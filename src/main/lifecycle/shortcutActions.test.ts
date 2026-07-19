import { describe, it, expect, vi } from 'vitest'
import type { OverlayState } from '@shared/types'
import { MAX_OPACITY, MIN_OPACITY, DEFAULT_HOMEPAGE } from '@shared/types'
import type { OverlayWindow } from '../windows/OverlayWindow'
import type { TabManager } from '../managers/TabManager'
import type { ProfileManager } from '../managers/ProfileManager'
import { buildShortcutActions } from './shortcutActions'

function makeDeps(opts: {
  state?: OverlayState
  destroyed?: boolean
  orderedIds?: string[]
  activeId?: string | null
  opacity?: number
  homepageUrl?: string | undefined
} = {}) {
  const {
    state = 'FOCUSED',
    destroyed = false,
    orderedIds = ['t1', 't2', 't3'],
    activeId = 't1',
    opacity = 0.5,
  } = opts
  // Distinguish "not provided" from an explicit `undefined` (the homepage-less case).
  const homepageUrl = 'homepageUrl' in opts ? opts.homepageUrl : 'https://home'

  const send = vi.fn()
  const overlay = {
    show: vi.fn(),
    toggle: vi.fn(),
    getState: vi.fn((): OverlayState => state),
    getOpacity: vi.fn(() => opacity),
    setOpacity: vi.fn(),
    enterClickThrough: vi.fn(),
    leaveClickThrough: vi.fn(),
    win: { isDestroyed: vi.fn(() => destroyed), webContents: { send } },
  }
  const tabs = {
    getOrderedIds: vi.fn(() => orderedIds),
    getActiveId: vi.fn(() => activeId),
    setActive: vi.fn(),
    create: vi.fn(),
    close: vi.fn(),
    reload: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
  }
  const profiles = {
    getActive: vi.fn(() => ({ id: 'p1', homepageUrl })),
    update: vi.fn(),
  }
  const broadcastOpacity = vi.fn()

  const actions = buildShortcutActions({
    overlay: overlay as unknown as OverlayWindow,
    tabs: tabs as unknown as TabManager,
    profiles: profiles as unknown as ProfileManager,
    broadcastOpacity,
  })
  return { actions, overlay, tabs, profiles, broadcastOpacity, send }
}

describe('toggleOverlay', () => {
  it('toggles and notifies the renderer when the window is alive', () => {
    const d = makeDeps()
    d.actions.toggleOverlay()
    expect(d.overlay.toggle).toHaveBeenCalledOnce()
    expect(d.send).toHaveBeenCalledOnce()
  })
  it('toggles but does not notify a destroyed window', () => {
    const d = makeDeps({ destroyed: true })
    d.actions.toggleOverlay()
    expect(d.overlay.toggle).toHaveBeenCalledOnce()
    expect(d.send).not.toHaveBeenCalled()
  })
})

describe('clickThrough', () => {
  it('enters click-through from FOCUSED', () => {
    const d = makeDeps({ state: 'FOCUSED' })
    d.actions.clickThrough()
    expect(d.overlay.enterClickThrough).toHaveBeenCalledOnce()
  })
  it('leaves click-through from CLICK_THROUGH', () => {
    const d = makeDeps({ state: 'CLICK_THROUGH' })
    d.actions.clickThrough()
    expect(d.overlay.leaveClickThrough).toHaveBeenCalledOnce()
  })
  it('does nothing from HIDDEN', () => {
    const d = makeDeps({ state: 'HIDDEN' })
    d.actions.clickThrough()
    expect(d.overlay.enterClickThrough).not.toHaveBeenCalled()
    expect(d.overlay.leaveClickThrough).not.toHaveBeenCalled()
  })
})

describe('toggleFocusMode', () => {
  it('returns early for a destroyed window', () => {
    const d = makeDeps({ destroyed: true })
    d.actions.toggleFocusMode()
    expect(d.send).not.toHaveBeenCalled()
  })
  it('shows the overlay first when hidden, then sends', () => {
    const d = makeDeps({ state: 'HIDDEN' })
    d.actions.toggleFocusMode()
    expect(d.overlay.show).toHaveBeenCalledOnce()
    expect(d.send).toHaveBeenCalledOnce()
  })
  it('does not re-show when already visible', () => {
    const d = makeDeps({ state: 'FOCUSED' })
    d.actions.toggleFocusMode()
    expect(d.overlay.show).not.toHaveBeenCalled()
    expect(d.send).toHaveBeenCalledOnce()
  })
})

