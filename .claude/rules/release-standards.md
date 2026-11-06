# Release standards

Every session, agent and contributor that branches, tags or releases follows these (user instruction, 2026-11-06). A reviewer reports a breach as a finding. `docs/releasing.md` says how the pipeline runs and how to start it; `scripts/release/version.ts` holds the version rules below as code.

## Branches

- `main` is the trunk and is always releasable: every change lands on it as one squash commit from a pull request (`.claude/rules/commit-standards.md`, Squash).
- A work branch is `<type>/<short-slug>`, with a type from the commit standards, lowercase and hyphenated: `fix/staging-attacks`, `feat/lost-in-mirkwood`. It branches from `main`, is short-lived, and is deleted once merged. An agent session keeps the branch its harness or brief names (`claude/…`, `wip/<F>`).
- `release/v<major>.<minor>` exists only to patch a released line while `main` holds work that must not ship yet. It is cut from that line's last tag (`git switch -c release/v0.3 v0.3.2`). The fix lands on `main` first, then a pull request cherry-picks it (`git cherry-pick -x`) onto the release branch, and the release runs from there. It cuts only `v<major>.<minor>.x` patches.

## Versioning

- Versions are semver, `<major>.<minor>.<patch>`, and live only in the tag `v<major>.<minor>.<patch>`. `app.json` and `package.json` stay at `0.0.0` on every branch; the release build stamps the version and the build number (Android's `versionCode`, iOS's `CFBundleVersion`) from the tag (`app.config.js`). Do not commit a version bump.
- The bump comes from the commits since the last tag: a `Breaking:` line is major, a `feat` minor, a `fix`, `style` or `refactor` patch. `repo` commits alone make no release; ask for `patch` when a `repo` change (a card data refresh) should still ship.
- `Breaking:` is a line in the commit body, kept in the squash commit, written for players: an update that loses something saved (a campaign, a log, a deck) or removes a feature or setting. An engine version change that drops an open scenario is not breaking: the notes say it on their own.
- Before 1.0.0 a breaking change bumps minor. 1.0.0 is the user's decision, asked for with `major`. The first release is 0.1.0.

## Tags and releases

- Only the release workflow (`.github/workflows/release.yml`) creates a `v*` tag or a GitHub release. Do not tag, push a tag or draft a release by hand.
- A tag is never moved, deleted or reused. A bad release is followed by a fixed patch release; edit the bad one's notes to say what is wrong with it.
- Every release ships on both platforms from the tagged commit, after the same checks as `test.yml`: a signed APK on the GitHub release, signed with the one release key so each release installs over the last and keeps the player's saves, and the iOS build on TestFlight (user decision, 2026-11-06). `docs/releasing.md` (Signing) sets both up.
- A TestFlight build expires 90 days after upload, so a release is cut at least every 90 days.

## Release notes

- The notes are written by `scripts/release/notes.ts` from the commit subjects since the last tag: `feat` under New, `fix` under Fixes, `style` under Look and feel, `refactor` under Under the hood, `Breaking:` lines under Before you update, `repo` counted. So a pull request title is a line of the notes: write it for a player.
- Do not write the notes by hand. Edit a published release only to add a short note above the generated text.

## Who releases

- A dry run (`dry_run: true`) builds and checks without tagging; anyone may start one, agents included, whenever it helps.
- A release (`dry_run: false`) is outward-facing: an agent starts one only when the user asks for it in that session, then reports the run and the release page. A person with write access starts one when `main` has something players should get.
