import { isNameList, namedBy, stepWith } from "./setup-names.ts";
import type { NameIndex, SetupClause } from "./setup-text.ts";

// Rules: rm.setup-the-fords-of-isen, rm.out-of-play-deck, rm.mugash-player-card-backs, rm.setup-into-fangorn, rm.current-trial, rm.raven-deck (data/rules/entries.json).
// The sentences of the nine stage 1A cards of the Ring-maker cycle that the other readers do not read. Each pattern is quoted from a Setup line, names the cards it moves, and returns null for a
// sentence it does not read (or whose card names find no card), so the scenario stays unbuilt and a name is never dropped silently.
export function readTheRingMaker(sentence: string, names: NameIndex): SetupClause[] | null {
  // A card name that starts with "The" (The Empty Mug) is found as it is printed.
  const withoutThe = namedBy(names);
  const named = (phrase: string | undefined): string[] => (isNameList(names.without(phrase ?? "")) && names.codesOf(phrase ?? "").length > 0 ? names.codesOf(phrase ?? "") : withoutThe(phrase));
  const count = (word: string | undefined): number => (/^\d+$/.test(word ?? "") ? Number(word) : 1);
  const step = stepWith([]);
  // The cards of one encounter set with a trait and a type: "all 3 Guardian enemies" of The Three Trials.
  const ofSet = (set: string, trait: string, type: string): string[] => names.cards.filter((card) => card.encounterSet === set && card.type === type && card.traits.includes(trait)).map((card) => card.code);
  let match: RegExpExecArray | null;

  // The Fords of Isen, Into Fangorn: "Add The Islet to the staging area and attach Gríma to that location."
  if ((match = /^Add (.+?) to the staging area and attach (.+?) to that location$/i.exec(sentence))) {
    const [location, attached] = [named(match[1]), named(match[2])];
    return location.length === 0 || attached.length === 0 ? null : [{ kind: "stage", codes: location, perPlayer: null, count: 1 }, stepWith(attached)("attach", { to: location })];
  }
  // Celebrimbor's Secret: "Attach Celebrimbor's Mould to The Secret Chamber." (the Chamber is staged by the sentence before)
  if ((match = /^Attach (.+?) to (.+)$/i.exec(sentence))) {
    const [attached, to] = [named(match[1]), named(match[2])];
    return attached.length === 0 || to.length === 0 ? null : [stepWith(attached)("attach", { to })];
  }
  // The Fords of Isen: "Each player searches the encounter deck for 1 different Dunland enemy and adds it to the staging area."
  if ((match = /^Each player searches the encounter deck for (?:1|an?|one) different ([A-Z][A-Za-z-]+) enemy and adds it to the staging area$/.exec(sentence))) return [step("eachPlayerAddsTraitEnemy", { trait: match[1] ?? "" })];
  // The Dunland Trap: "Each player searches the encounter deck for a Boar Clan enemy and puts it into play engaged with him."
  if ((match = /^Each player searches the encounter deck for (?:1|an?|one) ([A-Z][A-Za-z -]+?) enemy and puts it into play engaged with him$/.exec(sentence))) return [step("eachPlayerEngagesTraitEnemy", { trait: match[1] ?? "" })];
  // To Catch an Orc: "Each player removes the top 20 cards of his deck and places them aside, as an out-of-play deck." (rm.out-of-play-deck)
  if ((match = /^Each player removes the top (\d+) cards of his deck and places them aside, as an out-of-play deck$/i.exec(sentence))) return [step("createOutOfPlayDecks", { count: Number(match[1]) })];
  // To Catch an Orc: "The first player takes Mugash plus 1 Mugash's Guard for each other player in the game and randomly shuffles one facedown into each player's out-of-play deck." (rm.mugash-player-card-backs)
  if ((match = /^The first player takes (.+?) plus (\d+|an?|one) (.+?) for each other player in the game and randomly shuffles one facedown into each player's out-of-play deck$/i.exec(sentence))) {
    const [leader, guards] = [named(match[1]), named(match[3])];
    return leader.length === 0 || guards.length === 0 ? null : [stepWith([...leader, ...guards])("shuffleIntoOutOfPlayDecks", { count: count(match[2]), copies: 1 })];
  }
  // To Catch an Orc: "Place any remaining copies of Mugash's Guard aside, out of play."
  if ((match = /^Place any remaining copies of (.+?) aside,? out of play$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [{ kind: "aside", codes, allCopies: true }];
  }
  // Into Fangorn: "Reveal X additional encounter cards where X equals the number of players in the game minus 1."
  if (/^Reveal X additional encounter cards where X equals the number of players in the game minus 1$/i.test(sentence)) return [step("revealPlayersLessOne")];
  // The Three Trials: "Set aside all 3 Guardian enemies, all 3 Key objectives, all 3 Barrow locations, and Hallowed Circle." (rm.current-trial)
  if (/^Set aside all 3 Guardian enemies, all 3 Key objectives, all 3 Barrow locations, and Hallowed Circle$/i.test(sentence)) {
    const codes = [...ofSet("The Three Trials", "Guardian", "enemy"), ...ofSet("The Three Trials", "Key", "objective"), ...ofSet("The Three Trials", "Barrow", "location"), ...named("Hallowed Circle")];
    return codes.length !== 10 ? null : [{ kind: "aside", codes, allCopies: false }];
  }
  // Trouble in Tharbad, The Antlered Crown: "Make The Empty Mug the active location."
  if ((match = /^Make (.+?) the active location$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [{ kind: "active", codes }];
  }
  // Trouble in Tharbad: "Search the encounter deck for 1 copy of Spy From Mordor per player, and add them to the staging area." One copy for each player.
  if ((match = /^Search the encounter deck for (\d+|an?|one) cop(?:y|ies) of (.+?) per player,? and add them to the staging area$/i.exec(sentence))) {
    const codes = named(match[2]);
    return codes.length === 0 ? null : [{ kind: "search", codes }, { kind: "stage", codes, perPlayer: count(match[1]), count: 0 }];
  }
  // Trouble in Tharbad: "The first player takes control of Nalir, as an ally." The Nîn-in-Eilph and The Antlered Crown print it without the ally clause.
  if ((match = /^The first player takes control of (.+?)(?:, as an ally)?$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [stepWith(codes)("takeControl")];
  }
  // The Nîn-in-Eilph: "Each player searches the encounter deck for a different location and adds it to the staging area."
  if (/^Each player searches the encounter deck for (?:1|an?|one) different location and adds it to the staging area$/i.test(sentence)) return [{ kind: "eachPlayerAddsLocation", count: 1 }];
  // Celebrimbor's Secret: "Each player adds a different Ost-in-Edhil location to the staging area."
  if ((match = /^Each player adds (?:1|an?|one) different ([A-Z][A-Za-z-]+) location to the staging area$/.exec(sentence))) return [{ kind: "eachPlayerAddsLocation", count: 1 }, step("eachPlayerAddsTraitLocation", { trait: match[1] ?? "" })];
  // The Antlered Crown: "Reveal 1 copy of Dunland Battlefield and make it the active location." / "Reveal 1 copy of Raven War-camp and add it to the staging area."
  if ((match = /^Reveal (?:1|an?|one) copy of (.+?) and make it the active location$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [{ kind: "search", codes }, { kind: "active", codes }];
  }
  if ((match = /^Reveal (?:1|an?|one) copy of (.+?) and add it to the staging area$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [{ kind: "search", codes }, { kind: "stage", codes, perPlayer: null, count: 1 }];
  }
  // The Antlered Crown: "Create the Raven deck (see insert) and set it next to the quest deck." The enemies of Dunland Warriors and Dunland Raiders (rm.raven-deck).
  if (/^Create the Raven deck \(see insert\) and set it next to the quest deck$/i.test(sentence)) {
    const codes = names.cards.filter((card) => card.type === "enemy" && (card.encounterSet === "Dunland Warriors" || card.encounterSet === "Dunland Raiders")).map((card) => card.code);
    return codes.length === 0 ? null : [stepWith(codes)("buildRavenDeck")];
  }
  // The Antlered Crown: "Each player chooses 1 different enemy from the Raven deck and adds it to the staging area."
  if (/^Each player chooses (?:1|an?|one) different enemy from the Raven deck and adds it to the staging area$/i.test(sentence)) return [step("eachPlayerChoosesRavenEnemy")];
  // The Antlered Crown: "Shuffle the encounter deck and Raven deck."
  if (/^Shuffle the encounter deck and Raven deck$/i.test(sentence)) return [{ kind: "shuffleEncounterDeck" }, step("shuffleRavenDeck")];
  return null;
}
