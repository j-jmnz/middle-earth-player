# Fellowship of the Ring

The rulings, readings and table pieces of Fellowship of the Ring, scenario by scenario. Product rules, the Domain and the Core round are in `docs/brief.md`; the authority order is in `.claude/rules/authority.md`.

MEC109 reprints **The Black Riders** (RingsDB pack `TBR`, 2013) and **The Road Darkens** (pack `TRD`, 2014) as one campaign. There is no RingsDB pack code for the 2022 box. The campaign id is `fellowship-of-the-ring`. The box is 329 cards: 7 heroes, 57 player cards, 22 quests, 209 encounters, 6 campaign cards, 28 boons and burdens.

Every scenario in the box starts the same way. The engine does it. Do not ask the player to remember the booklet.

- The first seat must control a Fellowship-sphere hero with the Ring-bearer trait. That hero is one the player put in the deck. Do not insert a Frodo the player did not choose.
- Attach The One Ring to that hero. The One Ring is an objective granted by setup. It is not a deck card and it does not count against the 50-card minimum.
- While The One Ring is attached, that hero does not count against the hero limit. A seat may therefore start with four heroes: the Ring-bearer plus three others. A seat may also start with three heroes when one of them is the Ring-bearer. Both are legal. A seat with no Ring-bearer is not.
- Only one Fellowship-sphere hero may be in play. No other version of Frodo may be a starting hero or in the deck.
- Fellowship-sphere heroes cannot be used outside saga scenarios. The deck may still be saved. The briefing refuses them.
- Two-handed: when the first-player token passes in refresh, the new first seat gains control of the attached Ring-bearer, the resources in that hero's pool, and every card attached to that hero. If that transfer leaves a seat with no heroes, that seat is eliminated immediately.

| # | Scenario id | Difficulty | Encounter sets and extra rules, from the booklet |
| --- | --- | --- | --- |
| 1 | `a-shadow-of-the-past` | 6 | Sets: A Shadow of the Past, Hunted, The Ring, The Black Riders. Hide X. Stage titles used by Hall of Beorn: Three is Company, A Shortcut to Mushrooms, Escape to Buckland. |
| 2 | `a-knife-in-the-dark` | 7 | Sets: A Knife in the Dark, Hunted, The Ring, The Nazgûl. |
| 3 | `flight-to-the-ford` | 5 | Sets: Flight to the Ford, Hunted, The Black Riders, The Nazgûl. Not The Ring. Burden deck and life tracker, below. The campaign card adds a response any player may trigger. |
| 4 | `the-ring-goes-south` | 6 | Set: The Ring Goes South only. The campaign card waives the hero-change penalty and grants Sting, Mithril Shirt, Glamdring and Andúril. Stage 4 can have two active locations. Doors of Durin is immune to player card effects. The Ring-bearer can be placed facedown under Watcher in the Water. |
| 5 | `journey-in-the-dark` | 8 | Set: Journey in the Dark only. The campaign card adds the burden objectives Grievous Wound and Overcome by Grief to the staging area and the burden treacheries Pursued by the Enemy and Shadow of Fear to the encounter deck. Doom, Doom, Doom counts damage tokens down to the Balrog, which sits in the staging area but is considered engaged with the first player. |
| 6 | `breaking-of-the-fellowship` | 7 | Set: Breaking of the Fellowship only. Stage 2A removes the Ring-bearer from the game. From stage 2B, separate staging, each seat on a different stage 3A. True solo is one area. Do not delete the rule for solo. |

The booklet's scenario chapters name the encounter sets. They do not list every card. Card-by-card setup (Bag End, the Black Rider, Bucklebury Ferry, and the rest) is printed on the quest cards. Hall of Beorn is a reading aid for those lines. The quest card wins if Hall of Beorn disagrees. The runtime never fetches Hall of Beorn.

## Scenario 1 resolution

This is a transaction, not a notes field. On a win the player chooses one of:

- `Gandalf's Delay` or `The Ring Draws Them`, then
- `Gildor Inglorion` or `Mr. Underhill`.

Each chosen card is added to the campaign pool and recorded on the log.

The choice is printed on the back of the campaign card 141030. Each campaign card's Setup and Resolution lines are effect records owned by the card's ledger lines, with timings `campaignSetup` and `resolution`. A Resolution record is a list of `ChooseCards` groups plus `Earn`, `EarnAllBurdens`, `MarkFallen` and `NameCaptives`. One choice is asked per group, per player in seat order when the card says so; a chosen card goes to the pool, into a hand or onto a hero, and an `inPlay` or `attachedToHero` condition reads the final state. `ChooseResolution` carries an option id (a code, or `code>heroInstanceId`, or `skip`), never a typed number. A scenario that is lost writes nothing. A scenario already on the log is not granted again. A chosen Permanent card is recorded as attached, not as a pool card.

