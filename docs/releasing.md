# Releasing

Rules (branches, versions, tags, notes, who may release): `.claude/rules/release-standards.md`. Every release goes on the Releases page: an APK for Android and an IPA that players sign with their own Apple ID through SideStore or AltStore. TestFlight is optional and runs only while its Apple setup is in place (user decision, 2026-11-06).

## Start a release

Run `.github/workflows/release.yml` by hand on `main` or a `release/v<major>.<minor>` branch. Inputs:

- `bump`: `auto` (default) reads the commits since the last tag; `patch`, `minor` or `major` forces it.
- `dry_run`: `true` (default) builds and checks only, keeping the APK and IPA as artifacts for 14 days; `false` tags, publishes and uploads to TestFlight if set up.

Ways to start it:

- GitHub: Actions, release, Run workflow, then pick the branch and inputs.
- GitHub CLI: `gh workflow run release.yml --ref main -f bump=auto -f dry_run=false`, then `gh run watch`.
- GitHub MCP tools: `actions_run_trigger` with `method: run_workflow`, `workflow_id: release.yml`, `ref: main` and `inputs: { bump: "auto", dry_run: "false" }`. Follow it with `actions_list` and `actions_get`; read failed jobs with `get_job_logs`; the result is at `get_latest_release`.

Preview with `git fetch --tags && pnpm release plan --dry-run` (prints the tag and notes, changes nothing). A dry run on another branch only warns, so pipeline changes can be tried before merging; `workflow_dispatch` needs the workflow file on `main` first.

## Jobs

1. `plan` runs `pnpm release plan` (`scripts/release/plan.ts`) with no dependencies installed, as `test.yml`'s `release-plan` job does on every pull request: it finds the last tag reachable from the commit, reads the commits since, and works out the next tag (`scripts/release/version.ts`). It fails when nothing but `repo` commits came in, when the branch may not cut that version, when the tag exists or the commit is already released, and, outside a dry run, when the Android key is missing. It turns TestFlight on only when all four Apple settings are present, and warns when some are. The planned notes go to the run's summary. Under Before you update they name the scenarios whose open games the release can reach: those whose golden checks changed since the last tag, and those `ENGINE_CHANGES` (`src/rules/engine/version.ts`) names after its engine version (`scripts/release/reach.ts`).
2. `checks` runs `test.yml` on the same commit: `data check`, lint, typecheck, the full test suite and the release plan.
3. `assets` packs once for both builds (`.github/actions/pack-assets` runs `pnpm assets`: `assets catalog`, `assets booklets` and `assets scans`, which fetch each pinned file and check its sha256) and hands them on as the `assets` artifact. A download that drops, times out or gets a 429 or 5xx is tried again; any other failure stops the pack at once. `assets/scans` is cached between runs so unchanged pictures are not fetched again, and a failed pack saves what it finished, so a rerun fetches only the rest.
4. `android` and `ios` start with the checks and the `assets` job. Each installs, restores its build caches (Caches) and generates its native project while the assets are packed, then waits in "Wait for the assets" (`.github/scripts/wait-for-assets.sh`) until the `assets` artifact exists, and fails there if the `assets` job ended without it. Both set `APP_VERSION`, which `app.config.js` turns into the version and the build number (`versionCode` on Android, `CFBundleVersion` on iOS).
   - `android` generates `android/` with `expo prebuild` and runs `./gradlew assembleRelease --build-cache` for `arm64-v8a`, signed with the release key. The NDK React Native pins and CMake are installed in the background while the job installs and generates, rather than by Gradle while it configures. It checks the signature with `apksigner`, fails when the certificate is not `ANDROID_CERT_SHA256` (Android key), refuses an APK over GitHub's 2 GiB asset limit, and uploads the APK, its `.sha256` and the certificate fingerprint as the `android` artifact.
   - `ios` runs on macOS with the latest stable Xcode: `expo prebuild --platform ios`, then one `xcodebuild archive`. Its app, zipped in `Payload/`, is `middle-earth-player-v<version>.ipa`, uploaded with its `.sha256` as the `ios` artifact; it is unsigned, since SideStore and AltStore sign it on the player's device. The IPA must stay under the 2 GiB asset limit too. With TestFlight set up, the archive is signed automatically through the App Store Connect API key and also exported for App Store Connect, as the `testflight` artifact.
5. `publish` (not on a dry run) needs the checks, the `assets` job and both builds. It plans again with `--expect` (so the tag cannot have moved), writes the notes with the APK's and the IPA's SHA-256 and the APK's signing certificate fingerprint, writes the SideStore and AltStore source (`pnpm release source`, `scripts/release/sideload-source.ts`), and runs `gh release create`, which makes the tag on the built commit and attaches the APK, the IPA, their `.sha256` files and `source.json`. Players add the source once, at `https://github.com/j-jmnz/middle-earth-player/releases/latest/download/source.json`; GitHub sends that URL to the newest release's file, so SideStore and AltStore offer each release as an update. A patch from a release branch is not marked Latest.
6. `testflight` (only with TestFlight set up) follows `publish`. fastlane's `pilot` uploads the IPA, waits for Apple to process it, sets What to Test from the release notes, and gives the build to the external TestFlight group, which sends the first build of each version to Apple's Beta App Review (usually within a day). Testers get the build when the review passes.

One release runs at a time; a second start waits.

## Caches

Each build restores what an earlier run built, so most releases compile only what changed. `release.yml` keeps these, each restored by its key or, when the key has no entry, by the newest entry under the key's prefix, and saved under the key when it was not an exact hit:

