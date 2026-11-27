# The City of Ulfast

Vengeance of Mordor part 5 (The City of Ulfast, `TCoU`), standalone only, on Easy and Normal (Q09.5, E09.5). Encounter sets The City of Ulfast, Servants of Sauron and Under Guard (`vom.setup-the-city-of-ulfast`; the last two are in A Shadow in the East). The quest is four stages, and the scenario adds the encounter side quest Cat and Mouse (22048).

- **Setup.** Stage 1A prints "Setup: Add City Guard to the staging area. Each player adds a different location to the staging area. Shuffle the encounter deck." (`22050:A:1`). The generic readers read all three sentences; no reader of the cycle is needed.
- **Piles.** City Guard and one copy of each location DragnCards stages (The King's Lawn, Guarded Archway, Crowded Market, Streets of Ulfast, Side Street, Catacombs) are staged; the locations are searched for by the players.
- **Resources on the main quest.** Several cards count the resources on the main quest, the current stage of the quest deck. Each stage B places 1 resource at the end of the round and gives City Guard -5 engagement cost for each resource on that stage (`vom.strategy-tip-the-city-of-ulfast`).

## Data

- City Guard has Indestructible, is immune to player card effects, cannot leave the staging area, and is considered engaged with each player whose threat is equal to or higher than its engagement cost; its Threat X is 1 more than the resources on the main quest.
- Each stage B caps City Guard's damage (5, 10, 15, 20); stage 4B cannot be defeated while City Guard has hit points, and defeating it wins the game.

## Readings

The statuses are those of the Readings bullet of `docs/scenarios/vengeance-of-mordor.md`. Each key is the scan-read ledger line (`data/printed/vengeance-of-mordor.json`), `<code>:<side>:<n>`. Sources read: the City of Ulfast rulesheet (`vom.strategy-tip-the-city-of-ulfast`, no Setup rule beyond the sets), https://visionofthepalantir.com/2021/07/15/the-city-of-ulfast/ (a play article with no designer answer), ALeP = https://alongextendedparty.com/semi-official-errata-faq-1-10/ (no entry for the scenario). A line not listed here is span-settled.

- City Guard engagement (`22037:A:3`) (span-settled). City Guard is considered engaged with each player whose threat is equal to or higher than its engagement cost, engagement cost as printed (45) minus 5 for each resource on the main quest and plus 20 while Crowded Market is the active location; it makes attacks like any engaged enemy and stays in the staging area. Basis: the printed line and `vom.strategy-tip-the-city-of-ulfast`; the post above says "higher than" in one place and "equal to or higher" in another, and the card wins.
- Resources on the main quest (`22044:A:1`, `22038:A:1`) (span-settled). The count is the resources on the current stage only; a defeated stage takes its resources to the victory display, so the next stage starts at 0. Basis: `vom.strategy-tip-the-city-of-ulfast` ("each quest stage will reduce the City Guard's engagement cost by 5 for each round that you linger there").
- Extra Vigil (`22045:A:1`) (recommended). It attaches to City Guard; two copies stack for -20; "raise your threat by 1 to discard Extra Vigil" is optional and costs the threat only if the player discards it. Not taken: the threat is raised without the discard. Why recommended: the post above says two copies stack; the printed "to discard" is a cost; no official source settles it.
- We've Been Seen (`22046:A:1`) (recommended). A player who chooses City Guard's attack takes it as an immediate attack against him (the City Guard is not engaged by it); a player who chooses the threat raises it by 1 plus the allies he controls. Not taken: both. Why recommended: no source covers the choice; the card prints "either ... or".
- Ulfast Sentry (`22038:A:2`) (recommended). The player engaged with it chooses; "makes an attack" is an immediate attack against that player, with Attack X from the resources on the main quest. Not taken: the first player chooses. Why recommended: the post above reads it as the engaged player; no official source settles it.
- Drawing Attention (`22052:A:1`) (recommended). Each player chooses in player order, and City Guard's immediate attack against a player is an engaged attack, with a shadow card, even though it is in the staging area. Not taken: no shadow card. Why recommended: no source says whether a staged attacker is dealt a shadow card; `rr.shadow-effects` deals one to each enemy that attacks.
