// Builds an installer and publishes it as a GitHub Release via the `gh` CLI.
// Usage: node scripts/release.mjs [win|mac|linux] [--draft] [--dry-run] [--skip-build] [--allow-dirty] [--force]
//
// Multi-platform releases: run once per platform. The first run creates the
// tag + GitHub release; subsequent runs for other platforms (same version)
// detect the existing release and upload their artifacts to it instead.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const releaseDir = join(rootDir, 'release')

const PLATFORM_MAP = { win32: 'win', darwin: 'mac', linux: 'linux' }
// On Windows, npm is a .cmd shim — execFileSync needs the exact filename,
// unlike spawning through a shell which resolves PATHEXT automatically.
const NPM_CMD = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const ARTIFACT_PATTERNS = {
  win: [/\.exe$/i, /\.exe\.blockmap$/i],
  mac: [/\.dmg$/i, /\.zip$/i, /\.dmg\.blockmap$/i, /\.zip\.blockmap$/i],
  linux: [/\.AppImage$/i, /\.deb$/i]
}

const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('--')))
const platformArg = args.find((a) => !a.startsWith('--'))
const platform = platformArg ?? PLATFORM_MAP[process.platform]

const dryRun = flags.has('--dry-run')
const draft = flags.has('--draft')
const skipBuild = flags.has('--skip-build')
const allowDirty = flags.has('--allow-dirty')
const force = flags.has('--force')

function run(cmd, cmdArgs, options = {}) {
  console.log(`$ ${cmd} ${cmdArgs.join(' ')}`)
  if (dryRun && options.mutating) {
    console.log('  (skipped: --dry-run)')
    return ''
  }
  return execFileSync(cmd, cmdArgs, { cwd: rootDir, encoding: 'utf8', stdio: options.silent ? 'pipe' : 'inherit', ...options })
}

function fail(message) {
  console.error(`\nrelease.mjs: ${message}`)
  process.exit(1)
}

async function main() {
  if (!ARTIFACT_PATTERNS[platform]) {
    fail(`Unknown or unsupported platform "${platform}". Use one of: win, mac, linux.`)
  }

  // gh CLI must be installed and authenticated before anything else.
  try {
    execFileSync('gh', ['--version'], { stdio: 'pipe' })
  } catch {
    fail('GitHub CLI ("gh") was not found. Install it from https://cli.github.com/ and run "gh auth login" first.')
  }
  try {
    execFileSync('gh', ['auth', 'status'], { stdio: 'pipe' })
  } catch {
    fail('"gh" is not authenticated. Run "gh auth login" first.')
  }

  if (!allowDirty) {
    const status = execFileSync('git', ['status', '--porcelain'], { cwd: rootDir, encoding: 'utf8' })
    if (status.trim().length > 0) {
      fail('Working tree is not clean. Commit or stash your changes, or pass --allow-dirty.')
    }
  }

  try {
    execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: rootDir, stdio: 'pipe' })
  } catch {
    fail('No "origin" remote configured. Run: git remote add origin <github-repo-url>')
  }

  const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'))
  const tag = `v${pkg.version}`
  console.log(`Preparing release ${tag} (platform: ${platform})`)

  // If a GitHub release for this tag already exists (e.g. Windows was
  // published first), switch to "attach" mode: just upload this platform's
  // artifacts to it instead of re-tagging/re-creating the release.
  let releaseExists = false
  try {
    execFileSync('gh', ['release', 'view', tag], { cwd: rootDir, stdio: 'pipe' })
    releaseExists = true
  } catch {
    releaseExists = false
  }

  if (!releaseExists) {
    const existingLocalTag = execFileSync('git', ['tag', '--list', tag], { cwd: rootDir, encoding: 'utf8' }).trim()
    let existingRemoteTag = ''
    try {
      existingRemoteTag = execFileSync('git', ['ls-remote', '--tags', 'origin', tag], { cwd: rootDir, encoding: 'utf8' }).trim()
    } catch {
      fail('Could not reach "origin" to check existing tags. Check your network connection and remote URL.')
    }
    if (!force && (existingLocalTag || existingRemoteTag)) {
      fail(`Tag ${tag} already exists locally/remotely but no GitHub release was found for it. Bump "version" in package.json, or pass --force to reuse the tag.`)
    }
  }

  if (!skipBuild) {
    run(NPM_CMD, ['run', 'typecheck'])
    run(NPM_CMD, ['run', `build:${platform}`])
  } else {
    console.log('Skipping build (--skip-build): reusing whatever is already in release/')
  }

  if (!existsSync(releaseDir)) {
    fail(`No release/ directory found. Run without --skip-build, or build manually first.`)
  }
  const artifacts = readdirSync(releaseDir)
    .filter((f) => ARTIFACT_PATTERNS[platform].some((re) => re.test(f)))
    .map((f) => join(releaseDir, f))
  if (artifacts.length === 0) {
    fail(`No ${platform} installer artifacts found in release/. Did the build succeed?`)
  }
  console.log(`Found ${artifacts.length} artifact(s):`)
  artifacts.forEach((a) => console.log(`  - ${a}`))

  if (releaseExists) {
    console.log(`Release ${tag} already exists — uploading ${platform} artifacts to it.`)
    run('gh', ['release', 'upload', tag, ...artifacts, '--clobber'], { mutating: true })
  } else {
    run('git', ['tag', '-a', tag, '-m', tag], { mutating: true })
    run('git', ['push', 'origin', tag], { mutating: true })

    const ghArgs = ['release', 'create', tag, ...artifacts, '--title', tag, '--generate-notes']
    if (draft) ghArgs.push('--draft')
    run('gh', ghArgs, { mutating: true })
  }

  console.log(dryRun ? `\nDry run complete for ${tag}.` : `\nRelease ${tag} updated with ${platform} artifacts.`)
}

main().catch((err) => {
  console.error(`\nrelease.mjs: unexpected error — ${err.message}`)
  process.exitCode = 1
})
