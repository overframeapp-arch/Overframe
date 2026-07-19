/**
 * webview2_addon.cpp
 *
 * Node.js N-API addon that embeds Microsoft Edge WebView2 controls as child
 * windows of an Electron BrowserWindow HWND. One WebView2 environment is
 * shared across all tabs (one Edge process); each tab gets its own controller.
 *
 * Exposed JS API (see WebView2View.ts for the typed wrapper):
 *   wv2.createTab(parentHwndBuffer, x, y, w, h)  -> tabId (number)
 *   wv2.navigate(tabId, url)
 *   wv2.goBack(tabId) / goForward(tabId) / reload(tabId) / stop(tabId)
 *   wv2.setBounds(tabId, x, y, w, h)
 *   wv2.show(tabId) / hide(tabId)
 *   wv2.destroyTab(tabId)
 *   wv2.executeScript(tabId, js)                 -> Promise<string>
 *   wv2.setUserAgent(tabId, ua)
 *   wv2.setZoom(tabId, factor)
 *   wv2.setMuted(tabId, muted)
 *   wv2.getURL(tabId)                            -> string
 *   wv2.canGoBack(tabId) / canGoForward(tabId)   -> bool
 *   wv2.setEventCallback(cb)  -- cb(tabId, type, dataJson) for all tabs
 *
 * Events emitted via the callback (dataJson is a JSON string):
 *   { type: 'navigation_starting',  url, isRedirect }
 *   { type: 'navigation_completed', url, success, canGoBack, canGoForward }
 *   { type: 'history_changed',      canGoBack, canGoForward }
 *   { type: 'title_changed',        title }
 *   { type: 'new_window',           url }
 *   { type: 'zoom_changed',         factor }
 *   { type: 'audio_changed',        playing }
 *   { type: 'muted_changed',        muted }
 *   { type: 'download',             id, filename, url, receivedBytes, totalBytes, state }
 *   { type: 'fullscreen_changed',   active }
 *
 * Security: navigations to non-http(s)/about schemes are cancelled in
 * NavigationStarting (mirrors the old will-navigate protocol guard).
 */

#ifndef NOMINMAX
#define NOMINMAX
#endif
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <wrl/client.h>
#include <wrl/event.h>
#include <wrl/implements.h>
#include "WebView2.h"
#include "WebView2EnvironmentOptions.h"
#include <napi.h>
#include <atomic>
#include <map>
#include <mutex>
#include <set>
#include <string>
#include <vector>
#include <functional>
#include <shlwapi.h>
#include <shlobj.h>
#include <sstream>

#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "oleaut32.lib")

using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;

// CoreWebView2EnvironmentOptions is provided by WebView2EnvironmentOptions.h.
// It correctly initialises TargetCompatibleBrowserVersion to the SDK version
// string and ReleaseChannels to kAllChannels — both of which are required for
// CreateCoreWebView2EnvironmentWithOptions to succeed.

// ── Utilities ──────────────────────────────────────────────────────────────────

static std::wstring Utf8ToWide(const std::string& s) {
  if (s.empty()) return {};
  int sz = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, nullptr, 0);
  std::wstring out(sz, 0);
  MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, out.data(), sz);
  if (!out.empty() && out.back() == L'\0') out.pop_back();
  return out;
}

static std::string WideToUtf8(const std::wstring& s) {
  if (s.empty()) return {};
  int sz = WideCharToMultiByte(CP_UTF8, 0, s.c_str(), -1, nullptr, 0, nullptr, nullptr);
  std::string out(sz, 0);
  WideCharToMultiByte(CP_UTF8, 0, s.c_str(), -1, out.data(), sz, nullptr, nullptr);
  if (!out.empty() && out.back() == '\0') out.pop_back();
  return out;
}

// Escape a UTF-8 string for safe embedding inside a JSON string literal.
// Handles quotes, backslashes, and control characters (URLs/titles/paths can
// contain any of these — naive concatenation would produce invalid JSON).
static std::string JsonEscape(const std::string& s) {
  std::string out;
  out.reserve(s.size() + 8);
  for (unsigned char c : s) {
    switch (c) {
      case '"':  out += "\\\""; break;
      case '\\': out += "\\\\"; break;
      case '\n': out += "\\n";  break;
      case '\r': out += "\\r";  break;
      case '\t': out += "\\t";  break;
      default:
        if (c < 0x20) {
          char buf[8];
          snprintf(buf, sizeof buf, "\\u%04x", c);
          out += buf;
        } else {
          out += static_cast<char>(c);
        }
    }
  }
  return out;
}

// Last path component of a Windows or POSIX-style path.
static std::string BaseName(const std::string& p) {
  auto pos = p.find_last_of("\\/");
  return pos == std::string::npos ? p : p.substr(pos + 1);
}

// Security: only http(s) and about: navigations are permitted in a tab.
// Everything else (javascript:, data:, file:, mailto:, custom protocol
// handlers…) is cancelled in NavigationStarting — mirrors the will-navigate
// protocol guard the previous WebContentsView implementation enforced.
static bool IsAllowedNavScheme(const std::string& url) {
  auto pos = url.find(':');
  if (pos == std::string::npos) return true; // scheme-relative / fragment — allow
  std::string scheme = url.substr(0, pos);
  for (auto& c : scheme) c = static_cast<char>(tolower(static_cast<unsigned char>(c)));
  return scheme == "http" || scheme == "https" || scheme == "about";
}

// ── Global state ───────────────────────────────────────────────────────────────

struct TabEntry {
  ComPtr<ICoreWebView2Controller>  controller;
  ComPtr<ICoreWebView2>            webview;
  ComPtr<ICoreWebView2_4>          webview4; // downloads
  ComPtr<ICoreWebView2_8>          webview8; // mute / audio-playing
  HWND                             hwnd = nullptr;
  bool                             visible = true;
  std::string                      currentUrl;
  bool                             canGoBack    = false;
  bool                             canGoForward = false;
  double                           zoomFactor   = 1.0;

  // Event registration tokens
  EventRegistrationToken tokNavStarting{};
  EventRegistrationToken tokNavCompleted{};
  EventRegistrationToken tokProcessFailed{};
  EventRegistrationToken tokTitleChanged{};
  EventRegistrationToken tokNewWindow{};
  EventRegistrationToken tokHistoryChanged{};
  EventRegistrationToken tokZoomChanged{};
  EventRegistrationToken tokAudioPlaying{};
  EventRegistrationToken tokMutedChanged{};
  EventRegistrationToken tokDownloadStarting{};
  EventRegistrationToken tokGotFocus{};
  EventRegistrationToken tokFullscreen{};
};

static ComPtr<ICoreWebView2Environment> g_env;
static std::mutex                       g_tabsMutex;
static std::map<int, TabEntry>          g_tabs;
static std::atomic<int>                 g_nextTabId{1};
static std::atomic<int>                 g_nextDownloadId{1};
// 0=auto, 1=light, 2=dark — applied to the shared profile so prefers-color-scheme works correctly
static std::atomic<int>                 g_colorScheme{0};

// ── Browser extension state ────────────────────────────────────────────────────

static std::string g_pendingExtensionPath;             // extension folder path before first tab
static bool        g_pendingExtensionEnabled = false;  // desired enabled state for deferred load
static ComPtr<ICoreWebView2BrowserExtension> g_activeExtension; // retained for runtime enable/disable

// Resolved from CreateTab's controller-created callback once the deferred
// AddBrowserExtension+Enable calls (queued by addExtension() before any tab
// existed) genuinely complete. Non-null iff a caller is awaiting that result.
static Napi::Promise::Deferred*  g_pendingExtensionDeferred = nullptr;
static Napi::ThreadSafeFunction  g_pendingExtensionTsfn; // valid iff g_pendingExtensionDeferred != nullptr

// ── Pending NewWindowRequested deferrals — keyed by request ID.
// When NewWindowRequested fires we take a deferral and emit the request ID to JS.
// JS creates a new tab and calls completeNewWindow(reqId, newTabId) to provide the
// ICoreWebView2 as NewWindow, establishing window.opener in the popup page.
struct PendingNewWindow {
  ComPtr<ICoreWebView2NewWindowRequestedEventArgs> args;
  ComPtr<ICoreWebView2Deferral>                    deferral;
};
static std::map<int, PendingNewWindow> g_pendingNewWindows;
static std::atomic<int>               g_nextNewWindowId{1};

