import { Jimp } from 'jimp'
import pngToIco from 'png-to-ico'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const buildDir = join(__dirname, '..', 'build')
const resourcesDir = join(__dirname, '..', 'resources')

const TRANSPARENT = 0x00000000
const BOARD_COLOR = 0x3a7bd5ff
const CLIP_COLOR = 0xf5f5f5ff
const MASTER_SIZE = 256
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

function isOutsideRoundedRect(x, y, w, h, r) {
  const nearLeft = x < r
  const nearRight = x > w - r
  const nearTop = y < r
  const nearBottom = y > h - r
  if ((nearLeft || nearRight) && (nearTop || nearBottom)) {
    const cx = nearLeft ? r : w - r
    const cy = nearTop ? r : h - r
    const dx = x - cx
    const dy = y - cy
    return dx * dx + dy * dy > r * r
  }
  return false
}

function fillRect(image, x, y, w, h, color, radius) {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      if (radius > 0 && isOutsideRoundedRect(px - x, py - y, w, h, radius)) continue
      image.setPixelColor(color, px, py)
    }
  }
}

async function drawIcon(size) {
  const image = new Jimp({ width: size, height: size, color: TRANSPARENT })

  const pad = Math.round(size * 0.14)
  const boardW = size - pad * 2
  const boardH = size - pad * 2
  fillRect(image, pad, pad, boardW, boardH, BOARD_COLOR, Math.round(size * 0.08))

  const clipW = Math.round(size * 0.32)
  const clipH = Math.round(size * 0.12)
  const clipX = Math.round((size - clipW) / 2)
  const clipY = Math.round(pad * 0.35)
  fillRect(image, clipX, clipY, clipW, clipH, CLIP_COLOR, Math.round(size * 0.03))

  const lineX = pad + Math.round(size * 0.12)
  const lineW = boardW - Math.round(size * 0.24)
  const lineH = Math.round(size * 0.035)
  for (let i = 0; i < 4; i++) {
    const lineY = pad + Math.round(size * 0.28) + i * Math.round(size * 0.14)
    if (lineY + lineH > pad + boardH) break
    fillRect(image, lineX, lineY, lineW, lineH, CLIP_COLOR, 0)
  }

  return image
}

async function main() {
  await mkdir(buildDir, { recursive: true })
  await mkdir(resourcesDir, { recursive: true })

  const master = await drawIcon(MASTER_SIZE)
  const masterBuffer = await master.getBuffer('image/png')
  await writeFile(join(buildDir, 'icon.png'), masterBuffer)
  await writeFile(join(resourcesDir, 'icon.png'), masterBuffer)

  const buffers = []
  for (const size of ICO_SIZES) {
    const resized = await drawIcon(size)
    buffers.push(await resized.getBuffer('image/png'))
  }
  const icoBuffer = await pngToIco(buffers)
  await writeFile(join(buildDir, 'icon.ico'), icoBuffer)

  console.log('Generated build/icon.png, build/icon.ico and resources/icon.png')
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
