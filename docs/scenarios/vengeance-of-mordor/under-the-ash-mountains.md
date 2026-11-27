# Under the Ash Mountains

Vengeance of Mordor part 7 (Under the Ash Mountains, `UtAM`), standalone only, on Easy and Normal (Q09.7, E09.7). Encounter sets Under the Ash Mountains and Twisted Tunnels (`vom.setup-under-the-ash-mountains`; the rulesheet prints "Twisting Tunnels", the set is in A Shadow in the East and the cards print "Twisted Tunnels", so an alias maps the booklet's spelling). The quest is two stages with the same discard rule; the scenario adds the encounter side quests The Tunnels of Torech Gorgor (22092), A Haunt for Beasts (22093) and Overwhelming Darkness (22094).

- **Setup.** Stage 1A prints "Setup: Each player with more than 40 cards in his deck discards cards from the top of his deck until he has 40 cards left. The first player adds a copy of Torech Gorgor Patrol to the staging area. Each other player adds 1 different location to the staging area. Shuffle the encounter deck and discard cards from the top until a side quest is discarded. Reveal that side quest. Shuffle the encounter discard pile into the encounter deck." (`22106:A:1`). The reader gives the steps `trimDecks`, `revealSideQuestFromDeck` and `reshuffleDiscardIntoDeck`, a staging clause and `eachPlayerAddsLocation` with `exceptFirst`.
- **Piles.** One Torech Gorgor Patrol is staged; the second is in the encounter deck. DragnCards loads 2 Ash Mountain Werewolf and the scan numbers the set so that 3 exist (8/29 to 10/29), so an override raises the count (Easy 3).
- **Win and lose.** At the end of the round each player discards X cards from his deck, X 1 more than the quest cards in play, and a player with no cards left is eliminated (`22106:B:2`); defeating stage 2B wins (`22107:B:3`).

## Data

- Event cards cannot shuffle cards from a player's discard pile into his deck (both stages); Hideous Deeps and Orc Passage have the printed texts of the ledger.

## Readings

The statuses are those of the Readings bullet of `docs/scenarios/vengeance-of-mordor.md`. Each key is the scan-read ledger line (`data/printed/vengeance-of-mordor.json`), `<code>:<side>:<n>`. Sources read: the Under the Ash Mountains rulesheet (`vom.strategy-tip-under-the-ash-mountains`), ALeP = https://alongextendedparty.com/semi-official-errata-faq-1-10/ (items 3.347, 3.354, 3.356), https://visionofthepalantir.com/2021/02/13/under-the-ash-mountains/ (a play article, no designer answer). A line not listed here is span-settled.

- Elimination at the end of the round (`22106:B:2`) (researched). "If a player has no cards left in his deck, he is eliminated from the game" is part of the Forced effect that triggers at the end of the round, not a separate passive effect: ALeP 3.356 (28 May 2020, Caleb Grace): https://alongextendedparty.com/semi-official-errata-faq-1-10/.
- Setup timing (`22106:A:1`) (researched). Quest Setup runs at step 7, after the opening hand and the mulligan; the deck is trimmed from what is left of the deck, and a player Setup effect (a contract, The One Ring) resolves at the time its insert gives: ALeP 3.354 (18 and 19 April 2020, Caleb Grace): https://alongextendedparty.com/semi-official-errata-faq-1-10/.
- Quest cards in play (`22099:A:1`, `22100:A:1`, `22105:A:1`) (recommended). The count is the main quest plus each side quest in play, the staging area and the current quest included; the stage 2 card is not counted at stage 1. Not taken: only the main quest. Why recommended: the post above counts the main quest and the side quests; no official source settles a side quest in the victory display, which is out of play.
- Revealed side quest (`22106:A:1`) (recommended). The side quest discarded is revealed as the staging step reveals it: its When Revealed text resolves and it is added to the staging area, and a Surge on it is not triggered. Not taken: Surge triggers. Why recommended: the post above says Lost in the Dark takes 10 cards from the deck in Setup; no source covers Surge on a Setup reveal.
- Hideous Deeps (`22101:A:2`) (span-settled). The cards under it return only when it is explored as the active location. Basis: the printed line; the post above agrees.
- Torech Gorgor Patrol (`22099:A:2`) (span-settled). The limit of 5 progress a round on the main quest is for progress from all sources together while the Patrol is in the staging area. Basis: the printed line.
