# Security

[PRIVACY.md](PRIVACY.md) says what the app stores and what it sends. In short, the app has no accounts, no backend, no analytics, no ads and no crash reporting, and a release phone build makes one kind of network request. Pasting a RingsDB deck link fetches that deck's public JSON from `ringsdb.com`, and the name of any card the app does not know. Nothing else uses `fetch` (`src/screens/routes/deck-import.tsx`).

Card pictures are bundled (`pnpm scans:pack`), and a release build fetches none: every screen and the download queue get a picture's URL from `remotePictureUrl` (`src/screens/images/remote.native.ts`), which returns none outside a development build, so a card without a bundled picture is drawn as its text. A development build, and the web build (`remote.ts`), download such a picture from `ringsdb.com` or the Hall of Beorn and DragnCards image buckets on `s3.amazonaws.com`. `src/screens/images/policy.ts` refuses any other host, any non-HTTPS URL and any URL with credentials, a port, a query or `..`.

On Android the app asks for two permissions: `INTERNET`, for the deck import, and `VIBRATE`, for haptics. `app.json` (`android.blockedPermissions`) removes the overlay and external-storage permissions that Expo and its libraries would otherwise add. On iOS it asks for none. Opening a rulebook PDF goes through the system file picker, which needs no permission.

At build time, only `pnpm data:sync` uses the network. It fetches the sources listed in `data/sources.json` and checks each download against its pinned sha256 or git commit.

## Supply chain

- `pnpm-lock.yaml` is committed, and CI installs with `--frozen-lockfile`.
- CI (`.github/workflows/test.yml`) runs with a read-only token, so a pull request from a fork cannot write to the repository. Every action it and the release workflow (`.github/workflows/release.yml`, which holds the signing keys) use is pinned to a commit SHA, not a tag.
- Dependabot (`.github/dependabot.yml`) opens weekly update pull requests for the npm packages and the actions. They pass the same CI as any other change.
- No secret, signing key or keystore is committed.

## Reporting a vulnerability

Report it privately through GitHub: on the repository's Security tab, choose "Report a vulnerability". Do not open a public issue. Say what is affected (the app, a build script, a dependency), how to reproduce it, and what it lets an attacker do.

This is a volunteer project, so there is no fixed response time. Fixes go into `main`; there are no maintained older releases.
