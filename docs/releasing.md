# Releasing

How a release is cut and shipped. The rules (branches, versions, tags, notes, who may release) are in `.claude/rules/release-standards.md`; this doc says how the pipeline carries them out. The app is not listed on the Play Store or the App Store: Android players download the APK from the repository's Releases page, and iPhone and iPad players install the same release through TestFlight, Apple's beta channel (user decision, 2026-11-06).

## Start a release

The release is `.github/workflows/release.yml`, started by hand on `main` (or a `release/v<major>.<minor>` branch). It takes two inputs:

- `bump`: `auto` (the default) reads the commits since the last tag; `patch`, `minor` or `major` forces that bump.
- `dry_run`: `true` (the default) builds and checks only, leaving the APK and the IPA as workflow artifacts for 14 days; `false` tags, publishes and uploads to TestFlight.

Start it whichever way you have:

- On GitHub: Actions, release, Run workflow, pick the branch and the inputs.
- With the GitHub CLI: `gh workflow run release.yml --ref main -f bump=auto -f dry_run=false`, then `gh run watch`.
- As an agent with the GitHub MCP tools: `actions_run_trigger` with `method: run_workflow`, `workflow_id: release.yml`, `ref: main` and `inputs: { bump: "auto", dry_run: "false" }`; follow the run with `actions_list` and `actions_get`, and read a failed job with `get_job_logs`. The release is at `get_latest_release` once it is done.

Preview the version and notes first with `git fetch --tags && pnpm release:plan --dry-run`; it prints the tag and the notes and changes nothing. A dry run on another branch only warns, so a change to the pipeline can be tried before it merges (`workflow_dispatch` needs the workflow file on `main` first).

## Jobs

1. `plan` runs `pnpm release:plan` (`scripts/release/plan.ts`): it finds the last tag reachable from the commit, reads the commits since, and works out the next tag (`scripts/release/version.ts`). It fails when nothing but `repo` commits came in, when the branch may not cut that version, when the tag exists or the commit is already released, and, outside a dry run, when either platform's signing is missing. The planned notes go to the run's summary.
2. `checks` runs `test.yml` on the same commit: `data:check`, lint, typecheck and the full test suite.
3. `android` and `ios` build beside the checks, from the same packed assets (`.github/actions/pack-assets`: `pnpm catalog:build`, `booklets:pack` and `scans:pack`, which fetch each pinned file and check its sha256; `assets/scans` is cached between runs so unchanged pictures are not fetched again). Both set `APP_VERSION`, which `app.config.js` turns into the version and the build number (`versionCode` on Android, `CFBundleVersion` on iOS).
   - `android` generates `android/` with `expo prebuild` and runs `./gradlew assembleRelease` for `arm64-v8a`, signed with the release key. It checks the signature with `apksigner`, refuses an APK over GitHub's 2 GiB asset limit, and uploads the APK, its `.sha256` and the certificate fingerprint as the `android` artifact.
   - `ios` runs on macOS with the latest stable Xcode: `expo prebuild --platform ios`, then `xcodebuild archive` and `-exportArchive` for App Store Connect, signed automatically through the App Store Connect API key, and uploads `middle-earth-lcg-v<version>.ipa` as the `ios` artifact. Without the iOS signing a dry run archives unsigned, which checks the build but makes no IPA.
4. `publish` (not on a dry run) needs the checks and both builds. It plans again with `--expect` (so the tag cannot have moved), writes the notes with the APK's SHA-256 and the signing certificate's fingerprint, and runs `gh release create`, which makes the tag on the built commit and attaches `middle-earth-lcg-v<version>.apk` and its `.sha256`. A patch from a release branch is not marked Latest.
5. `testflight` follows `publish`. fastlane's `pilot` uploads the IPA, waits for Apple to process it, sets What to Test from the release notes, and gives the build to the external TestFlight group, which sends the first build of each version to Apple's Beta App Review (usually within a day). Testers get the build when the review passes.

The workflow runs one release at a time; a second start waits.

## Signing

Every release is signed for both platforms; `plan` refuses a release without both. An agent cannot make or read these secrets. Add each in the repository's Settings, Secrets and variables, Actions, and keep the originals in a password manager. Never commit a key (`.gitignore` refuses `*.jks`, `*.p8` and `*.p12`).

### Android key

Android installs an update over an earlier release only when both are signed with the same key, so one key signs every release, for good. Losing it means players must uninstall (and lose their saves) to move to a new one. The repository owner makes it once:

```bash
keytool -genkeypair -v -keystore middle-earth-lcg-release.jks -alias release \
  -keyalg RSA -keysize 4096 -validity 36500
base64 -w0 middle-earth-lcg-release.jks > keystore.b64
```

Secrets: `ANDROID_KEYSTORE_BASE64` (the contents of `keystore.b64`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`release`) and `ANDROID_KEY_PASSWORD`. Delete `keystore.b64` afterwards. Without them a dry run signs with the debug key and says so.

### Apple and TestFlight

TestFlight needs a paid Apple Developer Program membership. The owner sets it up once:

1. In the developer account, register the bundle id `com.middleearth.lcg`. In App Store Connect, create the app with that bundle id.
2. In App Store Connect, Users and Access, Integrations, make an App Store Connect API key with the Admin role (so Xcode can make the distribution certificate and profile itself), and download its `.p8` once.
3. In the app's TestFlight tab, fill in the Test Information (beta description, feedback email, contact for Beta App Review), make an external group named `Players`, and turn on its public link.
4. Secrets: `APP_STORE_CONNECT_KEY_BASE64` (`base64 -i AuthKey_<id>.p8`), `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`. Variables: `APPLE_TEAM_ID` (the ten-character team id), `TESTFLIGHT_URL` (the group's public link, which the notes and the README give players) and, for a group with another name, `TESTFLIGHT_GROUP`.

`app.json` declares that the app uses no non-exempt encryption (`ITSAppUsesNonExemptEncryption`), so App Store Connect asks no export compliance question per build.

## Installing

The README's Install section is the players' guide: the requirements, the Android and TestFlight steps, checking a download and what to do when an install fails. Keep it in step with what the pipeline ships. The 90-day TestFlight expiry is why a release is cut at least every 90 days (`.claude/rules/release-standards.md`, Tags and releases).

## When it fails

- `plan` says only `repo` commits came in: run again with `bump: patch` if the change should ship.
- `plan` says the tag exists or the commit is released: nothing to do, or a tag was made by hand; do not delete it (`.claude/rules/release-standards.md`, Tags and releases).
- `plan` says signing is missing: add the secrets and variables under Signing.
- `checks` fails: fix it on `main` through a pull request and start again. Nothing was tagged.
- `android` or `ios` fails packing pictures: a pinned file moved or changed upstream; `pnpm data:sync scans pictures` moves the pins (CLAUDE.md, Data). A Gradle failure after an Expo or React Native upgrade usually wants another Java version in the `setup-java` step; an Xcode failure, another `xcode-version`.
- `ios` fails signing: the API key lacks the Admin role, the team id is wrong, or the bundle id is not registered to that team.
- `publish` fails: re-run the failed jobs. The tag is made with the release, in one call, so a failed publish leaves neither.
- `testflight` fails after the release is published: re-run that job alone; it reads the IPA and the notes from the run's artifacts. Apple refuses a build number it already has, so a release whose upload succeeded is not uploaded again.
