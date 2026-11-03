# Table experience: next improvements

Proposals for the landscape table after the 2026-10-25 rework (`docs/design-system-table.md`). Rechecked against main on 2026-10-26, after the threat dial, the centered banner and the printed card backs. Two are built (Undo and haptics, at the end); the rest are not. Each one keeps the brief's rules: the engine computes every number, the table only offers legal choices, and no single tap sends an intent unless the moment has one answer. Inactive text has its own plan, `docs/plans/done/inactive-text.md`; item 5 below is its table part.

## Source

The user pasted the script of TheGameLocker's "How To Play The Lord Of The Rings LCG – the EASY way! (Part 1)" (YouTube `NCiTsoouhjc`) on 2026-10-25. The video teaches one solo game of Passage Through Mirkwood with the core Leadership deck, round by round. Round one goes step by step; later rounds go faster. It recommends keeping the Rules Reference's round chart (page 20, "it also shows you where all of the action windows are") at hand. It leaves action windows, multiplayer and card-text terms for Part 2. Its scenario is core-set, not MEC109, so these proposals take its lessons, not its cards. Its deck is one the import screen offers (`core-leadership`), and the app does not apply much of it (`docs/plans/done/inactive-text.md`).

At each step the video names the decision and what it costs:

- Committing exhausts a character, so it cannot defend or attack later: "I'm pretty sure this spider is going to engage me, so I'm going to have to hold back some of my heroes."
- Staging threat against willpower decides the quest. Only staging threat counts, not the active location or engaged enemies.
- "You can never skip the quest phase": committing no one still reveals a card and still compares threat.
- Travel takes a location out of staging, and its progress comes first. A travel cost must be paid. Only one location can be active.
- Threat against engagement cost decides which enemies engage. "Below 30 is pretty good", and 50 ends the game.
- The defender is chosen against the risk of a shadow card: "if this shadow card boosts the attack on this spider then Glóin is dead."
- Undefended damage skips defense, and some shadow effects are worse when undefended. A defender destroyed by the shadow card leaves the attack undefended.
- Attackers gang up on one enemy; a seat makes one attack per enemy.
- The window after staging is "the golden action window". The window before staging readies characters before a When Revealed effect can punish them. The window after a defender is declared readies the defender before the shadow card turns.
- Two Responses that trigger together resolve in the order the player chooses (Théodred, then Aragorn).
- Some effects last only "until the end of the round", and some come back later (Sneak Attack returns Gandalf at the end of the phase).
- A unique card already in play, or an ally outside planning, cannot be played: "this is just a dead card now."

**Measured on this repo** (scratch scripts, not committed; run again after merging main on 2026-10-26, with the same results).

- **Starter decks.** `test/harness/auto-player.ts` played both MEC109 starter decks, seeds 1, 2, 4, 5 and 9, true solo, Normal, with card play and actions on.
  - In 29 rounds it made 560 decisions, and 329 of them were Pass (59%). A round averaged 19.3 decisions and 11.3 passes, from 7 to 38 decisions.
  - Most passes came in an action window where something was legal, so the engine did not skip it (`stepWindow` in `src/rules/engine/step-window.ts`). Each Pass takes two taps, so a round spends about 20 taps on passing.
  - All 10 games were lost to "The One Ring left play", six of them by round 2.
- **The core Leadership deck.** With Frodo, Aragorn and Glóin, the same policy lost all 5 games the same way. Pass was 33% to 63% of the decisions.
- **What the losses mean.** The policy is naive and leaves attacks undefended. The point is not the win rate. The point is that the mistake that ends a game is one the table could warn about before it is confirmed.

## Where the table stands against the video

| The video teaches | The table now | Gap |
| --- | --- | --- |
| Commit, then staging, then resolve | Willpower against threat while committing; "Staging reveals more threat next" | It does not say what the commit leaves for combat |
| Never skip the quest | Commit no one arms: "Tap again: no one quests" | The armed line does not give the threat it will cost |
| Golden window after staging | Every window reads "Action window" under the phase name | Nothing says what the window comes before |
| Travel lowers staging threat and takes progress first | "The location becomes active and leaves staging." | No numbers. With a location active it says "No location to travel to" |
| Threat against engagement cost | The threat dial fills toward 50 and warms from 40 (built 2026-10-25); optional engagement lists each cost | No enemy's engagement cost is set against the threat, on the dial or in staging |
| Defender against shadow risk | Picked defender: "1 damage, shadow card next; Sam Gamgee is destroyed" | Unpicked characters show nothing, there is no margin, and nothing says the game is lost |
| Attackers gang up | Attack against defense, "N damage" | It does not say whether the enemy is destroyed |
| Effects until the end of the round | "+1" pill on the card; the preview says until when | The pill has no end. Delayed effects (`state.delayed`) are not drawn |
| Win by an objective, not progress | Quest band: "No quest points" | It does not say how the stage is won |
| Dead cards in hand | A card that cannot be played does not glow | Nothing says why. An event the app does not apply glows, and playing it spends resources for nothing |
| Card abilities do what they say | A card with no record is veiled "Inactive" on the table | See `docs/plans/done/inactive-text.md` |

