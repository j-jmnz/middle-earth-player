# Phase 31 — Escape from Dol Guldur

Engine half depends on: phase 30's engine half
Phone half depends on: phase 30
Blocks: phase 32

Plan: [docs/plans/done/mirkwood-paths.md](../plans/done/mirkwood-paths.md), "Phases 29–33" and "Notes for the orchestrator and the implementer agent".

## Goal

`escape-from-dol-guldur`, Mirkwood Paths part 3, is playable in campaign and standalone. Its resolution writes the Mendor carry-over.

## Procedure

The phase 12 "Scenario procedure", steps 1 to 6, for `escape-from-dol-guldur`:

- `pnpm data:build -- --verbose` shows no failed cross-check for it; every dealt card has a ledger entry (phase 27).
- `pnpm effects:draft escape-from-dol-guldur`, then the `effect-author` agent, until coverage is green for every line of every dealt card, including the campaign card's Setup and Resolution and the boons and burdens below.
- A new verb goes in a mechanic family (`src/catalog/families/<f>.ts`, `src/rules/families/<f>/`), cites a ledger line or a rule span, and has its own test. Do not bend an existing verb to mean something else.
- Scenario records go in `src/effects/authored/escape-from-dol-guldur.ts`; boon and burden pool records in `src/effects/authored/pool/RevCore.ts`.
- Golden: `src/campaign/scenarios/escape-from-dol-guldur/golden.json` with `escape-from-dol-guldur/golden.test.ts`, `test/scenarios/escape-from-dol-guldur/scene.ts` and `test/scenarios/escape-from-dol-guldur/game.ts`: true solo and two-handed, a win and a loss.
- A campaign test checks that Journey Along the Anduin's pool and its `prisoner` fact reach this scenario through the Campaign Setup Checklist.
- Add `escape-from-dol-guldur` to `src/campaign/playable.ts`, then `pnpm effects:open`.
- Phone half: words and widgets only where a line creates them (cite the line in `docs/brief.md`), Maestro win and loss flows, fixtures.

## Cards

- **Guarded objectives and claim** (01108 to 01110): Setup attaches the next encounter card to each objective; "free of encounters"; claim and attach; return on detach.
- **Prisoner and rescue**: generalize the captive in `south/captive.ts` (phase 14). The prisoner hero and its attachments are facedown and unusable; Mendor is captured with them; rescuing is an event.
- Orc Guard (01107/01125): a deck card as a facedown enemy.
- Iron Shackles (01105): attached to a player deck.
- A group limit of one ally per round (01123/01124).
- Dungeon Jailor.
- Campaign card 01131: its Forced replacement and flip. The resolution writes the Mendor and Mendor's Support carry-over (phase 28).
- Encounter sets and Easy removals from `ltp.setup-escape-from-dol-guldur` and the `easy-mode` spans.

## E2E

`.maestro/scenarios/escape-from-dol-guldur/escape-from-dol-guldur.yaml` (a win writes the carry-over and unlocks `the-oath` in Mirkwood Paths) and `.maestro/scenarios/escape-from-dol-guldur/escape-from-dol-guldur-loss.yaml`, with their fixtures.

## Exit

**Engine half:** coverage and the goldens green in Node. A win runs the resolution and unlocks the next part in Mirkwood Paths; a loss writes nothing. The plan's Verification list is green (`data:build`, `data:check`, `--verbose`, `tsc`, `lint`, `test`, `effects:open` with no line for this scenario, `card-smoke/run.ts` on the new codes, `catalog:build`, `booklets:pack`, the golden). Every Fellowship golden and test passes without edits to its expectations.

**Phone half:** as in phase 12: a person can win and lose the scenario on the phone, the log matches the engine, and no control types damage, resources, threat, progress or life. In a cloud session the phone checks and Maestro runs stay open in `STATUS.md`.

One review round, as above.