The score of a won scenario is computed from the final state when the log is written (`src/campaign/score.ts`). Only completed rounds count: a round is tallied at the end of its refresh phase (`faq.scoring`), so the round the players win in is not one.

Stage 3 has no quest points. The win is a `questResolution` record on Bucklebury Ferry: after it leaves play explored, the players win.

## Scenario files

- `docs/scenarios/fellowship-of-the-ring/a-knife-in-the-dark.md`: A Knife in the Dark
- `docs/scenarios/fellowship-of-the-ring/flight-to-the-ford.md`: Flight to the Ford burden deck and life
- `docs/scenarios/fellowship-of-the-ring/the-ring-goes-south.md`: The Ring Goes South, stage 4 and the damage on locations
- `docs/scenarios/fellowship-of-the-ring/journey-in-the-dark.md`: Journey in the Dark, the Doom countdown and the Balrog
- `docs/scenarios/fellowship-of-the-ring/breaking-of-the-fellowship.md`: Breaking of the Fellowship, stage 2B

## Hide tests

The rule is `mec109.hide-x` and `mec109.hide-tests`, with the worked example (Hide 3, 2 willpower committed, discarded threat 2 + 2 + 0, an action raises willpower to 4, the test succeeds) as the fixture. The engine runs it as a frame: the revealing seat tests before that card's When Revealed or Forced effect, an action window opens after the discarded threat is known, then the frame pops and the rest of the revealed card resolves. A treachery adds 0 threat. This is not a token the player tracks by hand.

## Explored on arrival

A location in the staging area can hold progress that fills its quest points once it is active (A Shadow of the Past, Pathless Country: its staging bonus drops away). The players travel to it and it is explored at once (`rr.explored`) and goes to the discard pile. It never became the active location, so its Forced effects and Responses after travel do not fire. Source: agent recommendation (`rr.explored` does not say whether a location explored on arrival counts as the active location).

## Seeded decks

On first launch, insert two saved decks that match the printed starter lists. They are ordinary `user.db` decks. The parenthetical numbers below are collector numbers inside a product, not RingsDB codes, and the same number is used in the core set and in this box. Resolve each row by card name against the core set plus MEC109. Prefer the Revised Core code when the booklet's core-set card has a revised printing. The lists are data: `data/starter-decks.json` holds each row with the code chosen for it and the MEC109 span (`mec109.starter-stealth`, `mec109.starter-wisdom`) that prints the list, `pnpm data build` copies them into `data/campaigns/fellowship-of-the-ring.json` as `starterDecks`, and the seed script reads that file. A test checks each row's name, collector number and count, and each section total, against the span.

These decks can be built from this expansion and the core set. Each list is 3 heroes and 50 other cards.

**Stealth and Steadfastness**

- Heroes: Sam Gamgee (3), Merry (4), Pippin (6)
- Allies: 3 Bill the Pony (8), 2 Boromir (11), 2 Faramir (14), 2 Veteran Axehand (28), 2 Beorn (31), 3 Erebor Hammersmith (59), 2 Henamarth Riversong (60), 2 Gléowine (62), 3 Gandalf (73)
- Attachments: 3 Hobbit Cloak (10), 3 Dagger of Westernesse (13), 3 Elf-stone (20), 1 Steward of Gondor (26), 1 Celebrían's Stone (27), 1 Horn of Gondor (42)
- Events: 2 Halfling Determination (14), 3 Frodo's Intuition (26), 2 Ever Vigilant (20), 2 Common Cause (21), 3 Sneak Attack (23), 3 Feint (34), 2 Quick Strike (35)

**Wisdom and Wizardry**

- Heroes: Gandalf (7), Théodred (2), Éowyn (7)
- Allies: 3 Galadriel (9), 3 Bilbo Baggins (15), 1 Faramir (14), 3 Snowbourn Scout (16), 3 Wandering Took (43), 3 Northern Tracker (45)
- Attachments: 3 Gandalf's Staff (22), 3 Wizard Pipe (23), 2 Fellowship of the Ring (25), 2 Steward of Gondor (26), 1 Celebrían's Stone (27), 3 Unexpected Courage (57)
- Events: 3 Flame of Anor (24), 1 Ever Vigilant (20), 1 Common Cause (21), 2 Valiant Sacrifice (24), 1 Grim Resolve (25), 1 The Galadhrim's Greeting (46), 3 Hasty Stroke (48), 3 A Test of Will (50), 3 Stand and Fight (51), 2 Dwarven Tomb (63)

When both decks are used together, the booklet says to replace the three copies of Gandalf (73) in Stealth and Steadfastness with three copies of Elrond (19). Show that as a note on each starter deck's own screen, not on the deck list (user request, 2026-10-25). Do not mutate either saved deck. The same unique card may sit in both decks. A second copy cannot enter play. Do not reject the pair for sharing Faramir, Steward of Gondor, or Celebrían's Stone.
