# Releasing

How a release is cut and shipped. The rules (branches, versions, tags, notes, who may release) are in `.claude/rules/release-standards.md`; this doc says how the pipeline carries them out. The app is not on the Play Store or the App Store: players download the APK from the repository's Releases page.

## Start a release

The release is `.github/workflows/release.yml`, started by hand on `main` (or a `release/v<major>.<minor>` branch). It takes two inputs:

- `bump`: `auto` (the default) reads the commits since the last tag; `patch`, `minor` or `major` forces that bump.
- `dry_run`: `true` (the default) builds and checks only, leaving the APK as a workflow artifact for 14 days; `false` tags and publishes.

Start it whichever way you have:

- On GitHub: Actions, release, Run workflow, pick the branch and the inputs.
- With the GitHub CLI: `gh workflow run release.yml --ref main -f bump=auto -f dry_run=false`, then `gh run watch`.
- As an agent with the GitHub MCP tools: `actions_run_trigger` with `method: run_workflow`, `workflow_id: release.yml`, `ref: main` and `inputs: { bump: "auto", dry_run: "false" }`; follow the run with `actions_list` and `actions_get`, and read a failed job with `get_job_logs`. The release is at `get_latest_release` once it is done.

Preview the version and notes first with `git fetch --tags && pnpm release:plan --dry-run`; it prints the tag and the notes and changes nothing. A dry run on another branch only warns, so a change to the pipeline can be tried before it merges (`workflow_dispatch` needs the workflow file on `main` first).

## Jobs

1. `plan` runs `pnpm release:plan` (`scripts/release/plan.ts`): it finds the last tag reachable from the commit, reads the commits since, and works out the next tag (`scripts/release/version.ts`). It fails when nothing but `repo` commits came in, when the branch may not cut that version, when the tag exists or the commit is already released, and, outside a dry run, when the signing secrets are missing. The planned notes go to the run's summary.
2. `checks` runs `test.yml` on the same commit: `data:check`, lint, typecheck and the full test suite.
3. `android` builds the APK beside the checks. It packs the catalog, the booklets and every card picture (`pnpm catalog:build`, `booklets:pack`, `scans:pack`, fetching each pinned file and checking its sha256; `assets/scans` is cached between runs so unchanged pictures are not fetched again), generates `android/` with `expo prebuild`, and runs `./gradlew assembleRelease` for `arm64-v8a` with `APP_VERSION` set, which `app.config.js` turns into the version and `versionCode`. It signs with the release key, checks the signature with `apksigner`, refuses an APK over GitHub's 2 GiB asset limit, and uploads the APK, its `.sha256` and the certificate fingerprint as the `android` artifact.
4. `publish` (not on a dry run) needs all three. It plans again with `--expect` (so the tag cannot have moved), writes the notes with the APK's SHA-256 and the signing certificate's fingerprint, and runs `gh release create`, which makes the tag on the built commit and attaches `middle-earth-lcg-v<version>.apk` and its `.sha256`. A patch from a release branch is not marked Latest.

The workflow runs one release at a time; a second start waits.

## Signing key

Android installs an update over an earlier release only when both are signed with the same key, so one key signs every release, for good. Losing it means players must uninstall (and lose their saves) to move to a new one. The repository owner makes it once:

```bash
keytool -genkeypair -v -keystore middle-earth-lcg-release.jks -alias release \
  -keyalg RSA -keysize 4096 -validity 36500
base64 -w0 middle-earth-lcg-release.jks > keystore.b64
```

Then, in the repository's Settings, Secrets and variables, Actions, add `ANDROID_KEYSTORE_BASE64` (the contents of `keystore.b64`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`release`) and `ANDROID_KEY_PASSWORD`. Keep the `.jks` and both passwords in a password manager, delete `keystore.b64`, and never commit either (`.gitignore` refuses `*.jks`). An agent cannot make or read these secrets. Without them a dry run signs with the debug key and says so; a release fails in `plan`.

## Installing

A player opens the Releases page, downloads the `.apk` and opens it on an Android phone, allowing the browser or file manager to install unknown apps. A newer release installs over the older one and keeps every save. To check a download, compare `sha256sum` of the file with the `.sha256` asset, and the signer (`apksigner verify --print-certs`) with the fingerprint in the notes.

iOS has no download yet. A player builds it from source (README, On a phone); `docs/plans/ios-release.md` weighs the ways to ship one.

## When it fails

- `plan` says only `repo` commits came in: run again with `bump: patch` if the change should ship.
- `plan` says the tag exists or the commit is released: nothing to do, or a tag was made by hand; do not delete it (`.claude/rules/release-standards.md`, Tags and releases).
- `checks` fails: fix it on `main` through a pull request and start again. Nothing was tagged.
- `android` fails packing pictures: a pinned file moved or changed upstream; `pnpm data:sync scans pictures` moves the pins (CLAUDE.md, Data). A Gradle failure after an Expo or React Native upgrade usually wants another Java version in the `setup-java` step.
- `publish` fails: re-run the failed jobs. The tag is made with the release, in one call, so a failed publish leaves neither.
