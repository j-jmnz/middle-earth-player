# Security

The app is offline: it has no accounts, no backend and no network calls at run time. Only the `pnpm data:sync` script uses the network, to fetch the sources pinned in `data/sources.json`.

## Reporting a vulnerability

Report it privately through GitHub: on the repository's Security tab, choose "Report a vulnerability". Do not open a public issue. Say what is affected (the app, a build script, a dependency), how to reproduce it, and what it lets an attacker do.

This is a volunteer project, so there is no fixed response time. Fixes go into `main`; there are no maintained older releases.
