# Handover: sidequests family (F = sidequests)

Branch `wip-sidequests` (from `ccr-a8ef8247-8087n8` cb7d9e9), pushed to `wip/sidequests`. Brief: `docs/handover/agent-brief.md`
with the addendum (push to `wip/sidequests`, final commit deletes this file and restores `src/effects/open-lines.ts`).
Line list: the 85 lines in the session scratchpad `fam-sidequests.txt` (player side quests, contracts, encounter-keyword player
cards, the victory display). Check what is still open: `pnpm effects:open` then grep the line ids in `src/effects/open-lines.ts`.

Never name scratch files generically in the shared scratchpad (another agent overwrote `edit10.py`): prefix with `sq_`.

## Decisions (the Rules Reference in data/rules has no side quest, contract or Encounter-keyword span; I did not invent rule ids)

- A player side quest is a card type `player-side-quest` (printed.ts). It is played in the planning phase like an ally (resource
  match, its cost) into `Seat.questStage` (zone `seatQuest`, one slot per seat: one side quest per player at a time).
- A character commits to a side quest with `Commit { cardIds, sideQuestId }` (any seat's quest area). `CardInstance.questTo` holds
  it. The Willpower (or Attack for `QuestsWith attack` = Battle) of the characters committed to a side quest is placed on it as
  progress at quest resolution; it is not compared with the staging Threat and not counted by `committedWillpower`.
- A defeated side quest (progress >= quest points) hears `questDefeated` (self, from the victory display or discard), releases its
  attachments (`hostDefeated`), and goes to the victory display, or to its owner's discard pile when its `VictoryLimit` is full.
- Constants of a card in the victory display need `condition: { kind: "sourceIn", zone: "victory" }` on the record; they apply to
  every seat (cost-rules.ts skips the seat check for a card in the victory display).

## Done (checkpoint 1)

- Card types `player-side-quest`, `contract` in printed.ts.
- Verbs `VictoryLimit`, `QuestsWith`; trigger `questDefeated`; pick fields `sharesTraitWith`, `sameTitleAs`, `committedTo`;
  `PickEncounter` gained `notType`, `noVictory` (encounter family file, 2 optional fields).
- Engine: `families/sidequests-{play,quest,victory,pick}.ts`; hooks in planning.ts, legal.ts, machine.ts, quest.ts, stage-reveal.ts,
  pick.ts, player-verbs.ts, usage.ts, cost-rules.ts.
- Records: 09014, 10009, 10034, 10058, 10086, 16013, 17003, 17036, 17059, 17087, 10035:A:1, 10037:A:1, 16009:A:1.
- Tests: `families/sidequests*.test.ts`.

## Next

Remaining lines are listed by `bash sq_open.sh -v` style: victory display readers (Rossiel, Door is Closed, Halfling Bounder, ...),
hero Setup (Denethor, Eowyn, Thurindir), encounter-keyword player cards, campaign-pool gifts (142015-8), contracts.

## Open lines

(see the list at the end of the work)
