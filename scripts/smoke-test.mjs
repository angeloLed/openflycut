// Functional smoke test against a PACKAGED build (out/win-unpacked or
// out/linux-unpacked, from `npm run build:win` / `build:linux`) — exercises
// the real asar/minified bundle, not the dev server. Auto-detects platform.
//
// Usage: node scripts/smoke-test.mjs
// On Linux without a display, wrap it: xvfb-run -a node scripts/smoke-test.mjs
import { _electron as electron } from 'playwright-core'
import { join, dirname } from 'node:path'
import { mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')

const PLATFORM_CONFIG = {
  win32: { unpackedDir: 'win-unpacked', executable: 'OpenFlyCut.exe' },
  linux: { unpackedDir: 'linux-unpacked', executable: 'openflycut' }
}

function assert(condition, message) {
  if (!condition) throw new Error('ASSERTION FAILED: ' + message)
  console.log('OK:', message)
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const config = PLATFORM_CONFIG[process.platform]
  if (!config) {
    console.log(`No smoke-test config for platform "${process.platform}" — skipping.`)
    return
  }

  const unpackedDir = join(rootDir, 'release', config.unpackedDir)
  const executablePath = join(unpackedDir, config.executable)
  if (!existsSync(executablePath)) {
    throw new Error(
      `Packaged build not found at ${executablePath}. Run "npm run build:${process.platform === 'win32' ? 'win' : 'linux'}" first.`
    )
  }

  const userDataDir = mkdtempSync(join(tmpdir(), 'openflycut-smoketest-'))
  const launchArgs = [`--user-data-dir=${userDataDir}`]
  if (process.platform === 'linux') launchArgs.push('--no-sandbox', '--disable-gpu')

  console.log(`Launching ${executablePath}`)
  const app = await electron.launch({ executablePath, args: launchArgs, timeout: 30_000 })

  try {
    await sleep(1500)
    assert(await app.evaluate(({ app }) => app.isReady()), 'main process reports ready')
    assert(app.windows().length === 0, 'no window shown by default (tray-only, startMinimized)')

    // asar-internal paths — Electron reads straight out of the archive.
    const preloadPath = join(unpackedDir, 'resources', 'app.asar', 'out', 'preload', 'index.js')
    const htmlPath = join(unpackedDir, 'resources', 'app.asar', 'out', 'renderer', 'index.html')

    await app.evaluate(
      async ({ BrowserWindow }, { preloadPath, htmlPath }) => {
        const w = new BrowserWindow({
          width: 360,
          height: 420,
          show: true,
          webPreferences: { preload: preloadPath, contextIsolation: true, sandbox: true }
        })
        await w.loadFile(htmlPath)
      },
      { preloadPath, htmlPath }
    )
    await sleep(700)
    const page = app.windows().find((p) => p.url().includes('index.html'))
    assert(!!page, 'popup window opened and loaded')

    const consoleErrors = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    const emptyText = await page.evaluate(() => document.body.innerText)
    assert(emptyText.includes('No clipboard history yet'), 'popup renders the empty state')

    const hasApi = await page.evaluate(() => typeof window.api?.history?.getAll === 'function')
    assert(hasApi, 'contextBridge window.api is present')

    const testText = 'Smoke test clip ' + Date.now()
    await app.evaluate((electronMod, t) => electronMod.clipboard.writeText(t), testText)
    await sleep(1200)
    const history = await page.evaluate(() => window.api.history.getAll())
    assert(
      history.length === 1 && history[0].text === testText,
      `real clipboard capture round-trips through the watcher (got ${JSON.stringify(history)})`
    )

    const platform = await page.evaluate(() => window.api.app.getPlatform())
    assert(platform === process.platform, `app reports its own platform correctly (${platform})`)

    await sleep(300)
    assert(consoleErrors.length === 0, `no renderer console errors (got ${JSON.stringify(consoleErrors)})`)

    console.log('\nALL CHECKS PASSED')
  } finally {
    await app.close().catch(() => {})
  }
}

main().catch((err) => {
  console.error('\nSMOKE TEST FAILED:', err.message)
  process.exitCode = 1
})