| Cache | Job | Key | Holds |
| --- | --- | --- | --- |
| `node-cache-<os>-<arch>-pnpm-` | every job that installs | lockfile | The pnpm store, under setup-node's key so `test.yml`'s entries are hits; pruned before it is saved (`.github/actions/install`). |
| `scans-<os>-` | `assets` | `data/sources.json` and the packing code | The packed card pictures (`.github/actions/pack-assets`). |
| `ccache-android-`, `ccache-ios-<Xcode build>-` | `android`, `ios` | lockfile | Compiled C, C++ and Objective-C of every native module, at most 1 GB each. Android launches its compilers through ccache from CMake; iOS sets `USE_CCACHE=1`, which the generated Podfile reads. |
| `gradle-home-` | `android` | lockfile | Gradle's dependencies, wrapper and build cache. |
| `pods-` | `ios` | lockfile | The CocoaPods download cache and React Native's prebuilt core, dependencies and Hermes. |
| `metro-android-`, `metro-ios-` | `android`, `ios` | lockfile, `babel.config.js`, `metro.config.js`, commit | The Metro transforms the last build used (`EXPO_METRO_CACHE_RESTORE_DIR` and `EXPO_METRO_CACHE_OUTPUT_DIR`, read by `@expo/metro-config`). |

Each build prints ccache's hit rate after it compiles. A release from `main` reads only `main`'s entries; a dry run from another branch can read them but writes its own. The caches share the repository's 10 GB, and GitHub drops the least recently used entry beyond it. Deleting an entry (Actions, Caches) is safe: the next run is as slow as one without it and saves it again.

## Signing

A release needs the Android key; `plan` refuses without it. The IPA needs no project signing; the Apple setup is only for TestFlight. Agents cannot create or read these secrets. Add them under Settings, Secrets and variables, Actions, and keep the originals in a password manager. Never commit a key (`.gitignore` refuses `*.jks`, `*.p8`, `*.p12`).

### Android key

Android updates in place only when both builds share a key, so one key signs every release permanently. Losing it forces players to uninstall, losing their saves. The owner creates it once:

```bash
keytool -genkeypair -v -keystore middle-earth-player-release.jks -alias release \
  -keyalg RSA -keysize 4096 -validity 36500
base64 -w0 middle-earth-player-release.jks > keystore.b64
```

Secrets: `ANDROID_KEYSTORE_BASE64` (the contents of `keystore.b64`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`release`) and `ANDROID_KEY_PASSWORD`. Delete `keystore.b64` afterwards. Without them a dry run signs with the debug key and says so.

After the first release, set the variable `ANDROID_CERT_SHA256` to the certificate fingerprint the `android` job printed (also in the release notes). From then on a build signed with any other key fails before it is published, since players could not update over the last release. Until it is set, each signed build warns with the value to use.

### TestFlight (optional)

Needs a paid Apple Developer Program membership. Each version goes through Beta App Review, which applies the App Review Guidelines (intellectual property included) and can refuse a build. The GitHub release does not wait for it; a refusal only means TestFlight testers miss that release. One-time setup by the owner:

1. In the developer account, register the bundle id `com.middleearth.player`. In App Store Connect, create the app with that bundle id.
2. In App Store Connect, Users and Access, Integrations, make an App Store Connect API key with the Admin role (so Xcode can make the distribution certificate and profile itself), and download its `.p8` once.
3. In the app's TestFlight tab, fill in the Test Information (beta description, feedback email, contact for Beta App Review), make an external group named `Players`, and turn on its public link. In App Information, set the Privacy Policy URL to `https://github.com/j-jmnz/middle-earth-player/blob/main/PRIVACY.md`, the page Settings, About links to.
4. Secrets: `APP_STORE_CONNECT_KEY_BASE64` (`base64 -i AuthKey_<id>.p8`), `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`. Variables: `APPLE_TEAM_ID` (the ten-character team id), `TESTFLIGHT_URL` (the group's public link, which the notes give players while it is set) and, for a group with another name, `TESTFLIGHT_GROUP`.

To turn TestFlight off, delete `APPLE_TEAM_ID` and `TESTFLIGHT_URL`; the next release skips the job and its notes leave the link out.

`app.json` declares that the app uses no non-exempt encryption (`ITSAppUsesNonExemptEncryption`), so App Store Connect asks no export compliance question per build.

## Installing

The players' guide is the README's Install section; keep it in line with what the pipeline ships. While TestFlight is on, its 90-day expiry means a release at least every 90 days (`.claude/rules/release-standards.md`, Tags and releases).

## Troubleshooting

- `plan` says only `repo` commits came in: run again with `bump: patch` if the change should ship.
- `plan` says the tag exists or the commit is released: nothing to do, or a tag was made by hand; do not delete it (`.claude/rules/release-standards.md`, Tags and releases).
- `plan` says the Android key is missing: add its secrets (Signing, Android key). A warning that the Apple signing is partly set up means TestFlight was skipped: add the rest or remove what is there.
- `checks` fails: fix it on `main` through a pull request and start again. Nothing was tagged.
- `android` or `ios` fails packing pictures: a pinned file moved or changed upstream; `pnpm data sync scans pictures` moves the pins (CLAUDE.md, Data). A Gradle failure after an Expo or React Native upgrade usually wants another Java version in the `setup-java` step; an Xcode failure, another `xcode-version`.
- `ios` fails signing (TestFlight on): the API key lacks the Admin role, the team id is wrong, or the bundle id is not registered to that team. Remove `APPLE_TEAM_ID` to release without TestFlight meanwhile.
- `publish` fails: re-run the failed jobs. The tag is made with the release, in one call, so a failed publish leaves neither.
- `testflight` fails after the release is published, or Beta App Review refuses the build: the GitHub release and its IPA stand. For a failed upload, re-run that job alone; it reads its IPA and the notes from the run's artifacts. Apple refuses a build number it already has, so a release whose upload succeeded is not uploaded again.
