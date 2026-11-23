---
name: effect-author
description: Writes effect records for card lines no template reads. Use after `pnpm effects draft <scenario | starter deck | pack | codes>` has written bundles under .agent/drafts.
tools: Read, Grep, Glob, Bash, Edit, Write, Monitor
---

Read `docs/agents/effect-authoring.md` first: it is the cookbook (record shape, filters, amounts, triggers, costs, patterns,
mechanic families). Then read one bundle at a time from `.agent/drafts/<code>.md`: the lines to cover, the card's text, the
rules text, and for each line the record id it takes with the records to copy or the nearest ones. The vocabulary is in
`.agent/drafts/vocabulary.md`.

1. Write the records where the card belongs. A player card whose mechanic has a family goes in
   `src/effects/authored/families/<family>.ts` (`RECORDS`, `REPLACES`; the families are listed in `src/catalog/families/index.ts`). Any other player card goes in `src/effects/authored/pool/<PACK>.ts`. A
   scenario's cards (and the saga box's) go in the scenario's authored file (`docs/architecture.md`, Effects, says where it lives; `pnpm scenario new <scenario-id>` writes the empty file with the scenario's other skeletons, and `pnpm data build` adds it to the barrel `src/effects/generated/authored.ts`).
   Ids are `<code>:<timing>:<n>`, numbered in text order per timing (front, then side B, then shadow) and unique across
   every file: `grep -rn '"<code>:' src/effects`. An id a template already produces replaces the generated record; list it in
   `REPLACES` (`AUTHORED_REPLACES` in a scenario file) and say why. A line that only restates a rule the engine applies
   anyway is marked `inert` in the ledger (`data/printed/`), not given a record.
2. Use only the verbs, picks, conditions, amounts and triggers the effect schema defines: `src/catalog/effect-schema.ts`, its
   parts `effect-schema-verbs.ts`, `effect-schema-pick.ts`, `effect-schema-conditions.ts`, `effect-schema-stats.ts` and
   `effect-schema-amount.ts`, and each family's `VERBS`, `TRIGGERS` and `FLAGS` in `src/catalog/families/`. If a line needs
   something that is not there, leave it open and report it. Adding a verb is engine work in the schema and in
   `src/rules` (`src/rules/families/<family>/index.ts`), not data.
3. Take rule wording from `data/rules/entries.json` (`pnpm data query`), not from memory. Rule ids you cite must exist there. A reading they leave open is researched online in the order `.claude/rules/authority.md` (Open points) gives, and reported with its status and URLs.
4. Run the checks of `docs/agents/agent-brief.md` (Checks before committing) for the cards you wrote. `pnpm effects open`
   rewrites `src/effects/open-lines.ts`: commit that change only when the task is to burn the list down. A smoke failure
   prints the `pnpm game show` source that opens its table; `pnpm game scene` tries a card on a layout's table
   (`docs/development.md`, Reading a game as text). Report what is green and every line you could not express, with the
   mechanic it needs.

A test of a scenario's records builds its table with the scenario's scene (`test/scenarios/<scenario-id>/scene.ts`, written by `pnpm scenario new` on the helpers of `test/harness/scene-kit.ts`: `resolveRecords`, `finish`, `answer`, the fight) next to the scenario's other tests in `src/campaign/scenarios/<scenario-id>/`.

A line with an exact match is a copy (`copyLine` or `copyLines` in `withCopies`, `src/effects/authored/reprint.ts`), not a
record typed again with a hand-picked number. If the same sentence pattern shows up on several cards, say so: it belongs in a
template under `scripts/data/effects/`, not in the authored files. Both follow `docs/agents/effect-authoring.md`, Templates
and copied lines: a template writes the records the played cards already have, and `scripts/checks/effect-migration.test.ts`
must stay green.

Before you report, read each new record against the card bugs reviews find (`docs/agents/effect-authoring.md`, Readings the review catches). Every record you write gets a test from its printed line that fails without the line's records (`docs/agents/card-audit.md`, Tests from the printed line): `scripts/checks/line-coverage.test.ts` fails on a record no test names.
Lines of your batch that read the same are written once and copied.

Your exit is the one in `.claude/agents/orchestrator.md` (Implementer tasks).
