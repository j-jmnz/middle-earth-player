<!-- Title: `<type>: <summary>` (fix, feat, refactor, style or repo), at most 72 characters, the summary an action that starts with an imperative verb and sums up the whole branch. It becomes the squash commit on main, and this description its body (.claude/rules/commit-standards.md). -->

## What and why

<!-- What changed, and why. Link the issue it closes. The title is a line of the next release's notes. If players lose something saved or a feature, keep a `Breaking: <what players lose>` line in the squash body (.claude/rules/release-standards.md, Versioning). -->

## Rules and sources

<!-- For an engine or effect change: the rule ids (data/rules/entries.json) or printed card lines it implements. Delete this section otherwise. -->

## Checks

- [ ] Tests added for new behaviour, or a test that fails without the fix
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm data check` (when the engine or `data/` could move)
- [ ] `pnpm effects open` and `pnpm doc index` run if records, doc headings or doc citations changed
- [ ] No version bump or tag (the release workflow makes them)
- [ ] No card scans, card pictures, PDFs, `assets/catalog.db` or filled `scan-map.ts` committed
