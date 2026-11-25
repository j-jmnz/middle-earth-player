# The Blood of Gondor

Against the Shadow part 8 (pack `BoG`), standalone only, on Easy and Normal (Q03.8, E03.8). Encounter sets The Blood of Gondor and Ravaging Orcs (`ats.setup-the-blood-of-gondor`; Ravaging Orcs is shared with The Siege of Cair Andros and Encounter at Amon Dîn). Hidden cards are `ats.hidden-cards` and `ats.hidden-cards-turn-faceup`; the FAQ entry on hidden cards turned faceup is `faq.blood-of-gondor-hidden-cards`. Captured! (stage 2) has Battle (`hon.battle`); The Cross-roads makes the current quest card gain Siege and lose Battle (`faq.errata.06123`).

## Data

- **Piles.** Hall of Beorn's text of stage 1A adds The Cross-roads and the Black Númenorean to the staging area and puts the objective allies Faramir and Lord Alcaron into play. The data: `staging` Black Númenorean (06119) and The Cross-roads (06123), `setAside` Faramir (06132) and Lord Alcaron (06133). The scenario has two quest stages (06117, 06118). No override.
- **Errata.** The Ambush (`faq.errata.06117`, stage 1B: a choice between turning the hidden cards faceup and taking a hidden card) and The Cross-roads (`faq.errata.06123`). The scan of 06117 B already prints "either" and the comma, and the scan of 06123 prints the erratum's wording, so the ledger holds the printed text.
- **Printed lines.** The Readings are keyed by the scan-read ledger's line ids (`data/printed/against-the-shadow.json`). The scans of Captured! (06118 A) and Lying in Wait (06129 A) were read against the ledger and agree.
- **Name.** "The Crossroads" in the Setup line of 06117 is the card printed "The Cross-roads" (06123); there is one card.
- **Source typos.** Hall of Beorn has "hiddien" (06119), "Brutual" (06121), "Easter Road" (06127), "destoys" and "a characters" (06130). The ledger prints "hidden", "Brutal Uruk", "Eastern Road" and "destroys a character".
- **Shared cards.** Ravaging Orcs (05062 to 05064) is read in `the-siege-of-cair-andros.md`; its rows apply here as written there. One interaction is new: a hidden turn can engage Orc Arsonist in the middle of the combat phase (see `hidden.shadow-vs-arsonist`).
- **Conflict at the Crossroads.** Hall of Beorn lists Surge as a keyword of Conflict at the Crossroads (06131), but the card prints no Surge line: its When Revealed text says it gains surge only when no Orc enemy is engaged. An override in `data/overrides.json` turns the keyword off and the record gains it by its condition.
- **Rulesheet.** The hidden-card spans are read from the pinned rulesheet insert (`bog`). The Quest Companion transcription and the community FAQ compendium the research also used are community material.

## Readings

Statuses are those of `docs/scenarios/against-the-shadow.md` (Readings). Format: line (status). Reading. Not taken. Basis. Short names of sources:

- QC https://www.lotr-lcg-quest-companion.gamersdungeon.net/ (Blood of Gondor, Rulings, Hidden Cards)
- UFAQ https://docs.google.com/document/d/18_pYjnXi27r1P886cMHGmb7ZX-tuWeTLe7bGIVP-vs4/export?format=pdf
- F96446 https://ffg-forum-archive.entropicdreams.com/topic/96446-rule-questions-regarding-the-blood-of-gondor-quest (official answers by an FFG developer, 13 and 21 January 2014)
- F234287 https://ffg-forum-archive.entropicdreams.com/topic/234287-blood-of-gondor-hidden-cards-engagement/
- F101651 https://ffg-forum-archive.entropicdreams.com/topic/101651-lying-in-wait/page/1/
- VP https://visionofthepalantir.com/2018/05/13/the-blood-of-gondor/
- HoB https://hallofbeorn.com/LotR/Details/The-Ambush-TBoG
- The official FAQ https://www.fantasyflightgames.com/media/ffg_content/lotr-lcg/support/LotR-FAQ.pdf holds only the `faq.*` spans already in `data/rules/`.

### Hidden cards

