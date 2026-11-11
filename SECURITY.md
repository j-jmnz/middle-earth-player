# Security

What the app stores and sends: [PRIVACY.md](PRIVACY.md). No accounts, backend, analytics, ads or crash reporting.

## Network

A release phone build makes one kind of request: a pasted RingsDB deck link fetches that deck's public JSON from `ringsdb.com`, plus the name of any card the app does not know (`src/screens/routes/deck-import.tsx`). Nothing else calls `fetch`.

Card pictures are bundled (`pnpm assets scans`). In a release build `remotePictureUrl` (`src/screens/images/remote.native.ts`) returns no URL, so a card without a bundled picture is drawn as text. Development and web builds (`remote.ts`) download such pictures from `ringsdb.com` or the Hall of Beorn and DragnCards buckets on `s3.amazonaws.com`. `src/screens/images/policy.ts` refuses any other host, non-HTTPS URLs and URLs with credentials, a port, a query or `..`.

Android permissions: `INTERNET` (deck import) and `VIBRATE` (haptics). `app.json` (`android.blockedPermissions`) removes the overlay and external-storage permissions Expo and its libraries would add. iOS: none. Rulebook PDFs open through the system file picker, which needs no permission.

At build time only `pnpm data sync` uses the network. It fetches the sources in `data/sources.json` and checks each against its pinned sha256 or git commit.

## Supply chain

- `pnpm-lock.yaml` is committed; CI installs with `--frozen-lockfile`.
- CI (`.github/workflows/test.yml`) has a read-only token, so fork pull requests cannot write to the repository. Every action in it and in `.github/workflows/release.yml` (which holds the signing keys) is pinned to a commit SHA.
- Dependabot (`.github/dependabot.yml`) opens weekly updates for npm packages and actions; they pass the same CI.
- No secret, signing key or keystore is committed.

## Reporting a vulnerability

Use the repository's Security tab, "Report a vulnerability". Do not open a public issue. Include what is affected (app, build script, dependency), how to reproduce it and what it allows.

Volunteer project: no fixed response time. Fixes go to `main`; older releases are not maintained.
