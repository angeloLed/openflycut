const fs = require('fs')
const path = require('path')

// OpenFlyCut's UI is English-only, but Electron ships Chromium's locale
// files for ~55 languages (tens of MB) unconditionally. Strip everything
// except English so the packaged app isn't carrying dead weight.
const KEEP_LOCALES = new Set(['en-US.pak', 'en-GB.pak'])

exports.default = async function afterPack(context) {
  const localesDir =
    context.electronPlatformName === 'darwin'
      ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Frameworks', 'Electron Framework.framework', 'Resources')
      : path.join(context.appOutDir, 'locales')

  if (!fs.existsSync(localesDir)) return

  const removed = []
  for (const file of fs.readdirSync(localesDir)) {
    if (file.endsWith('.pak') && !KEEP_LOCALES.has(file)) {
      fs.unlinkSync(path.join(localesDir, file))
      removed.push(file)
    }
  }
  console.log(`[afterPack] removed ${removed.length} unused locale files from ${localesDir}`)
}
