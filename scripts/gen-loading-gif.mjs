/**
 * scripts/gen-loading-gif.mjs
 * Generates a 370x44 animated GIF for the Squirrel installer loading screen.
 *
 * Design: app icon + "Overframe" label (rendered via resvg for clean
 * anti-aliasing) centred as a block, indeterminate purple progress bar at the
 * bottom.  Colour palette matches the app brand (#09000f -> #c4b5fd purples).
 *
 * Uses @resvg/resvg-js (already a devDep) to rasterise both the SVG icon and
 * the text.  Pure GIF89a encoding, no other external deps.
 *
 * Usage: node scripts/gen-loading-gif.mjs
 * Output: public/icons/loading.gif
 */

import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const OUT   = join(__dir, '..', 'public', 'icons', 'loading.gif')

// Canvas
const W = 370
const H = 44
const FRAMES = 24
const FRAME_DELAY = 4  // x 10ms -> 40ms/frame ~960ms per loop

// 64-colour palette (GCT_SIZE = 5 -> 2^6 = 64 entries)
//   0-7  : dark backgrounds / track
//   8-55 : purple gradient, #09000f (index 8) -> #c4b5fd (index 55), 48 steps
//  56-63 : utility grays / white / black
const PALETTE = (() => {
  const p = []

  p.push(
    [0x0C, 0x0A, 0x14], // 0  frame bg
    [0x10, 0x0D, 0x1C], // 1
    [0x16, 0x12, 0x28], // 2
    [0x1E, 0x18, 0x30], // 3
    [0x26, 0x20, 0x3C], // 4
    [0x2E, 0x28, 0x48], // 5
    [0x18, 0x14, 0x26], // 6  track (inactive bar)
    [0x08, 0x04, 0x10], // 7
  )

  // Purple gradient 8-55 (48 shades, dark -> light)
  const dark  = [0x09, 0x00, 0x0F]
  const light = [0xC4, 0xB5, 0xFD]
  for (let i = 0; i < 48; i++) {
    const t = i / 47
    p.push([
      Math.round(dark[0] + t * (light[0] - dark[0])),
      Math.round(dark[1] + t * (light[1] - dark[1])),
      Math.round(dark[2] + t * (light[2] - dark[2])),
    ])
  }

  p.push(
    [0x38, 0x34, 0x44], // 56
    [0x58, 0x54, 0x68], // 57
    [0x80, 0x78, 0x90], // 58
    [0xA8, 0xA0, 0xB8], // 59
    [0xD0, 0xC8, 0xDC], // 60
    [0xF0, 0xEC, 0xFC], // 61  near-white lavender
    [0xFF, 0xFF, 0xFF], // 62  white
    [0x00, 0x00, 0x00], // 63  black
  )

  return p
})()

const GCT_SIZE    = 5  // 2^(5+1) = 64 entries
const MIN_CODE_SZ = 6  // >= ceil(log2(64))

// Colour mapping
function nearestPaletteIdx(r, g, b, a) {
  if (a < 32) return 0
  let best = 0, bestDist = Infinity
  for (let i = 0; i < PALETTE.length; i++) {
    const [pr, pg, pb] = PALETTE[i]
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2
    if (d < bestDist) { bestDist = d; best = i }
  }
  return best
}

// Icon rendering (28x28)
const ICON_SIZE = 28
const iconSvg   = readFileSync(join(__dir, '..', 'public', 'icons', 'icon.svg'), 'utf8')
const iconRsvg  = new Resvg(iconSvg, { fitTo: { mode: 'width', value: ICON_SIZE } })
const iconRend  = iconRsvg.render()
const ICON_RGBA = iconRend.pixels
const ICON_W    = iconRend.width
const ICON_H    = iconRend.height

// Text rendering via resvg (actual font, anti-aliased)
// "Overframe" in a generous canvas; scan for real rendered width.
const TEXT_CANVAS_W = 160
const TEXT_CANVAS_H = ICON_H
const TEXT_FONT_SIZE = 13

const textSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TEXT_CANVAS_W}" height="${TEXT_CANVAS_H}">
  <text x="1" y="21"
    font-family="'Segoe UI','Inter',system-ui,-apple-system,sans-serif"
    font-size="${TEXT_FONT_SIZE}"
    font-weight="600"
    letter-spacing="0.3"
    fill="#c4b5fd">Overframe</text>
