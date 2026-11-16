# Security

[PRIVACY.md](PRIVACY.md) describes what the app stores and sends. There are no accounts and no backend, and the app has no analytics, ads or crash reporting.

## Network

A release build on a phone makes only one kind of request. When you paste a RingsDB deck link, the app fetches that deck's public JSON from `ringsdb.com`, along with the name of any card it doesn't know (`src/screens/routes/deck-import.tsx`). Nothing else in the app calls `fetch`.

Card pictures are bundled with the app (`pnpm assets scans`). In a release build, `remotePictureUrl` (`src/screens/images/remote.native.ts`) returns no URL, so a card without a bundled picture is drawn as text instead. Development and browser builds (`remote.ts`) download those pictures from `ringsdb.com`, or from the Hall of Beorn and DragnCards buckets on `s3.amazonaws.com`; the desktop build (`EXPO_PUBLIC_DESKTOP=1`, `src/screens/nav/desktop.ts`) makes `remote.ts` return no URL either, so it fetches no picture. The web booklet reader loads pdf.js and its worker from the app's own origin (`public/pdfjs`, `pnpm assets pdfjs`), opens a book from its bundled asset URL or from the browser's private file storage, and sets pdf.js's `isEvalSupported` to false; a book the player adds is checked for the PDF header and opened by pdf.js before it is kept (`src/screens/booklets/store.ts`). `src/screens/images/policy.ts` refuses every other host, as well as any URL that isn't HTTPS or that carries credentials, a port, a query or `..`.

On Android the app asks for `INTERNET`, for deck import, and `VIBRATE`, for haptics. `app.json` (`android.blockedPermissions`) removes the overlay and external-storage permissions that Expo and its libraries would otherwise add. On iOS the app asks for no permissions. Rulebook PDFs open through the system file picker, which needs none.

At build time, `pnpm data sync` is the only command that uses the network. It fetches the sources listed in `data/sources.json` and checks each one against its pinned sha256 or git commit.

## Supply chain

- `pnpm-lock.yaml` is committed, and CI installs with `--frozen-lockfile`.
- CI (`.github/workflows/test.yml`) runs with a read-only token, so pull requests from forks can't write to the repository. Every action used there and in `.github/workflows/release.yml`, which holds the signing keys, is pinned to a commit SHA.
- Releases are only ever started by hand. `.github/workflows/release.yml` and `.eas/workflows/e2e.yml` run on `workflow_dispatch` alone, which needs write access to the repository, or for EAS a login to the project's Expo account. A real release refuses to run from any branch other than `main` or `release/v<major>.<minor>`. `scripts/checks/release-trigger.test.ts` fails if either workflow gains another trigger, or if any other workflow creates a tag or a release.
- `.github/CODEOWNERS` makes the maintainer the reviewer of every pull request.
- Dependabot (`.github/dependabot.yml`) opens weekly updates for npm packages and actions, and those updates go through the same CI. When a vulnerable transitive dependency's parents still allow an old release, `overrides` in `pnpm-workspace.yaml` sets a patched floor until they catch up.
- No secret, signing key or keystore is committed. `scripts/checks/private-data.test.ts` fails if a tracked file holds a credential, a personal email address or a Claude Code session id.

## Reporting a vulnerability

Use "Report a vulnerability" on the repository's Security tab, and please don't open a public issue. Say what is affected (the app, a build script or a dependency), how to reproduce the problem and what it allows an attacker to do.

This is a volunteer project, but you can expect a first reply within 14 days. A confirmed vulnerability is fixed in a release within 60 days of the report, and the release notes say what it fixed. Fixes go to `main`, and older releases are not maintained.
