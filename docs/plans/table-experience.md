# Table experience: next improvements

Proposals for the landscape table after the 2026-10-25 rework (`docs/design-system.md`, Table). Two are built (Undo and haptics, at the end); the rest are not. Each one keeps the brief's rules: the engine computes every number, the table only offers legal choices, and no single tap sends an intent unless the moment has one answer.

## Source

The user pasted the script of TheGameLocker's "How To Play The Lord Of The Rings LCG – the EASY way! (Part 1)" (YouTube `NCiTsoouhjc`) on 2026-10-25. The video teaches one solo game of Passage Through Mirkwood with the core Leadership deck, round by round. Round one goes step by step; later rounds go faster. It recommends keeping the Rules Reference's round chart (page 20, "it also shows you where all of the action windows are") at hand. It leaves action windows, multiplayer and card-text terms for Part 2. Its scenario and deck are core-set cards, not MEC109, so these proposals take its lessons, not its cards.

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

**Measured on this repo.** A scratch run (not committed) of `scripts/auto-player.ts` covered both MEC109 starter decks, seeds 1, 2, 4, 5 and 9, true solo, Normal, with card play and actions on. In 29 rounds it made 560 decisions, and 329 of them were Pass (59%). A round took 7 to 38 decisions. Most of those passes came in an action window where something was legal, so the engine did not skip it (`stepWindow` in `src/rules/step-window.ts` opens a window whenever any action is legal). Each Pass takes two taps, so a round spends about 20 taps on passing. All 10 games were lost to "The One Ring left play", five of them in round 1 or 2. The policy is naive and leaves attacks undefended. The point is not the win rate. The point is that the mistake that ends a game is one the table could warn about before it is confirmed.

## Where the table stands against the video

| The video teaches | The table now | Gap |
| --- | --- | --- |
| Commit, then staging, then resolve | Willpower against threat while committing; "Staging reveals more threat next" | It does not say what the commit leaves for combat |
| Never skip the quest | Commit no one arms: "Tap again: no one quests" | The armed line does not give the threat it will cost |
| Golden window after staging | Every window reads "Action window" under the phase name | Nothing says what the window comes before |
| Travel lowers staging threat and takes progress first | "The location becomes active and leaves staging." | No numbers. With a location active it says "No location to travel to" |
| Threat against engagement cost | Optional engagement lists each cost | No comparison with the threat, and no mark during the quest |
| Defender against shadow risk | Picked defender: "1 damage, shadow card next; Sam Gamgee is destroyed" | Unpicked characters show nothing, there is no margin, and nothing says the game is lost |
| Attackers gang up | Attack against defense, "N damage" | It does not say whether the enemy is destroyed |
| Effects until the end of the round | "+1" pill on the card; the preview says until when | The pill has no end. Delayed effects (`state.delayed`) are not drawn |
| Win by an objective, not progress | Quest band: "No quest points" | It does not say how the stage is won |
| Dead cards in hand | A card that cannot be played does not glow | Nothing says why |

## Proposals, most useful first

1. **Stops instead of Pass presses.** Replaces "fewer Pass presses". The table passes a step action window for the player unless that window is one of the player's stops. The default stops are the windows the video uses: after staging ("before the quest resolves") and before the shadow card turns. Planning and the quest commit always ask; the commit's own window is the video's "before staging" one. Response and cancel offers always stop, and so do the defense pick, travel and engagement. The table never passes these. Two more rules:
   - A step window also stops when a card that can be used there entered the hand or play since the last stop.
   - The stops are a setting, off by default and edited from the turn reference (8). The setting is the confirmation.
   - While stops are on, the dock says "Stops on" and the rail marks each stop.
   - An auto-pass is an ordinary Pass in the save, so Undo takes it back while nothing hidden has been shown.

   It also needs a "Pass to next stop" pill in the dock that arms like Pass. Its armed line names the stop it runs to: "Tap again: pass until before the shadow card". The engine is unchanged: every window still opens (brief, Action windows) and is passed by an intent.