// ── Thread-safe JS callback ───────────────────────────────────────────────────

static Napi::ThreadSafeFunction g_tsfn;

struct EventPayload {
  int         tabId;
  std::string type;
  std::string data; // JSON string
};

static void CallJS(int tabId, const std::string& type, const std::string& data) {
  if (!g_tsfn) return;
  auto* ev = new EventPayload{tabId, type, data};
  g_tsfn.NonBlockingCall(ev, [](Napi::Env env, Napi::Function jsCallback, EventPayload* ev) {
    Napi::Object obj = Napi::Object::New(env);
    obj.Set("type", Napi::String::New(env, ev->type));
    // Parse the JSON data back into JS object
    Napi::Object dataObj = Napi::Object::New(env);
    // We use a simple key=value approach via the JSON string
    // evaluated in a Napi::Env context: just pass as string and parse in JS
    jsCallback.Call({
      Napi::Number::New(env, ev->tabId),
      Napi::String::New(env, ev->type),
      Napi::String::New(env, ev->data),
    });
    delete ev;
  });
}

// Emit a 'download' event mirroring the shared DownloadEvent shape
// ({ id, filename, url, receivedBytes, totalBytes, state }).
static void EmitDownload(int tabId, int downloadId, const std::string& filename,
                         const std::string& url, INT64 received, INT64 total,
                         const char* state) {
  std::string data =
    "{\"id\":\"" + std::to_string(downloadId) +
    "\",\"filename\":\"" + JsonEscape(filename) +
    "\",\"url\":\"" + JsonEscape(url) +
    "\",\"receivedBytes\":" + std::to_string(received < 0 ? 0 : received) +
    ",\"totalBytes\":" + std::to_string(total < 0 ? 0 : total) +
    ",\"state\":\"" + state + "\"}";
  CallJS(tabId, "download", data);
}

// ── Async helper: run on UI thread via PostMessage ─────────────────────────────

// WebView2 callbacks must run on the thread that created the webview (UI thread).
// For Promise-based methods (executeScript, getCookies, etc.) we use a
// simple Event + result-by-pointer pattern, blocking the thread-pool thread
// that Node uses for async work. This is safe because it's brief COM I/O.

// ── Environment creation ──────────────────────────────────────────────────────

static bool EnsureEnvironment(Napi::Env env) {
  if (g_env) return true;

  // Use the system-installed WebView2 runtime (Edge Stable/Beta/Dev)
  // userData in %APPDATA%\Overframe\WebView2
  std::wstring dataDir;
  {
    wchar_t buf[MAX_PATH];
    if (SUCCEEDED(SHGetFolderPathW(nullptr, CSIDL_APPDATA, nullptr, 0, buf))) {
      dataDir = std::wstring(buf) + L"\\Overframe\\WebView2";
    }
  }

  // Create the official Microsoft environment options object and enable
  // browser extensions.  CoreWebView2EnvironmentOptions initialises
  // TargetCompatibleBrowserVersion to the SDK version string and
  // ReleaseChannels to kAllChannels — both required for a successful call.
  auto optsMake = Microsoft::WRL::Make<CoreWebView2EnvironmentOptions>();
  optsMake->put_AreBrowserExtensionsEnabled(TRUE);
  ComPtr<ICoreWebView2EnvironmentOptions> opts = optsMake;

  // Helper: one synchronous attempt.  Pumps the message queue if the call
  // succeeds (async completion); returns the final HRESULT.
  auto tryCreate = [&](ICoreWebView2EnvironmentOptions* options) -> HRESULT {
    HRESULT hr = E_FAIL;
    HANDLE ready = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    HRESULT callHr = CreateCoreWebView2EnvironmentWithOptions(
      nullptr,
      dataDir.empty() ? nullptr : dataDir.c_str(),
      options,
      Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
        [&hr, ready](HRESULT res, ICoreWebView2Environment* envPtr) -> HRESULT {
          hr = res;
          if (SUCCEEDED(res) && envPtr) g_env = envPtr;
          SetEvent(ready);
          return S_OK;
        }).Get());
    if (SUCCEEDED(callHr)) {
      MSG msg;
      while (WaitForSingleObject(ready, 0) == WAIT_TIMEOUT) {
        if (PeekMessageW(&msg, nullptr, 0, 0, PM_REMOVE)) {
          TranslateMessage(&msg);
          DispatchMessageW(&msg);
        }
      }
    } else {
      hr = callHr; // synchronous failure — callback never fired
    }
    CloseHandle(ready);
    return hr;
  };

  HRESULT hr = tryCreate(opts.Get());

  // If the existing profile was created before AreBrowserExtensionsEnabled was
  // set, WebView2 returns E_INVALIDARG.  Build a unique backup name so we
  // never collide with a leftover backup from a previous migration.
  if (hr == E_INVALIDARG && !dataDir.empty()) {
    std::wstring backup = dataDir + L"_bak" + std::to_wstring(GetTickCount64());
    MoveFileExW(dataDir.c_str(), backup.c_str(), 0);
    hr = tryCreate(opts.Get());
  }

  if (FAILED(hr)) {
    Napi::TypeError::New(env, "CreateCoreWebView2EnvironmentWithOptions failed: " +
      std::to_string(hr)).ThrowAsJavaScriptException();
    return false;
  }
  if (!g_env) {
    Napi::TypeError::New(env, "WebView2 environment creation failed (hr=" +
      std::to_string(hr) + "). Is the WebView2 runtime installed?")
      .ThrowAsJavaScriptException();
    return false;
  }
  return true;
}

// ── CreateTab ─────────────────────────────────────────────────────────────────