describe('newTab', () => {
  it('returns early for a destroyed window', () => {
    const d = makeDeps({ destroyed: true })
    d.actions.newTab()
    expect(d.tabs.create).not.toHaveBeenCalled()
  })
  it("opens the active profile's homepage", () => {
    const d = makeDeps({ homepageUrl: 'https://home' })
    d.actions.newTab()
    expect(d.overlay.show).toHaveBeenCalledOnce()
    expect(d.tabs.create).toHaveBeenCalledWith('https://home')
  })
  it('falls back to DEFAULT_HOMEPAGE when the profile has none', () => {
    const d = makeDeps({ homepageUrl: undefined })
    d.actions.newTab()
    expect(d.tabs.create).toHaveBeenCalledWith(DEFAULT_HOMEPAGE)
  })
})

describe('tab actions requiring an active tab', () => {
  it('closeTab closes when there is an active tab, no-ops otherwise', () => {
    const withTab = makeDeps({ activeId: 't1' })
    withTab.actions.closeTab()
    expect(withTab.tabs.close).toHaveBeenCalledWith('t1')

    const none = makeDeps({ activeId: null })
    none.actions.closeTab()
    expect(none.tabs.close).not.toHaveBeenCalled()
  })

  it('reloadTab / navBack / navForward act on the active tab', () => {
    const d = makeDeps({ activeId: 't1' })
    d.actions.reloadTab()
    d.actions.navBack()
    d.actions.navForward()
    expect(d.tabs.reload).toHaveBeenCalledWith('t1')
    expect(d.tabs.goBack).toHaveBeenCalledWith('t1')
    expect(d.tabs.goForward).toHaveBeenCalledWith('t1')
  })

  it('reloadTab / navBack / navForward no-op without an active tab', () => {
    const d = makeDeps({ activeId: null })
    d.actions.reloadTab()
    d.actions.navBack()
    d.actions.navForward()
    expect(d.tabs.reload).not.toHaveBeenCalled()
    expect(d.tabs.goBack).not.toHaveBeenCalled()
    expect(d.tabs.goForward).not.toHaveBeenCalled()
  })
})

describe('nextTab / prevTab (cycleTab)', () => {
  it('shows the overlay and does nothing with fewer than two tabs', () => {
    const d = makeDeps({ orderedIds: ['only'] })
    d.actions.nextTab()
    expect(d.overlay.show).toHaveBeenCalledOnce()
    expect(d.tabs.setActive).not.toHaveBeenCalled()
  })
  it('cycles forward from the active tab', () => {
    const d = makeDeps({ orderedIds: ['a', 'b', 'c'], activeId: 'a' })
    d.actions.nextTab()
    expect(d.tabs.setActive).toHaveBeenCalledWith('b')
  })
  it('wraps backward from the first tab', () => {
    const d = makeDeps({ orderedIds: ['a', 'b', 'c'], activeId: 'a' })
    d.actions.prevTab()
    expect(d.tabs.setActive).toHaveBeenCalledWith('c')
  })
  it('treats a missing active id as index -1, so nextTab lands on the first tab', () => {
    const d = makeDeps({ orderedIds: ['a', 'b', 'c'], activeId: null })
    d.actions.nextTab()
    expect(d.tabs.setActive).toHaveBeenCalledWith('a')
  })
})

describe('opacityUp / opacityDown (stepOpacity)', () => {
  it('steps opacity up and propagates the change', () => {
    const d = makeDeps({ opacity: 0.5 })
    d.actions.opacityUp()
    expect(d.overlay.setOpacity).toHaveBeenCalledWith(0.55)
    expect(d.profiles.update).toHaveBeenCalledWith('p1', { opacity: 0.55 })
    expect(d.broadcastOpacity).toHaveBeenCalledWith(0.55)
  })
  it('clamps at MAX_OPACITY', () => {
    const d = makeDeps({ opacity: MAX_OPACITY })
    d.actions.opacityUp()
    expect(d.overlay.setOpacity).toHaveBeenCalledWith(MAX_OPACITY)
  })
  it('clamps at MIN_OPACITY', () => {
    const d = makeDeps({ opacity: MIN_OPACITY })
    d.actions.opacityDown()
    expect(d.overlay.setOpacity).toHaveBeenCalledWith(MIN_OPACITY)
  })
})
