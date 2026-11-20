// Bump ENGINE_VERSION when a change to the engine can move a game that was replayed from its intents: a rule, a verb, the shuffle, the order of ids.
// A bump adds an ENGINE_CHANGES entry for the new number: the scenarios it reaches (or "all") and one plain line for players. "all" is for a mechanic every scenario
// has (the planning phase, the Commit window, a stage held back); a change that reaches only some scenarios gets its own entry with the same version number, so
// no line names a scenario's game that it cannot move. The list holds the versions after ENGINE_CHANGES_SINCE; a game dealt on an earlier version still gets the sheet, with its generic sentence. The table's sheet for a game dealt on an earlier version lists the lines that reach its scenario, and the
// release notes name the scenarios the lines since the last release reach.

export type EngineChange = {
  version: number;
  /** The ids of the scenarios whose games the change can move, or "all". */
  scenarios: readonly string[] | "all";
  /** One sentence for a player (several entries of one version are several lines): what the rules now do, in sentence case, with no rule ids or code names. */
  note: string;
};

/** The version the list starts after: an entry is for a version above it, up to ENGINE_VERSION (src/rules/engine/version.test.ts). */
export const ENGINE_CHANGES_SINCE = 26;

export const ENGINE_CHANGES: readonly EngineChange[] = [
  { version: 27, scenarios: ["the-fate-of-wilderland"], note: "The Goblins' Assault hears the players' failed quest once, as the card prints it, with no once-a-round limit." },
  { version: 27, scenarios: ["a-storm-on-cobas-haven", "the-city-of-corsairs"], note: "The first player, not the player who revealed the card, chooses the player who searches for each Send for Help event, and who controls Gandalf." },
  { version: 27, scenarios: ["a-storm-on-cobas-haven", "the-city-of-corsairs"], note: "A card you upgraded in the campaign log is turned up on its Upgraded side when it comes out of a facedown deck, for example The Shattered Monument." },
  { version: 27, scenarios: ["the-kings-quest", "mount-gundabad"], note: "A Deep location that its own Response sends to the victory display, like Forked Passage, is still replaced by the top card of the Caves deck." },
  { version: 27, scenarios: ["the-drowned-ruins", "a-storm-on-cobas-haven", "the-city-of-corsairs"], note: "Command (Spirit) can put the campaign's own Spyglass from outside the game into play, on its Upgraded side when its boxes are marked, while no Spyglass is in play." },
  { version: 27, scenarios: ["the-passing-of-the-grey-company", "the-siege-of-gondor", "the-black-gate-opens"], note: "Raising each player's threat to search for Andúril happens after the starting threat level is set, so the threat floor no longer includes that raise." },
  { version: 28, scenarios: ["the-caves-of-nibin-dum"], note: "A quest stage that prints 0 quest points is no longer completed in the same quest phase that reveals it: its When Revealed effects resolve first." },
  {
    version: 29,
    scenarios: ["across-the-ettenmoors", "deadmens-dike", "escape-from-mount-gram", "fire-in-the-night", "intruders-in-chetwood", "the-battle-of-carn-dum", "the-dread-realm", "the-treachery-of-rhudaur", "the-wastes-of-eriador", "the-weather-hills"],
    note: "Cards that count the side quests in the victory display, like Legacy Blade, Thurindir, Thalion and Dagnir, count encounter side quests and player side quests alike.",
  },
  { version: 29, scenarios: ["across-the-ettenmoors"], note: "Lie Low lowers the enemies' engagement costs only in a round when no progress was placed on it." },
  { version: 29, scenarios: ["across-the-ettenmoors", "intruders-in-chetwood", "the-wastes-of-eriador"], note: "Lost in the Wilderness returns the cards under it to their owners' hands when it is defeated, instead of discarding them." },
  { version: 29, scenarios: "all", note: "Cram readies the hero it was attached to after it is discarded." },
  { version: 30, scenarios: ["mount-gundabad"], note: "Dagnir and the other cards that count quest cards in the victory display count player side quests too." },
  { version: 30, scenarios: "all", note: "A card that attaches to a quest card in play, like The Long Defeat, can attach to a side quest." },
  { version: 30, scenarios: "all", note: "A player side quest is placed in the staging area when you play it, so you can play several. The first player may choose one side quest in the staging area as the current quest at the start of the quest phase, and all committed willpower is compared with the staging threat once: questing successfully on a side quest no longer raises your threat." },
  { version: 30, scenarios: "all", note: "While a side quest is the current quest, progress goes on it, not on the main quest card, even when the main quest card turns progress into something else, like Gornákh's Dungeons." },
  { version: 30, scenarios: ["lost-in-mirkwood", "across-the-ettenmoors", "the-kings-quest", "the-withered-heath", "roam-across-rhovanion", "fire-in-the-night", "the-ghost-of-framsburg", "mount-gundabad", "the-fate-of-wilderland"], note: "An Objective-Location counts as a location for cards that look for a location: it can be chosen as the active location, and exploring or travelling to it triggers them. While it lies in the staging area it is still an objective, so revealing it does not trigger them." },
  { version: 30, scenarios: ["a-journey-to-rhosgobel", "intruders-in-chetwood", "deadmens-dike", "the-treachery-of-rhudaur", "temple-of-the-deceived", "the-drowned-ruins"], note: "A player card that returns an objective ally to its owner's hand, like Meneldor's Flight or Born Aloft, puts it in the encounter discard pile instead, and the players lose the game when it was a card that says so, however it leaves play." },
  { version: 30, scenarios: ["a-journey-to-rhosgobel", "deadmens-dike", "intruders-in-chetwood", "raid-on-the-grey-havens", "return-to-mirkwood", "shelobs-lair", "temple-of-the-deceived", "the-drowned-ruins", "the-fate-of-numenor", "the-passage-of-the-marshes", "the-siege-of-gondor", "the-thing-in-the-depths", "the-treachery-of-rhudaur"], note: "An objective ally whose control changes (Iârion, Amarthiúl) is never a player's card, so no later exit puts it in a player's discard pile or hand." },
  { version: 30, scenarios: ["across-the-ettenmoors", "intruders-in-chetwood", "the-wastes-of-eriador"], note: "The hands under Lost in the Wilderness stay there when it leaves play without being defeated, instead of going to the discard pile." },
  { version: 30, scenarios: ["a-journey-to-rhosgobel", "the-treachery-of-rhudaur", "roam-across-rhovanion", "the-ghost-of-framsburg", "a-storm-on-cobas-haven"], note: "A claimed objective that prints no return to the staging area, like Athelas and the Clues of Rhudaur, goes to the encounter discard pile when its hero leaves play." },
  { version: 30, scenarios: "all", note: "When a player is eliminated, a side quest of theirs in the staging area goes to their discard pile, not the encounter discard pile." },
  { version: 30, scenarios: "all", note: "Delay the Enemy, Send for Aid and Gather Information let each player decline, as their text says \"may\"." },
  { version: 30, scenarios: ["escape-from-mount-gram"], note: "Loot the Dungeons, which the campaign card adds at the start, is now in every player's staging area, so it counts as a quest card and takes progress." },
  { version: 30, scenarios: ["breaking-of-the-fellowship"], note: "When the players have separate staging areas, a Trap played into the staging area goes into your own area and attaches only to an enemy that enters that area." },
  { version: 30, scenarios: ["a-shadow-of-the-past", "a-knife-in-the-dark", "flight-to-the-ford", "the-ring-goes-south", "journey-in-the-dark", "breaking-of-the-fellowship", "raid-on-the-grey-havens", "the-thing-in-the-depths", "journey-up-the-anduin", "the-kings-quest", "the-ghost-of-framsburg", "mount-gundabad", "the-fate-of-wilderland", "the-weather-hills", "the-wastes-of-eriador", "escape-from-mount-gram", "the-road-to-isengard", "journey-to-the-cross-roads", "shelobs-lair", "the-passing-of-the-grey-company", "the-battle-of-the-pelennor-fields", "the-tower-of-cirith-ungol", "the-black-gate-opens", "mount-doom", "conflict-at-the-carrock"], note: "Legolas, Blade of Gondolin and The Steadfast place no progress while the active location is immune to player card effects: not on the location and not on the quest." },
  { version: 31, scenarios: "all", note: "A shadow card is turned face up before you choose a Response that cancels its effect, like Hasty Stroke, so you can read the effect first." },
  { version: 32, scenarios: "all", note: "A card that exhausts to quest, attack, defend or pay a cost now triggers its \"after it exhausts\" effects, like Turayn, Arwen Undómiel, Tiny and Grievous Wound." },
  { version: 33, scenarios: "all", note: "A card played from your hand at no cost, like the Silvan allies Host of Galadhrim plays again, needs no hero of its sphere." },
  { version: 33, scenarios: ["across-the-ettenmoors", "a-storm-on-cobas-haven", "the-city-of-corsairs"], note: "An event played at no cost, like one Send for Help finds or one Scavenge for Supplies lets you play, needs no hero of its sphere." },
  { version: 34, scenarios: "all", note: "An attacker that leaves play before the attack deals its damage adds no Attack to it: Beechbone destroyed by his own damage deals none, by his Response or by the attack." },
  { version: 34, scenarios: "all", note: "A player card effect leaves a card immune to player card effects as it is, also when it names that card without choosing it: Lórien Guide, Northern Tracker and Longbeard Elder place no progress on such a location, and Fastred returns no such enemy." },
  { version: 34, scenarios: "all", note: "Every way a card readies, like Unexpected Courage and Grim Resolve, is heard by the cards that answer a ready." },
  { version: 34, scenarios: "all", note: "Elrond's own heal is heard by the cards that answer a heal; he still does not answer it himself." },
  { version: 34, scenarios: "all", note: "A resource moved to a hero's pool, as Errand-rider moves one, is gained: Heir of Mardil answers it." },
  { version: 34, scenarios: "all", note: "An encounter location or enemy that leaves play without being explored or destroyed, like a location Distant Stars discards, is heard by the cards that answer it leaving play." },
  { version: 34, scenarios: "all", note: "In a game of two players, the Responses of an encounter card in the staging area are the first player's, whoever revealed it." },
  { version: 34, scenarios: ["the-stone-of-erech"], note: "Groping Horror's discard of the only player's hand is heard by the cards that answer a discard from the hand." },
  { version: 34, scenarios: "all", note: "A raise of a threat to a set value, like Southern Gate's or A Elbereth! Gilthoniel!'s, is heard by the cards that answer a threat raise." },
  { version: 34, scenarios: ["the-battle-of-carn-dum"], note: "The copies The Sky Darkens discards from your deck are heard by the cards that answer a discard from the deck." },
  { version: 34, scenarios: ["a-journey-to-rhosgobel", "escape-from-mount-gram"], note: "An ally removed from the game or captured leaves play, and the cards that answer an ally leaving play hear it." },
  { version: 34, scenarios: ["return-to-mirkwood", "road-to-rivendell", "the-redhorn-gate", "lost-in-mirkwood", "roam-across-rhovanion", "shelobs-lair"], note: "A set-aside card the players take control of, like Gollum or an objective ally, enters play, and the cards that answer a card entering play hear it." },
  { version: 34, scenarios: ["temple-of-the-deceived"], note: "An ally turned up from under the active location enters play, and the cards that answer an ally entering play hear it." },
];

export const ENGINE_VERSION = 34;

/** The notes of the changes after `fromVersion`, up to the build's version, that can move a game of `scenarioId`. */
export function changesReaching(scenarioId: string, fromVersion: number, changes: readonly EngineChange[] = ENGINE_CHANGES): readonly string[] {
  return changes.filter((change) => change.version > fromVersion && change.version <= ENGINE_VERSION && (change.scenarios === "all" || change.scenarios.includes(scenarioId))).map((change) => change.note);
}
