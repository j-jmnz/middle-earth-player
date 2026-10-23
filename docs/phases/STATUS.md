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
| 5 | Image cache | active | Download queue, scan packer, and pack/card images are in the tree. Phone exits are still unproven. |
| 6 | Deck builder | not started | |
| 7 | Round engine | not started | |
| 8 | Scenario 1 effects | not started | |
| 9 | Starter effects | not started | |
| 10 | Campaign shell | not started | |
| 11 | Scenario 1 table | not started | |
| 12 | A Knife in the Dark | not started | |
| 13 | Flight to the Ford | not started | |
| 14 | The Ring Goes South | not started | |
| 15 | Journey in the Dark | not started | |
| 16 | Breaking of the Fellowship | not started | |
| 17 | Design system | active | Parchment chrome from the card frames and booklets, applied to the screens that exist. Review is still open. |