- `hidden.take` (span-settled). Taking 1 hidden card puts the top card of the encounter deck facedown in the taker's play area, unseen; with the deck empty the encounter discard pile is shuffled into it first. Not taken: none. Basis: `ats.hidden-cards`.
- `hidden.take-empty-both` (recommended). When the deck and the discard pile are both empty, no card is taken; a travel cost that is a hidden card cannot be paid then. Not taken: pay in part. Basis: `ats.hidden-cards` is silent on both piles empty; `rr.travel`. No source covers it, and a game reaches it only very late.
- `hidden.owner` (span-settled). A hidden card is counted per player. A player eliminated has his hidden cards discarded; a seat with no heroes turns none. Not taken: keep them. Basis: `ats.hidden-cards`.
- `hidden.taken-not-revealed` (span-settled). A taken hidden card is not revealed: no When Revealed, surge or shadow effect. Basis: `ats.hidden-cards` ("without looking at it"); UFAQ.
- `hidden.turn` (span-settled). Turning a player's hidden cards faceup is done one card at a time; an enemy engages him at once whatever its engagement cost, a treachery or a location is discarded at once (no When Revealed, not added to the staging area). Not taken: treat the card as revealed. Basis: `ats.hidden-cards-turn-faceup`.
- `hidden.turn-enemy-not-revealed` (researched). An enemy turned faceup is not revealed: no When Revealed and no surge. Cards that say otherwise (Lying in Wait) are read on their own rows. Not taken: revealed. Basis: UFAQ (official answer in F234287); rr.surge. Sources: UFAQ; F234287.
- `hidden.new-card-during-turn` (span-settled). Cards taken while a turn effect runs (Evil Crow) stay facedown. Not taken: turn them too. Basis: `faq.blood-of-gondor-hidden-cards`.
- `hidden.order-vs-shadow` (researched). At the beginning of the combat phase, turning hidden cards (stage 1B) and dealing shadow cards are simultaneous and the first player chooses the order (official answer, F96446, 21 January 2014). The engine resolves the stage's effect first and deals the shadow cards after it, so an enemy engaged by the turn gets a shadow card; the other order has no engine step to choose it. Not taken: a first-player choice of order. Basis: UFAQ; F96446. Sources: F96446; UFAQ.
- `hidden.shadow-vs-arsonist` (recommended). Orc Arsonist engaged by a hidden turn deals 1 shadow card to each enemy engaged with that player at once, even in the middle of combat; the cards stay until that enemy attacks. Not taken: no shadow after the shadow step. Basis: the `05063:A:1` row of `the-siege-of-cair-andros.md`; rr.attacks-outside-the-combat-phase. No source covers mid-combat engagement by a hidden turn.

### Stage 06117 The Ambush

- `06117:A:1` (span-settled). Setup in order: add The Cross-roads (06123) and Black Númenorean to the staging area, put Faramir and Lord Alcaron into play (the first player gains control through their own lines), shuffle the encounter deck, reveal 1 card per player and add it to the staging area. Not taken: control gained only at stage 2. Basis: printed line; `ats.ally-objectives`.
- `06117:A:1` (reveal) (recommended). The revealed cards go through the normal reveal: a treachery resolves its When Revealed and is discarded, an enemy or location goes to the staging area, and surge applies. Not taken: add whatever the type to the staging area. Basis: printed line; rr.surge ("even during Setup"). No source covers a treachery revealed by this Setup line.
- `06117:B:1` (span-settled). Each player takes 1 hidden card at the beginning of the quest phase. Basis: `ats.hidden-cards` (stages 1B and 2B print the same line).
- `06117:B:2` (span-settled). At the beginning of the combat phase each player, in player order, chooses: turn each of his hidden cards faceup, or take 1 hidden card. Faramir's Combat Action cannot be used before that choice. Not taken: do both. Basis: `faq.errata.06117`; official answer, F96446, 13 January 2014 ("a choice"). Sources: HoB; F96446.
- `06117:B:2` (no hidden card) (recommended). A player with no hidden card may choose either option. Not taken: he must take 1. Basis: `faq.errata.06117`. No source covers it; both choices are legal.