## Proposals, most useful first

1. **Stops instead of Pass presses.** Replaces "fewer Pass presses". The table passes a step action window for the player unless that window is one of the player's stops. The default stops are the windows the video uses: after staging ("before the quest resolves") and before the shadow card turns. Planning and the quest commit always ask; the commit's own window is the video's "before staging" one. Response and cancel offers always stop, and so do the defense pick, travel and engagement. The table never passes these. More rules:
   - A step window also stops when a card that can be used there entered the hand or play since the last stop.
   - The stops are a setting, off by default and edited from the turn reference (9). The setting is the confirmation.
   - While stops are on, the dock says "Stops on" and the rail marks each stop.
   - An auto-pass is an ordinary Pass in the save, so Undo takes it back while nothing hidden has been shown.

   It also needs a "Pass to next stop" pill in the dock that arms like Pass. Its armed line names the stop it runs to: "Tap again: pass until before the shadow card". The engine is unchanged: every window still opens (brief, Action windows) and is passed by an intent.
2. **Name each window by what it comes before.** The eyebrow keeps the phase, and the title replaces "Action window" with the next step of the framework: "Before staging", "Before the quest resolves", "Before travel", "Before the shadow card turns", "Before damage". The point is already in the state: the round's last `stepWindows` entry ("3.3" after staging, "6.2" after the shadow cards are dealt; `src/rules/engine/machine.ts`), and an attack's `awaiting` step ("defense", "shadow", "damage", "end", `src/rules/engine/step-window.ts`). The numbers that window can still change stay pinned (`readout.ts`). This costs a word table and answers the video's longest lesson.
3. **Say when a choice loses the game.** A defender pick or an undefended hero is the Ring-bearer, or the last hero, and the damage reaches the hit points left. The result line then says so in danger: "Frodo Baggins is destroyed: The One Ring leaves play and the game is lost". The same applies when a quest shortfall would take threat to 50. A primary that confirms such a pick arms like Pass, with "Tap again: the game is lost". A loss that only a shadow card could cause is a margin, not a warning (4).
4. **Combat foresight on the defender pick.** Each ready character carries the damage it would take before the shadow card, in danger when that destroys it. The undefended heroes do the same. The picked defender's line adds the margin: "2 hit points to spare". The numbers come from `defenseAsDefender` and `modifiedStat`, as `readout.ts` already reads them for the picked one. The player-attack line adds "destroys Forest Spider", or "3 short of destroying it".
5. **Text the app does not apply, at the table.** The veil goes. Its replacement is a small upright mark that does not cover the picture, and the preview lists the lines that are not applied. An event whose text is not applied is not offered, which is a decision for the user. Until then, it is offered with a warning that confirms on two taps. An attachment is offered with the warning too. Details, the measurements and the screens outside the table are in `docs/plans/done/inactive-text.md`. This comes early because a deck other than the two starters is 20% to 96% inactive. An event the app does not apply, held in the hand with the resources to pay for it, also opens action windows nothing else would: 21 of 108 in the measured games.
6. **Engagement foresight.** Several marks, all engine reads (`engagementCostOf` against the seat's threat):
   - From the quest commit to the engagement checks, each enemy in staging whose engagement cost is at or below the seat's threat carries a threat-red "Engages" mark.
   - The threat dial's meter carries a tick at each staging enemy's engagement cost. The ticks the threat has passed are the enemies that will engage.
   - The optional engagement sheet shows the threat beside each cost and says which enemies the checks will engage anyway.
   - A tap on the dial lists each staging enemy's cost with Engages or Stays, and the threat the refresh phase adds.
7. **What a quest commit leaves for combat.** While committing, the pinned numbers add the characters left ready and the attack strength of the enemies engaged and marked Engages: "Ready after this: 1 · Enemies attacking: 2 (3 and 3 attack)". The armed Commit no one line gives the cost: "Tap again: no one quests. Staging threat is 3 before the reveal."
8. **Travel: what it gains, what it costs, why not.** Each location on the travel pick shows the staging threat after travel ("Staging threat 5 → 3"), its quest points as "takes the next 3 progress", and its Travel line when it prints one. While a location is active, the sheet says "Explore Old Forest Road first: 1 more progress", not "No location to travel to". `travelRefusals` already reads the reasons, but it returns nothing while a location is active.
9. **Turn reference behind the rail.** A tap on the rail opens the round as the Rules Reference's framework chart lays it out: phases, steps, every action window, the current step marked, and the stops (1) as toggles. Each step has one line from its rule title in `data/rules` and the player's decision there. This is the video's "keep a round summary nearby".
10. **The objective on the quest band.** A stage with no quest points says how it is won, from its effect record ("Defeat Ungoliant's Spawn to win"), not "No quest points". The words are built from the record, as `words/choice.ts` builds a branch, and no booklet prose is pasted.
11. **Why a card does not glow.** A tap on a hand card that does not glow shows it large with the reducer's reason in one line: "No Leadership hero has 2 resources", "Gandalf is unique and already in play", "Allies are played in planning", "Attaches to a hero", "The app does not apply For Gondor!" (5). In planning, cards the seat cannot pay for are dimmed, and each hero's resource token carries its sphere tint. The video stresses that pools are kept per hero.
12. **Effects that end, and effects that come back.** A pill from a lasting effect carries a small end mark (round or phase). A pending delayed effect is drawn on its card, "Back to hand at end of combat", and the banner names it when it resolves.
13. **Resolve in beats.** After an attack, the centered banner steps through what happened one beat at a time, each beat drawn on the cards it touches: the shadow card turns, its effect, the damage, a card destroyed. When the shadow card destroys the defender, one beat reads "Snowbourn Scout destroyed: the attack is now undefended". The steps already come in order from the engine; this paces them.
14. **A first-game guide.** In a player's first scenario, a dismissible line under the dock's title explains each step the first two times it comes up, worded from the rule spans. Later rounds are quiet, as the video's later rounds are shorter. The briefing's difficulty line says what Easy changes, for a first game.
15. **Round summary.** At the end of the round, the banner sums the round from the log: threat before and after (the dial's change badge shows only the last change), progress placed, damage taken, cards drawn and played.
16. **Readability options.** A larger-cards setting that drops to five cards across and lets the hand overlap more, and a high-contrast badge option. The badges already carry a sign and an icon, so they do not rely on colour alone.

## Engine notes the video raised

- **Two Responses at once.** The video commits Aragorn and Théodred and resolves Théodred's Response first, so Aragorn's can spend the resource it adds. The engine queues one `committed` event per card in the Commit intent's order (`commit` in `src/rules/engine/machine.ts`). Each event's offers are collected when that event is announced. Only Responses the seat can pay for at that moment are offered (`collect` in `src/rules/windows/responses.ts`). The player chooses the order only through the order of the cards in the intent, and the table does not say that. The rules give the order to the player (`faq.simultaneous-effects`); this is already open in `docs/phases/STATUS.md`. The core Aragorn (01001) has no effect record yet, so the combo cannot be played today either way.
- **Always use a free Response.** A Response with no cost and no choice could be set to Always on its card's preview, as a per-game setting. Examples are Sam Gamgee readying and Pippin drawing a card after an engagement above the threat (141002, 141004). It would not apply to a Response with a cost, a target or a cancel. The video's example, Glóin, has no record yet.

## Order to build

The `ux` review of the rework (2026-10-25) put resolve in beats first, then combat foresight, Undo (since built), less ceremony for windows, and why a card does not glow. The transcript and the measurements change that order:

1. Stops (1) and window names (2), because Pass is most of a round's decisions.
2. The loss warning (3) and combat foresight (4), because every measured loss was one confirmed choice.
3. Text the app does not apply (5), because any deck but the two starters meets it in the first planning phase.
4. Engagement foresight (6), the commit readout (7) and travel (8).
5. The rest, in the order above.

## Built

- **Undo within an open decision** (2026-10-25; the rule is in `docs/brief.md`, The engine plays the game). Undo, in the dock, takes back the last choice while it showed nothing hidden. A commit or a card played can be taken back. A defender usually cannot, because the shadow card turns with it.
- **Haptics on arm and confirm** (2026-10-25, `expo-haptics`, which the user allowed): a tick when a button arms, a confirm when an intent is sent or taken back, a reject on a refusal.
- **Threat dial** (2026-10-25, on main): the threat as a threat-red pill whose meter fills toward 50, warming from 40, with a change badge. It covers the "50 ends the game" lesson; the engagement ticks of item 6 build on it.
- **Proposals 1 to 16 and both engine notes** (2026-10-26, branch `ccr-c7b5b4ea-4ei4kn`; the rules are in `docs/brief.md`, Screens, Table and Effects, and the look in `docs/design-system-table.md`). Where the build differs from the proposal:
  - Stops (1) are off by default and live in the turn reference (9) with the readability option (16) and the first-game guide (14), kept in `user.db` (`settings`). The rail does not mark each stop; the eyebrow says "Stops on".
  - Larger cards (16) was removed after the `ux` review: on a phone the three rows bind the height, so it grew cards by about 2 pt and cut the hand under 44 pt. Strong outlines stays.
  - Text the app does not apply (5) took the user's decision: an event with no record is not offered (`rr.triggered-ability`). An attachment with no record arms with the price ("Tap again: pay 2 for no effect").
  - The loss warning (3) covers a defender and an undefended hero. A quest shortfall that reaches 50 is said in the commit readout, not armed.
  - Always use (engine note) is a standing setting, not a per-game one, offered as a dock answer on the Response itself.
  - Two Responses at once (engine note): the Responses of one commit share one window and are used in any order. A Response whose cost cannot be paid yet waits in that window and is offered once another one has paid for it. The core Aragorn and Théodred have records, and `src/campaign/simultaneous-responses.test.ts` plays the video's combo.
