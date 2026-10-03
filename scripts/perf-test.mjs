// Latency benchmark against a PACKAGED build — measures the operations that
// decide whether the popup feels instant: fetching the list, selecting an
// item, and how long a new clipboard copy takes to show up in the UI.
// Seeds a realistic, full history (99 items with source-app icons) in an
// isolated profile first, so numbers are comparable across branches.
//
// Usage: node scripts/perf-test.mjs
import { _electron as electron } from 'playwright-core'
import { join, dirname } from 'node:path'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const PLATFORM_CONFIG = {
  win32: { unpackedDir: 'win-unpacked', executable: 'OpenFlyCut.exe' },
  linux: { unpackedDir: 'linux-unpacked', executable: 'openflycut' }
}
const config = PLATFORM_CONFIG[process.platform]
const unpackedDir = join(rootDir, 'release', config.unpackedDir)

// Small real PNG, reused as the icon for every seeded item.
const ICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAYklEQVR4nOySuw2AMAxE7Sidl6BnA3qWghqWomcDepZwndRxlI90VaS80vadzpYdgfhSQ1WDrYkIVw2288tEpf57rZwYWPF+/9SDIxDYIDvicyxVgV3NtwZmghESMIHAnxgBAAD//x2UFf4AAAAGSURBVAMAg3Ehn/CS6+oAAAAASUVORK5CYII='

function stats(samples) {
  const s = [...samples].sort((a, b) => a - b)
  const avg = s.reduce((a, b) => a + b, 0) / s.length
  return { avg: avg.toFixed(1), p95: s[Math.floor(s.length * 0.95)].toFixed(1), max: s[s.length - 1].toFixed(1) }
}

async function main() {
  if (!config) throw new Error(`No perf config for ${process.platform}`)
  const userDataDir = mkdtempSync(join(tmpdir(), 'openflycut-perf-'))
  // Seed in the legacy (v1) format — the current branch migrates it on start.
  const items = Array.from({ length: 99 }, (_, i) => ({
    id: `seed-${i}`,
    text: `Seeded clipboard entry #${i} — lorem ipsum dolor sit amet, consectetur ${i}`,
    createdAt: Date.now() - i * 1000,
    pinned: false,
    sourceApp: { name: 'Seed', iconDataUrl: ICON }
  }))
  mkdirSync(userDataDir, { recursive: true })
  writeFileSync(join(userDataDir, 'history.json'), JSON.stringify({ items }))

  const app = await electron.launch({
    executablePath: join(unpackedDir, config.executable),
    args: [`--user-data-dir=${userDataDir}`, ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-gpu'] : [])],
    timeout: 30_000
  })
  try {
    await sleep(1500)
    const preloadPath = join(unpackedDir, 'resources', 'app.asar', 'out', 'preload', 'index.js')
    const htmlPath = join(unpackedDir, 'resources', 'app.asar', 'out', 'renderer', 'index.html')
    await app.evaluate(
      async ({ BrowserWindow }, { preloadPath, htmlPath }) => {
        const w = new BrowserWindow({ width: 380, height: 420, show: false, webPreferences: { preload: preloadPath, contextIsolation: true, sandbox: true } })
        await w.loadFile(htmlPath)
        global.__perfWin = w
      },
      { preloadPath, htmlPath }
    )
    await sleep(600)
    const page = app.windows().find((p) => p.url().includes('index.html'))

    // Which API shape does this build expose? (main: history.getAll, branch: view.get)
    const hasView = await page.evaluate(() => !!window.api.view)

    const fetchTimes = []
    for (let i = 0; i < 40; i++) {
      const t = await page.evaluate(async (hasView) => {
        const t0 = performance.now()
        if (hasView) await window.api.view.get()
        else await window.api.history.getAll()
        return performance.now() - t0
      }, hasView)
      fetchTimes.push(t)
    }

    const selectTimes = []
    for (let i = 0; i < 10; i++) {
      const t = await page.evaluate(async ({ hasView, i }) => {
        const view = hasView ? await window.api.view.get() : null
        const list = hasView ? view.items : await window.api.history.getAll()
        const id = list[i].id
        const t0 = performance.now()
        if (hasView) await window.api.history.selectItem(view.currentBucketId, id)
        else await window.api.history.selectItem(id)
        return performance.now() - t0
      }, { hasView, i })
      selectTimes.push(t)
    }

    const captureTimes = []
    for (let i = 0; i < 5; i++) {
      const text = `perf capture ${i} ${Date.now()}`
      const t0 = Date.now()
      await app.evaluate((electronMod, t) => electronMod.clipboard.writeText(t), text)
      let seen = false
      while (!seen && Date.now() - t0 < 5000) {
        await sleep(15)
        seen = await page.evaluate(async ({ hasView, text }) => {
          const list = hasView ? (await window.api.view.get()).items : await window.api.history.getAll()
          return list.some((x) => x.text === text)
        }, { hasView, text })
      }
      captureTimes.push(Date.now() - t0)
      await sleep(200)
    }

    console.log(`build: ${hasView ? 'view API (buckets branch)' : 'history API (main)'} — ${items.length} seeded items with icons`)
    console.log(`fetch list  (ms): ${JSON.stringify(stats(fetchTimes))}`)
    console.log(`select item (ms): ${JSON.stringify(stats(selectTimes))}`)
    console.log(`copy → UI   (ms): ${JSON.stringify(stats(captureTimes))}`)
  } finally {
    await app.close().catch(() => {})
  }
}

main().catch((err) => {
  console.error('PERF TEST FAILED:', err.message)
  process.exitCode = 1
})
