# Authority

`data/` is the source of truth for cards, scenarios and rules text. Where each file came from is in `data/sources.json`; where a source was wrong is in `data/overrides.json`, with a reason. Change data by changing the source adapter, the normalizer, the templates or an override, then `pnpm data:build`. Do not hand-edit generated files.

The MEC109 booklet, the quest card and the campaign card win on a rule. A card's text is what is printed on it: a source's transcription is a candidate, and the scan-read ledger in `data/printed/` is the text the build uses. When a source and the printed card disagree, the card wins and the override names it. The core-set Learn to Play wins on the ordinary round. The Rules Reference wins on definitions. The FAQ's official rulings (`faq.*`) settle what those leave open, but not against a card or the booklet. All of them, with the Easy Mode sheet and the campaign log, are in `data/rules/` and split into rule ids in `data/rules/entries.json`; code and tests name the rule ids they implement. `docs/brief.md` wins on product shape. `docs/architecture.md` wins on how the code is split.

A rule change updates `docs/brief.md` in the same change. Do not commit `catalog.db`, card scans or PDFs. Card text and rules text live in `data/` on purpose.

Code changes follow `.claude/rules/code-standards.md`. Doc changes, `docs/phases/STATUS.md` included, follow `.claude/rules/docs-standards.md`. Running a plan with several sections is `/orchestrator`. Implementing a phase is `/implementer`. Reviewing a diff is `/reviewer`. Reviewing screens is `/ux`. Writing effect records for lines no template reads is `effect-author`. Phase status is `docs/phases/STATUS.md`.
