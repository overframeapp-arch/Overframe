// Manages all shortcuts via uiohook-napi (WH_KEYBOARD_LL — fires before game input).
// Shortcuts are logical characters (AZERTY-aware): renderer sends the layout map
// so logical letters → physical keycodes are resolved at registration time.
import type { UiohookKeyboardEvent } from 'uiohook-napi'
import { UiohookKey, uIOhook } from 'uiohook-napi'
import type { ShortcutId, Shortcuts } from '@shared/types'

// ── Static key map ────────────────────────────────────────────────────────────

// Accelerator token → uiohook keycode. Letters are QWERTY fallback (overridden by layout map).
const KEY_MAP: Record<string, number> = {
  // Letters (physical QWERTY fallback — overridden by layout map for letters)
  A: UiohookKey.A, B: UiohookKey.B, C: UiohookKey.C, D: UiohookKey.D,
  E: UiohookKey.E, F: UiohookKey.F, G: UiohookKey.G, H: UiohookKey.H,
  I: UiohookKey.I, J: UiohookKey.J, K: UiohookKey.K, L: UiohookKey.L,
  M: UiohookKey.M, N: UiohookKey.N, O: UiohookKey.O, P: UiohookKey.P,
  Q: UiohookKey.Q, R: UiohookKey.R, S: UiohookKey.S, T: UiohookKey.T,
  U: UiohookKey.U, V: UiohookKey.V, W: UiohookKey.W, X: UiohookKey.X,
  Y: UiohookKey.Y, Z: UiohookKey.Z,
  // Digits (numrow — same physical position on all layouts)
  '0': UiohookKey[0], '1': UiohookKey[1], '2': UiohookKey[2],
  '3': UiohookKey[3], '4': UiohookKey[4], '5': UiohookKey[5],
  '6': UiohookKey[6], '7': UiohookKey[7], '8': UiohookKey[8],
  '9': UiohookKey[9],
  // Function keys
  F1: UiohookKey.F1, F2:  UiohookKey.F2,  F3:  UiohookKey.F3,  F4:  UiohookKey.F4,
  F5: UiohookKey.F5, F6:  UiohookKey.F6,  F7:  UiohookKey.F7,  F8:  UiohookKey.F8,
  F9: UiohookKey.F9, F10: UiohookKey.F10, F11: UiohookKey.F11, F12: UiohookKey.F12,
  // Navigation — position-invariant across all layouts
  Left:     UiohookKey.ArrowLeft,  Right: UiohookKey.ArrowRight,
  Up:       UiohookKey.ArrowUp,    Down:  UiohookKey.ArrowDown,
  Home:     UiohookKey.Home,       End:   UiohookKey.End,
  PageUp:   UiohookKey.PageUp,     PageDown: UiohookKey.PageDown,
  // Misc
  Space:     UiohookKey.Space,
  Tab:       UiohookKey.Tab,
  Escape:    UiohookKey.Escape,
  Enter:     UiohookKey.Enter,
  Backspace: UiohookKey.Backspace,
  Delete:    UiohookKey.Delete,
  Insert:    UiohookKey.Insert,
}

interface Binding {
  ctrl:  boolean
  shift: boolean
  alt:   boolean
  key:   number
}

function matches(b: Binding, e: UiohookKeyboardEvent): boolean {
  return (
    e.keycode  === b.key   &&
    e.ctrlKey  === b.ctrl  &&
    e.shiftKey === b.shift &&
    e.altKey   === b.alt
  )
}

// ── ShortcutManager ───────────────────────────────────────────────────────────

type Actions = Partial<Record<ShortcutId, () => void>>

export class ShortcutManager {
  /** Active uiohook listener per shortcut id */
  private listeners = new Map<ShortcutId, (e: UiohookKeyboardEvent) => void>()
  private actions: Actions = {}
  // logical letter → uiohook keycode (from renderer layout map; QWERTY fallback)
  private logicalLetterToKeycode = new Map<string, number>()

  init(shortcuts: Shortcuts, actions: Actions): void {
    this.actions = actions
    this.applyAll(shortcuts)
  }

  setLayoutMap(physicalToLogical: Record<string, string>): void {
    this.logicalLetterToKeycode.clear()
    for (const [code, logicalChar] of Object.entries(physicalToLogical)) {
      // Only handle letter keys (KeyA … KeyZ)
      if (!code.startsWith('Key') || !/^[a-z]$/i.test(logicalChar)) continue
      const physicalLetter = code.slice(3).toUpperCase()  // 'KeyW' → 'W'
      const keycode = KEY_MAP[physicalLetter]
      if (keycode !== undefined) {
        this.logicalLetterToKeycode.set(logicalChar.toUpperCase(), keycode)
      }
    }
  }

  apply(shortcuts: Shortcuts): void {
    this.applyAll(shortcuts)
  }

  dispose(): void {
    for (const listener of this.listeners.values()) {
      uIOhook.off('keydown', listener)
    }
    this.listeners.clear()
  }

  // ── private ─────────────────────────────────────────────────────────────────

  // Parse "Ctrl+Shift+Z" → Binding; letters resolved via layout map (QWERTY fallback).
  private parseAccelerator(acc: string): Binding | null {
    let ctrl = false, shift = false, alt = false, keyToken = ''
    for (const part of acc.split('+')) {
      const p = part.trim()
      if (p === 'Ctrl' || p === 'Control' || p === 'CommandOrControl') ctrl = true
      else if (p === 'Shift') shift = true
      else if (p === 'Alt')   alt = true
      else keyToken = p
    }
    if (!keyToken) return null

    let code: number | undefined
    // Single letter → layout-aware lookup (AZERTY support)
    if (/^[A-Z]$/.test(keyToken)) {
      code = this.logicalLetterToKeycode.get(keyToken) ?? KEY_MAP[keyToken]
    } else {
      code = KEY_MAP[keyToken]
    }
    if (code === undefined) return null
    return { ctrl, shift, alt, key: code }
  }

  private applyAll(shortcuts: Shortcuts): void {
    // Tear down every existing listener first
    for (const listener of this.listeners.values()) {
      uIOhook.off('keydown', listener)
    }
    this.listeners.clear()

    for (const [id, acc] of Object.entries(shortcuts) as [ShortcutId, string | null][]) {
      if (!acc) continue                          // null = disabled
      const binding = this.parseAccelerator(acc)
      if (!binding) continue                      // unrecognised key
      const action = this.actions[id]
      if (!action) continue                       // no handler registered

      const listener = (e: UiohookKeyboardEvent): void => {
        if (matches(binding, e)) action()
      }
      uIOhook.on('keydown', listener)
      this.listeners.set(id, listener)
    }
  }
}
