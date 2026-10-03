// Functional smoke test against a PACKAGED build (out/win-unpacked or
// out/linux-unpacked, from `npm run build:win` / `build:linux`) — exercises
// the real asar/minified bundle, not the dev server. Auto-detects platform.
//
// Usage: node scripts/smoke-test.mjs
// On Linux without a display, wrap it: xvfb-run -a node scripts/smoke-test.mjs
import { _electron as electron } from 'playwright-core'
import { join, dirname } from 'node:path'
import { mkdtempSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
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

  // Seed a LEGACY (pre-buckets) history file so the migration path is exercised too.
  const userDataDir = mkdtempSync(join(tmpdir(), 'openflycut-smoketest-'))
  mkdirSync(userDataDir, { recursive: true })
  writeFileSync(
    join(userDataDir, 'history.json'),
    JSON.stringify({
      items: [{ id: 'legacy-1', text: 'legacy clip from v1', createdAt: Date.now() - 1000, pinned: false }]
    })
  )

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

    const hasView = await page.evaluate(() => typeof window.api?.view?.get === 'function')
    assert(hasView, 'contextBridge window.api.view is present')

    // Migration: the legacy file becomes a single "default" bucket, with a backup kept.
    const view0 = await page.evaluate(() => window.api.view.get())
    assert(view0.buckets.length === 1 && view0.buckets[0].name === 'default', 'legacy history migrates into a bucket named "default"')
    assert(view0.items.some((i) => i.text === 'legacy clip from v1'), 'legacy entries survive the migration')
    assert(existsSync(join(userDataDir, 'history.json.v1.bak')), 'original v1 history is backed up before migration')

    // innerText applies CSS text-transform, so compare case-insensitively.
    const bodyText = await page.evaluate(() => document.body.innerText)
    assert(bodyText.toLowerCase().includes('default'), 'popup shows the current bucket name')

    // Capture goes into the current bucket.
    const testText = 'Smoke test clip ' + Date.now()
    await app.evaluate((electronMod, t) => electronMod.clipboard.writeText(t), testText)
    await sleep(1200)
    const view1 = await page.evaluate(() => window.api.view.get())
    assert(
      view1.items.length === view0.items.length + 1 && view1.items[0].text === testText,
      'copied text round-trips through the watcher into the current bucket'
    )

    // Buckets: create, switch, capture into the new one, and keep the old one intact.
    const created = await page.evaluate(() => window.api.buckets.create('Work'))
    assert(created.ok, 'creating a bucket succeeds')
    const duplicate = await page.evaluate(() => window.api.buckets.create('work'))
    assert(!duplicate.ok, 'duplicate bucket names (case-insensitive) are rejected')
    const empty = await page.evaluate(() => window.api.buckets.create('   '))
    assert(!empty.ok, 'empty bucket names are rejected')

    await page.evaluate((id) => window.api.buckets.setCurrent(id), created.value.id)
    const workText = 'Work clip ' + Date.now()
    await app.evaluate((electronMod, t) => electronMod.clipboard.writeText(t), workText)
    await sleep(1200)
    const view2 = await page.evaluate(() => window.api.view.get())
    assert(view2.currentBucketId === created.value.id, 'switching the current bucket is reflected in the view')
    assert(view2.items.some((i) => i.text === workText), 'a copy made while "Work" is current lands in "Work"')
    assert(!view2.items.some((i) => i.text === testText), 'entries from "default" are not shown in "Work"')

    // Rename and delete.
    const renamed = await page.evaluate((id) => window.api.buckets.rename(id, 'Office'), created.value.id)
    assert(renamed.ok && renamed.value.name === 'Office', 'renaming a bucket succeeds')
    const deleted = await page.evaluate((id) => window.api.buckets.delete(id), created.value.id)
    assert(deleted.ok, 'deleting a bucket succeeds')
    const view3 = await page.evaluate(() => window.api.view.get())
    assert(view3.buckets.length === 1, 'only the remaining bucket is left after delete')
    assert(view3.currentBucketId === view3.buckets[0].id, 'deleting the current bucket falls back to another one')

    // Editing an entry's text.
    const edited = await page.evaluate(
      (args) => window.api.history.updateItemText(args.bucketId, args.id, 'edited text'),
      { bucketId: view3.currentBucketId, id: view3.items[0].id }
    )
    assert(edited.ok && edited.value[0].text === 'edited text', 'editing an entry text persists')
    const emptyEdit = await page.evaluate(
      (args) => window.api.history.updateItemText(args.bucketId, args.id, '  '),
      { bucketId: view3.currentBucketId, id: view3.items[0].id }
    )
    assert(!emptyEdit.ok, 'entries cannot be edited to empty text')

    // Shortcut validation: a clash between two of the three shortcut fields is refused.
    const clash = await page.evaluate(() =>
      window.api.settings.update({ bucketNextHotkey: 'CommandOrControl+Shift+V' })
    )
    assert(!!clash.shortcutErrors.bucketNextHotkey, 'a bucket shortcut that clashes with the main hotkey is refused')
    const okUpdate = await page.evaluate(() => window.api.settings.update({ bucketNextHotkey: 'CommandOrControl+Alt+Right' }))
    assert(Object.keys(okUpdate.shortcutErrors).length === 0, 'a valid bucket shortcut is accepted')

    const historyBytes = await page.evaluate(() => window.api.history.getSize())
    assert(historyBytes > 0, `history file size is reported for the settings tab (${historyBytes} bytes)`)

    const settings = await page.evaluate(() => window.api.settings.get())
    assert(settings.maxHistorySize === 99, `default maxHistorySize is 99 (got ${settings.maxHistorySize})`)

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