Napi::Value CreateTab(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 5) {
    Napi::TypeError::New(env, "createTab(hwndBuf, x, y, w, h)").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (!EnsureEnvironment(env)) return env.Undefined();

  // Extract parent HWND from Buffer
  Napi::Buffer<uint8_t> hwndBuf = info[0].As<Napi::Buffer<uint8_t>>();
  HWND parentHwnd = *reinterpret_cast<HWND*>(hwndBuf.Data());
  int x = info[1].As<Napi::Number>().Int32Value();
  int y = info[2].As<Napi::Number>().Int32Value();
  int w = info[3].As<Napi::Number>().Int32Value();
  int h = info[4].As<Napi::Number>().Int32Value();

  int tabId = g_nextTabId.fetch_add(1);

  // Snapshot direct children of parentHwnd before creating the controller.
  // After creation we compare to find the new WebView2 host HWND.
  std::vector<HWND> childrenBefore;
  {
    HWND c = GetWindow(parentHwnd, GW_CHILD);
    while (c) { childrenBefore.push_back(c); c = GetWindow(c, GW_HWNDNEXT); }
  }

  HANDLE ready = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  HRESULT hr = E_FAIL;

  HRESULT createHr = g_env->CreateCoreWebView2Controller(
    parentHwnd,
    Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
      [&hr, &tabId, x, y, w, h, ready](
        HRESULT res, ICoreWebView2Controller* ctrl) -> HRESULT {
        hr = res;
        if (SUCCEEDED(res) && ctrl) {
          std::lock_guard<std::mutex> lk(g_tabsMutex);
          TabEntry& tab = g_tabs[tabId];
          tab.controller = ctrl;
          ctrl->get_CoreWebView2(&tab.webview);

          // If addExtension() was called before any tab existed, load it now.
          // If that call is being awaited (g_pendingExtensionDeferred), resolve it
          // once Enable() genuinely completes, instead of leaving it fire-and-forget.
          if (tab.webview && !g_pendingExtensionPath.empty()) {
            std::string extPath = std::exchange(g_pendingExtensionPath, {});
            bool extEnable = g_pendingExtensionEnabled;
            Napi::Promise::Deferred* pendingDef  = std::exchange(g_pendingExtensionDeferred, nullptr);
            Napi::ThreadSafeFunction  pendingTsfn = g_pendingExtensionTsfn;
            ComPtr<ICoreWebView2>         wvForReload = tab.webview;
            ComPtr<ICoreWebView2_13>      wv13ext;
            ComPtr<ICoreWebView2Profile>  profileExt;
            ComPtr<ICoreWebView2Profile7> profile7ext;
            bool gotProfile =
              SUCCEEDED(tab.webview.As(&wv13ext)) &&
              SUCCEEDED(wv13ext->get_Profile(&profileExt)) &&
              SUCCEEDED(profileExt.As(&profile7ext));
            if (gotProfile) {
              std::wstring wPath = Utf8ToWide(extPath);
              profile7ext->AddBrowserExtension(wPath.c_str(),
                Callback<ICoreWebView2ProfileAddBrowserExtensionCompletedHandler>(
                  [extEnable, pendingDef, pendingTsfn](
                    HRESULT hr, ICoreWebView2BrowserExtension* ext) mutable -> HRESULT {
                    if (SUCCEEDED(hr) && ext) {
                      g_activeExtension = ext;
                      // Always explicitly enable/disable. Edge marks side-loaded extensions
                      // with DISABLE_NOT_VERIFIED (disable_reasons=8192) — Enable() overrides it.
                      // No Reload() here: this path fires during first-tab creation, before any
                      // URL has been navigated to. Calling Reload() would cancel the pending
                      // Navigate() and leave the tab at about:blank. Content scripts inject
                      // normally on the first real page load.
                      ext->Enable(extEnable ? TRUE : FALSE,
                        Callback<ICoreWebView2BrowserExtensionEnableCompletedHandler>(
                          [pendingDef, pendingTsfn](HRESULT hr2) mutable -> HRESULT {
                            if (pendingDef) {
                              pendingTsfn.NonBlockingCall([hr2, pendingDef](Napi::Env e, Napi::Function) {
                                if (SUCCEEDED(hr2)) pendingDef->Resolve(e.Undefined());
                                else pendingDef->Reject(Napi::String::New(e, "Enable failed hr=" + std::to_string(hr2)));
                                delete pendingDef;
                              });
                              pendingTsfn.Release();
                            }
                            return S_OK;
                          }).Get());
                    } else if (pendingDef) {
                      pendingTsfn.NonBlockingCall([hr, pendingDef](Napi::Env e, Napi::Function) {
                        pendingDef->Reject(Napi::String::New(e, "AddBrowserExtension failed hr=" + std::to_string(hr)));
                        delete pendingDef;
                      });
                      pendingTsfn.Release();
                    }
                    return S_OK;
                  }).Get());
            } else if (pendingDef) {
              pendingTsfn.NonBlockingCall([pendingDef](Napi::Env e, Napi::Function) {
                pendingDef->Reject(Napi::String::New(e, "addExtension: failed to get WebView2 profile"));
                delete pendingDef;
              });
              pendingTsfn.Release();
            }
          }

          // Apply stored color scheme to the shared profile (prefers-color-scheme).
          // All tabs share one Edge profile so this only needs to be applied once,
          // but re-applying on each tab creation is harmless.
          if (tab.webview) {
            ComPtr<ICoreWebView2_13> wv13;
            if (SUCCEEDED(tab.webview.As(&wv13))) {
              ComPtr<ICoreWebView2Profile> profile;
              if (SUCCEEDED(wv13->get_Profile(&profile))) {
                ComPtr<ICoreWebView2Profile3> profile3;
                if (SUCCEEDED(profile.As(&profile3))) {
                  profile3->put_PreferredColorScheme(
                    static_cast<COREWEBVIEW2_PREFERRED_COLOR_SCHEME>(g_colorScheme.load()));
                }
              }
            }
          }

          // Size
          RECT bounds = {x, y, x + w, y + h};
          ctrl->put_Bounds(bounds);
          ctrl->put_IsVisible(TRUE);

          // Hook GotFocus — fires when the WebView2 controller receives input focus
          ctrl->add_GotFocus(
            Callback<ICoreWebView2FocusChangedEventHandler>(
              [tabId](ICoreWebView2Controller*, IUnknown*) -> HRESULT {
                CallJS(tabId, "got_focus", "{}");
                return S_OK;
              }).Get(), &tab.tokGotFocus);

          // Hook ContainsFullScreenElementChanged — fires when a page element enters
          // or exits fullscreen (e.g. a video player pressing its fullscreen button).
          // We relay this to JS so the overlay window can expand to cover the whole screen.
          tab.webview->add_ContainsFullScreenElementChanged(
            Callback<ICoreWebView2ContainsFullScreenElementChangedEventHandler>(
              [tabId](ICoreWebView2* wv, IUnknown*) -> HRESULT {
                BOOL active = FALSE;
                wv->get_ContainsFullScreenElement(&active);
                CallJS(tabId, "fullscreen_changed",
                  std::string("{\"active\":") + (active ? "true" : "false") + "}");
                return S_OK;
              }).Get(), &tab.tokFullscreen);

          // Hook NavigationStarting
          tab.webview->add_NavigationStarting(
            Callback<ICoreWebView2NavigationStartingEventHandler>(
              [tabId](ICoreWebView2* wv, ICoreWebView2NavigationStartingEventArgs* args) -> HRESULT {
                LPWSTR uriRaw = nullptr;
                args->get_Uri(&uriRaw);
                std::string url = uriRaw ? WideToUtf8(uriRaw) : "";
                CoTaskMemFree(uriRaw);
                // Security guard: cancel navigations to non-http(s)/about schemes.
                if (!IsAllowedNavScheme(url)) {
                  args->put_Cancel(TRUE);
                  return S_OK;
                }
                BOOL isRedir = FALSE;
                args->get_IsRedirected(&isRedir);
                std::string data = "{\"url\":\"" + JsonEscape(url) + "\",\"isRedirect\":" +
                  (isRedir ? "true" : "false") + "}";
                CallJS(tabId, "navigation_starting", data);
                return S_OK;
              }).Get(), &tab.tokNavStarting);

          // Hook NavigationCompleted
          tab.webview->add_NavigationCompleted(
            Callback<ICoreWebView2NavigationCompletedEventHandler>(
              [tabId](ICoreWebView2* wv, ICoreWebView2NavigationCompletedEventArgs* args) -> HRESULT {
                BOOL ok = FALSE;
                args->get_IsSuccess(&ok);
                LPWSTR uriRaw = nullptr;
                wv->get_Source(&uriRaw);
                std::string url = uriRaw ? WideToUtf8(uriRaw) : "";
                CoTaskMemFree(uriRaw);
                BOOL back = FALSE, fwd = FALSE;
                {
                  std::lock_guard<std::mutex> lk(g_tabsMutex);
                  auto it = g_tabs.find(tabId);
                  if (it != g_tabs.end()) {
                    it->second.currentUrl = url;
                    it->second.webview->get_CanGoBack(&back);
                    it->second.webview->get_CanGoForward(&fwd);
                    it->second.canGoBack    = !!back;
                    it->second.canGoForward = !!fwd;
                  }
                }
                std::string data = "{\"url\":\"" + JsonEscape(url) + "\",\"success\":" +
                  (ok ? "true" : "false") +
                  ",\"canGoBack\":" + (back ? "true" : "false") +
                  ",\"canGoForward\":" + (fwd ? "true" : "false") + "}";
                CallJS(tabId, "navigation_completed", data);
                return S_OK;
              }).Get(), &tab.tokNavCompleted);

          // Hook ProcessFailed — fires when the Edge renderer or browser process crashes.
          // NavigationCompleted won't fire in this case, leaving the tab stuck at isLoading=true.
          // Emitting process_failed lets JS clear that state so the user can reload.
          tab.webview->add_ProcessFailed(
            Callback<ICoreWebView2ProcessFailedEventHandler>(
              [tabId](ICoreWebView2* wv, ICoreWebView2ProcessFailedEventArgs* args) -> HRESULT {
                COREWEBVIEW2_PROCESS_FAILED_KIND kind = COREWEBVIEW2_PROCESS_FAILED_KIND_BROWSER_PROCESS_EXITED;
                args->get_ProcessFailedKind(&kind);
                CallJS(tabId, "process_failed", "{\"kind\":" + std::to_string(static_cast<int>(kind)) + "}");
                return S_OK;
              }).Get(), &tab.tokProcessFailed);

          // Hook TitleChanged
          tab.webview->add_DocumentTitleChanged(
            Callback<ICoreWebView2DocumentTitleChangedEventHandler>(
              [tabId](ICoreWebView2* wv, IUnknown*) -> HRESULT {
                LPWSTR titleRaw = nullptr;
                wv->get_DocumentTitle(&titleRaw);
                std::string title = titleRaw ? WideToUtf8(titleRaw) : "";
                CoTaskMemFree(titleRaw);
                CallJS(tabId, "title_changed", "{\"title\":\"" + JsonEscape(title) + "\"}");
                return S_OK;
              }).Get(), &tab.tokTitleChanged);

          // Hook HistoryChanged — fires AFTER NavigationCompleted with updated back/fwd state.
          // get_CanGoBack() called inside NavigationCompleted returns a stale value because
          // WebView2 updates the history after the handler returns.
          tab.webview->add_HistoryChanged(
            Callback<ICoreWebView2HistoryChangedEventHandler>(
              [tabId](ICoreWebView2* wv, IUnknown*) -> HRESULT {
                BOOL back = FALSE, fwd = FALSE;
                wv->get_CanGoBack(&back);
                wv->get_CanGoForward(&fwd);
                {
                  std::lock_guard<std::mutex> lk(g_tabsMutex);
                  auto it = g_tabs.find(tabId);
                  if (it != g_tabs.end()) {
                    it->second.canGoBack    = !!back;
                    it->second.canGoForward = !!fwd;
                  }
                }
                std::string data = "{\"canGoBack\":" + std::string(back ? "true" : "false") +
                                   ",\"canGoForward\":" + std::string(fwd ? "true" : "false") + "}";
                CallJS(tabId, "history_changed", data);
                return S_OK;
              }).Get(), &tab.tokHistoryChanged);

          // Hook NewWindowRequested — use a deferral so window.open() stays
          // pending until JS provides the new WebView2 controller.  This lets
          // the popup page's window.opener be set correctly (required for
          // OAuth flows like Google Sign-In that postMessage back to opener).
          tab.webview->add_NewWindowRequested(
            Callback<ICoreWebView2NewWindowRequestedEventHandler>(
              [tabId](ICoreWebView2* wv, ICoreWebView2NewWindowRequestedEventArgs* args) -> HRESULT {
                LPWSTR uriRaw = nullptr;
                args->get_Uri(&uriRaw);
                std::string url = uriRaw ? WideToUtf8(uriRaw) : "";
                CoTaskMemFree(uriRaw);

                // Take a deferral — window.open() in the content process stays
                // pending until CompleteNewWindow calls deferral->Complete().
                ComPtr<ICoreWebView2Deferral> deferral;
                args->GetDeferral(&deferral);

                int reqId = g_nextNewWindowId.fetch_add(1);
                {
                  std::lock_guard<std::mutex> lk(g_tabsMutex);
                  ComPtr<ICoreWebView2NewWindowRequestedEventArgs> argsPtr(args);
                  g_pendingNewWindows[reqId] = { argsPtr, deferral };
                }

                std::string data = "{\"url\":\"" + JsonEscape(url) +
                                   "\",\"reqId\":" + std::to_string(reqId) + "}";
                CallJS(tabId, "new_window", data);
                return S_OK;
              }).Get(), &tab.tokNewWindow);

          // ── Query the versioned interfaces used by zoom/mute/download ───────
          tab.webview.As(&tab.webview4); // ICoreWebView2_4 — downloads
          tab.webview.As(&tab.webview8); // ICoreWebView2_8 — mute / audio state

          // Hook ZoomFactorChanged (on the controller, not the webview).
          // Fires for native Ctrl+± / Ctrl+scroll zoom and for our put_ZoomFactor.
          ctrl->add_ZoomFactorChanged(
            Callback<ICoreWebView2ZoomFactorChangedEventHandler>(
              [tabId](ICoreWebView2Controller* c, IUnknown*) -> HRESULT {
                double z = 1.0;
                c->get_ZoomFactor(&z);
                {
                  std::lock_guard<std::mutex> lk(g_tabsMutex);
                  auto it = g_tabs.find(tabId);
                  if (it != g_tabs.end()) it->second.zoomFactor = z;
                }
                CallJS(tabId, "zoom_changed", "{\"factor\":" + std::to_string(z) + "}");
                return S_OK;
              }).Get(), &tab.tokZoomChanged);

          // Hook audio-playing + mute state (ICoreWebView2_8).
          if (tab.webview8) {
            tab.webview8->add_IsDocumentPlayingAudioChanged(
              Callback<ICoreWebView2IsDocumentPlayingAudioChangedEventHandler>(
                [tabId](ICoreWebView2* sender, IUnknown*) -> HRESULT {
                  ComPtr<ICoreWebView2> base(sender);
                  ComPtr<ICoreWebView2_8> wv8;
                  if (SUCCEEDED(base.As(&wv8)) && wv8) {
                    BOOL playing = FALSE;
                    wv8->get_IsDocumentPlayingAudio(&playing);
                    CallJS(tabId, "audio_changed",
                      std::string("{\"playing\":") + (playing ? "true" : "false") + "}");
                  }
                  return S_OK;
                }).Get(), &tab.tokAudioPlaying);

            tab.webview8->add_IsMutedChanged(
              Callback<ICoreWebView2IsMutedChangedEventHandler>(
                [tabId](ICoreWebView2* sender, IUnknown*) -> HRESULT {
                  ComPtr<ICoreWebView2> base(sender);
                  ComPtr<ICoreWebView2_8> wv8;
                  if (SUCCEEDED(base.As(&wv8)) && wv8) {
                    BOOL muted = FALSE;
                    wv8->get_IsMuted(&muted);
                    CallJS(tabId, "muted_changed",
                      std::string("{\"muted\":") + (muted ? "true" : "false") + "}");
                  }
                  return S_OK;
                }).Get(), &tab.tokMutedChanged);
          }

          // Hook DownloadStarting (ICoreWebView2_4). We keep WebView2's default
          // download UI; we only surface progress to the renderer for toasts.
          if (tab.webview4) {
            tab.webview4->add_DownloadStarting(
              Callback<ICoreWebView2DownloadStartingEventHandler>(
                [tabId](ICoreWebView2*, ICoreWebView2DownloadStartingEventArgs* args) -> HRESULT {
                  ComPtr<ICoreWebView2DownloadOperation> op;
                  args->get_DownloadOperation(&op);
                  if (!op) return S_OK;

                  int downloadId = g_nextDownloadId.fetch_add(1);

                  LPWSTR uriRaw = nullptr;
                  op->get_Uri(&uriRaw);
                  std::string url = uriRaw ? WideToUtf8(uriRaw) : "";
                  CoTaskMemFree(uriRaw);

                  LPWSTR pathRaw = nullptr;
                  op->get_ResultFilePath(&pathRaw);
                  std::string filename = pathRaw ? BaseName(WideToUtf8(pathRaw)) : "";
                  CoTaskMemFree(pathRaw);

                  INT64 total = 0;
                  op->get_TotalBytesToReceive(&total);

                  EmitDownload(tabId, downloadId, filename, url, 0, total, "started");

                  EventRegistrationToken tok{};
                  op->add_BytesReceivedChanged(
                    Callback<ICoreWebView2BytesReceivedChangedEventHandler>(
                      [tabId, downloadId, filename, url](
                        ICoreWebView2DownloadOperation* o, IUnknown*) -> HRESULT {
                        INT64 recv = 0, tot = 0;
                        o->get_BytesReceived(&recv);
                        o->get_TotalBytesToReceive(&tot);
                        EmitDownload(tabId, downloadId, filename, url, recv, tot, "progressing");
                        return S_OK;
                      }).Get(), &tok);

                  op->add_StateChanged(
                    Callback<ICoreWebView2StateChangedEventHandler>(
                      [tabId, downloadId, filename, url](
                        ICoreWebView2DownloadOperation* o, IUnknown*) -> HRESULT {
                        COREWEBVIEW2_DOWNLOAD_STATE st = COREWEBVIEW2_DOWNLOAD_STATE_IN_PROGRESS;
                        o->get_State(&st);
                        INT64 recv = 0, tot = 0;
                        o->get_BytesReceived(&recv);
                        o->get_TotalBytesToReceive(&tot);
                        const char* state =
                          st == COREWEBVIEW2_DOWNLOAD_STATE_COMPLETED   ? "completed" :
                          st == COREWEBVIEW2_DOWNLOAD_STATE_INTERRUPTED ? "interrupted" :
                                                                          "progressing";
                        EmitDownload(tabId, downloadId, filename, url, recv, tot, state);
                        return S_OK;
                      }).Get(), &tok);

                  return S_OK;
                }).Get(), &tab.tokDownloadStarting);
          }
        }
        SetEvent(ready);
        return S_OK;
      }).Get());

  if (FAILED(createHr)) {
    CloseHandle(ready);
    Napi::TypeError::New(env, "CreateCoreWebView2Controller failed").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  MSG msg;
  while (WaitForSingleObject(ready, 0) == WAIT_TIMEOUT) {
    if (PeekMessageW(&msg, nullptr, 0, 0, PM_REMOVE)) {
      TranslateMessage(&msg);
      DispatchMessageW(&msg);
    }
  }
  CloseHandle(ready);

  if (FAILED(hr)) {
    Napi::TypeError::New(env, "WebView2 controller creation failed: hr=" +
      std::to_string(hr)).ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Find the WebView2 host HWND: the first new direct child of parentHwnd
  // added since we took the snapshot. New windows are placed at the top of
  // the Z-order by default, so we scan from the top.
  {
    std::lock_guard<std::mutex> lk(g_tabsMutex);
    auto& tab = g_tabs[tabId];
    HWND c = GetWindow(parentHwnd, GW_CHILD);
    while (c) {
      bool wasExisting = false;
      for (auto e : childrenBefore) { if (e == c) { wasExisting = true; break; } }
      if (!wasExisting) { tab.hwnd = c; break; }
      c = GetWindow(c, GW_HWNDNEXT);
    }
  }

  return Napi::Number::New(env, tabId);
}

// ── Navigate ──────────────────────────────────────────────────────────────────

Napi::Value Navigate(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int tabId = info[0].As<Napi::Number>().Int32Value();
  std::string url = info[1].As<Napi::String>().Utf8Value();
  std::lock_guard<std::mutex> lk(g_tabsMutex);
  auto it = g_tabs.find(tabId);
  if (it != g_tabs.end() && it->second.webview) {
    it->second.webview->Navigate(Utf8ToWide(url).c_str());
  }
  return env.Undefined();
}

Napi::Value GoBack(const Napi::CallbackInfo& info) {
  int tabId = info[0].As<Napi::Number>().Int32Value();
  std::lock_guard<std::mutex> lk(g_tabsMutex);
  auto it = g_tabs.find(tabId);
  if (it != g_tabs.end() && it->second.webview) it->second.webview->GoBack();
  return info.Env().Undefined();
}

Napi::Value GoForward(const Napi::CallbackInfo& info) {
  int tabId = info[0].As<Napi::Number>().Int32Value();
  std::lock_guard<std::mutex> lk(g_tabsMutex);
  auto it = g_tabs.find(tabId);
  if (it != g_tabs.end() && it->second.webview) it->second.webview->GoForward();
  return info.Env().Undefined();
}

Napi::Value Reload(const Napi::CallbackInfo& info) {
  int tabId = info[0].As<Napi::Number>().Int32Value();
  std::lock_guard<std::mutex> lk(g_tabsMutex);
  auto it = g_tabs.find(tabId);
  if (it != g_tabs.end() && it->second.webview) it->second.webview->Reload();
  return info.Env().Undefined();
}

Napi::Value Stop(const Napi::CallbackInfo& info) {
  int tabId = info[0].As<Napi::Number>().Int32Value();
  std::lock_guard<std::mutex> lk(g_tabsMutex);
  auto it = g_tabs.find(tabId);
  if (it != g_tabs.end() && it->second.webview) it->second.webview->Stop();
  return info.Env().Undefined();
}

// ── SetBounds / Show / Hide ───────────────────────────────────────────────────

Napi::Value SetBounds(const Napi::CallbackInfo& info) {
  int tabId = info[0].As<Napi::Number>().Int32Value();
  int x = info[1].As<Napi::Number>().Int32Value();
  int y = info[2].As<Napi::Number>().Int32Value();
  int w = info[3].As<Napi::Number>().Int32Value();
  int h = info[4].As<Napi::Number>().Int32Value();
  std::lock_guard<std::mutex> lk(g_tabsMutex);
  auto it = g_tabs.find(tabId);
  if (it != g_tabs.end() && it->second.controller) {
    RECT bounds = {x, y, x + w, y + h};
    it->second.controller->put_Bounds(bounds);
    // NOTE: do NOT call SetWindowPos(HWND_TOP) here during initial layout —
    // before the WebView2 child HWND is fully parented, re-ordering Z-order
    // triggers a WM_WINDOWPOSCHANGED/focus cascade that makes Electron's Chromium
    // call GetWindowClassName on a half-initialised sibling HWND →
    // hwnd_util PLOG(FATAL) 1400 at startup.
    // BUT: after a native window resize, Electron's compositor may reorder its
    // internal HWNDs, pushing WebView2 below the transparent Electron renderer
    // HWND so clicks no longer reach it. Re-assert Z-order here, guarded by
    // visible==true (set in Show()) which guarantees the HWND is fully parented.
    if (it->second.visible && it->second.hwnd) {
      SetWindowPos(it->second.hwnd, HWND_TOP, 0, 0, 0, 0,
                   SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
    }
  }
  return info.Env().Undefined();
}

Napi::Value Show(const Napi::CallbackInfo& info) {
  int tabId = info[0].As<Napi::Number>().Int32Value();
  std::lock_guard<std::mutex> lk(g_tabsMutex);
  auto it = g_tabs.find(tabId);
  if (it != g_tabs.end() && it->second.controller) {
    it->second.controller->put_IsVisible(TRUE);
    it->second.visible = true;
    // Bring the WebView2 host HWND above Electron's Chromium renderer HWND
    // so Win32 delivers mouse events (clicks, scroll) to it rather than the
    // transparent Electron renderer that sits in front otherwise.
    if (it->second.hwnd) {
      SetWindowPos(it->second.hwnd, HWND_TOP, 0, 0, 0, 0,
                   SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
    }
  }
  return info.Env().Undefined();
}

Napi::Value Hide(const Napi::CallbackInfo& info) {
  int tabId = info[0].As<Napi::Number>().Int32Value();
  std::lock_guard<std::mutex> lk(g_tabsMutex);
  auto it = g_tabs.find(tabId);
  if (it != g_tabs.end() && it->second.controller) {
    it->second.controller->put_IsVisible(FALSE);
    it->second.visible = false;
  }
  return info.Env().Undefined();
}

// ── DestroyTab ────────────────────────────────────────────────────────────────

Napi::Value DestroyTab(const Napi::CallbackInfo& info) {
  int tabId = info[0].As<Napi::Number>().Int32Value();
  std::lock_guard<std::mutex> lk(g_tabsMutex);
  auto it = g_tabs.find(tabId);
  if (it != g_tabs.end()) {
    if (it->second.webview) {
      it->second.webview->remove_NavigationStarting(it->second.tokNavStarting);
      it->second.webview->remove_NavigationCompleted(it->second.tokNavCompleted);
      it->second.webview->remove_ProcessFailed(it->second.tokProcessFailed);
      it->second.webview->remove_DocumentTitleChanged(it->second.tokTitleChanged);
      it->second.webview->remove_NewWindowRequested(it->second.tokNewWindow);
      it->second.webview->remove_HistoryChanged(it->second.tokHistoryChanged);
      it->second.webview->remove_ContainsFullScreenElementChanged(it->second.tokFullscreen);
    }
    if (it->second.webview8) {
      it->second.webview8->remove_IsDocumentPlayingAudioChanged(it->second.tokAudioPlaying);
      it->second.webview8->remove_IsMutedChanged(it->second.tokMutedChanged);
    }
    if (it->second.webview4) {
      it->second.webview4->remove_DownloadStarting(it->second.tokDownloadStarting);
    }
    if (it->second.controller) {
      it->second.controller->remove_ZoomFactorChanged(it->second.tokZoomChanged);
      it->second.controller->remove_GotFocus(it->second.tokGotFocus);
      it->second.controller->Close();
    }
    g_tabs.erase(it);
  }
  return info.Env().Undefined();
}

// ── ExecuteScript (async) ─────────────────────────────────────────────────────

Napi::Value ExecuteScript(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int tabId = info[0].As<Napi::Number>().Int32Value();
  std::string js = info[1].As<Napi::String>().Utf8Value();

  auto deferred = Napi::Promise::Deferred::New(env);
  auto* def = new Napi::Promise::Deferred(deferred);

  ComPtr<ICoreWebView2> wv;
  {
    std::lock_guard<std::mutex> lk(g_tabsMutex);
    auto it = g_tabs.find(tabId);
    if (it != g_tabs.end()) wv = it->second.webview;
  }
  if (!wv) {
    deferred.Reject(Napi::String::New(env, "tab not found"));
    return deferred.Promise();
  }

  // We need a thread-safe function to resolve the promise
  auto tsfn = Napi::ThreadSafeFunction::New(
    env, Napi::Function::New(env, [](const Napi::CallbackInfo&){}),
    "execScript", 0, 1);

  struct ScriptResult { bool ok; std::string value; };
  auto* res = new ScriptResult{};

  wv->ExecuteScript(Utf8ToWide(js).c_str(),
    Callback<ICoreWebView2ExecuteScriptCompletedHandler>(
      [tsfn, def, res](HRESULT hr, LPCWSTR resultJson) mutable -> HRESULT {
        res->ok = SUCCEEDED(hr);
        res->value = resultJson ? WideToUtf8(resultJson) : "null";
        tsfn.NonBlockingCall(res, [def](Napi::Env env, Napi::Function, ScriptResult* r) {
          if (r->ok) def->Resolve(Napi::String::New(env, r->value));
          else       def->Reject(Napi::String::New(env, "ExecuteScript failed"));
          delete r;
          delete def;
        });
        tsfn.Release();
        return S_OK;
      }).Get());

  return deferred.Promise();
}

// ── GetURL / CanGoBack / CanGoForward ─────────────────────────────────────────

Napi::Value GetURL(const Napi::CallbackInfo& info) {
  int tabId = info[0].As<Napi::Number>().Int32Value();
  std::lock_guard<std::mutex> lk(g_tabsMutex);
  auto it = g_tabs.find(tabId);
  std::string url = (it != g_tabs.end()) ? it->second.currentUrl : "";
  return Napi::String::New(info.Env(), url);
}

Napi::Value CanGoBack(const Napi::CallbackInfo& info) {
  int tabId = info[0].As<Napi::Number>().Int32Value();
  std::lock_guard<std::mutex> lk(g_tabsMutex);
  auto it = g_tabs.find(tabId);
  return Napi::Boolean::New(info.Env(), it != g_tabs.end() && it->second.canGoBack);
}

Napi::Value CanGoForward(const Napi::CallbackInfo& info) {
  int tabId = info[0].As<Napi::Number>().Int32Value();
  std::lock_guard<std::mutex> lk(g_tabsMutex);
  auto it = g_tabs.find(tabId);
  return Napi::Boolean::New(info.Env(), it != g_tabs.end() && it->second.canGoForward);
}

// ── SetUserAgent ──────────────────────────────────────────────────────────────

Napi::Value SetUserAgent(const Napi::CallbackInfo& info) {
  int tabId = info[0].As<Napi::Number>().Int32Value();
  std::string ua = info[1].As<Napi::String>().Utf8Value();
  std::lock_guard<std::mutex> lk(g_tabsMutex);
  auto it = g_tabs.find(tabId);
  if (it != g_tabs.end() && it->second.webview) {
    ComPtr<ICoreWebView2Settings> settings;
    if (SUCCEEDED(it->second.webview->get_Settings(&settings))) {
      ComPtr<ICoreWebView2Settings2> settings2;
      if (SUCCEEDED(settings.As(&settings2))) {
        settings2->put_UserAgent(Utf8ToWide(ua).c_str());
      }
    }
  }
  return info.Env().Undefined();
}

// ── SetZoom ───────────────────────────────────────────────────────────────────

Napi::Value SetZoom(const Napi::CallbackInfo& info) {
  int tabId = info[0].As<Napi::Number>().Int32Value();
  double factor = info[1].As<Napi::Number>().DoubleValue();
  std::lock_guard<std::mutex> lk(g_tabsMutex);
  auto it = g_tabs.find(tabId);
  if (it != g_tabs.end() && it->second.controller) {
    it->second.controller->put_ZoomFactor(factor);
  }
  return info.Env().Undefined();
}

// ── SetMuted ──────────────────────────────────────────────────────────────────

Napi::Value SetMuted(const Napi::CallbackInfo& info) {
  int tabId = info[0].As<Napi::Number>().Int32Value();
  bool muted = info[1].As<Napi::Boolean>().Value();
  std::lock_guard<std::mutex> lk(g_tabsMutex);
  auto it = g_tabs.find(tabId);
  if (it != g_tabs.end() && it->second.webview8) {
    it->second.webview8->put_IsMuted(muted ? TRUE : FALSE);
  }
  return info.Env().Undefined();
}

// ── CompleteNewWindow ─────────────────────────────────────────────────────────
// Called by JS after creating the new tab for a popup.
// Sets the new WebView2 as NewWindow on the deferred args so window.open()
// returns a proper window reference with window.opener set.
// newTabId <= 0 means "block the popup" (window.open returns null).

Napi::Value CompleteNewWindow(const Napi::CallbackInfo& info) {
  int reqId    = info[0].As<Napi::Number>().Int32Value();
  int newTabId = info[1].As<Napi::Number>().Int32Value();

  ComPtr<ICoreWebView2NewWindowRequestedEventArgs> args;
  ComPtr<ICoreWebView2Deferral>                    deferral;
  ComPtr<ICoreWebView2>                            newWebView;

  {
    std::lock_guard<std::mutex> lk(g_tabsMutex);
    auto reqIt = g_pendingNewWindows.find(reqId);
    if (reqIt != g_pendingNewWindows.end()) {
      args    = reqIt->second.args;
      deferral = reqIt->second.deferral;
      g_pendingNewWindows.erase(reqIt);
    }
    if (newTabId > 0) {
      auto tabIt = g_tabs.find(newTabId);
      if (tabIt != g_tabs.end()) newWebView = tabIt->second.webview;
    }
  }

  if (args && deferral) {
    if (newWebView) {
      args->put_NewWindow(newWebView.Get());
      args->put_Handled(TRUE);
    } else {
      args->put_Handled(TRUE); // block — window.open() returns null
    }
    deferral->Complete();
  }

  return info.Env().Undefined();
}

// ── SetEventCallback ──────────────────────────────────────────────────────────

Napi::Value SetEventCallback(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (g_tsfn) g_tsfn.Release();
  Napi::Function cb = info[0].As<Napi::Function>();
  g_tsfn = Napi::ThreadSafeFunction::New(env, cb, "wv2events", 0, 1);
  return env.Undefined();
}

// ── ClaimFocus ────────────────────────────────────────────────────────────────
// Gives OS keyboard focus to the Electron/Chromium render widget HWND by
// enumerating the overlay window's direct child HWNDs and calling SetFocus()
// on the first one that is NOT a WebView2 controller HWND we manage.
// This is necessary because webContents.focus() / BrowserWindow.focus() do not
// call ::SetFocus() at the Win32 level when the overlay is already the foreground
// window — so keyboard input stays on Edge's HWND even after clicking the chrome.

Napi::Value ClaimFocus(const Napi::CallbackInfo& info) {
  Napi::Buffer<uint8_t> hwndBuf = info[0].As<Napi::Buffer<uint8_t>>();
  HWND parentHwnd = *reinterpret_cast<HWND*>(hwndBuf.Data());

  // Collect every HWND we must NOT focus: the WebView2 hosts (+ descendants) and
  // any embedded companion window passed as info[1] (the IG promo child, which has
  // its own Chrome_RenderWidgetHostHWND — without this we'd steal focus to the
  // promo and the address bar could no longer be typed into).
  std::set<HWND> skip;
  {
    std::lock_guard<std::mutex> lk(g_tabsMutex);
    for (auto& [id, tab] : g_tabs) {
      if (!tab.hwnd) continue;
      skip.insert(tab.hwnd);
      EnumChildWindows(tab.hwnd, [](HWND h, LPARAM lp) -> BOOL {
        reinterpret_cast<std::set<HWND>*>(lp)->insert(h);
        return TRUE;
      }, reinterpret_cast<LPARAM>(&skip));
    }
  }
  // Any number of additional buffers (info[1..]) are companion windows to skip
  // (the embedded IG promo + achievement children, each with their own widget).
  for (size_t i = 1; i < info.Length(); ++i) {
    if (!info[i].IsBuffer()) continue;
    HWND exclude = *reinterpret_cast<HWND*>(info[i].As<Napi::Buffer<uint8_t>>().Data());
    if (!exclude) continue;
    skip.insert(exclude);
    EnumChildWindows(exclude, [](HWND h, LPARAM lp) -> BOOL {
      reinterpret_cast<std::set<HWND>*>(lp)->insert(h);
      return TRUE;
    }, reinterpret_cast<LPARAM>(&skip));
  }

  // Search ALL descendants of the overlay for the Chromium render widget HWND.
  // Its Win32 class is "Chrome_RenderWidgetHostHWND" in all Electron versions.
  struct Ctx { HWND result; std::set<HWND>* skip; };
  Ctx ctx = {nullptr, &skip};

  EnumChildWindows(parentHwnd, [](HWND hwnd, LPARAM lp) -> BOOL {
    auto* c = reinterpret_cast<Ctx*>(lp);
    if (c->skip->count(hwnd)) return TRUE; // skip WebView2 / embedded-promo HWNDs
    char cls[256] = {};
    GetClassNameA(hwnd, cls, sizeof(cls));
    if (strstr(cls, "RenderWidgetHostHWND") != nullptr) {
      c->result = hwnd;
      return FALSE; // stop on first match
    }
    return TRUE;
  }, reinterpret_cast<LPARAM>(&ctx));

  // If found, SetFocus to the render widget; otherwise fall back to the frame HWND.
  SetFocus(ctx.result ? ctx.result : parentHwnd);

  return info.Env().Undefined();
}

// ── Child-window embedding (IG promo) ─────────────────────────────────────────
// Re-parents an Electron BrowserWindow's HWND as a WS_CHILD of the overlay's
// top-level HWND (the same parent the WebView2 hosts use). As a child it is
// clipped to the overlay client area and moves / Z-orders as part of it — it is
// NO LONGER a separate top-level window with its own activation. That removes the
// cross-window focus cascade that the overlay's Alt+B hide/show (app.focus steal
// + moveTop + setAlwaysOnTop) triggered when a separate always-on-top promo
// window coexisted with it → ui/gfx/win/hwnd_util.cc GetClassName FATAL 1400.

Napi::Value AttachChildWindow(const Napi::CallbackInfo& info) {
  HWND child  = *reinterpret_cast<HWND*>(info[0].As<Napi::Buffer<uint8_t>>().Data());
  HWND parent = *reinterpret_cast<HWND*>(info[1].As<Napi::Buffer<uint8_t>>().Data());
  if (!IsWindow(child) || !IsWindow(parent))
    return Napi::Boolean::New(info.Env(), false);

  // WS_POPUP → WS_CHILD. Keep WS_EX_NOACTIVATE / WS_EX_LAYERED (set by Electron
  // for focusable:false + transparent) so the child never steals activation.
  LONG_PTR style = GetWindowLongPtrW(child, GWL_STYLE);
  style = (style & ~static_cast<LONG_PTR>(WS_POPUP)) | WS_CHILD;
  SetWindowLongPtrW(child, GWL_STYLE, style);
  SetParent(child, parent);
  ShowWindow(child, SW_HIDE);   // stay hidden until JS reveals it
  return Napi::Boolean::New(info.Env(), true);
}

// Position the embedded child in PARENT-CLIENT coordinates and toggle its
// visibility. HWND_TOP raises it above the WebView2 sibling; SWP_NOACTIVATE keeps
// it out of the activation path; show/hide of a *child* posts no WM_ACTIVATE, so
// (unlike a top-level Show/Hide) it cannot interleave with the overlay cascade.

Napi::Value SetChildWindowBounds(const Napi::CallbackInfo& info) {
  HWND child   = *reinterpret_cast<HWND*>(info[0].As<Napi::Buffer<uint8_t>>().Data());
  int  x       = info[1].As<Napi::Number>().Int32Value();
  int  y       = info[2].As<Napi::Number>().Int32Value();
  int  w       = info[3].As<Napi::Number>().Int32Value();
  int  h       = info[4].As<Napi::Number>().Int32Value();
  bool visible = info[5].As<Napi::Boolean>().Value();
  if (!IsWindow(child)) return info.Env().Undefined();

  UINT flags = SWP_NOACTIVATE | SWP_NOOWNERZORDER |
               (visible ? SWP_SHOWWINDOW : SWP_HIDEWINDOW);
  SetWindowPos(child, HWND_TOP, x, y, w, h, flags);

  // Straight edges (no region): a Win32 window region is 1-bit, so rounded
  // corners come out jagged/aliased. An embedded child can't do antialiased
  // (transparency-backed) rounding, so we keep clean straight edges instead.
  // Clear any region a previous build may have left on the window.
  SetWindowRgn(child, nullptr, TRUE);
  return info.Env().Undefined();
}

// ── SetColorScheme ─────────────────────────────────────────────────────────────
// Sets the Edge profile's PreferredColorScheme so that prefers-color-scheme
// media queries in all WebView2 tabs reflect the app's dark/light preference.
// scheme: 0=auto (follow OS), 1=light, 2=dark

Napi::Value SetColorScheme(const Napi::CallbackInfo& info) {
  int scheme = info[0].As<Napi::Number>().Int32Value();
  g_colorScheme.store(scheme);
  std::lock_guard<std::mutex> lk(g_tabsMutex);
  for (auto& [id, tab] : g_tabs) {
    if (!tab.webview) continue;
    ComPtr<ICoreWebView2_13> wv13;
    if (SUCCEEDED(tab.webview.As(&wv13))) {
      ComPtr<ICoreWebView2Profile> profile;
      if (SUCCEEDED(wv13->get_Profile(&profile))) {
        ComPtr<ICoreWebView2Profile3> profile3;
        if (SUCCEEDED(profile.As(&profile3))) {
          profile3->put_PreferredColorScheme(
            static_cast<COREWEBVIEW2_PREFERRED_COLOR_SCHEME>(scheme));
        }
      }
    }
    break; // all tabs share the same profile — one call is enough
  }
  return info.Env().Undefined();
}

// ── AddExtension (async) ──────────────────────────────────────────────────────
// Installs a browser extension from an unpacked folder into the shared Edge profile,
// then explicitly enables or disables it per `enabled`.
// If the extension is already installed (ERROR_FILE_EXISTS), the call is idempotent:
// it falls back to Enable/Disable on the existing handle rather than rejecting.
// If no tab exists yet the call is deferred: the path+state are stored and applied
// when the first tab is created, and the returned Promise resolves once that deferred
// AddBrowserExtension+Enable actually completes (see CreateTab). Same when tabs
// already exist — the Promise always tracks genuine completion, never an early return.

Napi::Value AddExtension(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsString() || !info[1].IsBoolean()) {
    Napi::TypeError::New(env, "addExtension(path, enabled)").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  std::string extPath = info[0].As<Napi::String>().Utf8Value();
  bool enable = info[1].As<Napi::Boolean>().Value();

  auto deferred = Napi::Promise::Deferred::New(env);

  ComPtr<ICoreWebView2> wv;
  {
    std::lock_guard<std::mutex> lk(g_tabsMutex);
    if (!g_tabs.empty()) wv = g_tabs.begin()->second.webview;
  }

  if (!wv) {
    // No tabs yet — store for deferred loading on first CreateTab. Resolved later,
    // from CreateTab's controller-created callback, once AddBrowserExtension+Enable
    // genuinely complete (see g_pendingExtensionDeferred there) rather than here.
    //
    // A previous pre-first-tab call may still be parked (e.g. the startup install
    // followed by an adBlockEnabled settings toggle before any tab exists). Reject
    // it — not resolve — so callers sequencing follow-up work on genuine install
    // completion (the filter-list migration in main/index.ts) don't run against an
    // install that never happened. We are on the JS thread here, so settling the
    // parked deferred directly is safe.
    if (g_pendingExtensionDeferred) {
      g_pendingExtensionDeferred->Reject(
        Napi::String::New(env, "addExtension superseded by a newer call"));
      delete g_pendingExtensionDeferred;
      g_pendingExtensionDeferred = nullptr;
      g_pendingExtensionTsfn.Release();
    }
    g_pendingExtensionPath    = extPath;
    g_pendingExtensionEnabled = enable;
    g_pendingExtensionDeferred = new Napi::Promise::Deferred(deferred);
    g_pendingExtensionTsfn = Napi::ThreadSafeFunction::New(
      env, Napi::Function::New(env, [](const Napi::CallbackInfo&){}),
      "addExtensionPending", 0, 1);
    return deferred.Promise();
  }

  ComPtr<ICoreWebView2_13>      wv13;
  ComPtr<ICoreWebView2Profile>  profile;
  ComPtr<ICoreWebView2Profile7> profile7;
  if (FAILED(wv.As(&wv13)) ||
      FAILED(wv13->get_Profile(&profile)) ||
      FAILED(profile.As(&profile7))) {
    deferred.Reject(Napi::String::New(env, "addExtension: failed to get WebView2 profile"));
    return deferred.Promise();
  }

  auto* def  = new Napi::Promise::Deferred(deferred);
  auto  tsfn = Napi::ThreadSafeFunction::New(
    env, Napi::Function::New(env, [](const Napi::CallbackInfo&){}),
    "addExtension", 0, 1);

  std::wstring wPath = Utf8ToWide(extPath);
  profile7->AddBrowserExtension(wPath.c_str(),
    Callback<ICoreWebView2ProfileAddBrowserExtensionCompletedHandler>(
      [tsfn, def, enable](HRESULT hr, ICoreWebView2BrowserExtension* ext) mutable -> HRESULT {
        // Resolve the extension handle: newly installed, or existing (ERROR_FILE_EXISTS).
        ICoreWebView2BrowserExtension* target = nullptr;
        if (SUCCEEDED(hr) && ext) {
          g_activeExtension = ext;
          target = ext;
        } else if (hr == HRESULT_FROM_WIN32(ERROR_FILE_EXISTS) && g_activeExtension) {
          target = g_activeExtension.Get();
        }

        if (!target) {
          tsfn.NonBlockingCall([hr, def](Napi::Env e, Napi::Function) {
            def->Reject(Napi::String::New(e, "AddBrowserExtension failed hr=" + std::to_string(hr)));
            delete def;
          });
          tsfn.Release();
          return S_OK;
        }

        // Always explicitly enable/disable. Edge marks side-loaded extensions with
        // DISABLE_NOT_VERIFIED (disable_reasons=8192); Enable(TRUE) overrides this.
        target->Enable(enable ? TRUE : FALSE,
          Callback<ICoreWebView2BrowserExtensionEnableCompletedHandler>(
            [tsfn, def](HRESULT hr2) mutable -> HRESULT {
              tsfn.NonBlockingCall([hr2, def](Napi::Env e, Napi::Function) {
                if (SUCCEEDED(hr2)) def->Resolve(e.Undefined());
                else def->Reject(Napi::String::New(e, "Enable failed hr=" + std::to_string(hr2)));
                delete def;
              });
              tsfn.Release();
              return S_OK;
            }).Get());
        return S_OK;
      }).Get());

  return deferred.Promise();
}

// ── SetExtensionEnabled (async) ───────────────────────────────────────────────
// Runtime toggle for the extension loaded via addExtension().
// If the extension hasn't been installed yet (pending deferred), only the
// desired state is updated (applied at first CreateTab time).

Napi::Value SetExtensionEnabled(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsBoolean()) {
    Napi::TypeError::New(env, "setExtensionEnabled(enabled)").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  bool enable = info[0].As<Napi::Boolean>().Value();

  auto deferred = Napi::Promise::Deferred::New(env);

  if (!g_pendingExtensionPath.empty()) {
    // Extension deferred — just update desired state
    g_pendingExtensionEnabled = enable;
    deferred.Resolve(env.Undefined());
    return deferred.Promise();
  }

  if (!g_activeExtension) {
    deferred.Resolve(env.Undefined()); // no extension — no-op
    return deferred.Promise();
  }

  auto* def  = new Napi::Promise::Deferred(deferred);
  auto  tsfn = Napi::ThreadSafeFunction::New(
    env, Napi::Function::New(env, [](const Napi::CallbackInfo&){}),
    "setExtensionEnabled", 0, 1);

  g_activeExtension->Enable(enable ? TRUE : FALSE,
    Callback<ICoreWebView2BrowserExtensionEnableCompletedHandler>(
      [tsfn, def](HRESULT hr) mutable -> HRESULT {
        tsfn.NonBlockingCall([hr, def](Napi::Env e, Napi::Function) {
          if (SUCCEEDED(hr)) def->Resolve(e.Undefined());
          else def->Reject(Napi::String::New(e, "Enable failed hr=" + std::to_string(hr)));
          delete def;
        });
        tsfn.Release();
        return S_OK;
      }).Get());

  return deferred.Promise();
}

// ── RemoveExtension (async) ──────────────────────────────────────────────────
// Fully uninstalls the extension loaded via addExtension(), wiping its
// storage.local/IndexedDB (filter list selection, whitelist, custom rules)
// along with it. Used as a one-time migration path: existing profiles keep
// whatever filter lists were selected on their first run, so shipping a new
// default selection (see download-ublock.mjs) only reaches them by uninstalling
// once and letting the caller reinstall via addExtension() — which then
// re-triggers uBlock's first-run default-list selection. No-op if nothing is
// currently installed (a subsequent addExtension() call will install fresh).
Napi::Value RemoveExtension(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  auto deferred = Napi::Promise::Deferred::New(env);

  ComPtr<ICoreWebView2BrowserExtension> ext = g_activeExtension;
  if (!ext) {
    deferred.Resolve(env.Undefined());
    return deferred.Promise();
  }

  auto* def  = new Napi::Promise::Deferred(deferred);
  auto  tsfn = Napi::ThreadSafeFunction::New(
    env, Napi::Function::New(env, [](const Napi::CallbackInfo&){}),
    "removeExtension", 0, 1);

  ext->Remove(
    Callback<ICoreWebView2BrowserExtensionRemoveCompletedHandler>(
      [tsfn, def](HRESULT hr) mutable -> HRESULT {
        g_activeExtension = nullptr;
        tsfn.NonBlockingCall([hr, def](Napi::Env e, Napi::Function) {
          if (SUCCEEDED(hr)) def->Resolve(e.Undefined());
          else def->Reject(Napi::String::New(e, "Remove failed hr=" + std::to_string(hr)));
          delete def;
        });
        tsfn.Release();
        return S_OK;
      }).Get());

  return deferred.Promise();
}

// ── Module init ───────────────────────────────────────────────────────────────

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  // Initialize COM on the main thread
  CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);

  exports.Set("createTab",        Napi::Function::New(env, CreateTab));
  exports.Set("navigate",         Napi::Function::New(env, Navigate));
  exports.Set("goBack",           Napi::Function::New(env, GoBack));
  exports.Set("goForward",        Napi::Function::New(env, GoForward));
  exports.Set("reload",           Napi::Function::New(env, Reload));
  exports.Set("stop",             Napi::Function::New(env, Stop));
  exports.Set("setBounds",        Napi::Function::New(env, SetBounds));
  exports.Set("show",             Napi::Function::New(env, Show));
  exports.Set("hide",             Napi::Function::New(env, Hide));
  exports.Set("destroyTab",       Napi::Function::New(env, DestroyTab));
  exports.Set("executeScript",    Napi::Function::New(env, ExecuteScript));
  exports.Set("getURL",           Napi::Function::New(env, GetURL));
  exports.Set("canGoBack",        Napi::Function::New(env, CanGoBack));
  exports.Set("canGoForward",     Napi::Function::New(env, CanGoForward));
  exports.Set("setUserAgent",     Napi::Function::New(env, SetUserAgent));
  exports.Set("setZoom",          Napi::Function::New(env, SetZoom));
  exports.Set("setMuted",         Napi::Function::New(env, SetMuted));
  exports.Set("setColorScheme",    Napi::Function::New(env, SetColorScheme));
  exports.Set("claimFocus",        Napi::Function::New(env, ClaimFocus));
  exports.Set("setEventCallback",  Napi::Function::New(env, SetEventCallback));
  exports.Set("completeNewWindow", Napi::Function::New(env, CompleteNewWindow));
  exports.Set("attachChildWindow",    Napi::Function::New(env, AttachChildWindow));
  exports.Set("setChildWindowBounds", Napi::Function::New(env, SetChildWindowBounds));
  exports.Set("addExtension",         Napi::Function::New(env, AddExtension));
  exports.Set("setExtensionEnabled",  Napi::Function::New(env, SetExtensionEnabled));
  exports.Set("removeExtension",      Napi::Function::New(env, RemoveExtension));
  return exports;
}

NODE_API_MODULE(webview2_addon, Init)
