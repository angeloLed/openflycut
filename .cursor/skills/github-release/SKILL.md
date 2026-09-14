---
name: github-release
description: Publishes a new OpenFlyCut version to GitHub Releases — builds the installer, tags the version, and uploads the artifacts with the gh CLI. Use when the user asks to cut/ship/publish a release, "fai una release", "pubblica la release vX.Y.Z", or similar.
disable-model-invocation: true
icon: rocket
color: green
---

# GitHub Release

Publishes the current version of OpenFlyCut as a GitHub Release: builds the
platform installer, tags the commit, and uploads the artifacts, using
`scripts/release.mjs` (wrapped by the `npm run release:*` scripts).

This is a **manual, on-demand release flow** (no CI/CD, no `publish` config
in `electron-builder.yml`). Only run it when the user explicitly asks for a
release — never trigger it as a side effect of an unrelated task.

## Prerequisites — verify before running anything

1. `gh --version` succeeds and `gh auth status` shows an authenticated
   account. If either fails, stop and tell the user to install the GitHub
   CLI (https://cli.github.com/) and run `gh auth login`.
2. `git status --porcelain` is empty (clean working tree). If not, ask the
   user whether to commit/stash first, or explicitly opt into `--allow-dirty`.
3. `package.json`'s `"version"` field has already been bumped for this
   release. If it still matches the last published tag, ask the user for the
   new version and update `package.json` (and `CHANGELOG.md` if the project
   has one) in a separate commit before releasing.
4. Confirm which platform to build: `win`, `mac`, or `linux` (defaults to the
   current OS if omitted). Building for `mac` requires running on macOS;
   `electron-builder` cannot cross-compile a signed `.dmg` from Windows/Linux.

## Multi-platform releases (Windows + Linux)

The Linux target must be built inside the project's Docker image
(`Dockerfile`), never natively on the Windows host — `koffi`/Electron need
Linux-native prebuilt binaries, and a Windows host produces the wrong ones.
Conversely the Windows NSIS installer cannot be built inside Docker at all —
it must run natively on Windows. So a combined release always runs the
script **once per platform**, on the environment that platform actually
requires:

```bash
# 1) Windows — native, creates the tag + GitHub release
npm run release:win

# 2) Linux — build inside Docker, then publish from the host without rebuilding
docker build -t openflycut-dev .
docker run --rm -v "$PWD":/app -v /app/node_modules openflycut-dev npm run typecheck
docker run --rm -v "$PWD":/app -v /app/node_modules openflycut-dev npm run build:linux
docker run --rm -v "$PWD":/app -v /app/node_modules openflycut-dev xvfb-run -a npm run smoke-test
npm run release:linux -- --skip-build
```

`release.mjs` detects that the `v<version>` release already exists (created
in step 1) and switches to "attach" mode automatically: it skips
tagging/pushing and just runs `gh release upload` with the Linux artifacts
instead of `gh release create`. Order matters only in that *some* platform
must run first to create the release — Windows first is the natural choice
since it runs natively without Docker.

## Steps (single platform)

1. Run the release script for the target platform:
   ```bash
   npm run release:win   # or release:mac / release:linux
   ```
   This runs `typecheck`, then `build:<platform>`, then — if no GitHub
   release for `v<version>` exists yet — creates and pushes the git tag and
   runs `gh release create` with the built installer (and `.blockmap` file,
   if present) from `release/`. If the release already exists (e.g. Windows
   was published first), it uploads this platform's artifacts to it instead.

2. Before running the real command, do a dry run and show the user what
   would happen:
   ```bash
   npm run release -- <platform> --dry-run
   ```
   `--dry-run` still builds and collects artifacts, but skips tagging,
   pushing, and creating the GitHub release — it only prints the commands
   it *would* run.

3. **Creating a GitHub Release is a public, visible action.** After the dry
   run, show the user the resolved tag name and the list of artifact files,
   and get explicit confirmation before running the real (non-dry-run)
   command.

4. If the user wants to review before it goes public, add `--draft` to
   create the release as a draft:
   ```bash
   npm run release -- <platform> --draft
   ```
   Then point them to the release's GitHub Releases page to publish it
   manually when ready.

5. After a successful run, report the release URL that `gh` printed (last
   line of output) back to the user.

## Useful flags (`node scripts/release.mjs [win|mac|linux] [flags]`)

- `--dry-run` — build and validate, but don't tag, push, or create the release.
- `--draft` — create the GitHub Release as a draft instead of publishing it.
- `--skip-build` — reuse whatever installer is already in `release/` instead
  of rebuilding (only if the user already built it in this session).
- `--allow-dirty` — proceed with an uncommitted working tree (avoid unless
  the user explicitly asks for it).
- `--force` — re-tag/overwrite even if `v<version>` already exists locally
  or on `origin` (only if the user explicitly asks to redo a release).

## Failure modes to explain to the user

- **"gh" not found / not authenticated** — install/login instructions above.
- **Tag exists but no GitHub release found for it** — an inconsistent state
  (e.g. a previous run tagged but failed before creating the release); ask
  before using `--force`. This is different from the normal multi-platform
  case, where a release already existing is expected and handled
  automatically (see above).
- **No artifacts found in `release/`** — the build likely failed; check the
  build output above the error. For `linux`, confirm the build ran inside
  Docker, not natively on Windows.
- **Dirty working tree** — uncommitted changes; ask whether to commit them
  first rather than silently using `--allow-dirty`.