### Stage 06118 Captured!

- `06118:A:1` (span-settled). Faramir and Lord Alcaron are placed under Captured!: they stay in play (not in the staging area, not committed) and no player controls them, so no ability of theirs can be used and their "leaves play" lines do not fire. Not taken: they leave play (loss). Basis: printed line ("they are in play but the players cannot gain control of them"); mec109.stage-4 (a card under a card is still in play and nobody controls it); `ats.ally-objectives`.
- `06118:A:1` (control lines) (recommended). The control lines of 06132 and 06133 do not return control while Captured! holds them: the printed parenthesis wins over a constant "gains control". Not taken: control returns at once. Basis: printed line; VP ("stay in play under no player's control"). No source covers the interaction.
- `06118:A:1` (hidden) (recommended). Then each player turns each of his hidden cards faceup, one card at a time, in player order, the first player first. Not taken: all players at the same time. Basis: `ats.hidden-cards-turn-faceup`; `faq.blood-of-gondor-hidden-cards`. The span gives one card at a time within a player and says nothing of the order between players.
- `06118:B:1` (span-settled). Battle: characters count Attack instead of Willpower when questing; enemies and locations in the staging area keep their Threat. Basis: hon.battle.
- `06118:B:2` (span-settled). Each player takes 1 hidden card at the beginning of the quest phase. Basis: `ats.hidden-cards`.
- `06118:B:3` (recommended). A player who holds 5 hidden cards must turn them faceup as soon as he holds 5, whatever took the fifth card (the quest phase, the encounter phase, Evil Crow, a shadow card or a travel cost). The 5 are turned one at a time under the insert, and a card taken by that turn stays facedown. Not taken: checked only at the beginning of the quest phase. Basis: printed line; VP ("must flip their hidden cards when they receive a fifth"); `faq.blood-of-gondor-hidden-cards`. No official answer in the FAQ, UFAQ or F96446.
- `06118:B:3` (two-card cost) (recommended). Eastern Road takes 2 cards as one instruction: a player at 4 or 5 turns when the whole instruction ends, so cards 5 and 6 are turned. Not taken: turn when the fifth is taken, the sixth stays facedown. Basis: printed line. No source covers it.
- `06118:B:4` (span-settled). Defeating this stage (15 quest points) wins the game; the normal quest resolution checks it. Basis: printed line.
- `06118:B:1` with `06123:A:1` (span-settled). While The Cross-roads is in play (in the staging area or active), stage 2B has Siege and not Battle: characters count Defense when questing. Not taken: both apply (Willpower). Basis: `faq.errata.06123` ("gains siege (and loses battle)"); hon.siege; hon.battle.

### Enemies and treacheries

