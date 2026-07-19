/**
 * Download uBlock Origin MV2 (Chromium build) from GitHub releases.
 * Run once: pnpm download:ublock
 * Output: public/extensions/ublock/
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, readdirSync, renameSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = join(__dirname, '..')
const EXT_DIR   = join(ROOT, 'public', 'extensions')
const DEST      = join(EXT_DIR, 'ublock')
const TMP_ZIP   = join(EXT_DIR, 'ublock_tmp.zip')
const TMP_DIR   = join(EXT_DIR, 'ublock_extracted')

// Pin the version — MV2 (1.x) required for WebView2 extension support
const VERSION = '1.71.0'
const ZIP_URL = `https://github.com/gorhill/uBlock/releases/download/${VERSION}/uBlock0_${VERSION}.chromium.zip`

mkdirSync(EXT_DIR, { recursive: true })

console.log(`Downloading uBlock Origin ${VERSION}...`)
execSync(
  `powershell -Command "Invoke-WebRequest -Uri '${ZIP_URL}' -OutFile '${TMP_ZIP}'"`,
  { stdio: 'inherit' }
)

console.log('Extracting...')
if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true })
execSync(
  `powershell -Command "Expand-Archive -Path '${TMP_ZIP}' -DestinationPath '${TMP_DIR}' -Force"`,
  { stdio: 'inherit' }
)

// The zip contains a single directory — move its contents to DEST
const entries = readdirSync(TMP_DIR)
const srcDir  = entries.length === 1 ? join(TMP_DIR, entries[0]) : TMP_DIR

if (existsSync(DEST)) rmSync(DEST, { recursive: true })
renameSync(srcDir, DEST)

// Cleanup
if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true })
if (existsSync(TMP_ZIP)) rmSync(TMP_ZIP)

// Enable "AdGuard – Ads" by default alongside the stock EasyList/uBlock filters —
// it catches ad patterns (including some YouTube ones) the default lists miss.
// Only affects fresh WebView2 profiles: uBlock picks its default list selection
// once on first run and persists it, so this has no effect on profiles that
// already exist at %APPDATA%\Overframe\WebView2.
console.log('Patching default filter list selection...')
const assetsJsonPath = join(DEST, 'assets', 'assets.json')
const assetsJson = JSON.parse(readFileSync(assetsJsonPath, 'utf8'))
if (assetsJson['adguard-generic']) delete assetsJson['adguard-generic'].off
writeFileSync(assetsJsonPath, JSON.stringify(assetsJson, null, '\t') + '\n')

console.log(`Done — uBlock Origin ${VERSION} at ${DEST}`)
