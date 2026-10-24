# Phase status

Status is `not started`, `active`, or `completed`.

If nothing is active, the only legal start is the lowest-numbered phase whose dependencies are completed. Dependencies live in the phase file, not in this table.

When you start a phase, set it to `active` and leave a one-line note. When its exit is green, and `/reviewer` reports no blocks, set it to `completed` and write the date. A phase that changes `src/screens` or `src/play` also needs `/ux` to report no blocks. Do not mark the next phase active. More than one phase may be active only when their files say they can run beside each other.

Maestro flows are written in the phase that names them. `maestro test` runs after the last phase. It does not gate an earlier phase.

| Phase | Work | Status | Note |
| --- | --- | --- | --- |
| 0 | Correct the brief | completed | 2026-10-23. Brief matches the booklet on the items in the phase file. Gandalf's Delay draw timing stays unresolved until the quest card is cited. |
| 1 | Tooling shell | completed | 2026-10-23. Expo shell opens on an empty campaign list. Import boundaries, Vitest, and the Maestro flow are in place. |
| 2 | Catalog build | completed | 2026-10-23. The catalog script writes `assets/catalog.db` from RingsDB. Node tests read hero `141001`. Reviewer reported no blocks. |
| 3 | Phone databases | completed | 2026-10-23. Catalog and user databases open on the phone. A splash-screen hide failure leaves the pack list up. The open-card Maestro flow is written and runs with the suite after the last phase. |
| 4 | Scenario 1 fixture | completed | 2026-10-23. The A Shadow of the Past fixture joins to catalog rows. The Normal encounter deck is 42. Reviewer reported no blocks. |
| 5 | Image cache | completed | 2026-10-23. Download queue, scan packer, and pack/card images are in the tree. The airplane-mode resume was not run on a phone. |
| 6 | Deck builder | completed | Phone check is still open: nobody has flung the full pool and typed in the filter on a physical phone. The simulator does not close that exit. Review blocks on split copies, the dropped-card sentence, the cost filter, a failed starter insert, shared sphere marks, extra heroes, add-button feedback, the name field, reduced motion, and chooser lists were fixed. |
| 7 | Round engine | completed | Review blocks on eliminated seats, staging archery, an attack after the attacker leaves play, and progress above quest points are fixed and waiting for review. Engagement takes the highest cost at or below threat, and a quest shortfall raises every living player's threat (both per Learn to Play p12-14). Unused shadow cards are discarded when their enemy leaves play and at the end of combat (p16). This phase does not close the phase 6 phone fling. |
| 8 | Scenario 1 effects | completed | 2026-10-24. Batches 1-5 done (Hide frame; quest setup on catalog cards; When Revealed and Forced; shadows; Response, Action, constant, travel; loadout validator, Ring-bearer setup, two-handed transfer, resolution groups with ChooseResolution, win from Bucklebury Ferry, effects rows in catalog.db with round-trip test, ensure-catalog, CI workflow, full-game test on fixed seeds). Reviewer reported no blocks. All 26 dealt cards were re-read 2026-10-24 from Hall of Beorn's MEC109 (TFotR) printing pages; keywords, engagement, threat, quest points, traits, unique flags, and printed timings matched, and `scripts/mec109-read.test.ts` pins them. The 26 still await confirmation on the physical cards, including the stage 3 win on Bucklebury Ferry. Local records now carry the MEC109 collector numbers from those pages. 141078 Gandalf's Delay is complete: its second Setup record reduces the opening hand (`ReduceOpeningHand` 1), resolved with player Setup before the hand (MEC109 #46, TFotR printing read via Hall of Beorn 2026-10-24; confirm on the card). Shadow timing (after the defender is declared or the attack is undefended, before damage) is confirmed on Learn to Play p16. Revealed treachery and treasure cards stay in staging as before (user decision). |
| 9 | Starter effects | not started | |
| 10 | Campaign shell | not started | |
| 11 | Scenario 1 table | not started | |
| 12 | A Knife in the Dark | not started | |
| 13 | Flight to the Ford | not started | |
| 14 | The Ring Goes South | not started | |
| 15 | Journey in the Dark | not started | |
| 16 | Breaking of the Fellowship | not started | |
| 17 | Design system | completed | 2026-10-23. Parchment chrome from the card frames and booklets, applied to the screens that exist. Reviewer has not reported. |
