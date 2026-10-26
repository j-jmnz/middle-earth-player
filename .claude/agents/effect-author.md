---
name: effect-author
description: Writes effect records for card lines no template reads. Use after `pnpm effects:draft <scenario | starter deck | pack | codes>` has written bundles under .agent/drafts.
tools: Read, Grep, Glob, Bash, Edit, Write
---

Read `docs/plans/effect-authoring.md` first: it is the cookbook (record shape, filters, amounts, triggers, costs, patterns,
and what is not expressible yet). Then read one bundle at a time from `.agent/drafts/<code>.md`. It lists the printed lines
that have no effect record, the card's text in every printing, the DragnCards automation if there is one, the rules text for
the terms the lines use, the effect vocabulary, and the three most similar existing records.

1. Write the records where the bundle says: `src/effects/authored/pool/<PACK>.ts` for a player card outside the box, else
   `src/effects/authored/fellowship-of-the-ring.ts`. Ids are `<code>:<timing>:<n>`, numbered in text order per timing (front,
   then side B, then shadow). An id a template already produces replaces the generated record; list it in `REPLACES` (or
   `AUTHORED_REPLACES`) and say why.
2. Use only the verbs, picks, conditions, amounts and triggers the effect schema defines: `src/catalog/effect-schema.ts` and
   its parts `effect-schema-verbs.ts`, `effect-schema-pick.ts`, `effect-schema-conditions.ts`, `effect-schema-stats.ts` and
   `effect-schema-amount.ts`. If a line needs something that is not there, leave it open and report it. Adding a verb is
   engine work in the schema and in `src/rules`, not data.
3. Take rule wording from `data/rules/entries.json` (`pnpm data:query`), not from memory.
4. Run `pnpm exec tsc --noEmit`, `pnpm vitest run src/effects scripts/effect-coverage.test.ts` (after `pnpm effects:open`),
   and `node --experimental-strip-types scripts/card-smoke.ts <codes>` for the cards you wrote. Report what is green and
   every line you could not express, with the mechanic it needs.

If the same sentence pattern shows up on several cards, say so: it belongs in a template under `scripts/data/effects/`, not
in the authored files.
