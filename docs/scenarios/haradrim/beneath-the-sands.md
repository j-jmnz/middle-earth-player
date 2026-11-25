# Beneath the Sands

Haradrim part 6 (Beneath the Sands, `BtS`), standalone only, on Easy and Normal (Q07.6, E07.6). Encounter sets Beneath the Sands, Desert Creatures and Harad Territory (`hrd.setup-beneath-the-sands`). The scenario adds the double-sided Search objective, Off Track and On Track (`hrd.search-objective`), the Track X keyword (`hrd.track`, `hrd.track-example`), Valour (`bts.valour`) and the encounter side quest Lost Underground (17075).

- **Setup.** Stage 1A prints "Set Brood Mother aside, out of play. Add the Search objective to the staging area (Off Track face up)." (`17076:A:1`). The reader gives an aside and a staging clause naming Off Track.
- **Piles.** The set-aside pile holds Brood Mother (17065). The staging pile holds the Search objective as one placement, Off Track (17079) faceup with On Track (17080) as its `back`. DragnCards files the one card with On Track as side A; two `dragnCardCodes` rows (the OCTGN guid finds side A, an override names side B) and a rule in `scripts/data/normalize/scenarios.ts` (a two-sided card the Setup stages is dealt on the side the Setup names) give Off Track as the faceup side.
- **Track X (what the engine needs).** On a location with Track X: after the players travel there while Off Track, discard X cards from the encounter deck (shuffle the discard pile in when it runs out); if one has "On Track" in its lower right corner, flip the Search objective to On Track and discard its resources. While On Track is in play many cards read it. The flip may be blocked by Lost Underground.
- **Side quest.** Lost Underground (Beneath the Sands) is in the encounter pile at both difficulties; while it is in play the objective cannot flip.
- **Errata.** None. Off Track prints "place 1 resource here" where Hall of Beorn says "progress"; the ledger follows the scan (misprints keep the source line).

## Data

- Track is in the `keywords` of `data/cards` as "Track 2", "Track 3", "Track 4" tokens; the build lists it among the unknown keyword tokens until the family reads it.
- Stage 1B discards cards until X locations are discarded and stages them; stage 2A flips Off Track and stages X enemies; stage 3A adds Brood Mother.
- The Spider's Hive is printed "The Spiders' Hive" on the quest card; the data keeps Hall of Beorn's "The Spider's Hive" (item for issue #269).

## Readings

The statuses are those of the Readings bullet of `docs/scenarios/haradrim.md`. Each key is the scan-read ledger line (`data/printed/haradrim.json`), `<code>:<side>:<n>`. Sources read: `hrd.search-objective`, `hrd.track`, https://lotr-lcg-quest-companion.gamersdungeon.net/haradrim-cycle-quest-beneath-the-sands.html, https://secondhandtook.wordpress.com/2017/05/30/first-impressions-beneath-the-sands/ (player reviews; no official ruling on the travel step).

- Track (span-settled). The keyword resolves after the players travel, only while Off Track; X is the active location's Track value; the encounter discard pile is shuffled into the deck when the deck is empty and the discard continues. Basis: `hrd.track`.
- Off Track and progress (span-settled). While Off Track is in play the players cannot place progress on the main quest; On Track lets them. Basis: `hrd.search-objective`.
- Lost Underground (`17075:A:1`) (span-settled). "Flip the Search objective to Off Track" on reveal; the objective cannot flip while the side quest is in play; Track is not resolved. Basis: the printed line.
- Track and the quest phase (recommended). The Forced effect of On Track at the end of the quest phase searches the top 3 cards; the Track keyword is not resolved while On Track. Not taken: Track resolves in both states. Basis: `hrd.track` ("if they are off track"). Sources: the review above states the same; no official ruling.
- Flip resources (span-settled). Flipping from Off Track to On Track discards all resources on the objective. Basis: `hrd.track`.
- Valour (span-settled). `bts.valour`.

## Readings to confirm

- Track and the quest phase: recommended. See Readings.
