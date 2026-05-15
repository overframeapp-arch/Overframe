#!/usr/bin/env node
/**
 * scripts/create-loading-gif.mjs
 *
 * Generates public/icons/loading.gif — the splash shown by the
 * Squirrel.Windows installer while it extracts the app.
 *
 * Pure Node.js, no external dependencies.
 * Output: 308×168 px animated GIF, dark bg + indigo progress bar, 5 frames.
 */

import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Canvas dimensions (Squirrel loading dialog standard) ─────────────────────
const W = 308
const H = 168

// ── Palette (4 entries → minCodeSize = 2) ────────────────────────────────────
// Index 0 = background  (#0f0f0f)
// Index 1 = accent bar  (#6366f1 indigo)
// Index 2 = bar track   (#2a2a3a dim blue-grey)
// Index 3 = unused
const BG    = 0
const TRACK = 2
const ACC   = 1

const PALETTE = [
  [15,  15,  15],   // 0 – near-black bg
  [99,  102, 241],  // 1 – indigo accent
  [42,  42,  58],   // 2 – dim track
  [15,  15,  15],   // 3 – unused (pad to power of 2)
]

// ── Progress-bar geometry ─────────────────────────────────────────────────────
const BAR_Y  = 148          // top of bar, near bottom of canvas
const BAR_H  = 4            // bar height in pixels
const BAR_X0 = 20           // left margin
const BAR_W  = W - BAR_X0 * 2  // 268 px total track width

// ── Build one frame ───────────────────────────────────────────────────────────
function buildFrame(progress /* 0.0–1.0 */) {
  const px = new Uint8Array(W * H) // default = 0 = BG
  const fillEnd = Math.round(BAR_X0 + BAR_W * progress)

  for (let y = BAR_Y; y < BAR_Y + BAR_H; y++) {
    // Draw full track in dim colour
    for (let x = BAR_X0; x < BAR_X0 + BAR_W; x++) {
      px[y * W + x] = TRACK
    }
    // Overwrite filled portion with accent
    for (let x = BAR_X0; x < fillEnd; x++) {
      px[y * W + x] = ACC
    }
  }

  return px
}

// ── LZW encoder ───────────────────────────────────────────────────────────────
function lzwEncode(pixels, minCodeSize) {
  const clearCode = 1 << minCodeSize
  const eoiCode   = clearCode + 1

  // Single-pixel codes (0..clearCode-1) are directly their own codes — no table
  // entry needed. Populate only composite (prefix_code << 8 | pixel) sequences.
  const initTable = () => ({ m: new Map(), next: eoiCode + 1 })

  let { m: table, next: nextCode } = initTable()
  let codeSize = minCodeSize + 1

  // Bit-packing
  const rawBytes = []
  let buf    = 0
  let bufLen = 0

  const emit = (code) => {
    buf    |= code << bufLen
    bufLen += codeSize
    while (bufLen >= 8) {
      rawBytes.push(buf & 0xFF)
      buf    >>>= 8
      bufLen  -= 8
    }
  }

  emit(clearCode)

  // LZW main loop — use composite numeric keys: (prefix << 8) | pixel
  // Works because our palette fits in 8 bits (4 colours).
  let prefix = pixels[0]

  for (let i = 1; i < pixels.length; i++) {
    const p   = pixels[i]
    const key = (prefix << 8) | p

    if (table.has(key)) {
      prefix = table.get(key)
    } else {
      emit(prefix)
      if (nextCode < 4096) {
        table.set(key, nextCode++)
        // Bump codeSize when table reaches the next power-of-2 boundary
        if (nextCode === (1 << codeSize) && codeSize < 12) codeSize++
      } else {
        // Table full — emit clear and reset
        emit(clearCode)
        ;({ m: table, next: nextCode } = initTable())
        codeSize = minCodeSize + 1
      }
      prefix = p
    }
  }

  emit(prefix)
  emit(eoiCode)
  if (bufLen > 0) rawBytes.push(buf & 0xFF)

  // Pack into GIF sub-blocks (max 255 bytes each)
  const out = [minCodeSize]
  for (let i = 0; i < rawBytes.length; i += 255) {
    const chunk = rawBytes.slice(i, i + 255)
    out.push(chunk.length, ...chunk)
  }
  out.push(0) // block terminator

  return out
}

// ── GIF89a writer ─────────────────────────────────────────────────────────────
function encodeGif(frames, delayHundredths) {
  const buf   = []
  const byte  = (...xs) => xs.forEach(x => buf.push(x & 0xFF))
  const word  = n       => { byte(n & 0xFF); byte((n >> 8) & 0xFF) }
  const ascii = s       => [...s].forEach(c => byte(c.charCodeAt(0)))

  // Header
  ascii('GIF89a')

  // Logical Screen Descriptor
  word(W); word(H)
  // Packed: GlobalCT present | ColorRes=001 | Sort=0 | GCT-size=001 (4 colours)
  byte(0b10000001)
  byte(BG)   // background colour index
  byte(0)    // pixel aspect ratio

  // Global Colour Table (4 entries = 12 bytes)
  for (const [r, g, b] of PALETTE) byte(r, g, b)

  // Netscape 2.0 Application Extension — infinite loop
  byte(0x21, 0xFF, 11)
  ascii('NETSCAPE2.0')
  byte(3, 1)
  word(0)    // loop count 0 = infinite
  byte(0)    // block terminator

  for (const px of frames) {
    // Graphic Control Extension
    byte(0x21, 0xF9, 4)
    byte(0b00000000)       // disposal=0, no user input, no transparent colour
    word(delayHundredths)  // delay in 1/100 s
    byte(0)                // transparent colour index (unused)
    byte(0)                // block terminator

    // Image Descriptor
    byte(0x2C)
    word(0); word(0)       // left, top
    word(W); word(H)
    byte(0)                // no local colour table, not interlaced

    // Image Data
    buf.push(...lzwEncode(px, 2))
  }

  byte(0x3B) // GIF Trailer
  return Buffer.from(buf)
}

// ── Main ──────────────────────────────────────────────────────────────────────
const PROGRESSES     = [0.10, 0.30, 0.55, 0.78, 1.00]
const DELAY_HUNDREDTHS = 18  // 180 ms per frame

const frames = PROGRESSES.map(buildFrame)
const gif    = encodeGif(frames, DELAY_HUNDREDTHS)

const outPath = resolve(__dirname, '../public/icons/loading.gif')
writeFileSync(outPath, gif)
console.log(`✓  loading.gif  ${gif.length} bytes  →  ${outPath}`)
