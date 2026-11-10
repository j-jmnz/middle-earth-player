# Plan: Helm's Deep and The Road to Isengard

## Context

The Uruk-hai (scenario 7) is playable. The next two scenarios of The Two Towers are `helms-deep` (8, phase 64) and `the-road-to-isengard` (9, phase 65). Their data is built (`data/scenarios/helms-deep.json`, `data/scenarios/the-road-to-isengard.json`), each dealt card has a ledger entry in `data/printed/the-two-towers.json`, and both campaign cards' Setup and Resolution records exist (`src/effects/authored/the-two-towers.ts`). What is left is each scenario's engine half and screen half: the printed lines `src/effects/open-lines.ts` lists for their cards, the new mechanics those lines need, the table, the goldens and the flows.

Each scenario keeps the cards it shares with The Uruk-hai: Orcs of the White Hand (143063 to 143065) and Snaga Orcs (143066, 143067) are owned already. A line printed the same as an owned one is a copy, not a new record (`docs/plans/effect-authoring.md`, Templates and copied lines): 143061:A:3 is 143064:A:3.

The rules are `mec112.defense`, `mec112.wizardry`, `mec112.poisoned-counsels-searching-eye` and the saga rules already read for The Uruk-hai (`docs/brief.md`, The Two Towers). No `faq.*` span names either scenario; the Read task checks each line's words against the FAQ all the same.

## Base and landing

