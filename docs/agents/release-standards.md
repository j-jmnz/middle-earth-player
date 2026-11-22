# Release standards

Every session, agent and contributor that branches, tags or releases follows these (user instruction, 2026-11-06). A reviewer reports a breach as a finding. `docs/releasing.md` says how the pipeline runs and how to start it; `scripts/release/version.ts` holds the version rules below as code.

## Branches

- `main` is the trunk and is always releasable: every change lands on it as one squash commit from a pull request (`.claude/rules/commit-standards.md`, Squash).
- A work branch is `<type>/<short-slug>`, with a type from the commit standards, lowercase and hyphenated: `fix/staging-attacks`, `feat/lost-in-mirkwood`. It branches from `main`, is short-lived, and is deleted once merged. An agent session works on a branch named for its task, not on a random branch its harness names (`.claude/rules/agent-standards.md`).
- `release/v<major>.<minor>` exists only to patch a released line while `main` holds work that must not ship yet. It is cut from that line's last tag (`git switch -c release/v0.3 v0.3.2`). The fix lands on `main` first, then a pull request cherry-picks it (`git cherry-pick -x`) onto the release branch, and the release runs from there. It cuts only `v<major>.<minor>.x` patches.

## Versioning

- Versions are semver, `<major>.<minor>.<patch>`, and live only in the tag `v<major>.<minor>.<patch>`. `app.json` and `package.json` stay at `0.0.0` on every branch; the release build stamps the version and the build number (Android's `versionCode`, iOS's `CFBundleVersion`) from the tag (`app.config.js`). Do not commit a version bump.
- The bump comes from the commits since the last tag: a `Breaking:` line is major, a `feat` minor, a `fix`, `style` or `refactor` patch. `repo` commits alone make no release; ask for `patch` when a `repo` change (a card data refresh) should still ship.
- `Breaking:` is a line in the commit body, kept in the squash commit, written for players: an update that loses something saved (a campaign, a log, a deck) or removes a feature or setting. An engine version change that drops an open scenario is not breaking: the notes say it on their own.
- Before 1.0.0 a breaking change bumps minor. 1.0.0 is the user's decision, asked for with `major`. The first release is 0.1.0.

## Tags and releases

- Only the release workflow (`.github/workflows/release.yml`) creates a `v*` tag or a GitHub release. Do not tag, push a tag or draft a release by hand.
- A tag is never moved, deleted or reused. A bad release is followed by a fixed patch release; edit the bad one's notes to say what is wrong with it.
- Every release ships from the tagged commit, after the same checks as `test.yml`, on its GitHub release, with these files: a signed APK, signed with the one release key so each release installs over the last and keeps the player's saves; an unsigned IPA with the SideStore and AltStore source (`source.json`), which players sign with their own Apple ID; and the desktop app for Windows (an NSIS installer and a portable zip), macOS (a universal `.dmg`) and Linux (an AppImage and a `.deb`), unsigned, each with a `.sha256` file beside it (user decision, 2026-11-16). TestFlight is an optional extra that runs only while its Apple setup is in place (user decision, 2026-11-06). The phone builds are never held back by the desktop build: when it fails, the release ships the APK, the IPA and `source.json` without the desktop files and its notes say the desktop app is not part of it (user decision, 2026-11-16). `docs/releasing.md` (Signing) sets them up.
- The desktop app's origin (`app://middle-earth-player`), its profile folder name, its app name and its app id never change after the first release (user decision, 2026-11-16): OPFS, which holds `user.db` and the booklets a player added, belongs to the origin and lives in the profile folder, so changing either loses every saved game. `desktop/identity.ts` holds them and `desktop/identity.test.ts` pins them.
- While TestFlight is on, a release is cut at least every 90 days, since a TestFlight build expires 90 days after upload.

## Release notes

- The notes are written by `scripts/release/notes.ts` from the commit subjects since the last tag: `feat` under New, `fix` under Fixes, `style` under Look and feel, `refactor` under Under the hood, `repo` (and any untyped subject from before the standards) under Project, `Breaking:` lines under Before you update. A commit whose body has a `Settles #<n>` line adds `closes #<n>` to its line, and a `Refs #<n>` line adds `see #<n>`, so each line links the issues it settles or works on (user instruction, 2026-11-19; `docs/agents/issue-standards.md`, Finish). Every commit is listed; none is only counted or left out (user request, 2026-11-17). So a pull request title is a line of the notes: write it for a player, as an action (`.claude/rules/commit-standards.md`, Subject line).
- An issue is closed by the release that ships it, not at the merge (user instruction, 2026-11-20). When a release ships a commit that settles or refers to an issue, the release workflow comments on that issue with the release that fixed it or carries the work, and closes each settled issue (`docs/releasing.md`, Issue comments). Do not post these comments or close these issues by hand.
- Do not write the notes by hand. Edit a published release only to add a short note above the generated text.

## Who releases

- A dry run (`dry_run: true`) builds and checks without tagging; anyone may start one, agents included, whenever it helps.
- A release (`dry_run: false`) is outward-facing: an agent starts one only when the user asks for it in that session, then reports the run and the release page. A person with write access starts one when `main` has something players should get.
