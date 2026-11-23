# Card audit

The standing procedure to prove that the cards in play do what they print, and to find the ones that do not. Run it after a batch of records lands with no test from the card text, after a wide engine change, or when the user asks to harden what is playable. The main session runs it as `.claude/agents/orchestrator.md` says (models, briefs, commits); this file says what is particular to an audit.

## What finds what

Five checks find different faults. None replaces another.

- **A soak** finds a throw, a stall, a broken table and an offer the engine then refuses. It plays random games of a scenario dealt as a standalone game to stand-in heroes with a deck of free events (no pre-built deck), on Normal, Easy and Nightmare, with new seeds each run, checks every table (`scripts/card-smoke/invariants.ts`) and tries every offered intent on a share of the tables. `pnpm test encounter --all` is the committed form; a longer run is a scratch script on `scripts/card-smoke/encounter-games.ts`, never committed. It cannot see a card that does the wrong thing on a sound table.
- **The idle check** (`scripts/card-smoke/idle.ts`) runs in the card smoke (`pnpm test smoke --all`), which plays each player card in the starter game with the starter decks, and so reaches a card on a table those decks make. The soak's games run it too, but their seats are stand-in heroes with free events, so it reaches no player card there. It finds an Action, a Response or an event that was offered, used and changed nothing (`rr.triggered-ability`, `rr.cost`): a hit is read against the printed line, then fixed through `src/rules/player/potential.ts`, a family `idle` hook or a `canPick` condition on the record, or listed with its reason in `scripts/card-smoke/idle-known.ts`.
- **The line checks** (`scripts/checks/record-readings.test.ts`) find a line about enemies "in play" whose record reads only the engaged ones and a "Then" after a part that can come up short with no condition on it, and read the "Limit" and duration lines that no test title tests twice or to the end. The first two list today's findings with their reasons, and a new one fails; the third lists the records of the day it was added (`scripts/checks/record-readings-limit-open.ts`), which only shrinks.
- **A test from the printed line** finds a record that says less, more or other than its card. `scripts/checks/line-coverage.test.ts` fails on a record no test names, so the list of untested records is its failure output.
- **A review** finds a fix that passes its own tests and is wrong for other cards. Every fix run of an audit is reviewed (Fix and review).

Sort a soak's rows before a fix: a refusal of an intent the random player built can be the player's fault (`test/harness/auto-player.ts`, `scripts/card-smoke/policy.ts`), not the engine's. The row is the engine's when `legalIntents`, the pay request or the first guess of a sheet offers what `reduce` refuses.

## Tests from the printed line

A test writer writes tests only and commits nothing. Its brief gives it the records of its batch, with their line ids and one file name for each pack or scenario, so two writers never write the same file.

- The expected result comes from the printed words and the rule spans (`pnpm data query`), never from the record. `pnpm effects render` shows which record implements a line; it is not the source of what must happen. A ruling in `docs/brief.md` or the box's file in `docs/scenarios/` is the reading to test, not a fault.
- Each test runs again without its line's records and fails there: a card-spec row (`cardSpecs`, `test/harness/card-spec.ts`), `lineSpec` (`test/harness/line-spec.ts`), or a scene test run again on `withoutLines`. A test that passes without its records tests nothing. For a line that is a card's only ability the second run fails at the first intent, so assert every clause the card prints.
- The title starts with the line id, written out. A title built in a loop does not name its line for the coverage check: write the ids in the `describe` title.
- No assertion inside an `if`. The scene fixes how many candidates there are, so the test knows whether a choice opens: a choice with one candidate, or with copies of one card, is taken with no question.
- Send only intents the engine offers, as a player does. Build the smallest table for the moment (`.claude/rules/code-standards.md`, Test cost). A pack with no ledger entry uses `sendUnledgered` and says so in the file header.
- Test on purpose the clauses of `docs/agents/effect-authoring.md` (Readings the review catches), and the false case of every condition, with one player and with two.

## A fault

The engine or the record does not do what the line prints. The writer does not fix it and does not bend the test: the test stays as the card says, as a plain `it.fails` whose title starts with the line id, under a `// FAULT:` comment of one sentence (what the card prints, what the engine does). Before it calls a fault it reads the rule span and the box's rulings again: about half of the first suspected faults of an audit rest on a wrong rule premise. A line whose words allow two readings that no doc settles gets no test and goes to the report as an open point (`.claude/rules/authority.md`, Open points).

## Fix and review

- One fix run takes all the faults of a round. It fixes the general cause where one cause explains several faults, then turns each `it.fails` into a plain test and deletes its comment.
- For each kind of fault it searches every record for the same mistake and reads the printed line of each hit. The report lists the hits and what was done with each.
- `pnpm effects reach <base-ref>` prints every card whose record or render the fix changed, by card with its printed line: read each before the review. It does not see a change in engine code that no record shows, so for a shared reader search the records for the verb or field it reads.
- A change to a reader many cards share (a pick filter, a sphere or trait reader, a cost or payment helper, `moveCard`) lists the other cards whose behaviour it changes, by code, each checked against its printed text, with a test for a card of each kind. A check keyed on an unrelated fact, added so that no golden moves, is not a fix: apply the rule in general and regenerate the goldens it moves.
- The cause of each moved golden is the block `pnpm game moved` prints for it (the first differing intent and the records and cards that resolved there), pasted into the commit body: never a cause written from memory.
- Before a new flag, verb or filter, search the families for one that does the same.
- The review reads the fix diff with a fresh context and is told to look for the cards a general change reaches, an offer and a refusal that disagree, an ability now withheld wrongly, and the stated cause of each moved golden, which it checks against `pnpm game moved`. Its findings go to a second fix run.
- The commit that closes the review carries a line `Reviewed: <who read the diff and what they looked at>`. `pnpm commit:check --range`, which CI runs on a pull request's commits, refuses a branch that changes `src/rules` or `src/effects/authored` with no such line (`scripts/git/range-rules.ts`).

## Running it

- A fix run never works in a tree beside test writers, and a commit holds only files that pass on the committed code: a test file committed while another agent's engine change is uncommitted breaks CI.
- On a machine with four cores: four test writers at one time, one fix run alone, one full suite at a time. A soak uses every core, so nothing else runs beside it.
- The main session commits each writer's batch when its report arrives and its files pass. A report is a claim: run the files.
- Research the open points in one batch at the end, by an agent that changes no file. The designer's collected answers are the quickest official source after the FAQ in `data/rules/`; cite the item and its URL.
