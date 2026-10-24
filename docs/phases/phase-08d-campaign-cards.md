# Phase 8d: Campaign from cards

Depends on: phase 8c
Blocks: phases 10 and 12
Can run beside: phase 9

Plan: [docs/plans/authoritative-data.md](../plans/authoritative-data.md), changes C, D, F and G.

## Goal

Every Fellowship scenario is built into `data/scenarios` from its printed cards. Campaign setup and resolution come from the campaign cards and the Campaign Setup Checklist. Every engine step names its cause. No screen changes.

## Card facts

- `campaignKind` (`boon`, `burden` or null), `burdenSet`, and `back` (`player` or `encounter`) come from the card source and the ledger. Fix the boon and burden typing that 8b left as `treasure`/`Campaign`.
- Ledger the remaining dealt cards of scenarios 2 to 6, as in phase 8c.

## Scenarios built from the cards

- The encounter sets for each scenario come from its MEC109 Setup span. Quantities come from Hall of Beorn's set counts. Placement comes from running the setup records, the campaign card's front first and then stage 1A, in printed order, inside `buildStart`.
- The Setup templates read lists ("X and Y", "X, Y, and Z"), "all copies of", "1 … per player", "aside, out of play", "attach … to the Ring-bearer", "shuffle … into a Burden deck", and "set the Ring-bearer's life at N". A line no template reads is authored, as in phase 8.
- DragnCards' Normal and Easy load lists and Hall of Beorn's per-scenario counts become cross-checks. A real disagreement (Knife Ringwraith Easy, Flight Black Steed Easy) is an override that names the printed card that settles it.
- Burden decks and second encounter decks are zones in the definition when a setup record creates them. The widget flags stay derived from the zones.
- All six scenarios are written to `data/scenarios`. `data:check` fails when one is missing. `campaign.scenarios` lists all six. Whether a scenario is playable is the coverage result, not whether its file exists.

## Campaign

- `src/campaign` runs the Campaign Setup Checklist as numbered steps that cite its span. Heroes from the log. Fallen heroes replaced. A voluntary hero change adds 1 to the threat penalty unless a campaign card waives it. Apply the threat penalty. Attach Permanent cards. Put Setup boons and burdens into play (MEC109: a player card with Setup is found and resolved before the opening hand). Shuffle player-backed pool cards into their owners' decks. Shuffle encounter-backed pool cards into the encounter deck.
- Campaign card Setup and Resolution are effect records with timings `campaignSetup` and `resolution`, owned lines like any other. Delete `authored.resolution` from `data/campaigns/fellowship-of-the-ring.json` and its schema.
- Generalize `ChooseResolution` into the choices those records open: one choice per group, a choice per player in seat order, attach to a hero the chooser controls, a condition on the final state (The Balrog in play, Lust for the Ring attached, Fallen into Evil attached), and naming a hero for the notes. The player never types a number.
- `CampaignLog` gains `campaignPool` (code, back, burden set, attachedTo), `threatPenalty`, `captives`, and per-scenario `rounds` and `victoryPoints`. `score` is the Learn to Play formula, computed by the engine on a win. Update the `Save` and `CampaignLog` types in `docs/brief.md`.
- Scenario 1 is regenerated through this path. Its golden may change only where the old path was wrong: its resolution now comes from 141030's back. Explain each changed line of the golden in the commit.

## Causes and saves

- `EngineStep` gains `cause`: a rule id or an effect id with its line id. A test plays every golden and fails on a number-changing step (threat, damage, progress, resources, draw, reveal, life) whose cause is missing or not a verified span or ledger line.
- `saves.activeScenario` is `{ engineVersion, dataHash, seed, intents }`. Loading replays it through the reducer. A test replays each golden from its intents and matches the final state.

## Exit

- `pnpm data:check`, `pnpm test`, `pnpm lint` and `tsc` are green from a clean clone with the network off.
- `data/scenarios` holds all six scenarios. Each Normal deck size is asserted against the count derived from the printed cards.
- A campaign test wins scenario 1 with the Gandalf's Delay and The Ring Draws Them choices in turn, starts scenario 2, and finds the chosen burden in the encounter deck. The chosen boon goes where its own card says: Mr. Underhill by its Setup line, Gildor Inglorion by its encounter back. A hero change raises the threat penalty. A fallen hero cannot start.
- The cause test is green on every golden.
- Phone checks: none.
