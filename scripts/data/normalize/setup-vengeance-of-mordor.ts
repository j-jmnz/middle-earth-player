import { namedBy, stepWith } from "./setup-names.ts";
import type { NameIndex, SetupClause } from "./setup-text.ts";

// The Vengeance of Mordor cycle's packs (scripts/data/campaign-defs.ts, PRODUCTS).
const VOM_PACKS: ReadonlySet<string> = new Set(["ASitE", "WaR", "TCoU", "CotW", "UtAM", "TLoS", "TFoN"]);

// Rules: vom.setup-the-river-running, vom.setup-danger-in-dorwinion, vom.setup-the-temple-of-doom, vom.power-of-mordor-deck-the-temple-of-doom, vom.setup-wrath-and-ruin, vom.the-circuit, vom.setup-under-the-ash-mountains,
// vom.setup-the-land-of-sorrow, vom.power-of-mordor-deck-the-fortress-of-nurn, vom.storm-the-castle (data/rules/entries.json).
// The sentences of the stage 1A cards of the Vengeance of Mordor cycle that the other readers do not read. Each pattern is quoted from a Setup line, names the cards it moves, and returns null for a
// sentence it does not read (or whose card names find no card), so the scenario stays unbuilt and a name is never dropped silently. `before` holds the clauses read earlier in the same Setup.
export function readVengeanceOfMordor(sentence: string, names: NameIndex, before: readonly SetupClause[]): SetupClause[] | null {
  const own = (code: string): boolean => names.cards.find((card) => card.code === code)?.printings.some((printing) => VOM_PACKS.has(printing.pack)) === true;
  const named = (phrase: string | undefined): string[] => {
    const codes = namedBy(names)(phrase);
    return codes.every(own) ? codes : [];
  };
  const step = stepWith([]);
  // The cards of one trait and type of the whole cycle (not only the scenario's encounter sets; a scenario that shares a trait across boxes reads the same set): "each Plot objective", "each Cultist enemy", "each Camp location".
  const ofTrait = (trait: string, type: string): string[] => names.cards.filter((card) => own(card.code) && card.type === type && card.traits.includes(trait)).map((card) => card.code);
  const last = before[before.length - 1];
  let match: RegExpExecArray | null;

  // The River Running: "Each player adds 1 different Easterling enemy to the staging area."
  if ((match = /^Each player adds (?:1|an?|one) different ([A-Z][A-Za-z-]+) enemy to the staging area$/.exec(sentence))) return [step("eachPlayerAddsTraitEnemy", { trait: match[1] ?? "" })];
  // Danger in Dorwinion: "Set each Plot objective and each Cultist enemy aside, out of play."
  if ((match = /^Set each ([A-Z][a-z]+) objective and each ([A-Z][a-z]+) enemy aside,? out of play$/.exec(sentence))) {
    const codes = [...ofTrait(match[1] ?? "", "objective"), ...ofTrait(match[2] ?? "", "enemy")];
    return codes.length === 0 ? null : [{ kind: "aside", codes, allCopies: false }];
  }
  // Danger in Dorwinion: "One of those locations must be Side Street."
  if ((match = /^One of those locations must be (.+)$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [stepWith(codes)("mustBeLocation")];
  }
  // The Temple of Doom: "Shuffle each of the stage 2 quest cards together and place them facedown under this stage."
  if (/^Shuffle each of the stage 2 quest cards together and place them facedown under this stage$/i.test(sentence)) return [step("shuffleStageTwosUnder")];
  // The Temple of Doom, The Fortress of Nurn: "Create The Power of Mordor deck (see insert) and set it next to the quest deck." (vom.power-of-mordor-deck-the-temple-of-doom)
  if (/^Create (?:the|The) Power of Mordor deck \(see insert\) and set it next to the quest deck$/i.test(sentence)) return [step("buildPowerOfMordorDeck", { asideSets: ["The Power of Mordor"] })];
  // Wrath and Ruin: "Make a copy of Makeshift Fortification the active location."
  if ((match = /^Make a copy of (.+?) the active location$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [{ kind: "active", codes }];
  }
  // Challenge of the Wainriders: "Build the circuit (see insert)." (vom.the-circuit)
  if (/^Build the circuit \(see insert\)$/i.test(sentence)) return [step("buildCircuit")];
  // Challenge of the Wainriders: "Place The Wainriders and The Challengers objective cards at this stage."
  if ((match = /^Place (.+?) objective cards at this stage$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [stepWith(codes)("placeCircuitObjectives")];
  }
  // Challenge of the Wainriders, Under the Ash Mountains: "The first player adds Wainrider Champion to the staging area." / "The first player adds a copy of Torech Gorgor Patrol to the staging area."
  if ((match = /^The first player adds (?:an? copy of )?(.+?) to the staging area$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [{ kind: "stage", codes, perPlayer: null, count: 1 }];
  }
  // Challenge of the Wainriders, Under the Ash Mountains: "Each other player adds 1 different location to the staging area."
  if ((match = /^Each other player adds (?:1|an?|one) different location to the staging area$/i.exec(sentence))) return [{ kind: "eachPlayerAddsLocation", count: 1 }];
  // Under the Ash Mountains: "Each player with more than 40 cards in his deck discards cards from the top of his deck until he has 40 cards left."
  if ((match = /^Each player with more than (\d+) cards in his deck discards cards from the top of his deck until he has \d+ cards left$/i.exec(sentence))) return [step("trimDecks", { count: Number(match[1]) })];
  // Under the Ash Mountains: "Shuffle the encounter deck and discard cards from the top until a side quest is discarded." and "Reveal that side quest."
  if (/^Shuffle the encounter deck and discard cards from the top until a side quest is discarded$/i.test(sentence)) return [step("revealSideQuestFromDeck")];
  if (/^Reveal that side quest$/i.test(sentence)) return last?.kind === "step" && last.step === "revealSideQuestFromDeck" ? [] : null;
  // Under the Ash Mountains: "Shuffle the encounter discard pile into the encounter deck."
  if (/^Shuffle the encounter discard pile into the encounter deck$/i.test(sentence)) return [step("reshuffleDiscardIntoDeck")];
  // The Land of Sorrow: "Add each Camp location to the staging area."
  if ((match = /^Add each ([A-Z][a-z]+) location to the staging area$/.exec(sentence))) {
    const codes = ofTrait(match[1] ?? "", "location");
    return codes.length === 0 ? null : [{ kind: "stage", codes, perPlayer: null, count: 0 }];
  }
  // The Land of Sorrow: "Attach a random Captive objective-ally to each Camp location as a guarded objective."
  if ((match = /^Attach a random ([A-Z][a-z]+) objective-ally to each ([A-Z][a-z]+) location as a guarded objective$/.exec(sentence))) {
    const codes = ofTrait(match[1] ?? "", "objective");
    return codes.length === 0 ? null : [stepWith(codes)("attachRandomCaptives")];
  }
  // The Land of Sorrow: "Place one random Warden enemy faceup (but not in play) under each Camp location."
  if ((match = /^Place (?:1|one) random ([A-Z][a-z]+) enemy faceup \(but not in play\) under each ([A-Z][a-z]+) location$/.exec(sentence))) {
    const codes = ofTrait(match[1] ?? "", "enemy");
    return codes.length === 0 ? null : [stepWith(codes)("placeWardensUnderCamps")];
  }
  // The Fortress of Nurn: "Player decks cannot exceed 50 cards."
  if ((match = /^Player decks cannot exceed (\d+) cards$/i.exec(sentence))) return [step("limitDeckSize", { count: Number(match[1]) })];
  // The Fortress of Nurn: "Each player puts 1 copy of Ulchor's Guard into play engaged with him."
  if ((match = /^Each player puts (?:1|an?|one) copy of (.+?) into play engaged with him$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [stepWith(codes)("putCopyEngagedEachPlayer", { count: 1 })];
  }
  // The Fortress of Nurn: "Add Thane Ulchor and all 4 copies of the Storm the Castle side quest to the staging area." (vom.storm-the-castle)
  if ((match = /^Add (.+?) and all (\d+) copies of the (.+?) side quest to the staging area$/i.exec(sentence))) {
    const [staged, quests] = [named(match[1]), names.cards.filter((card) => own(card.code) && card.type === "encounter-side-quest" && card.name === match?.[3]).map((card) => card.code)];
    return staged.length === 0 || quests.length !== Number(match[2]) ? null : [{ kind: "stage", codes: [...staged, ...quests], perPlayer: null, count: 1 }];
  }
  // The Fortress of Nurn: "Place the top card of The Power of Mordor deck faceup under each side quest in play."
  if (/^Place the top card of (?:the|The) Power of Mordor deck faceup under each side quest in play$/i.test(sentence)) return [step("placePowerCardUnderSideQuests")];
  // The Fortress of Nurn: "Each player places 8 cards from top of his deck under the quest deck and each side quest in play."
  if ((match = /^Each player places (\d+) cards from (?:the )?top of his deck under the quest deck and each side quest in play$/i.exec(sentence))) return [step("placeDeckCardsUnder", { count: Number(match[1]) })];
  return null;
}