</svg>`

const textRsvg  = new Resvg(textSvg, { fitTo: { mode: 'width', value: TEXT_CANVAS_W } })
const textRend  = textRsvg.render()
const TEXT_RGBA = textRend.pixels
const TEXT_FW   = textRend.width
const TEXT_FH   = textRend.height

// Find actual rendered text width (rightmost opaque pixel + margin)
let textMaxX = 0
for (let y = 0; y < TEXT_FH; y++)
  for (let x = TEXT_FW - 1; x >= 0; x--)
    if (TEXT_RGBA[(y * TEXT_FW + x) * 4 + 3] > 16) { if (x > textMaxX) textMaxX = x; break }
const TEXT_W = textMaxX + 2

// Layout
const TRACK_H = 3
const TRACK_Y = H - TRACK_H

const GAP     = 10
const BLOCK_W = ICON_W + GAP + TEXT_W
const ICON_X  = Math.round((W - BLOCK_W) / 2)
const ICON_Y  = Math.round((TRACK_Y - ICON_H) / 2)
const TEXT_X  = ICON_X + ICON_W + GAP
const TEXT_Y  = ICON_Y

// Bar geometry
const BAR_W  = 110
const TRAVEL = W + BAR_W

// Palette indices for the animated bar (within the purple gradient 8-55)
const BAR_TRAIL  = 10  // very dark purple   -- trailing edge
const BAR_MID    = 30  // primary purple     -- main body
const BAR_BRIGHT = 46  // light purple       -- leading edge glow

// Base pixel layer (bg + track + icon + text -- shared across all frames)
const BASE = new Uint8Array(W * H).fill(0)

// Track
for (let y = TRACK_Y; y < TRACK_Y + TRACK_H; y++)
  for (let x = 0; x < W; x++) BASE[y * W + x] = 6

// Icon
for (let y = 0; y < ICON_H; y++) {
  for (let x = 0; x < ICON_W; x++) {
    const src = (y * ICON_W + x) * 4
    const c = nearestPaletteIdx(
      ICON_RGBA[src], ICON_RGBA[src + 1], ICON_RGBA[src + 2], ICON_RGBA[src + 3],
    )
    const dy = ICON_Y + y, dx = ICON_X + x
    if (dy >= 0 && dy < TRACK_Y && dx >= 0 && dx < W)
      BASE[dy * W + dx] = c
  }
}

// Text (stamp only non-transparent pixels)
for (let y = 0; y < TEXT_FH; y++) {
  for (let x = 0; x < TEXT_W; x++) {
    const src = (y * TEXT_FW + x) * 4
    const a = TEXT_RGBA[src + 3]
    if (a < 16) continue
    const c = nearestPaletteIdx(
      TEXT_RGBA[src], TEXT_RGBA[src + 1], TEXT_RGBA[src + 2], a,
    )
    const dy = TEXT_Y + y, dx = TEXT_X + x
    if (dy >= 0 && dy < TRACK_Y && dx >= 0 && dx < W)
      BASE[dy * W + dx] = c
  }
}

// Per-frame pixel builder
function buildFrame(f) {
  const px = Uint8Array.from(BASE)
  const lead = Math.round((f / FRAMES) * TRAVEL)
  const tail = lead - BAR_W
  for (let y = TRACK_Y; y < TRACK_Y + TRACK_H; y++) {
    for (let x = Math.max(0, tail); x < Math.min(W, lead); x++) {
      const t = (x - tail) / BAR_W
      px[y * W + x] = t > 0.88 ? BAR_BRIGHT : t < 0.12 ? BAR_TRAIL : BAR_MID
    }
  }
  return px
}

// LZW encoder
function lzwEncode(data, minCode) {
  const clearCode = 1 << minCode, eoi = clearCode + 1
  let codeSize = minCode + 1, nextCode = eoi + 1
  const table = new Map()
  const bits = []
  const write = (c) => { for (let i = 0; i < codeSize; i++) bits.push((c >>> i) & 1) }
  const reset = () => {
    table.clear()
    for (let i = 0; i < clearCode; i++) table.set(`${i}`, i)
    nextCode = eoi + 1; codeSize = minCode + 1
  }
  reset(); write(clearCode)
  let buf = `${data[0]}`
  for (let i = 1; i < data.length; i++) {
    const next = `${buf},${data[i]}`
    if (table.has(next)) { buf = next; continue }
    write(table.get(buf))
    if (nextCode < 4096) {
      table.set(next, nextCode++)
      if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++
    } else { write(clearCode); reset() }
    buf = `${data[i]}`
  }
  write(table.get(buf)); write(eoi)
  const bytes = []
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0
    for (let j = 0; j < 8 && i+j < bits.length; j++) b |= bits[i+j] << j
    bytes.push(b)
  }
  return Buffer.from(bytes)
}

function subBlocks(buf) {
  const parts = []
  for (let i = 0; i < buf.length; i += 255) {
    const s = buf.subarray(i, i+255); parts.push(Buffer.from([s.length]), s)
  }
  parts.push(Buffer.from([0x00])); return Buffer.concat(parts)
}

// GIF assembly
const gctBuf = Buffer.alloc(PALETTE.length * 3)
PALETTE.forEach(([r,g,b],i) => { gctBuf[i*3]=r; gctBuf[i*3+1]=g; gctBuf[i*3+2]=b })

const lsd = Buffer.alloc(7)
lsd.writeUInt16LE(W, 0); lsd.writeUInt16LE(H, 2)
lsd[4] = 0x80 | (7 << 4) | GCT_SIZE
lsd[5] = 0; lsd[6] = 0

const loopExt = Buffer.concat([
  Buffer.from([0x21,0xFF,0x0B]),
  Buffer.from('NETSCAPE2.0'),
  Buffer.from([0x03,0x01,0x00,0x00,0x00]),
])

const parts = [Buffer.from('GIF89a'), lsd, gctBuf, loopExt]

for (let f = 0; f < FRAMES; f++) {
  const gce = Buffer.alloc(8)
  gce[0]=0x21; gce[1]=0xF9; gce[2]=0x04
  gce[3]=0b00001000
  gce.writeUInt16LE(FRAME_DELAY, 4)
  gce[6]=0x00; gce[7]=0x00

  const imgDesc = Buffer.alloc(10)
  imgDesc[0]=0x2C
  imgDesc.writeUInt16LE(0,1); imgDesc.writeUInt16LE(0,3)
  imgDesc.writeUInt16LE(W,5); imgDesc.writeUInt16LE(H,7)
  imgDesc[9]=0x00

  const compressed = lzwEncode(buildFrame(f), MIN_CODE_SZ)
  parts.push(gce, imgDesc, Buffer.from([MIN_CODE_SZ]), subBlocks(compressed))
}

parts.push(Buffer.from([0x3B]))

const gif = Buffer.concat(parts)
mkdirSync(join(__dir, '..', 'public', 'icons'), { recursive: true })
writeFileSync(OUT, gif)
console.log(`loading.gif -> ${gif.length} bytes  (${W}x${H} x ${FRAMES} frames @ ${FRAME_DELAY * 10}ms)`)
