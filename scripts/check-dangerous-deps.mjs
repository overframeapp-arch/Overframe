#!/usr/bin/env node
/**
 * scripts/check-dangerous-deps.mjs
 *
 * Dependency audit — Rec 6 from the anti-cheat audit.
 * Fails the build (exit 1) if any package capable of native OS-level hooking,
 * process injection, or memory access is found in package.json.
 *
 * Run manually:    node scripts/check-dangerous-deps.mjs
 * Run in CI:       pnpm check:deps
 *
 * Add new entries to FORBIDDEN when new dangerous package families appear.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dir = dirname(fileURLToPath(import.meta.url))
const pkgPath = resolve(__dir, '../package.json')

/** @type {{ dependencies?: Record<string, string>; devDependencies?: Record<string, string> }} */
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

/**
 * Packages that enable OS-level hooks, process injection, memory access, or
 * keyboard/mouse automation — all of which would be detected by anti-cheat.
 *
 * Rationale for each entry:
 *  - ffi-napi / node-ffi-napi / koffi : arbitrary DLL loading via FFI → process injection risk
 *  - ref-napi / ref-struct-di          : companion to ffi, enables pointer arithmetic
 *  - edge-js                           : calls .NET CLR inside Node → unverified native calls
 *  - iohook                            : WH_KEYBOARD_LL / WH_MOUSE_LL global hooks → AC flagged
 *  - robotjs / nut-js                  : SendInput / mouse_event simulation → AC flagged
 *  - node-keyboard                     : global keyboard listener via native hooks
 *
 * Note: uiohook-napi is intentionally NOT in this list. It uses the same
 * WH_KEYBOARD_LL hook as Discord push-to-talk (read-only, no injection,
 * no memory access) and is required for in-game shortcut delivery.
 */
const FORBIDDEN = [
  'ffi-napi',
  'node-ffi-napi',
  'koffi',
  'edge-js',
  'ref-napi',
  'ref-struct-di',
  'iohook',
  'robotjs',
  '@nut-tree/nut-js',
  'nut-js',
  'node-keyboard',
]

const allDeps = {
  ...pkg.dependencies,
  ...pkg.devDependencies,
}

const found = FORBIDDEN.filter((name) => name in allDeps)

if (found.length > 0) {
  console.error(
    '\n❌  SECURITY — Forbidden native bindings detected in package.json:\n' +
    found.map((f) => `     • ${f}`).join('\n') +
    '\n\n   These packages enable OS-level hooks or process injection which' +
    '\n   will be flagged by anti-cheat systems (EAC, BattlEye, Vanguard).' +
    '\n   Remove them before shipping.\n'
  )
  process.exit(1)
}

console.log('✅  Dependency audit passed — no forbidden native bindings found.')