- The work runs on the branch the session's harness names, from `main`.
- `orchestrator` runs the sections in order (`.claude/agents/orchestrator.md`). Sections 1 and 2 are each one scenario, run as the tasks of `docs/handover/agent-brief.md` (Scenario procedure): Read, the rulings asked once, Build, Judge, Finish, one review round, Fix. Section 2 starts after section 1's Fix: its campaign test continues from Helm's Deep's real Resolution.
- Commit and push often (`.claude/rules/commit-standards.md`, Checkpoints). Each writing task pushes a typed checkpoint after every green step, and the orchestrator commits and pushes at the end of each task. Section 1's checkpoints are `feat: Helm's Deep …, checkpoint` and section 2's are `feat: The Road to Isengard …, checkpoint`. The branch lands on `main` squashed.
- No task waits on the user for a reading. Read researches every reading, and Build applies it as researched or recommended.

## What does not move

- No other scenario's golden, fixture or `data/` file. A rule change that can move a replayed game bumps `ENGINE_VERSION` (`.claude/agents/implementer.md`), and a golden of another campaign that moves stops the task.
- The Uruk-hai's records, rulings and table (`docs/brief.md`, The Two Towers).
- The campaign card records of 143077 and 143081. A Read finding against one goes to the orchestrator, not into a silent edit.

## Sections

### 1. Helm's Deep (phase 64)

`feat`. Encounter sets Helm's Deep and Orcs of the White Hand; the stages 143072 to 143076; the campaign card 143077; Poisoned Counsels (143021), which the stage 1A choice shuffles into each deck and the Resolution earns.

**New family: `fortress`** (`src/catalog/families/fortress.ts`, `src/rules/families/fortress/`; the existing `defense` family is combat defense). It owns the Defense keyword (`mec112.defense`, 143073:B:1, 143074:B:1, 143075:B:1):
- While the current quest has Defense, questing places no progress for the players. When the staging Threat beats the committed Willpower, nobody raises threat: the first player places the difference as progress on the current quest, through the active location first. A tie or a players' win places nothing.
- The engine records whether the encounter deck placed progress on the stage this quest phase, as the result of questing. 143074:B:2 reads it.
- A stage the encounter deck defeats advances as usual. Stage 4B's defeat is a loss (143075:B:3).
- A quest-resolution hook in the core, if none fits. It goes behind the family hooks (`src/rules/interpret/family-hooks.ts`), not as a direct call (`docs/plans/scenario-pipeline.md`).

**The Defense of Helm's Deep** (143033). A resource-token counter on an objective. It adds its tokens to the staging Threat, gains a token at the end of each quest phase, and at 8 goes to the victory display and advances to stage 5A from any stage. Night Without End (143045:A:2) removes a token. Reuse `PlaceResourceTokens`, `AdvanceToStage` and the staging-threat amounts where they fit.

**Lines the existing vocabulary should read** (Build checks each against the verb list in the author pack before it adds one):
- Stage 1A/1B: a two-way Setup choice, with Poisoned Counsels in each deck or a bypass to 2A (`ChooseOption`, `ShuffleIntoEachDeck`, `AdvanceToLetterStage`). Each player puts an ally from hand into play that matches a hero's sphere (`PutIntoPlayFromHand`). Skip the quest and combat phases (`skipQuestPhase`, `skipCombat`). Advance at the end of the round.
- Stages 2 to 5: add set-aside cards (`StageSetAside`, `MakeSetAsideActive`) and search for Helm's Gate in the deck, discard pile and victory display (`SearchToStaging` with the victory display, if it reads it). Discard until X enemies (`DiscardUntilEnemies`). Stage 5B's "players cannot reduce their threat" (`noThreatReduction`) and its win with no enemies in play.
- Locations: Hornburg's archery reduction (`archeryPlayers`, negative, to a floor of 0), Deeping Wall's and Postern Door's hero bonuses, Postern Door's "cannot declare attacks" until the end of the round, and Helm's Gate's -20 engagement and +2 Attack. Helm's Gate's reveal at the end of each staging step (`stagingStepEnds`). Deeping Culvert's search per player.
- Deeping Culvert (143039:A:1) prints Threat X (the data's Threat is null). Read checks that a location Threat X is read through an existing "X is" record and is not 0.
- Treacheries: Scaling Ladders as a Siege attachment on the active location (`AttachToActiveLocation`). Devilry of Saruman's 3 progress bypassing the location, and every character blank until the end of the round (`blankText`). Reckless Hate's immediate attack by the highest-Attack staged enemy, else surge.
- Enemies: progress on the active location or quest after an attack or a kill (`characterDestroyedByAttack`). Soldier of Isengard is set aside per player.
- Shadows: Reckless Hate's additional attack is dealt a new shadow card (`faq.additional-attacks`; not `shadow: false`, as in the six older records under Open items).

**Poisoned Counsels** (143021, `mec112.poisoned-counsels-searching-eye`). An encounter card in a player's deck: drawn, held, discarded from hand or deck, never played. After it is drawn, the rest of the hand is discarded. Build checks how far the player-deck burden path already goes (`ShuffleIntoEachDeck`, the `cardsDrawn` and `enteredHand` triggers). The Searching Eye (scenario 10) reuses it, so it goes in the `burden` family, not in `fortress`.

**Readings to research at Read.** The Read task confirms each one and adds its own. It researches every reading the spans leave open: official rulings first, then community discussions. If neither gives a clear answer, it takes its recommended reading (`docs/handover/agent-brief.md`, Scenario procedure, Open points are researched, not asked). The literal reading named below is the default recommendation, not a decision.
- 143074:B:2. Does progress the encounter deck places on the active location, and not on the stage, count as "placed progress on this stage"? Literal: no.
- Devilry of Saruman (143043:A:1). Is a character entering play later in the round blank too? Literal: yes, each character.
- Night Without End (143045:A:2). With no token on The Defense of Helm's Deep, may the players still choose "remove 1 token"?
- 143072:B:1. Does a ☺ ally match ☺ Aragorn? Does a player with no matching ally put nothing into play?
- The progress from Soldier of Isengard (143036:A:2) and Scaling Ladders' shadow (143042:A:3) does not bypass the location, so it lands on the active location first (`mec112.defense`, span-settled).

**Table** (the Table step of `docs/handover/agent-brief.md`, Scenario procedure; each item cited in `docs/brief.md`):
- The Defense of Helm's Deep's tokens, as a readout with its limit of 8, read from the record (143033:A:3). It warms as the tokens near the limit.
- While the stage has Defense, the quest-resolution readout says the encounter deck places the difference as progress, not the players' threat (143073:B:1). The quest dial says which way the progress goes.
- Stage 4B's progress shows the loss at its quest points (143075:B:3).
- No held dial: no line holds a card for a seat.

**Campaign test.** It continues from The Uruk-hai's real Resolution. The Skill boons or Beyond All Hope reach Helm's Deep through the Campaign Setup Checklist. The +1 hero-change penalty is waived (143077:A:2). A seat that took Poisoned Counsels at stage 1A and still holds it when the game is won earns it (143077:B:1).

### 2. The Road to Isengard (phase 65)

`feat`. Encounter sets The Road to Isengard and Snaga Orcs; the stages 143078 to 143080; the campaign card 143081; Saruman's Voice (143068), which the Setup shuffles in; and the Palantír of Orthanc (143020), the boon its Resolution earns.

**New family: `wizardry`** (`src/catalog/families/wizardry.ts`, `src/rules/families/wizardry/`). It owns the Wizardry timing (`mec112.wizardry`):
- A location with a Wizardry line triggers it when it leaves play as an explored location, active or not.
- Machines of Isengard (143062:A:1) triggers the active location's Wizardry without exploring it, and surges when there is none.
- When Saruman (143047:A:2) or Wolf of Isengard (143052:A:1) is dealt a shadow card with a Wizardry line, a Forced fires. Saruman's has the defending player resolve the Wizardry as the only player in the game. The Wolf's offers a discard or an additional attack, the attack with a new shadow card.
- One test file covers all three routes and a Wizardry location dealt as an ordinary shadow card, which does nothing.

**Hand pressure** (the `deck` family unless Build finds a better owner):
- After a player draws any number of cards, Saruman's Staff (143048:A:1) has Saruman attack that player from the staging area with 2 shadow cards, then heals 1 damage from him. `cardsDrawn`, `AttackFromStaging`.
- Open Pit's raise follows a draw from a player card effect only (143059:A:1). The trigger needs the draw's source.
- Stage 3B: a player with 0 cards in hand is eliminated (143080:B:3, a state check while 3B is the current stage). On 3A, each player draws 6, then discards down to 6.
- Random discards from hand (`DiscardRandomFromHand`). Ring-wall's discard after damage is healed from a character (143055:A:1); a `healed` trigger, if none exists.
- Saruman's Voice (143068:A:2), a Condition attachment: removes its hero from the quest. Its Forced fires when the hero commits, is declared as an attacker or defender, or triggers its ability. "Triggers its ability" needs an event for a hero's own Action, Response or Forced being triggered; Build checks whether one exists.

**Saruman and the win** (143047, 143048, 143080):
- Saruman is indestructible, immune to player cards and cannot leave the staging area (`indestructible`, `immuneToPlayerCards`, `cannotLeaveStaging`).
- While Orthanc is active, Saruman counts as engaged with the first player (`engagedWithFirst`), so he can be attacked.
- While Saruman has hit points left, the players cannot win (a win gate: damage below his hit points). Defeating stage 3B wins once that gate is clear.
- When Orthanc is explored, the progress placed on the quest this phase is cancelled and Orthanc goes back to the staging area (143080:B:2). That needs the progress placed this phase recorded, and an explored location that goes back to staging, not to the discard pile.

**Lines the existing vocabulary should read:**
- Stage 1B: players cannot draw cards or gain resources (`cannotDraw`, and a gain-resources bar if `noPlayerCardResources` is narrower). No commit and no staging (`skipStaging`, with the commit bar). At the end of the round, a resource on the stage and an optional advance. If the players advance, the discard pile is shuffled in, 1 card is revealed per resource, and the Ent objectives in staging leave the game.
- Ent of Fangorn (143046), an objective ally. A gained Quest Action any player may trigger: exhaust a hero, discard the top encounter card and compare its Threat with the hero's Willpower. At 3 resources, take control (`PutObjectiveAllyIntoPlay` or `TakeControl`). The Palantír's Quest Action (143020:A:2) has the same compare, so the compare is one verb or condition for both. Its payoff reveals 1 fewer card this phase for a player (`revealFewer`) and removes the Palantír from the campaign pool (`RemoveFromCampaignPool`).
- Stage 2B: no travel to Orthanc. A damage token on the quest card after each non-unique location is explored, with the advance at 5. Exhaust an Ent to place 2 progress on a non-unique location, which can explore it in the staging area and so trigger its Wizardry.
- Locations: Orthanc's look at the top 3, reveal 1 and discard the rest (`LookAtTop`, `StageLooked`). Underground Armoury's shadow after an engagement. Steaming Vent's damage after a commit (`commitmentMade`). Plain of Isengard's archery on allies first. Gates of Isengard's search into play engaged, per player.
- Plain of Isengard (143058:A:1) prints Threat X, as Deeping Culvert does.
- Treacheries: Blast of Sorcery's damage among the questing characters. Poisoned Vapour exhausts each damaged character and blanks it until the end of the combat phase.

**Readings to research at Read** (as in section 1):
- Poisoned Vapour (143061:A:2). Are the characters damaged when it resolves blanked, or every damaged character until the end of combat, live?
- Saruman's Voice (143068:A:2). Which hero, and whose, when none is questing or the revealing player has none questing (Peril)?
- 143080:B:3. Checked at once (a constant), so a player emptied mid-effect is eliminated before the effect ends?
- 143048:A:1. Does "draws any number of cards" include the resource-phase draw? Literal: yes. Is 3A's draw of 6 heard, given that the Staff attaches after it? Literal: no.
- 143078:B:1. Does "cannot gain resources" bar the resource phase's resources? Literal: yes.
- Ent of Fangorn taken into control: an ally under that player, out of the staging area, so stage 1B's "remove each Ent objective in the staging area" no longer reaches it.
- Saruman's "as if he is the only player". Each "each player" reads the defending player, and Steaming Vent's X is 2.

**Table:**
- The damage on stage 2B, as a readout with its limit of 5 (143079:B:2).
- The resources on stage 1B, labelled as the cards revealed on advancing (143078:B:2).
- Each Ent of Fangorn's resources, with its limit of 3 (143046:A:1).
- Saruman's hit points left, labelled as the win gate (143048:A:2).
- On 3B, each seat's hand count, warning at 1 and 0 (143080:B:3).
- A choice that triggers a Wizardry names the location. Saruman's names the defending player as the only player.
- Saruman's Voice is drawn under its hero.

**Campaign test.** It continues from Helm's Deep's real Resolution. An earned Poisoned Counsels is shuffled into its owner's deck after the starting hand (`mec112.poisoned-counsels-searching-eye`), and The Road to Isengard's Setup does not take it out (the player-deck removal is for scenarios 10 to 12). The win runs 143081's Resolution on the hands at the win: Saruman's Voice, the Palantír for the first player, or both.

### 3. Closing

`repo`, by the orchestrator (`.claude/agents/orchestrator.md`, Closing):
- Phases 64 and 65 marked in `docs/phases/STATUS.md`.
- Each reading goes in `docs/brief.md`, The Two Towers, under its scenario's bullet, with its source URL or "agent recommendation".
- Each `recommended` reading, and each one settled only by a community discussion, also goes to Open items, under The Two Towers, as not user-confirmed.
- Any `*-won` fixture the seed finder cannot find goes under Fixtures and Maestro, as `hai-won` is.
- This plan is deleted.

## Risks

- **Wins.** Helm's Deep (difficulty 8) and stage 3B's elimination at 0 cards may leave the starter decks with no auto-played win, as for The Uruk-hai. The goldens may win with synthetic heroes, as the Dream-chaser goldens do. A missing `*-won` fixture is an open item, not a blocker.
- **Core hooks.** Defense changes quest resolution, and Orthanc's return changes what an explored location does. Both are core paths every scenario replays. Each goes behind a family hook, and every other golden stays byte-identical. If one cannot, the task stops and reports.
- **File limits.** The new family folders and the asks files count against `scripts/checks/layout.test.ts` and `scripts/checks/file-size.test.ts`, which `pnpm test:scenario` runs.

## Measure

Each scenario's Fix commit records in its body, under `Pipeline measure:`:
- the author pack's size;
- `pnpm test:scenario <id>`'s time;
- the number of full `pnpm test` runs (one per scenario);
- the minutes the subagents' Bash calls spent waiting on test runs.
