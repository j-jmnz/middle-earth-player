# The Land of Sorrow

Vengeance of Mordor part 8 (The Land of Sorrow, `TLoS`), standalone only, on Easy and Normal (Q09.8, E09.8). Encounter sets The Land of Sorrow, Easterling Raiders and Rolling Plains (`vom.setup-the-land-of-sorrow`; the last two are in A Shadow in the East). The quest is two stages; the scenario adds the Camp locations, the Warden enemies and the Captive objective-allies.

- **Setup.** Stage 1A prints "Setup: Add each Camp location to the staging area. Attach a random Captive objective-ally to each Camp location as a guarded objective. Place one random Warden enemy faceup (but not in play) under each Camp location. Shuffle the encounter deck and discard cards from the top until X locations are discarded, where X is 1 less than the number of players. Add each discarded this way to the staging area." (`22135:A:1`). The reader gives a staging clause for the three Camps, the steps `attachRandomCaptives` and `placeWardensUnderCamps`, and (with Ered Mithrin's pattern) `discardToStaging`.
- **Piles.** The three Camps (The Barracks, Slave Quarters, The Storehouse) are staged; the three Captives (Edrahil, Arador, Farin) and the three Wardens (Ulwarth, Lorgan, Borlach) are set aside until the Setup places them.
- **Win.** Stage 1B cannot be defeated unless the players control all 3 Captive objective-allies; stage 2B wins the game and cannot be defeated while a Warden is in play (`22136:B:3`).

## Data

- The Wardens are immune to player card effects, and only the engaged player declares attackers or defenders against one (Ulwarth: no allies). Each Camp has Victory 1 and gives the first player control of its Captive when explored.

## Readings

The statuses are those of the Readings bullet of `docs/scenarios/vengeance-of-mordor.md`. Each key is the scan-read ledger line (`data/printed/vengeance-of-mordor.json`), `<code>:<side>:<n>`. Sources read: the Land of Sorrow rulesheet (no rule beyond the sets), https://visionofthepalantir.com/2021/12/05/the-land-of-sorrow/ (a play article, no designer answer), ALeP = https://alongextendedparty.com/semi-official-errata-faq-1-10/ (no entry for the scenario). A line not listed here is span-settled.

- Random Captive and Warden (`22135:A:1`) (recommended). The first player draws the random card for each Camp without looking, in Camp order; the Warden lies faceup under the Camp and is not in play, so it has no threat, no text and no effect until the Camp is active. Not taken: the Wardens are in the staging area. Why recommended: the post above says "attached faceup but not in play"; no official source says who draws.
- Guarded objective (`22135:A:1`, `22121:A:2`) (span-settled). A Captive attached to a Camp location is a guarded objective of that location; exploring the Camp frees it and the first player gains control of the objective-ally. Basis: `rr.guarded`, the printed lines.
- Wardens under a Camp (`22121:A:1`, `22123:A:1`) (recommended). When a Camp becomes the active location its Warden is added to the staging area (for The Barracks it cannot take damage this round, for The Storehouse it gets +3 Attack and -30 engagement cost until the end of the round); the Warden is then an ordinary enemy until it leaves play. Not taken: the Warden engages. Why recommended: the post above reads it so and says most decks must engage the Storehouse's Warden; no official source settles it.
- Travelling to a Camp (`22135:B:1`) (span-settled). "Players cannot travel there while a Warden enemy is in play" counts any Warden in play, so a Camp is entered only after the Warden of the previous Camp is defeated. Basis: the printed line.
- Easterling Guard (`22127:A:2`) (span-settled). The current archery total includes the Guard's own Archery 2. Basis: `hrd.archery` ("cumulative").
- Wardens and ranged (`22118:A:2`, `22119:A:2`, `22120:A:2`) (recommended). Only the engaged player can declare attackers or defenders against a Warden, so a Ranged or Sentinel character of another player cannot; a Warden in the staging area has no engaged player. Not taken: Ranged and Sentinel are exceptions. Why recommended: the post above says Ranged and Sentinel cannot be used against Wardens; no official source settles it.
- Lead the Revolt (`22136:A:1`) (span-settled). The first player returns each Warden in the victory display to the staging area (a Warden defeated earlier has Victory 1), and each other player adds an enemy discarded from the shuffled deck. Basis: the printed line.
