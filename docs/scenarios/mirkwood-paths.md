# Mirkwood Paths and The Dark of Mirkwood

The rulings, readings and table pieces of Mirkwood Paths and The Dark of Mirkwood, scenario by scenario. Product rules, the Domain and the Core round are in `docs/brief.md`; the authority order is in `.claude/rules/authority.md`.

Two more official campaigns are built from the Revised Core Set (FFG product MEC101, RingsDB pack `RevCore`) and The Dark of Mirkwood (RingsDB pack `TDoM`). The Dark of Mirkwood rulebook (`tdom`, pinned in `data/sources.json`; `tdom.campaign-mode`, `tdom.mirkwood-paths`, `tdom.mini-campaign`) says how they fit together. Their data is built and the app knows more than one campaign: the campaign list shows one New playthrough tile for each campaign `data/campaigns/index.json` marks playable (`new-<campaignId>`), which opens that campaign's setup screen and its Start (`start-<id>`; `start-fellowship` for the Fellowship), the Scenarios tab one section for each box, and each save's progress line, path, log and booklet read their own campaign. A campaign is marked playable in the index once one of its scenarios is in `PLAYABLE_SCENARIOS`.

| Campaign id | Name | Scenarios, in order | Booklet |
| --- | --- | --- | --- |
| `mirkwood-paths` | Mirkwood Paths | `passage-through-mirkwood` (part 1), `journey-along-the-anduin` (2), `escape-from-dol-guldur` (3), `the-oath` (4), `the-caves-of-nibin-dum` (5) | `learn-to-play` (core campaign pages 30 and 31) |
| `the-dark-of-mirkwood` | The Dark of Mirkwood | `the-oath`, `the-caves-of-nibin-dum`, as a two-scenario mini campaign on a blank Campaign Log | `the-dark-of-mirkwood` |

The two campaigns share the scenario files of The Oath and The Caves of Nibin-Dûm. Neither is a saga: `saga` is false in their campaign files, so no Ring-bearer, no Fellowship-sphere hero and no prelude. Each campaign file names its booklet (`bookletId`) and, where the booklet prints a scenario's setup paragraph, its page (`bookletPages`; Mirkwood Paths has them for the three core scenarios, whose paragraphs are on Learn to Play p25, `ltp.setup-passage-through-mirkwood` and its two siblings).

Data rules, each with its reason in `data/overrides.json` or the code:

- The cards come from Hall of Beorn alone for these boxes, by `CardSet` ("Revised Core Set", "The Dark of Mirkwood"). Nightmare sets are different `CardSet`s, built as their own pack (Nightmare, below). Hall of Beorn's " (Campaign)" encounter-set suffix is not part of the set's name.
- The Revised Core Set reprints the 2011 core encounter cards under the same codes (01074 to 01131); the `RevCore` printing owns them. The Dark of Mirkwood's Hall of Beorn codes (020NN) are The Hunt for Gollum's, so its code is `410` and the two-digit collector number (Stalking Goblin 41041, as RingsDB lists it).
- Hall of Beorn's per-scenario counts lead. The quest card's printed Setup (from the scan-read ledger `data/printed/mirkwood-paths.json`) moves cards out of the encounter deck: searched for and staged, or set aside. DragnCards' decks (the 2011 core Q01/E01 and the Limited Collector's Edition Q00/E00 of The Oath and The Caves) are a cross-check: it compares each card's copy count (Normal and Easy), not which pile the copy is in. The Easy Mode sheet (`easy-mode.core-set`) lists the cards Easy removes from each Core Set encounter set and settles the Revised Core scenarios' Easy counts.
- The Learn to Play calls the second core scenario's set "Journey Down the Anduin"; the cards print "Journey Along the Anduin". The card wins; the booklet name is an alias (`encounterSetAliases`).

## Scenario files

- `docs/scenarios/mirkwood-paths/passage-through-mirkwood.md`: Passage Through Mirkwood
- `docs/scenarios/mirkwood-paths/journey-along-the-anduin.md`: Journey Along the Anduin
- `docs/scenarios/mirkwood-paths/escape-from-dol-guldur.md`: Escape from Dol Guldur
- `docs/scenarios/mirkwood-paths/the-oath.md`: The Oath
- `docs/scenarios/mirkwood-paths/the-caves-of-nibin-dum.md`: The Caves of Nibin-Dûm

## Readings to confirm

Readings not yet confirmed by the user (`.claude/rules/authority.md`, Open points). Delete a line when the user confirms it.

- Nightmare Ungoliant's Spawn (900102:A:1): the discard at 0 Willpower lasts the whole phase, not only the moment the effect resolves (`recommended`, `docs/scenarios/mirkwood-paths/passage-through-mirkwood.md`, Passage Through Mirkwood).
- Stage 2B (01127:B:1): an Ambush check made in the quest phase, when an enemy with Ambush is revealed, is still made (`recommended`, `docs/scenarios/mirkwood-paths/journey-along-the-anduin.md`, Journey Along the Anduin).
- Nightmare Troll Attack (900208:A:2): the attack resolved against each other player deals no shadow card of its own, and the hero that takes it is the controller's choice (`recommended`, `docs/scenarios/mirkwood-paths/journey-along-the-anduin.md`, Journey Along the Anduin; read https://visionofthepalantir.com/2019/05/18/nightmare-journey-along-the-anduin).
