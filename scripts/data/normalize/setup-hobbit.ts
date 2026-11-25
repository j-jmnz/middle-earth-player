import { isNameList, namedBy, setsOf, stepWith } from "./setup-names.ts";
import type { NameIndex, SetupClause } from "./setup-text.ts";

// Rules: hob.sack-deck, hob.setup-over-the-misty-mountains-grim, hob.active-and-inactive-encounter-decks, hob.riddle-area, hob.treasure-ohauh, hob.treasure-otd (data/rules/entries.json).
// The sentences of the six stage 1A cards of The Hobbit saga boxes that the other readers do not read. Each pattern is quoted from a Setup line, names the cards it moves, and returns null for a
// sentence it does not read (or whose card names find no card), so the scenario stays unbuilt and a name is never dropped silently. "Search the encounter deck for X, and add it to the staging
// area" is read by setup-shadows-of-mirkwood.ts, the bare "Search the encounter deck for X" and "Add X to the staging area" by setup-text.ts.
export function readHobbit(sentence: string, names: NameIndex): SetupClause[] | null {
  // A card name that starts with "The" (The Spider's Glade, The Lonely Mountain) is found as it is printed.
  const withoutThe = namedBy(names);
  const named = (phrase: string | undefined): string[] => (isNameList(names.without(phrase ?? "")) && names.codesOf(phrase ?? "").length > 0 ? names.codesOf(phrase ?? "") : withoutThe(phrase));
  const count = (word: string | undefined): number => (/^\d+$/.test(word ?? "") ? Number(word) : 1);
  let match: RegExpExecArray | null;

  // We Must Away, Ere Break of Day: "Remove and shuffle the 7 Sack cards into a Sack deck and set it aside face down." (hob.sack-deck): the Sack objectives are the cards of the Sack trait.
  if ((match = /^Remove and shuffle the (\d+) Sack cards into a Sack deck and set it aside,? face ?down$/i.exec(sentence))) {
    const sacks = names.cards.filter((card) => card.traits.includes("Sack")).map((card) => card.code);
    return sacks.length !== Number(match[1]) ? null : [{ kind: "aside", codes: sacks, allCopies: false }];
  }
  // We Must Away, Ere Break of Day: "Remove the 3 Troll enemies and the Troll Cave from the encounter deck and set them aside out of play." The three Trolls are the unique Troll enemies.
  if ((match = /^Remove the (\d+) Troll enemies and the (.+?) from the encounter deck and set them aside,? out of play$/i.exec(sentence))) {
    const trolls = names.cards.filter((card) => card.isUnique && card.type === "enemy" && card.traits.includes("Troll")).map((card) => card.code);
    const cave = named(match[2]);
    return trolls.length !== Number(match[1]) || cave.length === 0 ? null : [{ kind: "aside", codes: [...trolls, ...cave], allCopies: false }];
  }
  // We Must Away, Ere Break of Day: "Each player reveals 1 card from the top of the encounter deck and adds it to the staging area." (no comma: the other readers want one)
  if ((match = /^Each player reveals (\d+|an?|one) cards? from the top of the encounter deck and adds it to the staging area$/i.exec(sentence))) return [{ kind: "eachPlayerReveals", count: count(match[1]) }];

  // Over the Misty Mountains Grim: "Then, shuffle the The Great Goblin and Misty Mountain Goblins encounter sets into a second encounter deck and set it aside, inactive." (hob.active-and-inactive-encounter-decks)
  if ((match = /^Then,? shuffle the (?:the )?(.+?) encounter sets into a second encounter deck and set it aside,? inactive$/i.exec(sentence))) return [stepWith([])("secondDeck", { asideSets: setsOf(match[1] ?? "") })];

  // Dungeons Deep and Caverns Dim: "Create a riddle area with stage 2A and follow the setup instructions on that card." Stage 2A's own Setup searches the encounter deck for Gollum and Bilbo's Magic Ring (hob.riddle-area).
  if (/^Create a riddle area with stage 2A and follow the setup instructions on that card$/i.test(sentence)) return [stepWith([])("createRiddleArea")];

  // Flies and Spiders: "Each player may shuffle 1 copy Bilbo's Magic Ring into his deck." The treasure card the players discovered (hob.treasure-otd).
  if ((match = /^Each player may shuffle (\d+|an?|one) cop(?:y|ies) (?:of )?(.+?) into his deck$/i.exec(sentence))) {
    const codes = named(match[2]);
    return codes.length === 0 ? null : [stepWith(codes)("shuffleIntoDecks", { count: count(match[1]) })];
  }
  // Flies and Spiders: "Search the encounter deck for The Spider's Glade and set it aside, out of play."
  if ((match = /^Search the encounter deck for (.+?),? and set (?:it|them) aside,? out of play$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [{ kind: "search", codes }, { kind: "aside", codes, allCopies: false }];
  }
  // Flies and Spiders, The Battle of Five Armies: "Then, shuffle the encounter deck and reveal 1 encounter card per player."
  if ((match = /^Then,? shuffle the encounter deck and reveal (\d+|an?|one) encounter cards? per player$/i.exec(sentence))) return [{ kind: "shuffleEncounterDeck" }, stepWith([])("revealPerPlayer", { count: count(match[1]) })];

  // The Lonely Mountain: "Shuffle the five Erebor treasure cards and stack them facedown under The Lonely Mountain." The treasure cards of the Erebor trait.
  if ((match = /^Shuffle the (\w+) Erebor treasure cards and stack them facedown under (.+)$/i.exec(sentence))) {
    const [treasures, under] = [names.cards.filter((card) => card.type === "treasure" && card.traits.includes("Erebor")).map((card) => card.code), named(match[2])];
    return treasures.length === 0 || under.length === 0 ? null : [stepWith(treasures)("secrets", { to: under })];
  }
  return null;
}
