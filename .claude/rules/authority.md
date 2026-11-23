# Authority

`data/` is the source of truth for cards, scenarios and rules text. Sources are in `data/sources.json`; where one was wrong is `data/overrides.json`. Fan-made sets: `docs/brief.md`, Data sources, Fan-made content. Change data by changing the source adapter, the normalizer, the templates or an override, then `pnpm data build`. Do not hand-edit generated files.

The MEC109 booklet, the quest card and the campaign card win on a rule. A card's text is what is printed on it: a source's transcription is a candidate, and the scan-read ledger in `data/printed/` is the text the build uses. When a source and the printed card disagree, the card wins and the override names it. The core-set Learn to Play wins on the ordinary round. The Rules Reference wins on definitions. The FAQ's official rulings (`faq.*`) settle what those leave open, but not against a card or the booklet. All of them, with the Easy Mode sheet and the campaign log, are in `data/rules/` and split into rule ids in `data/rules/entries.json`; code and tests name them. `docs/brief.md` wins on product shape. `docs/architecture.md` wins on how the code is split.

## Open points

An open point is a reading of a card, a rule or an effect that `data/` and the order above do not settle. Every agent researches it online, never asks the user and never answers from memory (user instructions, 2026-11-10, 2026-11-12), in this order of authority:

1. **Official sources**: the FAQ and the Rules Reference not yet in `data/rules/`, FFG's and the designers' rules answers, and Hall of Beorn's rulings. An official ruling settles the point as an `faq.*` span would, and never against a card, the booklet or a span that wins over it.
2. **Community discussion**: BoardGameGeek, the lotrlcg subreddit, and the FFG and Hall of Beorn forums. It settles the point only when its answer is clear and agreed.
3. **The agent's recommendation**, when neither settles it, with the reason.

A reading is marked `researched` (with the URLs read) or `recommended` (with the URLs read and why none settled it). It goes to its scenario's file `docs/scenarios/<box>/<id>.md` (`<box>.md` for what its scenarios share, `docs/brief.md` for the core round and the player cards), with its source URL or "agent recommendation"; a `recommended` reading, or one settled only by community discussion, also gets a line in that file's Readings to confirm until the user confirms it. A scan that cannot be read is the one question for the user: the printed card cannot be taken from a discussion.

## Changes

A rule change updates `docs/brief.md` or the scenario's file in the same change. Do not commit `catalog.db`, card scans or PDFs. Card text and rules text live in `data/` on purpose.

Code changes follow `.claude/rules/code-standards.md`. Doc changes, `docs/phases/STATUS.md` included, follow `.claude/rules/docs-standards.md`. Commits and merges follow `.claude/rules/commit-standards.md`. Branches, versions, tags and releases follow `docs/agents/release-standards.md`. Running a plan with several sections is `/orchestrator`. Implementing a phase is `/implementer`. Reviewing a diff is `/reviewer`. Reviewing screens is `/ux`; changing the design system is `designer`. Writing effect records for lines no template reads is `effect-author`. Phase status is `docs/phases/STATUS.md`.
