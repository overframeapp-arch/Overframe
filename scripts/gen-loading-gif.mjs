/**
 * scripts/gen-loading-gif.mjs
 * Generates an animated GIF (370×44) for the Squirrel installer loading screen.
 *
 * Design: dark background matching the app theme, amber mascot icon on the left,
 * "OVERFRAME" label to its right, smooth indeterminate amber bar at the bottom.
 *
 * Uses @resvg/resvg-js (already a devDep) to rasterize the SVG icon.
 * Pure GIF89a encoding, no other external deps.
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

// ── Canvas ────────────────────────────────────────────────────────────────────
const W = 370
const H = 44
const FRAMES = 24         // one full sweep
const FRAME_DELAY = 4     // 4 × 10ms = 40ms → ~960ms per loop

// ── Colour palette (8 entries → GCT size field = 2, 2^3 = 8) ─────────────────
//  0  #111111  background
//  1  #F59E0B  amber main
//  2  #FDE68A  amber highlight (bar leading edge / icon highlight)
//  3  #78350F  amber very dark (bar trailing edge / icon deep shadow)
//  4  #1E1E1E  track (inactive bar background)
//  5  #EBEBEB  text + icon eye whites
//  6  #D97706  amber mid (icon body mid-tone)
//  7  #000000  icon pupils / eye outline
const PALETTE = [
  [0x11,0x11,0x11],
  [0xF5,0x9E,0x0B],
  [0xFD,0xE6,0x8A],
  [0x78,0x35,0x0F],
  [0x1E,0x1E,0x1E],
  [0xEB,0xEB,0xEB],
  [0xD9,0x77,0x06],
  [0x00,0x00,0x00],
]

// ── Icon rendering ────────────────────────────────────────────────────────────
const ICON_SIZE = 30  // render icon at 30×30 px
const svgData   = readFileSync(join(__dir, '..', 'public', 'icons', 'icon-amber.svg'), 'utf8')
const resvg     = new Resvg(svgData, { fitTo: { mode: 'width', value: ICON_SIZE } })
const rendered  = resvg.render()
const ICON_RGBA = rendered.pixels   // Buffer: RGBA, row-major
const ICON_W    = rendered.width
const ICON_H    = rendered.height

// Map an RGBA pixel to the nearest palette index (transparent → background)
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

// ── Layout ────────────────────────────────────────────────────────────────────
const GCT_SIZE    = 2   // 2^(2+1) = 8 entries
const MIN_CODE_SZ = 3   // ≥ ceil(log2(8))

// ── Bar geometry ──────────────────────────────────────────────────────────────
const TRACK_H = 3
const TRACK_Y = H - TRACK_H   // bottom 3 px
const BAR_W   = 120            // moving highlight width
const TRAVEL  = W + BAR_W     // total animation travel distance

// ── 3×5 pixel font (just the chars in "OVERFRAME") ───────────────────────────
const GLYPHS = {
  O: ['111','101','101','101','111'],
  V: ['101','101','101','010','010'],
  E: ['111','100','110','100','111'],
  R: ['110','101','110','101','101'],
  F: ['111','100','110','100','100'],
  A: ['010','101','111','101','101'],
  M: ['101','111','111','101','101'],
}
const LABEL       = 'OVERFRAME'
const GLYPH_W     = 3
const GLYPH_H     = 5
const GLYPH_SCALE = 2   // each glyph cell → 2×2 pixels
const GLYPH_GAP   = 2   // pixels between chars (post-scale)
const labelW      = LABEL.length * (GLYPH_W * GLYPH_SCALE + GLYPH_GAP) - GLYPH_GAP

// Icon + 8px gap + label, centred horizontally
const ICON_GAP   = 8
const blockW     = ICON_W + ICON_GAP + labelW
const ICON_X     = Math.round((W - blockW) / 2)
const ICON_Y     = Math.round((TRACK_Y - ICON_H) / 2)
const labelX     = ICON_X + ICON_W + ICON_GAP
const labelY     = Math.round((TRACK_Y - GLYPH_H * GLYPH_SCALE) / 2)

// ── Build base pixel layer (bg + track + icon + text, shared across frames) ───
const BASE = new Uint8Array(W * H).fill(0)
// Track
for (let y = TRACK_Y; y < TRACK_Y + TRACK_H; y++)
  for (let x = 0; x < W; x++) BASE[y * W + x] = 4

// Icon — map RGBA → palette and stamp
for (let y = 0; y < ICON_H; y++) {
  for (let x = 0; x < ICON_W; x++) {
    const src = (y * ICON_W + x) * 4
    const c = nearestPaletteIdx(
      ICON_RGBA[src], ICON_RGBA[src + 1], ICON_RGBA[src + 2], ICON_RGBA[src + 3]
    )
    const dy = ICON_Y + y, dx = ICON_X + x
    if (dy >= 0 && dy < TRACK_Y && dx >= 0 && dx < W)
      BASE[dy * W + dx] = c
  }
}

// Text label
// Text label
for (let ci = 0; ci < LABEL.length; ci++) {
  const rows = GLYPHS[LABEL[ci]]
  if (!rows) continue
  const cx = labelX + ci * (GLYPH_W * GLYPH_SCALE + GLYPH_GAP)
  for (let row = 0; row < GLYPH_H; row++) {
    for (let col = 0; col < GLYPH_W; col++) {
      if (rows[row][col] !== '1') continue
      for (let dy = 0; dy < GLYPH_SCALE; dy++) {
        for (let dx = 0; dx < GLYPH_SCALE; dx++) {
          const px = cx + col * GLYPH_SCALE + dx
          const py = labelY + row * GLYPH_SCALE + dy
          if (px >= 0 && px < W && py >= 0 && py < H) BASE[py * W + px] = 5
        }
      }
    }
  }
}

// ── Per-frame pixel builder ───────────────────────────────────────────────────
function buildFrame(f) {
  const px = Uint8Array.from(BASE)
  const lead = Math.round((f / FRAMES) * TRAVEL)
  const tail = lead - BAR_W
  for (let y = TRACK_Y; y < TRACK_Y + TRACK_H; y++) {
    for (let x = Math.max(0, tail); x < Math.min(W, lead); x++) {
      const t = (x - tail) / BAR_W
      px[y * W + x] = t > 0.88 ? 2 : t < 0.12 ? 3 : 1
    }
  }
  return px
}

// ── LZW encoder ───────────────────────────────────────────────────────────────
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

// ── GIF assembly ──────────────────────────────────────────────────────────────
const gctBuf = Buffer.alloc(PALETTE.length * 3)
PALETTE.forEach(([r,g,b],i) => { gctBuf[i*3]=r; gctBuf[i*3+1]=g; gctBuf[i*3+2]=b })

const lsd = Buffer.alloc(7)
lsd.writeUInt16LE(W, 0); lsd.writeUInt16LE(H, 2)
lsd[4] = 0x80 | (7 << 4) | GCT_SIZE  // GCTF=1 | color-res=7 | sort=0 | size
lsd[5] = 0; lsd[6] = 0

// Netscape 2.0 loop extension — loop forever
const loopExt = Buffer.concat([
  Buffer.from([0x21,0xFF,0x0B]),
  Buffer.from('NETSCAPE2.0'),
  Buffer.from([0x03,0x01,0x00,0x00,0x00]),
])

const parts = [Buffer.from('GIF89a'), lsd, gctBuf, loopExt]

for (let f = 0; f < FRAMES; f++) {
  const gce = Buffer.alloc(8)
  gce[0]=0x21; gce[1]=0xF9; gce[2]=0x04
  gce[3]=0b00001000           // disposal=restore-to-bg, no transparency
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

parts.push(Buffer.from([0x3B]))  // GIF trailer

const gif = Buffer.concat(parts)
mkdirSync(join(__dir, '..', 'public', 'icons'), { recursive: true })
writeFileSync(OUT, gif)
console.log(`✓ loading.gif → ${gif.length} bytes  (${W}×${H} × ${FRAMES} frames @ ${FRAME_DELAY * 10}ms)`)