2. **Name each window by what it comes before.** The eyebrow keeps the phase, and the title replaces "Action window" with the next step of the framework: "Before staging", "Before the quest resolves", "Before travel", "Before the shadow card turns", "Before damage". The point is already in the state: the round's last `stepWindows` entry ("3.3" after staging, "6.2" after the shadow cards are dealt; `src/rules/machine.ts`), and an attack's `awaiting` step ("defense", "shadow", "damage", "end", `src/rules/step-window.ts`). The numbers that window can still change stay pinned (`readout.ts`). This costs a word table and answers the video's longest lesson.
3. **Say when a choice loses the game.** A defender pick or an undefended hero is the Ring-bearer, or the last hero, and the damage reaches the hit points left. The result line then says so in danger: "Frodo Baggins is destroyed: The One Ring leaves play and the game is lost". The same applies when a quest shortfall would take threat to 50. A primary that confirms such a pick arms like Pass, with "Tap again: the game is lost". A loss that only a shadow card could cause is a margin, not a warning (4).
4. **Combat foresight on the defender pick.** Each ready character carries the damage it would take before the shadow card, in danger when that destroys it. The undefended heroes do the same. The picked defender's line adds the margin: "2 hit points to spare". The numbers come from `defenseAsDefender` and `modifiedStat`, as `readout.ts` already reads them for the picked one. The player-attack line adds "destroys Forest Spider", or "3 short of destroying it".
5. **Engagement foresight.** Several marks, all engine reads (`engagementCostOf` against the seat's threat):
   - From the quest commit to the engagement checks, each enemy in staging whose engagement cost is at or below the seat's threat carries a threat-red "Engages" mark.
   - The optional engagement sheet shows the threat beside each cost and says which enemies the checks will engage anyway.
   - A tap on a threat ring opens a panel: "Threat 30 of 50", each staging enemy's cost with Engages or Stays, and the threat the refresh phase adds.
6. **What a quest commit leaves for combat.** While committing, the pinned numbers add the characters left ready and the attack strength of the enemies engaged and marked Engages: "Ready after this: 1 · Enemies attacking: 2 (3 and 3 attack)". The armed Commit no one line gives the cost: "Tap again: no one quests. Staging threat is 3 before the reveal."
7. **Travel: what it gains, what it costs, why not.** Each location on the travel pick shows the staging threat after travel ("Staging threat 5 → 3"), its quest points as "takes the next 3 progress", and its Travel line when it prints one. While a location is active, the sheet says "Explore Old Forest Road first: 1 more progress", not "No location to travel to". `travelRefusals` already reads the reasons, but it returns nothing while a location is active.
8. **Turn reference behind the rail.** A tap on the rail opens the round as the Rules Reference's framework chart lays it out: phases, steps, every action window, the current step marked, and the stops (1) as toggles. Each step has one line from its rule title in `data/rules` and the player's decision there. This is the video's "keep a round summary nearby".
9. **The objective on the quest band.** A stage with no quest points says how it is won, from its effect record ("Defeat Ungoliant's Spawn to win"), not "No quest points". The words are built from the record, as `choice-words.ts` builds a branch, and no booklet prose is pasted.
10. **Why a card does not glow.** A tap on a hand card that does not glow shows it large with the reducer's reason in one line: "No Leadership hero has 2 resources", "Gandalf is unique and already in play", "Allies are played in planning", "Attaches to a hero". In planning, cards the seat cannot pay for are dimmed, and each hero's resource token carries its sphere tint. The video stresses that pools are kept per hero.
11. **Effects that end, and effects that come back.** A pill from a lasting effect carries a small end mark (round or phase). A pending delayed effect is drawn on its card, "Back to hand at end of combat", and the banner names it when it resolves.
12. **Resolve in beats.** After an attack, the banner steps through what happened one beat at a time, each beat drawn on the cards it touches: the shadow card turns, its effect, the damage, a card destroyed. When the shadow card destroys the defender, one beat reads "Snowbourn Scout destroyed: the attack is now undefended". The steps already come in order from the engine; this paces them.
13. **A first-game guide.** In a player's first scenario, a dismissible line under the dock's title explains each step the first two times it comes up, worded from the rule spans. Later rounds are quiet, as the video's later rounds are shorter. The briefing's difficulty line says what Easy changes, for a first game.
14. **Round summary.** At the end of the round, the banner sums the round from the log: threat before and after, progress placed, damage taken, cards drawn and played.
15. **Readability options.** A larger-cards setting that drops to five cards across and lets the hand overlap more, and a high-contrast badge option. The badges already carry a sign and an icon, so they do not rely on colour alone.

## Engine notes the video raised

- **Two Responses at once.** The video commits Aragorn and Théodred and resolves Théodred's Response first, so Aragorn's can spend the resource it adds. The engine queues one `committed` event per card in the Commit intent's order (`commit` in `src/rules/machine.ts`). Each event's offers are collected when that event is announced, and only Responses the seat can pay for at that moment are offered (`collect` in `src/rules/responses.ts`). The player chooses the order only through the order of the cards in the intent, and the table does not say that. The rules give the order to the player (`faq.simultaneous-effects`); this is already open in `docs/phases/STATUS.md`. The core Aragorn (01001) has no effect record yet, so the combo cannot be played today either way.
- **Always use a free Response.** A Response with no cost and no choice (Glóin: add resources for damage suffered) could be set to Always on its card's preview, as a per-game setting. It would not apply to a Response with a cost, a target or a cancel.

## Order to build

The `ux` review of the rework (2026-10-25) put resolve in beats first, then combat foresight, Undo (since built), less ceremony for windows, and why a card does not glow. The transcript and the measured passes change that order. Stops (1) and window names (2) come first, because Pass is most of a round's decisions. The loss warning (3) and foresight (4) come next, because every measured loss was one confirmed choice. Then engagement foresight (5), the commit readout (6) and travel (7). The rest follow in the order above.

## Built

- **Undo within an open decision** (2026-10-25; the rule is in `docs/brief.md`, Rules engine). Undo, in the dock, takes back the last choice while it showed nothing hidden. A commit or a card played can be taken back. A defender usually cannot, because the shadow card turns with it.
- **Haptics on arm and confirm** (2026-10-25, `expo-haptics`, which the user allowed): a tick when a button arms, a confirm when an intent is sent or taken back, a reject on a refusal.
