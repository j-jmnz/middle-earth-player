# Handover: automating every player card (main session)

User directives (2026-10-26):
- Make every deck-legal player card fully playable, using whatever resources are needed.
- Leave the Messenger of the King cards out (pack MotKA and contract 22134: `outOfScope` in `data/overrides.json`).
- When the work is done, merge to `main` without waiting for confirmation, and answer open questions without asking.
- Every agent spawned for this work runs on Sonnet 5.5 (`model: "sonnet"` in the Agent call).
- Extra branches on GitHub are fine. Before usage limits stop work, every agent and the main session write a handover and
  commit (and push) so no progress is lost.

## State when the user stopped the work (2026-10-26, session_01Ei8sWpP1Wh3AbvNb34oiyN)

The user asked to stop after phase 14, sidequests and misc. Everything is merged on `ccr-a8ef8247-8087n8` and pushed; no
agent is running. Not merged into `main` yet.

- Merged (squashed, duplicates reduced to one definition; see each commit message): attachments, attack, play, deck,
  rules spans (hon.battle, hon.siege, hon.archery, wor.guarded-x), the known follow-ups, leftovers (Battle/Siege, Imrahil's
  hero type, one PutIntoPlay path for attachments with Guarded), phase 13 (Flight to the Ford), misc, sidequests, phase 14
  (The Ring Goes South). ENGINE_VERSION is 6.
- Checks at the last merge: tsc, lint, data:check, full `pnpm test` green; existing goldens unchanged.
- **Open lines: 100.** 98 belong to scenarios 5 and 6 (Journey in the Dark, Breaking of the Fellowship: 142040-142090);
  2 are Smeagol's Gollum side (21072:B:1-2: its enemy stats are in no source, and no hero-to-enemy flip exists).
- Every player-card family line is closed apart from 21072:B:1-2. Trap has no official rule (card text only).

## Next steps (in order)

1. Phase 15 (Journey in the Dark), then phase 16 (Breaking of the Fellowship): `implementer` agents like phases 13/14
   (base = this branch, push to `wip/phase-1N`, records in `src/effects/authored/<scenario>.ts`, add to playable.ts).
2. Phase 13 review findings (non-blocking): see below.
3. Second pass on open lines; update docs/plans/effect-authoring.md "Not expressible yet" and docs/phases/STATUS.md
   (phone checks stay open in a cloud session); run `reviewer` on phase 14 and `ux` on the phone-half changes.
4. Delete docs/handover/, run the full checks, merge into `main`, push.

Phase 13 review (non-blocking):
1. burden-effects.ts passFirstPlayer duplicates refresh.ts passToken: one function.
2. burden-attack.ts attackWith duplicates effect-frames.ts immediateAttack: export and reuse.
3. 141028 Setup record never runs (setup comes from scenario-data/setup.ts); SetLife/ShuffleBurdenDeck only used by tests:
   make the record drive setup or drop the verbs and mark the line inert with a reason.
4. burden-effects.ts announceProgress keeps a module-level WeakMap (SEEN): queue progressPlaced where progress is placed.
5. Move non-burden verbs out of the burden family (EndQuestPhase, RemoveAllQuestProgress -> quest; PassFirstPlayer -> play;
   ImmediateAttackEach -> attack/defense; SetStatUntil -> a duration on SetStat/ModifyStat).
6. burden-words.ts hard-codes "Ring-bearer's" for SetStatUntil: derive from holders.

Other notes from the agents:
- src/play/threat-level.ts shows 50 as the elimination level and ignores eliminationReduction (The One Ring).
- Side quests and The Burglar's Turn loot have no phone UI yet (commit to a side quest, loot choice, loot deckbuilding).
- A card with printed Surge that also gains surge reveals one extra card only (surge is boolean).
- Maestro fixtures for scenarios 3-4 need a saved win of scenarios 1-2 (`scripts/e2e-fixtures.ts --won`).

## How the families were run

The agent brief is `docs/handover/agent-brief.md`. Each agent works in a worktree from this branch, pushes WIP to
`wip/<name>`, and the main session squashes it here ("Merging a family" below). Spawn agents with `model: "sonnet"`, at most
4 at a time.

## Merging a family

1. `git merge --squash origin/wip/<F>`, resolve, then delete `docs/handover/<F>.md`.
2. Conflicts are mostly additive: keep both sides.
3. A concept two families both added must end up as one definition; convert the other family's records and tests.
4. `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm effects:open`, `pnpm data:check`, full `pnpm test` (goldens must not
   change), commit the regenerated open lines, push.
