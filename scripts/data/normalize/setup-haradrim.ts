import { namedBy, stepWith } from "./setup-names.ts";
import type { NameIndex, SetupClause } from "./setup-text.ts";

// The Haradrim cycle's packs (scripts/data/campaign-defs.ts, PRODUCTS).
const HARADRIM_PACKS: ReadonlySet<string> = new Set(["TSoH", "M", "RAH", "BtS", "TBS", "DoCG", "CoP"]);

// Rules: hrd.setup-escape-from-umbar, hrd.heat-tracker, hrd.heroes-in-the-staging-area, hrd.objective-heroes, hrd.prepare-the-orcs-area, hrd.search-objective, hrd.guarded-x, hrd.captives-of-cirith-gurat, hrd.multiple-encounter-sets (data/rules/entries.json).
// The sentences of the nine stage 1A cards of the Haradrim cycle that the other readers do not read. Each pattern is quoted from a Setup line, names the cards it moves, and returns null for a
// sentence it does not read (or whose card names find no card), so the scenario stays unbuilt and a name is never dropped silently.
export function readHaradrim(sentence: string, names: NameIndex): SetupClause[] | null {
  // The patterns without a name are quoted sentences of this cycle. The name index holds the scenario's own cards (`scope` in scenarios.ts) and the cards its text names; `named` keeps only those of the cycle's packs.
  const own = (code: string): boolean => names.cards.find((card) => card.code === code)?.printings.some((printing) => HARADRIM_PACKS.has(printing.pack)) === true;
  const named = (phrase: string | undefined): string[] => {
    const codes = namedBy(names)(phrase);
    return codes.every(own) ? codes : [];
  };
  const step = stepWith([]);
  // The cards of one encounter set with a trait and a type: "each Capture objective" of The Mûmakil, "each Harad objective" of The Black Serpent.
  const ofSet = (set: string, trait: string, type: string): string[] => names.cards.filter((card) => card.encounterSet === set && card.type === type && card.traits.includes(trait)).map((card) => card.code);
  let match: RegExpExecArray | null;

  // Escape from Umbar: "Add “Seize them!” to the staging area." The quotes belong to the card's title.
  if ((match = /^Add [“"](.+?)[”"] to the staging area$/i.exec(sentence))) {
    // The card's name is printed with straight quotes, the quest card's Setup with curly ones.
    const codes = named(`"${match[1] ?? ""}"`);
    return codes.length === 0 ? null : [{ kind: "stage", codes, perPlayer: null, count: 1 }];
  }
  // Escape from Umbar: "Each player adds 1 different location to the staging area and puts 1 copy of Umbar Sentry into play engaged with him."
  if ((match = /^Each player adds (?:1|an?|one) different location to the staging area and puts (?:1|an?|one) copy of (.+?) into play engaged with him$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [{ kind: "eachPlayerAddsLocation", count: 1 }, stepWith(codes)("putCopyEngagedEachPlayer", { count: 1 })];
  }
  // Desert Crossing: "Each player searches the encounter deck for a copy of Burnt Sands and adds it to the staging area."
  if ((match = /^Each player searches the encounter deck for (?:1|an?|one) copy of (.+?) and adds it to the staging area$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [{ kind: "stage", codes, perPlayer: 1, count: 0 }];
  }
  // Desert Crossing: "Place the heat tracker next to the quest deck and set the temperature to 10." (hrd.heat-tracker)
  if ((match = /^Place the heat tracker next to the quest deck and set the temperature to (\d+)$/i.exec(sentence))) return [step("setTemperature", { count: Number(match[1]) })];
  // The Long Arm of Mordor: "Each player adds 1 copy of Sauron’s Enforcers to the staging area."
  if ((match = /^Each player adds (?:1|an?|one) copy of (.+?) to the staging area$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [{ kind: "stage", codes, perPlayer: 1, count: 0 }];
  }
  // The Long Arm of Mordor: "Move each hero to the staging area." (hrd.heroes-in-the-staging-area)
  if (/^Move each hero to the staging area$/i.test(sentence)) return [step("moveHeroesToStaging")];
  // The Long Arm of Mordor: "Each player takes control of an objective-hero and adds 2 resources to its resource pool." (hrd.objective-heroes)
  if ((match = /^Each player takes control of an objective-hero and adds (\d+) resources to its resource pool$/i.exec(sentence))) {
    const codes = names.cards.filter((card) => card.type === "objective" && card.typeName === "Objective Hero").map((card) => card.code);
    return codes.length === 0 ? null : [stepWith(codes)("takeObjectiveHero", { resources: Number(match[1]) })];
  }
  // The Long Arm of Mordor: "Remove each remaining objective-hero from the game."
  if (/^Remove each remaining objective-hero from the game$/i.test(sentence)) {
    const codes = names.cards.filter((card) => card.type === "objective" && card.typeName === "Objective Hero").map((card) => card.code);
    return codes.length === 0 ? null : [stepWith(codes)("removeFromGame")];
  }
  // The Long Arm of Mordor: "For the remainder of the game, heroes in the staging area are in play but under no player’s control, immune to player card effects, and their text boxes are considered to be blank."
  if (/^For the remainder of the game, heroes in the staging area are in play but under no player['’]s control, immune to player card effects, and their text boxes are considered to be blank$/i.test(sentence)) return [step("heroesInStagingAreaBlank")];
  // The Mûmakil: "Set each copy of Wild Mûmak and each Capture objective aside, out of play."
  if ((match = /^Set each copy of (.+?) and each ([A-Z][a-z]+) objective aside,? out of play$/i.exec(sentence))) {
    const [enemy, objectives] = [named(match[1]), ofSet("The Mûmakil", match[2] ?? "", "objective")];
    return enemy.length === 0 || objectives.length === 0 ? null : [{ kind: "aside", codes: [...enemy, ...objectives], allCopies: true }];
  }
  // Race Across Harad: "Each player takes control of a Tamed Mumak."
  if ((match = /^Each player takes control of an? (.+)$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [stepWith(codes)("takeControl", { players: true })];
  }
  // Race Across Harad: "Remove each remaining Tamed Mumak from the game."
  if ((match = /^Remove each remaining (.+?) from the game$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [stepWith(codes)("removeFromGame")];
  }
  // Race Across Harad: "Create the Orcs’ area with a second quest deck consisting of stage 1C, 2C, 3C, and 4C." (hrd.prepare-the-orcs-area)
  if (/^Create the Orcs?['’]s? area with a second quest deck consisting of stage 1C, 2C, 3C, and 4C$/i.test(sentence)) {
    const stages = names.cards.filter((card) => card.type === "quest" && /^\dC$/.test(card.stage ?? "")).map((card) => card.code);
    return stages.length !== 4 ? null : [stepWith(stages)("createOrcsArea")];
  }
  // Race Across Harad: "Place Uruk Chieftain in the Orcs’ area."
  if ((match = /^Place (.+?) in the Orcs?['’]s? area$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [stepWith(codes)("createOrcsArea")];
  }
  // Beneath the Sands: "Add the Search objective to the staging area (Off Track face up)." (hrd.search-objective)
  if (/^Add the Search objective to the staging area \(Off Track face up\)$/i.test(sentence)) {
    const codes = named("Off Track");
    return codes.length === 0 ? null : [{ kind: "stage", codes, perPlayer: null, count: 1 }];
  }
  // The Black Serpent: "Set each Harad objective aside, out of play."
  if ((match = /^Set each ([A-Z][a-z]+) objective aside,? out of play$/i.exec(sentence))) {
    const codes = ofSet("The Black Serpent", match[1] ?? "", "objective");
    return codes.length === 0 ? null : [{ kind: "aside", codes, allCopies: false }];
  }
  // The Black Serpent: "The first player randomly selects 1 set aside Harad objective, reveals it, and adds it to the staging area." (hrd.guarded-x)
  if ((match = /^The first player randomly selects (?:1|an?|one) set aside ([A-Z][a-z]+) objective, reveals it, and adds it to the staging area$/i.exec(sentence))) {
    const codes = ofSet("The Black Serpent", match[1] ?? "", "objective");
    return codes.length === 0 ? null : [stepWith(codes)("revealRandomAsideObjective")];
  }
  // The Dungeons of Cirith Gurat: "Starting with the first player, each player discards cards from the top of his deck until an ally that is not in play is discarded and attaches that ally to an unattached enemy in the staging area." (hrd.captives-of-cirith-gurat)
  if (/^Starting with the first player, each player discards cards from the top of his deck until an ally that is not in play is discarded and attaches that ally to an unattached enemy in the staging area$/i.test(sentence)) return [step("captureAllyFromDeck")];
  // The Crossings of Poros: "Set Poros Garrison and each of the following encounter sets aside, out of play: Mountains of Shadow, Desert Sands, Desert Creatures, Harad Soldiers, and Mordor Orcs." (hrd.multiple-encounter-sets)
  if ((match = /^Set (.+?) and each of the following encounter sets aside,? out of play: (.+)$/i.exec(sentence))) {
    const [codes, sets] = [named(match[1]), (match[2] ?? "").split(/,\s*(?:and\s+)?|\s+and\s+/).map((name) => name.trim()).filter((name) => name !== "")];
    return codes.length === 0 || sets.length === 0 ? null : [{ kind: "aside", codes, allCopies: false }, stepWith([])("setSetsAside", { asideSets: sets })];
  }
  // The Crossings of Poros: "The first player adds The Black Serpent to the staging area and shuffles the encounter deck."
  if ((match = /^The first player adds (.+?) to the staging area and shuffles the encounter deck$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [{ kind: "stage", codes, perPlayer: null, count: 1 }, { kind: "shuffleEncounterDeck" }];
  }
  return null;
}
