import { IPC } from '@shared/ipc'
import { DEFAULT_HOMEPAGE, MAX_OPACITY, MIN_OPACITY, type ShortcutId } from '@shared/types'
import type { OverlayWindow } from '../windows/OverlayWindow'
import type { TabManager } from '../managers/TabManager'
import type { ProfileManager } from '../managers/ProfileManager'

export interface ShortcutActionDeps {
  overlay: OverlayWindow
  tabs: TabManager
  profiles: ProfileManager
  broadcastOpacity: (value: number) => void
}

export type ShortcutActions = Record<ShortcutId, () => void>

export function buildShortcutActions({
  overlay,
  tabs,
  profiles,
  broadcastOpacity,
}: ShortcutActionDeps): ShortcutActions {
  const cycleTab = (delta: 1 | -1): void => {
    overlay.show()
    const ids = tabs.getOrderedIds()
    if (ids.length < 2) return
    const idx = ids.indexOf(tabs.getActiveId() ?? '')
    tabs.setActive(ids[(idx + delta + ids.length) % ids.length])
  }

  const stepOpacity = (delta: number): void => {
    const next = Math.max(
      MIN_OPACITY,
      Math.min(MAX_OPACITY, Math.round((overlay.getOpacity() + delta) * 100) / 100),
    )
    overlay.setOpacity(next)
    profiles.update(profiles.getActive().id, { opacity: next })
    broadcastOpacity(next)
  }

  return {
    toggleOverlay: () => {
      overlay.toggle()
      if (!overlay.win.isDestroyed()) {
        overlay.win.webContents.send(IPC.EventOverlayUserToggled)
      }
    },

    clickThrough: () => {
      const state = overlay.getState()
      if (state === 'FOCUSED') overlay.enterClickThrough()
      else if (state === 'CLICK_THROUGH') overlay.leaveClickThrough()
    },

    toggleFocusMode: () => {
      if (overlay.win.isDestroyed()) return
      overlay.show()
      overlay.win.webContents.send(IPC.EventToggleFocusMode)
    },

    newTab: () => {
      if (overlay.win.isDestroyed()) return
      overlay.show()
      void tabs.create(profiles.getActive().homepageUrl ?? DEFAULT_HOMEPAGE)
    },

    closeTab: () => {
      const id = tabs.getActiveId()
      if (id) tabs.close(id)
    },

    nextTab: () => cycleTab(1),
    prevTab: () => cycleTab(-1),

    reloadTab: () => {
      const id = tabs.getActiveId()
      if (id) tabs.reload(id)
    },

    navBack: () => {
      const id = tabs.getActiveId()
      if (id) tabs.goBack(id)
    },

    navForward: () => {
      const id = tabs.getActiveId()
      if (id) tabs.goForward(id)
    },

    opacityUp: () => stepOpacity(0.05),
    opacityDown: () => stepOpacity(-0.05),
  }
}
