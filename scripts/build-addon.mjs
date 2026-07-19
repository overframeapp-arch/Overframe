/**
 * Build the native WebView2 addon (native/webview2-addon) with node-gyp.
 *
 * Windows-only: the addon embeds Microsoft Edge WebView2 (windows.h, WRL, the
 * WebView2 SDK), so it can only be compiled on Windows. On any other platform
 * this is a graceful no-op so `pnpm install` and the Linux/macOS CI jobs still
 * succeed — the addon is only ever loaded at runtime on Windows.
 *
 * The WebView2 SDK header + import lib are vendored under
 * native/webview2-addon/{include,lib} (see that folder's README), so the build
 * is hermetic and needs no network access — only VS Build Tools 2022 + Python,
 * which node-gyp locates itself.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

if (process.platform !== 'win32') {
  console.log('[build-addon] skipped — the WebView2 addon is Windows-only.')
  process.exit(0)
}

const addonDir = path.join(root, 'native', 'webview2-addon')
if (!existsSync(path.join(addonDir, 'binding.gyp'))) {
  console.error('[build-addon] native/webview2-addon/binding.gyp not found — aborting.')
  process.exit(1)
}

const nodeGyp = path.join(root, 'node_modules', '.bin', 'node-gyp.cmd')
const result = spawnSync(nodeGyp, ['rebuild'], {
  cwd: addonDir,
  stdio: 'inherit',
  shell: true,
})

if (result.status !== 0) {
  console.error('[build-addon] node-gyp rebuild failed.')
}
process.exit(result.status ?? 1)
