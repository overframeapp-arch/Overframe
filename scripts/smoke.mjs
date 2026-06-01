// Product smoke test — launches the REAL built Electron app and asserts end-to-end
// behaviour through the dev observer (HTTP). No new dependency: it reuses the
// devServer that already ships in dev builds.
//
// What it proves (which unit tests cannot): the main process boots, managers wire
// up, the overlay window exists and transitions state, IPC works, and the observer
// pipeline (state/metrics/screenshot) is live.
//
// Usage:  pnpm smoke   (builds first, then runs this)
//
// Exit 0 = all checks passed, 1 = a check failed or the app did not start.

import electronPath from 'electron'
import { spawn, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const entry = join(root, 'out', 'main', 'index.js')
const BASE = 'http://127.0.0.1:9119'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (!existsSync(entry)) {
  console.error(`[smoke] ${entry} not found — run \`pnpm build\` first.`)
  process.exit(1)
}

let failures = 0
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
  if (!ok) failures++
}

// IMPORTANT: when this runs inside an Electron host (e.g. a VSCode integrated
// terminal), ELECTRON_RUN_AS_NODE=1 is inherited and would make our child run as
// plain Node (electron.app === undefined). Strip it so Electron boots normally.
const childEnv = { ...process.env, NODE_ENV: 'development' }
delete childEnv.ELECTRON_RUN_AS_NODE
delete childEnv.ELECTRON_NO_ATTACH_CONSOLE

const child = spawn(electronPath, [entry], {
  cwd: root,
  env: childEnv,
  stdio: 'ignore',
})

function killApp() {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' })
    } else {
      child.kill('SIGKILL')
    }
  } catch {
    /* already gone */
  }
}

const getJson = async (path) => (await fetch(BASE + path)).json()

try {
  // 1. Boot — wait up to 30s for the dev observer
  let up = false
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE + '/ping')).ok) { up = true; break }
    } catch {
      /* not ready yet */
    }
    await sleep(500)
  }
  check('app boots + dev observer responds (/ping)', up)
  if (!up) throw new Error('app did not start within 30s')

  // 2. Coherent boot state
  const VALID_OVERLAY = ['HIDDEN', 'FOCUSED', 'CLICK_THROUGH']
  const state = await getJson('/state')
  check('overlay reports a valid state at boot', VALID_OVERLAY.includes(state.overlay), `overlay=${state.overlay}`)
  check('/state reports a version', typeof state.version === 'string', String(state.version))
  check('/state exposes a tabs array', Array.isArray(state.tabs))

  // 3. Metrics pipeline (reported; only fails if egregiously over budget)
  const metrics = await getJson('/metrics')
  const mb = metrics?.memory?.totalMb
  check('/metrics returns live memory usage', typeof mb === 'number' && mb > 0, `${mb} MB (budget ${metrics?.target?.maxMb})`)
  check('memory not egregiously over budget', typeof mb === 'number' && mb < 500, `${mb} MB`)

  // 4. Overlay show pipeline
  await fetch(BASE + '/overlay/show')
  await sleep(500)
  const shown = await getJson('/state')
  check('overlay/show leaves HIDDEN', shown.overlay !== 'HIDDEN', `overlay=${shown.overlay}`)

  // 5. Screenshot pipeline
  const shot = await fetch(BASE + '/screenshot')
  const buf = Buffer.from(await shot.arrayBuffer())
  check('screenshot returns a non-trivial PNG', shot.headers.get('content-type') === 'image/png' && buf.length > 1000, `${buf.length} bytes`)

  // 6. Overlay hide pipeline
  await fetch(BASE + '/overlay/hide')
  await sleep(400)
  const hidden = await getJson('/state')
  check('overlay/hide returns to HIDDEN', hidden.overlay === 'HIDDEN', `overlay=${hidden.overlay}`)
} catch (err) {
  check('smoke run completed without throwing', false, err.message)
} finally {
  killApp()
}

await sleep(300)
console.log(`\n[smoke] ${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`)
process.exit(failures === 0 ? 0 : 1)
