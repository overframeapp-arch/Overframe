import http from 'http'
import { app } from 'electron'
import { readLog } from './devLogger'
import type { OverlayWindow } from '../windows/OverlayWindow'
import type { TabManager } from '../managers/TabManager'
import type { ProfileManager } from '../managers/ProfileManager'

export const DEV_SERVER_PORT = 9119

interface Deps {
  overlay: OverlayWindow
  tabs: TabManager
  profiles: ProfileManager
}

/**
 * Lightweight HTTP server exposing app state, screenshots, and logs to external
 * tools (Claude Code, curl, scripts). Only starts in dev builds.
 *
 * Endpoints:
 *   GET /ping           → health check JSON
 *   GET /screenshot     → PNG of the current overlay window
 *   GET /state          → structured JSON: overlay state, tabs, active profile
 *   GET /log/renderer   → last 300 lines of the renderer console log
 *   GET /log/webview    → last 300 lines of the webview (tab) console log
 *   GET /log/crash      → last 300 lines of the crash log
 */
export function startDevServer({ overlay, tabs, profiles }: Deps): void {
  if (app.isPackaged) return

  const server = http.createServer(async (req, res) => {
    const url = req.url ?? '/'

    // ── /ping ─────────────────────────────────────────────────────────────────
    if (url === '/ping') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', app: 'overframe', version: app.getVersion() }))
      return
    }

    // ── /screenshot ───────────────────────────────────────────────────────────
    if (url === '/screenshot') {
      if (overlay.win.isDestroyed()) {
        res.writeHead(503, { 'Content-Type': 'text/plain' })
        res.end('overlay window is destroyed')
        return
      }
      try {
        const image = await overlay.win.webContents.capturePage()
        res.writeHead(200, { 'Content-Type': 'image/png' })
        res.end(image.toPNG())
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end(`screenshot failed: ${String(err)}`)
      }
      return
    }

    // ── /overlay/show + /overlay/hide ────────────────────────────────────────
    if (url === '/overlay/show') {
      if (!overlay.win.isDestroyed()) overlay.show()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ state: overlay.getState() }))
      return
    }

    if (url === '/overlay/hide') {
      if (!overlay.win.isDestroyed()) void overlay.hide()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ state: overlay.getState() }))
      return
    }

    // ── /state ────────────────────────────────────────────────────────────────
    if (url === '/state') {
      const activeId = tabs.getActiveId()
      const state = {
        overlay: overlay.getState(),
        activeProfile: profiles.getActive(),
        tabs: tabs.getAll().map((t) => ({
          id: t.id,
          title: t.title,
          url: t.url,
          isLoading: t.isLoading,
          isActive: t.id === activeId,
        })),
        version: app.getVersion(),
        devServerPort: DEV_SERVER_PORT,
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(state, null, 2))
      return
    }

    // ── /metrics ──────────────────────────────────────────────────────────────
    // Memory measured against the documented targets (TECH_SPEC §10, PRD §6):
    //   idle (hidden)  < 150 MB    active  < 300 MB
    if (url === '/metrics') {
      const snap = tabs.getMemorySnapshot()
      const tabsKb = snap.tabs.reduce((sum, t) => sum + t.privateKb, 0)
      const totalKb = snap.appKb + tabsKb
      const overlayState = overlay.getState()
      const target = overlayState === 'HIDDEN' ? 150 : 300
      const totalMb = +(totalKb / 1024).toFixed(1)
      const metrics = {
        overlay: overlayState,
        memory: {
          appMb: +(snap.appKb / 1024).toFixed(1),
          tabsMb: +(tabsKb / 1024).toFixed(1),
          totalMb,
          tabCount: snap.tabs.length,
        },
        target: { maxMb: target, withinBudget: totalMb <= target },
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(metrics, null, 2))
      return
    }

    // ── /log/:source ──────────────────────────────────────────────────────────
    const logMatch = url.match(/^\/log\/(renderer|webview|crash)(\?lines=(\d+))?$/)
    if (logMatch) {
      const source = logMatch[1] as 'renderer' | 'webview' | 'crash'
      const lines = logMatch[3] ? parseInt(logMatch[3], 10) : 300
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(readLog(source, lines))
      return
    }

    // ── help ──────────────────────────────────────────────────────────────────
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(
      [
        `Overframe Dev Observer  http://127.0.0.1:${DEV_SERVER_PORT}`,
        '',
        'GET /ping                   health check',
        'GET /screenshot             PNG of the current overlay window',
        'GET /state                  JSON: overlay state, tabs, active profile',
        'GET /metrics                 RAM usage vs documented budget (150/300 MB)',
        'GET /log/renderer           last 300 lines of renderer console log',
        'GET /log/webview            last 300 lines of webview (tab) console log',
        'GET /log/crash              last 300 lines of crash log',
        'GET /log/renderer?lines=50  custom line count',
      'POST /overlay/show          show the overlay window',
      'POST /overlay/hide          hide the overlay window',
      ].join('\n'),
    )
  })

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[dev] Port ${DEV_SERVER_PORT} already in use — devServer skipped`)
    } else {
      console.error('[dev] devServer error:', err)
    }
  })

  server.listen(DEV_SERVER_PORT, '127.0.0.1', () => {
    console.log(`[dev] Observer → http://127.0.0.1:${DEV_SERVER_PORT}`)
  })
}
