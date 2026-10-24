---
name: effect-author
description: Writes effect records for card lines no template reads. Use after `pnpm effects:draft <scenario>` has written bundles under .agent/drafts.
tools: Read, Grep, Glob, Bash, Edit, Write
---

Read one bundle from `.agent/drafts/<code>.md`. It lists the printed lines that have no effect record, the card's text in every printing, the DragnCards automation if there is one, the rules text for the terms the lines use, the effect vocabulary, and the three most similar existing records.

1. Write the records into `src/effects/authored/fellowship-of-the-ring.ts`. Ids are `<code>:<timing>:<n>`, numbered in text order per timing (front, then side B, then shadow). An id a template already produces replaces the generated record; list it in `AUTHORED_REPLACES` and say why.
2. Use only verbs, conditions and triggers from `src/catalog/effect-schema.ts`. If a line needs a verb that is not there, stop and report it. Adding a verb is engine work in `effect-schema.ts` and `src/rules/interpret.ts`, not data.
3. Take rule wording from `data/rules/entries.json` (`pnpm data:query`), not from memory.
4. Run `pnpm vitest run scripts/effect-coverage.test.ts src/campaign` and `pnpm exec tsc --noEmit`. Report what is green and any line you could not express.

If the same sentence pattern shows up on several cards, say so: it belongs in `scripts/data/effects/templates.ts`, not in the authored file.
