---
name: effect-author
description: Writes effect records for card lines no template reads. Use after `pnpm effects:draft <scenario | starter deck | pack | codes>` has written bundles under .agent/drafts.
tools: Read, Grep, Glob, Bash, Edit, Write
---

Follow `.cursor/rules/code-standards.mdc` for any engine code you add (a state is never changed in place). Read `docs/plans/effect-authoring.md` first: it is the cookbook (record shape, filters, amounts, triggers, costs, patterns,
mechanic families, and what was not expressible when it was written; the schema may have grown since, so check it before
leaving a line open). Then read one bundle at a time from `.agent/drafts/<code>.md`. It lists the printed lines that have no
effect record, the card's text in every printing, the DragnCards automation if there is one, the rules text for the terms
the lines use, the effect vocabulary, and the three most similar existing records.

1. Write the records where the card belongs. A player card whose mechanic has a family goes in
   `src/effects/authored/families/<family>.ts` (`RECORDS`, `REPLACES`; families: attack, defense, encounter, quest, play,
   costs, deck, attachments, sidequests, misc). Any other player card goes in `src/effects/authored/pool/<PACK>.ts`. A
   scenario's cards (and the saga box's) go in `src/effects/authored/<scenario-id>.ts` (`fellowship-of-the-ring.ts` for
   scenarios 1 and 2); the burden and south families' verbs are used by the Flight to the Ford and Ring Goes South files.
   Ids are `<code>:<timing>:<n>`, numbered in text order per timing (front, then side B, then shadow) and unique across
   every file: `grep -rn '"<code>:' src/effects`. An id a template already produces replaces the generated record; list it in
   `REPLACES` (`AUTHORED_REPLACES` in a scenario file) and say why. A line that only restates a rule the engine applies
   anyway is marked `inert` in the ledger (`data/printed/`), not given a record.
2. Use only the verbs, picks, conditions, amounts and triggers the effect schema defines: `src/catalog/effect-schema.ts`, its
   parts `effect-schema-verbs.ts`, `effect-schema-pick.ts`, `effect-schema-conditions.ts`, `effect-schema-stats.ts` and
   `effect-schema-amount.ts`, and each family's `VERBS`, `TRIGGERS` and `FLAGS` in `src/catalog/families/`. If a line needs
   something that is not there, leave it open and report it. Adding a verb is engine work in the schema and in
   `src/rules` (`src/rules/families/<family>/index.ts`), not data.
3. Take rule wording from `data/rules/entries.json` (`pnpm data:query`), not from memory. Rule ids you cite must exist there.
4. Run `pnpm effects:open` (it rewrites `src/effects/open-lines.ts`; commit the change only when the task is to burn the
   list down), `pnpm exec tsc --noEmit`, `pnpm vitest run src/effects scripts/effect-coverage.test.ts`, and
   `node --experimental-strip-types scripts/card-smoke.ts <codes>` for the cards you wrote. Report what is green and every
   line you could not express, with the mechanic it needs.

If the same sentence pattern shows up on several cards, say so: it belongs in a template under `scripts/data/effects/`, not
in the authored files.