- `06119:A:1` (span-settled). X is the number of hidden cards in all players' play areas, counted again whenever they change. Not taken: per player. Basis: printed line; `ats.hidden-cards`.
- `06119:A:2` (span-settled). Forced at the end of the round: each player raises his threat by 1 for each hidden card in his own play area. The Forced effect works while Black Númenorean is in the staging area. Not taken: only when engaged. Basis: printed line; rr.forced.
- `06120:A:1` (span-settled). After it engages you (also by a hidden turn) you choose 1 non-objective ally you control and discard it, if able. Faramir and Lord Alcaron are objectives and are never chosen. Not taken: discard an objective ally. Basis: printed line.
- `06120:A:2` (span-settled). Shadow: +1 Attack, or +3 Attack instead if the attack is undefended (a total of +3, not +4). Not taken: +4. Basis: printed line ("instead").
- `06121:A:1` (trigger) (span-settled). After Brutal Uruk's own attack destroys a hero or an ally, its controller turns all his hidden cards faceup, one at a time; if that was his last hero he is eliminated first and the cards are discarded. Not taken: any attack. Basis: printed line ("destroys a character"); `ats.hidden-cards`.
- `06121:A:1` (resolve) (recommended). Each enemy turned faceup is dealt 1 shadow card, then its attack against that player is resolved as normal in this combat phase: it joins that player's unresolved attackers and the player picks the order. Not taken: it attacks right away after Brutal Uruk. Basis: printed line ("resolve their attacks as normal"); rr.engaged. F96446, F234287, UFAQ and VP do not discuss this card.
- `06122:A:1` (span-settled). When Evil Crow engages a player (by a hidden turn too) that player takes 1 hidden card; during a turn effect it stays facedown. Not taken: turn it too. Basis: `faq.blood-of-gondor-hidden-cards`.
- `06122:A:2` (span-settled). Shadow: the defending player takes 1 hidden card. Not taken: the attacking enemy's controller. Basis: `rr.defending-player` (the defending player is the player the attack is against).
- `06130:A:1` (span-settled). Surge. Basis: rr.surge.
- `06130:A:1` (empty deck) (recommended). A reading of this scenario's deck only. When Mordor Looms (or Conflict at the Crossroads, when it gains surge) is revealed and the encounter deck and the discard pile hold no card but the surging cards of its own open chain, its surge finds no card and the chain ends; the usual reset of the discard pile follows the last reveal. The two are the only surge cards of this deck, and neither raises threat or deals damage on a pass, so a pass that repeats changes nothing and the guard stops it; had a card of the deck raised threat on each pass (a Doomed surge card), the rules to the letter would apply and it would be revealed again until the loss. Not taken: what the rules read to the letter. The discard pile, with the surging card in it, is shuffled back so the card is revealed again inside its own surge, with no end when the pass changes nothing (the engine stops at its step limit). Basis: `rr.surge` (reveal 1 additional card: there is none), `ltp.surge`, `rr.step-3-3`, `rr.running-out-of-cards`, `faq.last-encounter-card` (the deck is reset once the last card is resolved). No official ruling on a surge loop was found: forum threads on the reset (https://ffg-forum-archive.entropicdreams.com/topic/57467-infinte-loop-question, https://ffg-forum-archive.entropicdreams.com/topic/57770-wargs-and-encounter-deck-exhausted-potential-loop) and the FAQ and UFAQ do not cover surge on the last card. The guard is the `deckReset` hook of the pelargir family (`families/pelargir/surge-chain.ts`): it acts only in a game with a record that takes a hidden card, so every other scenario resets as the rules read.
- `06130:A:2` (span-settled). Each player takes 1 hidden card. Basis: `ats.hidden-cards`.
- `06130:A:3` (span-settled). Shadow: after this attack destroys a character, its controller turns each hidden card faceup; enemies engage as the insert says (no shadow card at that moment). Basis: printed line ("destroys a character"); `ats.hidden-cards-turn-faceup`.
- `06130:A:3` (attack) (recommended). A newly engaged enemy attacks that player among the unresolved attackers of this phase. Not taken: it waits for the next phase. Basis: rr.engaged; Brutal Uruk says so in words and Mordor Looms does not. No source covers it.
- `06131:A:1` (span-settled). When Revealed: until the end of the phase each Orc enemy engaged with any player adds its Threat to the staging area total, also an Orc that engages later in the phase; if no Orc enemy is engaged when it is revealed, it gains surge. Not taken: only the Orcs engaged at that moment. Basis: printed line; rr.lasting-effects.
- `06131:A:1` (second copy) (recommended). A second Conflict at the Crossroads in the same phase adds nothing more: the engaged Orcs add their Threat once however many copies were revealed. The record uses the engaged-Threat lasting effect of Long Groping Arm and the Uruk-hai (`engagedThreatSeat` with the Orc trait on each seat), which holds one effect for each seat and trait; two copies of those cards can be held at once, so counting each copy would move their games. Not taken: the Threat counts once for each copy. Basis: printed line (an engaged Orc "adds its Threat": one contribution to the total); `rr.lasting-effects`. No official ruling and no discussion of two copies was found (a web search found none).
- `06131:A:2` (span-settled). Shadow: the defending player takes 1 hidden card. Not taken: the attacker's controller. Basis: `rr.defending-player`.
- `06129:A:1` (who) (span-settled). The first player turns each hidden card in his own play area faceup, one at a time; other players' hidden cards stay. Not taken: every player. Basis: printed line ("his play area"); this card's text replaces the insert's default of all players.
- `06129:A:1` (enemy) (recommended). A turned enemy engages the first player (insert) and then its When Revealed effects resolve, with those of the other turned cards once the whole turn is done, as the printed line says "each encounter card turned faceup"; its surge does not fire. No enemy of this encounter deck has a When Revealed effect, so only an enemy from another set shows it (Uruk Lieutenant in the tests). Not taken: only treachery and location resolve. Basis: printed line; `ats.hidden-cards-turn-faceup`. F101651 (posters disagree on enemies; not official). UFAQ says an enemy turned faceup is not "revealed", but this card names When Revealed effects without saying revealed.
- `06129:A:1` (treachery) (recommended). A turned treachery resolves its When Revealed and is then discarded; Surge on it (Mordor Looms, Conflict at the Crossroads) does not fire. Not taken: surge fires. Basis: printed line; rr.surge ("revealed"). Surge is a keyword, not a When Revealed effect. No source covers the case.
- `06129:A:1` (location) (span-settled). A turned location is added to the staging area when it is turned, and its When Revealed effects, if it has any, resolve with those of the other turned cards once the whole turn is done, the first card turned first. No location of this encounter deck has a When Revealed effect, so no game shows a difference. Not taken: discarded (the insert's default); each card's effects resolved before the next card is turned. Basis: printed line ("If a location is turned faceup, add it to the staging area"); QC for one card at a time.
- `06129:A:1` (Scourge of Mordor and Conflict) (recommended). Scourge of Mordor (05064) and Conflict at the Crossroads turned faceup resolve their When Revealed effects as for a treachery; X of Scourge of Mordor is read as in `the-siege-of-cair-andros.md` (`05064:A:1`). Not taken: no effect. Basis: printed line; same reasoning as the row above.

### Locations

- `06123:A:1` (recommended). The current quest card gains Siege (and loses Battle) while The Cross-roads is in play, in the staging area or active; stage 1 prints no Battle, so nothing is lost there. Not taken: only while it is the active location. Basis: `faq.errata.06123`. The card has no "while active" limit, and VP has players questing with Defense. The erratum gives the wording and not the zone.
- `06123:A:2` (span-settled). X is the number of players in the game. Basis: printed line.
- `06123:A:3` (recommended). Travel: the first player takes 1 hidden card, paid in full before the travel; if he cannot (both piles empty) the players cannot travel here. Not taken: pay in part. Basis: printed line; rr.travel; see `hidden.take-empty-both`.
- `06124:A:1`, `06126:A:1` (span-settled). Travel: the first player takes 1 hidden card. Basis: printed line; rr.travel.
- `06125:A:1`, `06127:A:1` (span-settled). +5 quest points only while the location is in the staging area; the bonus ends when it becomes the active location. Not taken: it stays. Basis: printed line.
- `06125:A:2` (span-settled). Travel: the first player takes 1 hidden card. Basis: printed line.
- `06127:A:2` (span-settled). Travel: the first player takes 2 hidden cards. Basis: printed line.
- `06128:A:1` (span-settled). Archery X. Basis: hon.archery.
- `06128:A:2` (span-settled). X is the number of players. Basis: printed line.
- `06128:A:3` (recommended). Forced after it leaves play as an explored location: the first player discards 1 hidden card from his own play area, chosen at random (all are facedown and unseen). The card goes to the encounter discard pile unresolved: discarding is not turning faceup, so nothing engages and no When Revealed resolves. With no hidden card nothing happens. Not taken: a hidden card of any player; turn it first. Basis: printed line (no "play area", no "faceup"). VP, F96446, F234287, UFAQ and a further search found no answer on a discarded hidden card.

### Objective allies

- `06132:A:1` (recommended). The first player gains control of Faramir while he is in play and not under Captured!. Not taken: control gained once. Basis: printed line; `ats.ally-objectives`; see `06118:A:1` (control lines).
- `06132:A:2` (controller) (span-settled). Only the player who controls Faramir (the first player) uses the Action, and "a hidden card" is chosen by him; no other player may use it though the card type is objective. Not taken: any player may use it, as for any objective's Action. Basis: `ats.ally-objectives` (a controlled objective ally is used "the same as any other ally"); rr.action (an Action of an ally is its controller's).
- `06132:A:2` (card) (recommended). Exhaust Faramir to turn 1 hidden card faceup: the card is any hidden card in the game, the first player chooses whose. Not taken: only the controller's own. Basis: printed line ("a hidden card"). F96446, F234287, UFAQ and VP say "1 hidden card" and not whose.
- `06132:A:2` (enemy) (researched). A turned enemy takes 3 damage before it engages; one destroyed never engages (its Forced effects do not fire); a treachery or a location follows the insert (discarded). Not taken: engage first. Basis: printed line; official answer in F234287. Sources: UFAQ; F234287.
- `06132:A:2` (none) (recommended). With no hidden card in the game the Action is not offered. Not taken: exhaust for nothing. Basis: printed line. No source covers it.
- `06132:A:2` (stage 2) (span-settled). The Action cannot be used while Faramir is under Captured!. Basis: `06118:A:1`.
- `06132:A:3` (span-settled). Any leaving of play (death, discard, return) loses the game, but not the placing under Captured!. Not taken: only in stage 1. Basis: printed line; mec109.stage-4.
- `06133:A:1` (recommended). The first player gains control of Lord Alcaron on the same terms as `06132:A:1`. Basis: printed line.
- `06133:A:2` (span-settled). Exhaust Lord Alcaron to return an enemy engaged with you, his controller, to the staging area, including an enemy just engaged by a hidden turn. Not taken: any player's enemy. Basis: printed line ("with you").
- `06133:A:2` (controller) (span-settled). Only the player who controls Lord Alcaron uses the Action: "you" is that player, and no other player may use it though the card type is objective. Not taken: any player may use it. Basis: as `06132:A:2` (controller).
- `06133:A:3` (span-settled). If Lord Alcaron leaves play the players lose. Basis: printed line.
- `06132:A:3`, `06133:A:3` (controller eliminated) (recommended). When the seat that controls Faramir or Lord Alcaron is eliminated, the ally is discarded with the rest of what that player controls, so it leaves play and the players lose. Not taken: the ally stays in play or passes to another player. Basis: `rr.player-elimination`; the same reading as Lord Alcaron in Encounter at Amon Dîn (`encounter-at-amon-din.md`). The tests eliminate the controller by a real attack.

