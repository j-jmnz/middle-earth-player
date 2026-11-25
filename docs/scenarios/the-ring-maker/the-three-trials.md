# The Three Trials

The Ring-maker part 5 (pack `TTT`), standalone only, on Easy and Normal (Q04.5, E04.5). Encounter sets The Three Trials and Ancient Forest (`rm.setup-the-three-trials`; Ancient Forest is shared with Into Fangorn). The rulesheet defines the current trial and the current trial's Key objective (`rm.current-trial`) and prints Secrecy X (`rm.secrecy`).

- **Setup.** Stage 1A prints "Set aside all 3 Guardian enemies, all 3 Key objectives, all 3 Barrow locations, and Hallowed Circle." (`08035:A:1`). The Setup reader takes the cards of the set by trait and type: the ten set-aside cards.
- **Piles.** The `setAside` pile holds Boar's, Wolf's and Raven's Guardian (08040 to 08042), the three Keys (08043 to 08045), the three Barrows (08046 to 08048) and Hallowed Circle (08049). The quest pile holds five stages: 1A, the three stage 2 quests (08036 to 08038) and 3A (08039). No override.
- **Errata.** None for a card of this scenario.

## Data

- Stage 1B advances "to a stage 2A quest of their choice" (`08035:B:1`). Each stage 2A sets cards aside into the staging area and attaches a Key to a Guardian or Barrow; each stage 2B says what the players do when they control the current trial's Key objective and advances to a stage 2 of their choice, or to stage 3A when all stage 2 quests have been defeated.
- The three Guardians print Time 2, 3 and 4 as an ability line (`08040:A:2` to `08042:A:2`: "Time 2. Forced: After the last time counter is removed from Boar's Guardian ..."), each re-placing its counters.
- Hallowed Circle (08049) is immune to player card effects and has the Travel cost "The players must exhaust 3 Key objectives."

## Readings

The statuses are those of the Readings bullet of `docs/scenarios/the-ring-maker.md`. Each key is the scan-read ledger line (`data/printed/the-ring-maker.json`), `<code>:<side>:<n>`.

- The current trial (`08036:B:2`, `08037:B:2`, `08038:B:2`) (span-settled). The stage 2 in play is the current trial; its Key objective is the one chosen by its stage 2A's When Revealed effect. The stage 2B ends when the players control that Key, whichever other Keys they control. Basis: `rm.current-trial`.
- Choosing a stage (`08035:B:1`, `08036:B:2`) (span-settled). The players choose the stage 2A by group decision; a stage defeated earlier is not offered again, and when all three are defeated the quest advances to stage 3A. Basis: the printed lines, `rm.current-trial`.
- Random choices (`08036:A:1`, `08037:A:1`, `08038:A:1`) (span-settled). "Randomly choose 1 of the remaining set aside" picks among the cards still set aside, which excludes those of earlier trials. The Key that shares a Trait with the Guardian (Boar, Wolf or Raven) is found among the set-aside Keys. Basis: `rm.current-trial` and its example.
- `08038:A:1` (span-settled). The Key is shuffled into the bottom 10 cards of the encounter deck after the encounter discard pile is shuffled into the deck. The ledger corrects "suffle" to "shuffle". Basis: the scan.
- `08038:B:1` (span-settled). "Any time players would place progress on this quest, discard an equal number of cards from the encounter deck instead (progress is placed on the active location before triggering this effect)": the progress still goes to the active location first and only the excess is replaced, one card for each progress. Not taken: all the progress is replaced. Basis: the printed parenthesis.
- `08040:A:1` to `08042:A:1` (span-settled). The Guardians cannot have non-Key attachments, so the Key attached by the stage stays. Basis: the printed lines.
- `08037:B:1` (span-settled). The Guardians cannot be damaged and do not leave play except by a quest effect. Basis: the printed line.
- `08043:A:1` to `08045:A:3` (span-settled). Each Key must be claimed by the first player and attached to a hero; a discarded Key returns to the staging area; a Key dealt as a shadow card shuffles back into the encounter deck. Basis: the printed lines.
- `08049:A:2` (span-settled). The three Keys are exhausted for the Travel cost of Hallowed Circle; the hero each is attached to is not exhausted. Basis: the printed line.
- `08052:A:1`, `08052:A:3` (span-settled). Grim Foothills has Doomed 2, which raises each player's threat by 2 when it is revealed (`rr.doomed-x`), and progress is placed on it before the active location while it is in the staging area. Basis: `rr.doomed-x`, the printed line.
- `08055:A:1` (span-settled). Wild Tenacity removes X time counters from each enemy that has the Time keyword, where X is the number of players. Basis: the printed line, `rm.time-x`.
