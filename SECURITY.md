# Security

[PRIVACY.md](PRIVACY.md) describes what the app stores and sends. There are no accounts and no backend, and the app has no analytics, ads or crash reporting.

## Network

A release build makes two kinds of request. When you paste a RingsDB deck link, the app fetches that deck's public JSON from `ringsdb.com`, along with the name of any card it doesn't know (`src/screens/routes/deck-import.tsx`). While Check for new versions is on, at most once a day it fetches `https://api.github.com/repos/j-jmnz/middle-earth-player/releases/latest` with no header of its own and reads only the tag and the date (`src/screens/update/check.ts`, `src/ui/update-offer.ts`); Get it opens a release page built from that version, never a URL from the answer. Nothing else in the app calls `fetch`.

Card pictures are bundled with the app (`pnpm assets scans`). In a release build, `remotePictureUrl` (`src/screens/images/remote.native.ts`) returns no URL, so a card without a bundled picture is drawn as text instead. Development and browser builds (`remote.ts`) download those pictures from `ringsdb.com`, or from the Hall of Beorn and DragnCards buckets on `s3.amazonaws.com`; the desktop build (`EXPO_PUBLIC_DESKTOP=1`, `src/screens/nav/desktop.ts`) makes `remote.ts` return no URL either, so it fetches no picture. The web booklet reader loads pdf.js and its worker from the app's own origin (`public/pdfjs`, `pnpm assets pdfjs`), opens a book from its bundled asset URL or from the browser's private file storage, and sets pdf.js's `isEvalSupported` to false; a book the player adds is checked for the PDF header and opened by pdf.js before it is kept (`src/screens/booklets/store.ts`). `src/screens/images/policy.ts` refuses every other host, as well as any URL that isn't HTTPS or that carries credentials, a port, a query or `..`.

The desktop app (Electron, `desktop/`) holds the web build to the same rule in the shell instead of trusting the page. It serves the export from disk over `app://middle-earth-player/`, with a Content-Security-Policy that allows no host but `https://ringsdb.com` and the update check's one URL (`desktop/serve.ts`), and `session.webRequest` cancels every request except the app's own, the RingsDB deck import's endpoints and that URL (`desktop/policy.ts`, tested). The window runs sandboxed with context isolation and no Node integration; its preload exposes one boolean and its change event (whether the platform's screen reader is on) and nothing else. Navigation away from the app is refused, a new window is never opened, only links to the project's GitHub page reach the system browser, every permission request is denied, and the shipped Electron has the `runAsNode`, `NODE_OPTIONS` and load-outside-the-asar fuses off. `pnpm desktop smoke` checks that no request leaves `app://`. The installers are unsigned, like the iOS app: Windows shows SmartScreen and macOS asks you to open the app from its context menu, and checksums are on the release page. The app has no auto-update: the update check only says that a release is out.

On Android the app asks for `INTERNET`, for deck import and the update check, and `VIBRATE`, for haptics. `app.json` (`android.blockedPermissions`) removes the overlay and external-storage permissions that Expo and its libraries would otherwise add. On iOS the app asks for no permissions. Rulebook PDFs open through the system file picker, which needs none.

At build time, `pnpm data sync` is the only command that uses the network. It fetches the sources listed in `data/sources.json` and checks each one against its pinned sha256 or git commit.

## Supply chain

- `pnpm-lock.yaml` is committed, and CI installs with `--frozen-lockfile`.
- CI (`.github/workflows/test.yml`) runs with a read-only token, so pull requests from forks can't write to the repository. Every action used there and in `.github/workflows/release.yml`, which holds the signing keys, is pinned to a commit SHA.
- Releases are only ever started by hand. `.github/workflows/release.yml` and `.eas/workflows/e2e.yml` run on `workflow_dispatch` alone, which needs write access to the repository, or for EAS a login to the project's Expo account. A real release refuses to run from any branch other than `main` or `release/v<major>.<minor>`. `scripts/checks/release-trigger.test.ts` fails if either workflow gains another trigger, or if any other workflow creates a tag or a release.
- The desktop installers are built by the same release workflow from the tagged commit, on GitHub's Windows, macOS and Linux runners, and each ships with a `.sha256` file and its SHA-256 in the release notes. They are unsigned (Windows Authenticode is an optional step that runs only when its secrets exist; macOS notarization is not set up), so check the checksum if you want proof that a download is the release's. Electron is pinned exactly, and the packed app is launched and checked by `pnpm desktop smoke` before a release is published.
- `.github/CODEOWNERS` makes the maintainer the reviewer of every pull request.
- Dependabot (`.github/dependabot.yml`) opens weekly updates for npm packages and actions, and those updates go through the same CI. When a vulnerable transitive dependency's parents still allow an old release, `overrides` in `pnpm-workspace.yaml` sets a patched floor until they catch up.
- No secret, signing key or keystore is committed. `scripts/checks/private-data.test.ts` fails if a tracked file holds a credential, a personal email address or a Claude Code session id.

## Reporting a vulnerability

Use "Report a vulnerability" on the repository's Security tab, and please don't open a public issue. Say what is affected (the app, a build script or a dependency), how to reproduce the problem and what it allows an attacker to do.

This is a volunteer project, but you can expect a first reply within 14 days. A confirmed vulnerability is fixed in a release within 60 days of the report, and the release notes say what it fixed. Fixes go to `main`, and older releases are not maintained.