### Ravaging Orcs

- `05062:A:1`, `05062:A:2`, `05063:A:1`, `05063:A:2`, `05064:A:1`, `05064:A:2`. Read in `the-siege-of-cair-andros.md` and applied as given there (statuses there); the hidden-card interaction is `hidden.shadow-vs-arsonist` above.

### Easy mode

- `easy` (researched). Easy mode removes 2 Conflict at the Crossroads, 2 Orc Ambusher, 2 Brutal Uruk and 3 Orc Rabble. Basis: QC; the Easy Mode sheet in `data/rules/` is checked in Build against the scenario's `easy` counts. Source: QC.

## Readings to confirm

Each is a `recommended` reading, or one settled only by community discussion. Full rows under Readings.

- `hidden.take-empty-both`: with both piles empty no hidden card is taken, and a travel cost of one cannot be paid.
- `hidden.shadow-vs-arsonist`: Orc Arsonist engaged by a hidden turn deals its shadow cards at once.
- `06117:A:1` (reveal): a treachery revealed by the Setup resolves its When Revealed.
- `06117:B:2` (no hidden card): a player with none may choose either option.
- `06118:A:1` (control lines): Captured! keeps control from returning to the first player.
- `06118:A:1` (hidden): the players turn in player order, one card at a time.
- `06118:B:3` and its two-card cost: the turn at 5 hidden cards happens as soon as the fifth is held, after a whole instruction.
- `06121:A:1` (resolve), `06130:A:3` (attack): a newly engaged enemy joins this phase's unresolved attackers.
- `06129:A:1` (enemy), (treachery), (Scourge of Mordor and Conflict): When Revealed resolves for a turned card, surge does not.
- `06131:A:1` (second copy): two copies in one phase add the engaged Orcs' Threat once, not twice.
- `06130:A:1` (empty deck), this deck only: a surge card revealed when the deck and the discard pile hold nothing else finds no card, and the chain ends.
- `06132:A:3`, `06133:A:3` (controller eliminated): the ally is discarded with the eliminated player's cards and the players lose.
- `06123:A:1`: The Cross-roads gives Siege in the staging area too.
- `06123:A:3`: a Travel that needs a hidden card cannot be paid with both piles empty.
- `06128:A:3`: the discarded hidden card is chosen at random and not resolved.
- `06132:A:1`, `06133:A:1`: control lines wait while Captured! holds the allies.
- `06132:A:2` (card), (none): Faramir turns any player's hidden card, and is not offered with none.
- `hidden.order-vs-shadow`: the engine turns before it deals shadow cards.

