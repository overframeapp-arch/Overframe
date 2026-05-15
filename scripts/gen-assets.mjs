/**
 * scripts/gen-assets.mjs
 * Generates PNG/ICO assets from SVG sources.
 *
 * Usage: node scripts/gen-assets.mjs
 * Outputs:
 *   public/icons/icon.png   (512×512)
 *   public/icons/icon.ico   (multi-size: 16, 32, 48, 256)
 *   public/icons/tray.png   (22×22)
 *   public/banner.png       (1200×400)
 */

import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = join(__dir, '..')

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderSvg(svgPath, width, height, { fonts = false } = {}) {
  const svg = readFileSync(join(root, svgPath), 'utf8')
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { loadSystemFonts: fonts },
  })
  const rendered = resvg.render()
  return rendered.asPng()
}

/**
 * Build a multi-image ICO file from an array of PNG Buffers.
 * Each PNG must be a valid PNG binary (starts with PNG signature).
 */
function buildIco(pngBuffers) {
  const count = pngBuffers.length
  const HEADER = 6
  const ENTRY  = 16
  const dataStart = HEADER + count * ENTRY
  const totalSize = dataStart + pngBuffers.reduce((s, b) => s + b.length, 0)
  const buf = Buffer.alloc(totalSize)

  // ICO header
  buf.writeUInt16LE(0, 0)      // reserved
  buf.writeUInt16LE(1, 2)      // type = 1 (ICO)
  buf.writeUInt16LE(count, 4)  // image count

  let offset = dataStart
  pngBuffers.forEach((png, i) => {
    // Read width/height from PNG IHDR chunk (bytes 16–23)
    const w = png.readUInt32BE(16)
    const h = png.readUInt32BE(20)
    const entry = HEADER + i * ENTRY
    buf.writeUInt8(w >= 256 ? 0 : w,   entry)       // width  (0 = 256)
    buf.writeUInt8(h >= 256 ? 0 : h,   entry + 1)   // height (0 = 256)
    buf.writeUInt8(0,                   entry + 2)   // colour count
    buf.writeUInt8(0,                   entry + 3)   // reserved
    buf.writeUInt16LE(1,                entry + 4)   // planes
    buf.writeUInt16LE(32,               entry + 6)   // bits per pixel
    buf.writeUInt32LE(png.length,       entry + 8)   // image data size
    buf.writeUInt32LE(offset,           entry + 12)  // image data offset
    png.copy(buf, offset)
    offset += png.length
  })

  return buf
}

// ── Generate ─────────────────────────────────────────────────────────────────

console.log('⚙  Generating assets from SVG sources…\n')

// Icon — multiple sizes
const icoSizes = [16, 32, 48, 256]
const icoPngs  = icoSizes.map(s => renderSvg('public/icons/icon.svg', s, s))

// icon.png (512×512 — used by Electron as app icon on Linux / About dialog)
const icon512 = renderSvg('public/icons/icon.svg', 512, 512)
writeFileSync(join(root, 'public/icons/icon.png'), icon512)
console.log('  ✓  public/icons/icon.png  (512×512)')

// icon.ico (multi-size — used by Electron on Windows)
const ico = buildIco(icoPngs)
writeFileSync(join(root, 'public/icons/icon.ico'), ico)
console.log(`  ✓  public/icons/icon.ico  (${icoSizes.join(', ')}px)`)

// tray.png (22×22 — system tray)
const tray = renderSvg('public/icons/icon.svg', 22, 22)
writeFileSync(join(root, 'public/icons/tray.png'), tray)
console.log('  ✓  public/icons/tray.png  (22×22)')

// Icon variants
const iconLight = renderSvg('public/icons/icon-light.svg', 512, 512)
writeFileSync(join(root, 'public/icons/icon-light.png'), iconLight)
console.log('  ✓  public/icons/icon-light.png  (512×512)')

const iconTransp = renderSvg('public/icons/icon-transparent.svg', 512, 512)
writeFileSync(join(root, 'public/icons/icon-transparent.png'), iconTransp)
console.log('  ✓  public/icons/icon-transparent.png  (512×512)')

const iconAmber = renderSvg('public/icons/icon-amber.svg', 512, 512)
writeFileSync(join(root, 'public/icons/icon-amber.png'), iconAmber)
console.log('  ✓  public/icons/icon-amber.png  (512×512)')

const iconDev = renderSvg('public/icons/icon-dev.svg', 512, 512)
writeFileSync(join(root, 'public/icons/icon-dev.png'), iconDev)
console.log('  ✓  public/icons/icon-dev.png  (512×512)')

// banner.png variants
for (const [src, out] of [
  ['public/banner.svg',             'public/banner.png'],
  ['public/banner-light.svg',       'public/banner-light.png'],
  ['public/banner-transparent.svg', 'public/banner-transparent.png'],
]) {
  const png = renderSvg(src, 1200, 400, { fonts: true })
  writeFileSync(join(root, out), png)
  console.log(`  ✓  ${out}  (1200×400)`)
}

// Ko-fi tier badges (1024×512 each, 2:1) — Bronze / Silver / Gold
// Full badge: logo mark + wordmark + tier label
for (const tier of [1, 2, 3]) {
  const png = renderSvg(`public/icons/tier-${tier}.svg`, 1024, 512, { fonts: true })
  writeFileSync(join(root, `public/icons/tier-${tier}.png`), png)
  console.log(`  ✓  public/icons/tier-${tier}.png  (1024×512)`)
}

// Icon-only tier badges (1024×512, 2:1) — transparent PNG, mark only
// tier-0 = violet (brand), tier-1 = bronze, tier-2 = silver, tier-3 = gold
for (const tier of [0, 1, 2, 3]) {
  const png = renderSvg(`public/icons/tier-${tier}-badge.svg`, 1024, 512)
  writeFileSync(join(root, `public/icons/tier-${tier}-badge.png`), png)
  console.log(`  ✓  public/icons/tier-${tier}-badge.png  (1024×512 transparent)`)
}

console.log('\n✅ Done.')
