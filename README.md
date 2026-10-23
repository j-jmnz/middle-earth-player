# Solo LOTR LCG

A personal, offline app for The Lord of the Rings: The Card Game. Official campaigns are the product. The proof of concept is the 2022 Fellowship of the Ring Saga Expansion (MEC109), with the full official player-card pool available for decks from the first install.

The phone app is not scaffolded yet. Decisions, the stack, the data rules, and the build order are in [docs/brief.md](docs/brief.md). Structure is in [docs/architecture.md](docs/architecture.md). What is in progress is in [docs/phases/STATUS.md](docs/phases/STATUS.md). `/implementer` builds a phase, `/reviewer` reviews the diff, and `/ux` reviews the screens. The app applies the rules, keywords, phases, effects, and the resulting numbers. The player only chooses among legal options. Do not reopen the product shape, and do not port DragnCards.

Do not commit `catalog.db`, RingsDB dumps, or card text. The catalog is generated in the release job and shipped inside the binary.