## Engine notes

The hidden cards are in the family `pelargir` (`src/catalog/families/pelargir.ts`, `src/rules/families/pelargir/hidden.ts`, `hidden-turn.ts`, `hidden-sweep.ts`; the render templates are in `scripts/data/effects/render/families/pelargir.ts`).

- **A hidden card** (`ats.hidden-cards`). It is the top card of the encounter deck set aside facedown in a player's play area: zone `setAside`, `face` down, `owner` the seat, `hiddenAt` the order taken, controlled by nobody, so its text is inert and no core sweep moves it. No `EngineStep` names it. The Set aside list counts it as facedown and names none (`asideSecrets` of the family, `TakeHiddenCard` with `deck`). `pnpm game show` names it, as it names every hidden card.
- **Taking** (`06117:B:1`, `06122:A:1`, `06123:A:3`). `TakeHiddenCard` takes `amount` cards as one instruction. An empty deck is refilled from the discard pile first. A Travel cost of it is unpayable when the deck and the discard pile hold fewer cards than it takes (the family's `travel.unpayable`).
- **Turning** (`ats.hidden-cards-turn-faceup`, `faq.blood-of-gondor-hidden-cards`). `TurnHiddenCards` turns the cards held when it starts, one at a time (a treachery turned with `resolve` waits in the staging area while its When Revealed resolves and is discarded by `DiscardResolved`, the engine's own last instruction of its frame): an enemy engages through the engine's own engagement, so Forced effects that hear `engaged` fire (a card they take stays facedown); a treachery or a location is discarded. `resolve` (Lying in Wait) adds a location to the staging area when it is turned, then resolves the When Revealed effects of every card turned (an enemy after it has engaged) once the turn is done, the first card turned first, and fires no surge. `shadow` (Brutal Uruk) deals each enemy turned a shadow card. A seat that left the game turns nothing.
- **Faramir's Action** (`06132:A:2`). `TurnHiddenCard` queues a Choose of `seat:N` among the players who hold a hidden card (no Choose with one), then picks the card with the game's seed. An enemy takes the 3 damage in the staging area before it engages, so one destroyed never engages.
- **The turn at 5 cards** (`06118:B:3`). A settle sweep (`hiddenSweep`) turns the cards of a player who holds 5 while the current stage holds `turnsAtFiveHidden`, once the stack, the attack and any window other than an action window are clear. It also discards the hidden cards of a player who left the game.
- **The amount `hidden`** (`06119:A:1`, `06119:A:2`). `own` counts the acting player's cards, `all` every player's; the family's `amount` hook reads it.
- **The two allies** (`06132:A:1`, `06133:A:1`, `06118:A:1`). Their Actions are the controller's alone: the condition of each Action names an ally of that name the acting player controls, because the engine lets any player use the Action of an objective card. The Setup puts them in the first player's play area; each ally's Forced effect on `firstPlayerTokenPassed` moves it to the new first player (`GainControlOfSelf`). `HoldUnderStage` moves them to the captive zone under Captured!: in play, controlled by nobody, committed to nothing, with no Action and no leaving-play announcement. Their own `LoseGame` Forced effects hear a real leaving of play only.
- **Siege and Battle** (`06123:A:1`). The constants of The Cross-roads use `until: whileSourceInPlay`, so Siege holds in the staging area; `losesBattle` takes Battle from the current stage (`stage-keyword.ts`).
- **Conflict at the Crossroads** (`06131:A:1`). Each seat holds the engaged-Threat lasting effect with the Orc trait until the end of the phase (`engagedThreatSeat`, `src/rules/quest/engaged-threat.ts`); it is read live and lists each Orc as a Threat source in the quest readout.
- **Easy mode** (`easy`). The scenario's own counts remove 2 Conflict at the Crossroads, 2 Orc Ambusher, 2 Brutal Uruk and 3 Orc Rabble, as the Quest Companion lists.

## Limits

- The first player's choice of order between turning the hidden cards at the beginning of the combat phase and dealing the shadow cards (`hidden.order-vs-shadow`) is not offered: the engine turns first. An Orc Arsonist that the turn engages deals its Forced shadow cards at once, and the card the combat phase would deal to an enemy that already holds one is not dealt, so each enemy ends with 1 shadow card.
- Faramir's hidden card is picked by the game's seed, not by the player.

## Table

Each piece is made by a line named here and drawn only while that line makes it; none is a control. The words, the layout and the rules of each piece are in `docs/design-system-table.md`, The Blood of Gondor's table pieces; every hook keys on this scenario's id or on its records' verbs and is empty in another. Code: `src/play/readouts/against-the-shadow/blood.ts`, `blood-steps.ts`, `src/play/words/scenarios/against-the-shadow/blood.ts`, `blood-choice.ts`, `src/play/words/asks/the-blood-of-gondor.ts`; test `src/play/scenarios/the-blood-of-gondor-table.test.ts`. Hidden information comes first: no piece names a card that is facedown or tells its type before it is turned.

- **Hidden cards** (`06117:B:1`, `ats.hidden-cards`): a mark "Hidden N" on each seat's threat dial and a total dial "Hidden"; the cards are never drawn (the Set aside list counts them facedown). A near warning at 4 on stage 2 only, and at 5 or more (the turn waits for the effect or attack in progress) (`06118:B:3`).
- **Stages** (`06117:B:2`, `06118:A:1`, `06118:B:3`, `06118:B:4`): previews with the counts, what each phase does, the turn at 5, the allies held, the win and the loss; Siege and Battle chips follow the engine (`06123:A:1`). The guide and the window before combat say the choice comes before the shadow cards on stage 1.
- **Allies** (`06132:A:1`, `06132:A:2`, `06133:A:1`, `06133:A:2`, `06132:A:3`, `06133:A:3`): whose, who may use the Action, the loss; held under Captured! they are a pill on the stage and a line in its preview; Faramir's choice names each player and his count.
- **Locations** (`06123:A:1`, `06123:A:3`, `06124:A:1`, `06125:A:1`, `06125:A:2`, `06126:A:1`, `06127:A:1`, `06127:A:2`, `06128:A:3`, `06119:A:1`, `06119:A:2`): the Travel cost as a consequence (what the first player holds now and after) and its refusal reason, the travel readout with the quest points the location has once active (without the +5 of the staging area) and the hidden cost, the +5 quest points, the Dark Woods' discard, The Cross-roads' Siege, Black Númenorean's X and raise.
- **Combat** (`06121:A:1`, `06131:A:1`): Brutal Uruk's line on the attack sheet; the dock readout adds "a character destroyed turns your 1 hidden card" and, for Faramir or Lord Alcaron as defender, that the players lose if he is destroyed.
- **Banner and log**: cards taken (a count and the card whose line took them), cards turned (the banner tells one line for each turn: the enemies that engage by name, attacking this phase in the combat phase, the other cards by count; the log tells each card with its type and where it went), the credit going to the card that did each, the turn at 5 to Captured!, a choice that returns no engine step (a Take, a Turn that engages nobody) is kept by the table with one bookkeeping step (`carryHidden`), the allies placed under Captured!, control passing with the first player token.
- **Asks**: the combat choice (`06117:B:2`), Orc Ambusher's ally discard (`06120:A:1`) and Lord Alcaron's enemy (`06133:A:2`); Faramir's choice of a player is the engine's own and has its words in `blood-choice.ts`.
