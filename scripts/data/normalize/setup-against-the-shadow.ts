import { isNameList, namedBy, stepWith } from "./setup-names.ts";
import type { NameIndex, SetupClause } from "./setup-text.ts";

// Rules: ats.setup-the-stewards-fear-underworld-deck, ats.underworld, ats.hidden-cards, ats.setup-the-morgul-vale-to-the-tower (data/rules/entries.json).
// The sentences of the nine stage 1A cards of Against the Shadow that the other readers do not read. Each pattern is quoted from a Setup line, names the cards it moves, and returns null for a
// sentence it does not read (or whose card names find no card), so the scenario stays unbuilt and a name is never dropped silently.
// The Villain cards are enemies and the Plot cards are objectives (06011.A Setup; the card types in data/cards/TSF.json).
const HIDDEN_TYPE = { Villain: "enemy", Plot: "objective" } as const;
function hiddenCodes(names: NameIndex, trait: keyof typeof HIDDEN_TYPE): string[] {
  return names.cards.filter((card) => card.traits.includes(trait) && card.type === HIDDEN_TYPE[trait]).map((card) => card.code);
}

// `before` is the clauses the earlier sentences of the same Setup read.
export function readAgainstTheShadow(sentence: string, names: NameIndex, before: readonly SetupClause[]): SetupClause[] | null {
  // A card name that starts with "The" (The Leaping Fish) is found as it is printed.
  const withoutThe = namedBy(names);
  const named = (phrase: string | undefined): string[] => (isNameList(names.without(phrase ?? "")) && names.codesOf(phrase ?? "").length > 0 ? names.codesOf(phrase ?? "") : withoutThe(phrase));
  const count = (word: string | undefined): number => (/^\d+$/.test(word ?? "") ? Number(word) : 1);
  let match: RegExpExecArray | null;

  // Peril in Pelargir: "Make The Leaping Fish the active location and attach Alcaron's Scroll to a hero." ("a hero" names no player.)
  if ((match = /^Make (.+?) the active location and attach (.+?) to a hero$/i.exec(sentence))) {
    const [active, scroll] = [named(match[1]), named(match[2])];
    return active.length === 0 || scroll.length === 0 ? null : [{ kind: "active", codes: active }, { kind: "attachChosen", codes: scroll, who: "anyPlayer" }];
  }
  // Into Ithilien: "Each player must search the encounter deck for a copy of Southron Company and add it to the staging area." One copy for each player, as "Add X and 1 Y per player to the staging area".
  if ((match = /^Each player must search the encounter deck for (\d+|an?|one) cop(?:y|ies) of (.+?) and add it to the staging area$/i.exec(sentence))) {
    const codes = named(match[2]);
    return codes.length === 0 ? null : [{ kind: "stage", codes, perPlayer: count(match[1]), count: 0 }];
  }
  // The Steward's Fear: "Create the underworld deck." The deck is every enemy of the Streets of Gondor and Brigands sets and the three Clue objectives of The Steward's Fear (ats.setup-the-stewards-fear-underworld-deck).
  if (/^Create the underworld deck$/i.test(sentence)) {
    const codes = names.cards.filter((card) => (card.type === "enemy" && (card.encounterSet === "Streets of Gondor" || card.encounterSet === "Brigands")) || (card.type === "objective" && card.traits.includes("Clue") && card.encounterSet === "The Steward's Fear")).map((card) => card.code);
    return codes.length === 0 ? null : [stepWith(codes)("buildUnderworldDeck")];
  }
  // The Steward's Fear: "Shuffle all Villain cards and randomly set one aside, out of play, without looking at it. Remove the others from the game. Repeat this with all Plot cards." The three Villain
  // enemies and the three Plot objectives: the first sentence is the step with the cards it chooses from, "Remove the others from the game" is part of it, and "Repeat" is the same step for the Plot cards.
  if ((match = /^Shuffle all (Villain|Plot) cards and randomly set one aside,? out of play,? without looking at it$/i.exec(sentence))) {
    const codes = hiddenCodes(names, /^villain$/i.test(match[1] ?? "") ? "Villain" : "Plot");
    return codes.length === 0 ? null : [stepWith(codes)("hideOneAside", { count: codes.length - 1 })];
  }
  // "Remove the others from the game" is read only straight after that step, so it drops no name for another scenario.
  const last = before[before.length - 1];
  if (/^Remove the others from the game$/i.test(sentence)) return last?.kind === "step" && last.step === "hideOneAside" ? [] : null;
  if (/^Repeat this with all Plot cards$/i.test(sentence)) {
    const codes = hiddenCodes(names, "Plot");
    return codes.length === 0 ? null : [stepWith(codes)("hideOneAside", { count: codes.length - 1 })];
  }
  // The Morgul Vale: "Set aside Lord Alcaron, Nazgûl of Minas Morgul, and The White Bridge." (no "out of play": the later stages add them to the staging area)
  if ((match = /^Set aside (Lord Alcaron, Nazgûl of Minas Morgul, and The White Bridge)$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [{ kind: "aside", codes, allCopies: false }];
  }
  // The Drúadan Forest: "Search the encounter deck for Drû-buri-Drû and set him aside, out of play."
  if ((match = /^Search the encounter deck for (.+?),? and set (?:him|her) aside,? out of play$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [{ kind: "search", codes }, { kind: "aside", codes, allCopies: false }];
  }
  // Encounter at Amon Dîn: "Then, shuffle the encounter deck and reveal 1 encounter card per player and add it to the staging area."
  // The Blood of Gondor: "Shuffle the encounter deck and reveal 1 card from the encounter deck per player and add it to the staging area."
  if ((match = /^(?:Then, )?shuffle the encounter deck and reveal (\d+|an?|one) (?:encounter )?cards?(?: from the encounter deck)? per player and add it to the staging area$/i.exec(sentence))) return [{ kind: "shuffleEncounterDeck" }, stepWith([])("revealPerPlayer", { count: count(match[1]) })];
  // Assault on Osgiliath: "Each player chooses 1 enemy and 1 unique location and add them to the staging area."
  if (/^Each player chooses (?:1|an?|one) enemy and (?:1|an?|one) unique location and add them to the staging area$/i.test(sentence)) return [stepWith([])("eachPlayerChoosesEnemyAndLocation")];
  // The Blood of Gondor: "Add the Crossroads and Black Númenorean to the staging area." The quest card prints "the Crossroads" for the location titled The Cross-roads.
  if ((match = /^Add the Crossroads and (.+?) to the staging area$/i.exec(sentence))) {
    const [crossroads, others] = [names.codesOf("The Cross-roads"), named(match[1])];
    return crossroads.length === 0 || others.length === 0 || !isNameList(names.without(match[1] ?? "")) ? null : [{ kind: "stage", codes: [...crossroads, ...others], perPlayer: null, count: 1 }];
  }
  return null;
}
