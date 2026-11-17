import { isNameList, namedBy, setsOf, stepWith } from "./setup-names.ts";
import type { NameIndex, SetupClause } from "./setup-text.ts";

// Rules: dwd.setup-into-the-pit-set-aside, dwd.setup-the-redhorn-gate-set-aside, dwd.ally-objective-arwen, dwd.setup-the-watcher-in-the-water-set-aside, dwd.setup-foundations-of-stone-cave-torch,
// dwd.creating-the-quest-deck (data/rules/entries.json).
// The sentences of the nine Dwarrowdelf stage 1A cards that the other readers do not read. Each pattern is quoted from a Setup line, names the cards it moves, and returns null for a
// sentence it does not read (or whose card names find no card), so the scenario stays unbuilt and a name is never dropped silently. "Search the encounter deck for X" and "Add X to the
// staging area" are read by setup-text.ts.
export function readDwarrowdelf(sentence: string, names: NameIndex): SetupClause[] | null {
  // A card name that starts with "The" (The Watcher) is found as it is printed; "the Stormcaller" is found without its article.
  const withoutThe = namedBy(names);
  const named = (phrase: string | undefined): string[] => (isNameList(names.without(phrase ?? "")) && names.codesOf(phrase ?? "").length > 0 ? names.codesOf(phrase ?? "") : withoutThe(phrase));
  let match: RegExpExecArray | null;

  // Into the Pit: "Put East-gate into play as the active location, and have the first player attach Cave Torch to a hero of his choice."
  if ((match = /^Put (.+?) into play as the active location,? and have the first player attach (.+?) to a hero of his choice$/i.exec(sentence))) {
    const [active, attached] = [named(match[1]), named(match[2])];
    return active.length === 0 || attached.length === 0 ? null : [{ kind: "active", codes: active }, { kind: "attachChosen", codes: attached, who: "firstPlayer" }];
  }
  // The Seventh Level: "Search the encounter deck for Book of Mazarbul, and have the first player attach it to a hero of his choice."
  if ((match = /^Search the encounter deck for (.+?),? and have the first player attach it to a hero of his choice$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [{ kind: "search", codes }, { kind: "attachChosen", codes, who: "firstPlayer" }];
  }
  // The Long Dark, Foundations of Stone: "The first player attaches Cave Torch to a hero of his choice."
  if ((match = /^The first player attaches (.+?) to a hero of his choice$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [{ kind: "attachChosen", codes, who: "firstPlayer" }];
  }

  // Flight from Moria: "Prepare the quest deck." (the stage 2 cards shuffled together, dwd.creating-the-quest-deck).
  if (/^Prepare the quest deck$/i.test(sentence)) return [stepWith([])("shuffleStageTwos")];

  // The Redhorn Gate, Flight from Moria: "Remove all copies of Snowstorm from the encounter deck and set them aside, out of play." / "Remove all copies of A Foe Beyond from the encounter deck."
  if ((match = /^Remove all copies of (.+?) from the encounter deck(?: and set them aside,? out of play)?$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [{ kind: "aside", codes, allCopies: true }];
  }
  // Flight from Moria: "Then, shuffle 1 copy of A Foe Beyond per player back into the encounter deck."
  if ((match = /^Then,? shuffle (\d+) cop(?:y|ies) of (.+?) per player back into the encounter deck$/i.exec(sentence))) {
    const codes = named(match[2]);
    return codes.length === 0 ? null : [stepWith(codes)("shuffleAsideBack", { count: Number(match[1]), players: true })];
  }
  // The Watcher in the Water, Shadow and Flame: "Remove The Watcher and Doors of Durin from the encounter deck and set them aside, out of play." / "Remove Dark Pit from the encounter deck and place it aside, out of play."
  if ((match = /^Remove (.+?) from the encounter deck and (?:set them|place it) aside,? out of play$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [{ kind: "aside", codes, allCopies: false }];
  }

  // Foundations of Stone: "Place the Foundations of Stone encounter set aside, out of play."
  if ((match = /^Place the (.+?) encounter sets? aside,? out of play$/i.exec(sentence))) return [stepWith([])("setSetsAside", { asideSets: setsOf(match[1] ?? "") })];

  // The Redhorn Gate, Road to Rivendell: "Put Arwen Undómiel into play under the control of the first player." (dwd.ally-objective-arwen)
  if ((match = /^Put (.+?) into play under the control of the first player$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [{ kind: "putIntoPlay", codes, under: "firstPlayer" }];
  }
  // Road to Rivendell: "Reveal 1 card from the encounter deck per player, and add them to the staging area."
  if ((match = /^Reveal (\d+|an?|one) cards? from the encounter deck per player,? and add (?:it|them) to the staging area$/i.exec(sentence))) {
    return [{ kind: "eachPlayerReveals", count: /^\d+$/.test(match[1] ?? "") ? Number(match[1]) : 1 }];
  }
  return null;
}
