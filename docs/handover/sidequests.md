# Handover: sidequests family (F = sidequests)

Branch `wip-sidequests` (from `ccr-a8ef8247-8087n8` cb7d9e9), pushed to `wip/sidequests`. Brief: `docs/handover/agent-brief.md`
with the addendum (push to `wip/sidequests`, final commit deletes this file and restores `src/effects/open-lines.ts`).
Line list: the 85 lines in the session scratchpad `fam-sidequests.txt` (player side quests, contracts, encounter-keyword player
cards, the victory display). Check what is still open: `pnpm effects:open`, then grep the line ids in `src/effects/open-lines.ts`.

Never name scratch files generically in the shared scratchpad (another agent overwrote `edit10.py`): prefix with `sq_`. Write
scripts with the Write tool; heredoc one-liners are sometimes refused by the worktree guard.

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
- Hero and contract `Setup:` lines resolve once after the mulligan, before the quest card's Setup, in frames that can ask
  (`pushPlayerSetup`, `ScenarioState.playerSetup`).
- Encounter keyword: the cards are set aside at the start (owner = the deck's seat), a card shuffles one in from the set-aside zone,
  it is revealed like an encounter card; `TakeRevealedCard` moves it into the chosen player's play area; a revealed ally or event
  still in the staging area after its When Revealed is discarded to the encounter discard pile (frames.ts).
- "Remove it from the campaign pool": `ScenarioState.removedFromPool`, applied by `campaign/log.ts` when the scenario is won.

## Done (checkpoints 1 to 4)

Side quests (play, commit, progress, defeat, limit, Battle), victory display readers, Setup of heroes, Lorien gifts, Encounter-
keyword cards. See the records in `src/effects/authored/families/sidequests.ts` and the tests `families/sidequests*.test.ts`.

## Next

Contracts: 21074 Fellowship (flip, character count, no allies), 22024 The Burglar's Turn (loot deck), 22049 Forth the Three
Hunters, 22074 The Grey Wanderer, 22091 Council of the Wise, 22147 Bond of Friendship, 40047 A Perilous Voyage. Needs: a contract
in play from the start (StartSeat.contract), flipping (`CardInstance.face` A/B and the side-B records), deckbuilding rules.
Also the UI: a way to commit characters to a side quest (src/play) and to play a side quest.

## Open lines

(see the list at the end of the work)
