import { namedBy, setsOf, stepWith } from "./setup-names.ts";
import type { NameIndex, SetupClause } from "./setup-text.ts";

// Ered Mithrin's Setup sentences (docs/plans/ered-mithrin.md, phase 49): the nine stage 1A cards' and the nine campaign cards'. Every pattern is quoted from a
// ledger line (data/printed/ered-mithrin.json), names the cards (and, for the deck steps, the encounter sets) it moves, and returns null for a sentence it
// does not read, so the other patterns try it. A step that names cards returns null when a name finds no card: the sentence ends up unread and the
// scenario is not built, a name is never dropped silently. A sentence that only restates the one before it (`This is the side quest deck`,
// `Add each discarded location to the staging area`) is read as nothing after that one, and left to the other patterns otherwise.
export function readEredMithrin(sentence: string, names: NameIndex, before: readonly SetupClause[]): SetupClause[] | null {
  const last = before.at(-1);
  const step = stepWith([]);
  const named = namedBy(names);
  let match: RegExpExecArray | null;

  if (/^Create the Evil Creatures deck \(see insert\) and place it next to the quest deck$/i.test(sentence)) return [step("buildEvilCreaturesDeck")];
  if (/^(?:Build|Create) the Caves deck(?: \(see insert\))? and (?:set|place) it next to the quest deck$/i.test(sentence)) return [step("buildCavesDeck")];
  if (/^Create the Caves deck and the quest deck \(see insert\)$/i.test(sentence)) return [step("buildCavesDeck"), step("prepareQuestDeck")];
  if ((match = /^Search the encounter deck for all (\d+) encounter side quests, shuffle them together, and place them facedown next to the quest deck$/i.exec(sentence))) {
    return [step("buildSideQuestDeck", { count: Number(match[1]) })];
  }
  if (/^This is the side quest deck$/i.test(sentence)) return last?.kind === "step" && last.step === "buildSideQuestDeck" ? [] : null;

  // "Set the Spiders of Mirkwood and Dol Guldur Orcs encounter sets aside, out of play" / "Set Fire-drake, Dragon Hoard, and the Dragon Might encounter sets
  // aside, out of play" (the cards by name and the set by its name).
  if ((match = /^Set the (.+?) encounter sets? aside,? out of play$/i.exec(sentence))) return [step("setSetsAside", { asideSets: setsOf(match[1] ?? "") })];
  if ((match = /^Set (.+?),? and the (.+?) encounter sets? aside,? out of play$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [{ kind: "aside", codes, allCopies: false }, step("setSetsAside", { asideSets: setsOf(match[2] ?? "") })];
  }
  if (/^Set each other objective and objective-ally aside,? out of play$/i.test(sentence)) return [step("asideEachOtherObjective")];
  if ((match = /^Shuffle (\d+) set aside (.+?) objectives into the Caves deck$/i.exec(sentence))) {
    const codes = named(match[2]);
    return codes.length === 0 ? null : [step("shuffleAsideIntoCaves", { codes, count: Number(match[1]) })];
  }

  // The cards discarded from the top of the encounter deck for the staging area.
  if ((match = /^(Shuffle the encounter deck and )?discard cards from the top until X (locations|enemies) (?:are|have been) discarded, where X is (the number of players|1 less than the number of players)(?: in the game)?$/i.exec(sentence))) {
    return [{ kind: "discardToStaging", types: [match[2]?.toLowerCase() === "enemies" ? "enemy" : "location"], amount: /1 less/.test(match[3] ?? "") ? "playersLessOne" : "players", eachPlayer: false, shuffleFirst: match[1] !== undefined }];
  }
  if (/^Each player discards cards from the top of the encounter deck until he discards an enemy or location and adds that card to the staging area$/i.test(sentence)) {
    return [{ kind: "discardToStaging", types: ["enemy", "location"], amount: "players", eachPlayer: true, shuffleFirst: false }];
  }
  if (/^Add (?:each discarded|those) (?:locations?|enem(?:y|ies))(?: discarded)? to the staging area$/i.test(sentence)) return last?.kind === "discardToStaging" ? [] : null;

  // Who takes control of a boon ally or objective.
  if ((match = /^The first player (?:takes|gains) control of (.+?) and adds (.+?) to the staging area$/i.exec(sentence))) {
    const [who, staged] = [named(match[1]), names.codesOf(match[2] ?? "")];
    return who.length === 0 || staged.length === 0 ? null : [step("takeControl", { codes: who }), { kind: "stage", codes: staged, perPlayer: null, count: 1 }];
  }
  if ((match = /^(?:The first player|Any player) (?:takes|gains) control of (.+?)(, objective side face-up)?$/i.exec(sentence))) {
    // A card with an objective side and an enemy side (Urdug) is two catalog cards, and both are the card the player takes.
    const codes = match[2] ? names.allCodesOf(match[1] ?? "") : named(match[1]);
    return codes.length === 0 ? null : [step("takeControl", { codes })];
  }
  if ((match = /^The first player adds (.+?) to the staging area and shuffles the encounter deck$/i.exec(sentence))) {
    const codes = names.codesOf(match[1] ?? "");
    return codes.length === 0 ? null : [{ kind: "stage", codes, perPlayer: null, count: 1 }, { kind: "shuffleEncounterDeck" }];
  }
  if ((match = /^Each player adds (\d+|an?|one) (.+?) to the staging area$/i.exec(sentence))) {
    const codes = named(match[2]);
    return codes.length === 0 ? null : [{ kind: "stage", codes, perPlayer: /^\d+$/.test(match[1] ?? "") ? Number(match[1]) : 1, count: 0 }];
  }
  if (/^Each other player reveals an encounter card$/i.test(sentence)) return [step("eachOtherPlayerReveals", { count: 1 })];
  if (/^Each player searches the encounter deck for a different location and adds it to the staging area$/i.test(sentence)) return [{ kind: "eachPlayerAddsLocation", count: 1 }];
  if ((match = /^The first player may search the encounter deck for a copy of (.+?) and add it to the staging area$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [step("searchAndStage", { to: codes })];
  }

  // Treasures (emce.treasure).
  if ((match = /^If they do, the players look at (\d+) random undiscovered treasures and attach (\d+) of them to (.+?) as a guarded objective$/i.exec(sentence))) {
    const codes = named(match[3]);
    return codes.length === 0 ? null : [step("attachTreasure", { to: codes, count: Number(match[1]) })];
  }
  if (/^When free of encounters, the players claim the treasure and attach it to any character$/i.test(sentence)) return last?.kind === "step" && last.step === "attachTreasure" ? [step("claimTreasure")] : null;

  // The hero change and Haldan (emce.haldan).
  if ((match = /^Each player may change hero cards without incurring the \+1 threat penalty(, and (Haldan) may be included among a player's heroes)?$/i.exec(sentence))) {
    const haldan = match[2] ? named(match[2]) : [];
    return match[2] && haldan.length === 0 ? null : [{ kind: "waivePenalty" }, ...(match[2] ? [step("haldanMayBeHero", { to: haldan })] : [])];
  }
  if ((match = /^Add (.+?) to the staging area, shuffle (.+?) into the encounter deck, and shuffle (.+?) into the Caves deck$/i.exec(sentence))) {
    const [staged, deck, caves] = [names.codesOf(match[1] ?? ""), names.codesOf(match[2] ?? ""), names.codesOf(match[3] ?? "")];
    if (staged.length === 0 || deck.length === 0 || caves.length === 0) return null;
    return [{ kind: "stage", codes: staged, perPlayer: null, count: 1 }, { kind: "shuffleInto", codes: deck, into: "encounter deck", set: null }, { kind: "shuffleInto", codes: caves, into: "Caves deck", set: null }];
  }

  // The log's lines (emce.boon-allies): the cards a Setup removes before the game.
  if ((match = /^(?:If "([^"]+?),?" )?search the encounter deck for (\d+) (non-unique )?(treacheries|locations|enemies)(?: not named (.+?))?(?: and the Caves deck for (\d+) locations?)? and remove them from the game$/i.exec(sentence))) {
    const what = { treacheries: "treachery", locations: "location", enemies: "enemy" } as const;
    return [{ kind: "removeCards", ifLogged: match[1] ?? null, count: Number(match[2]), what: what[(match[4] ?? "").toLowerCase() as keyof typeof what], nonUnique: match[3] !== undefined, except: match[5] ?? null, alsoCaves: match[6] ? Number(match[6]) : null }];
  }
  if ((match = /^(A player|Each player) may search their deck for an? (unique )?(boon ally|boon or treasure card) and add it to their hand$/i.exec(sentence))) {
    return [{ kind: "searchDeckForBoon", who: /^each/i.test(match[1] ?? "") ? "eachPlayer" : "aPlayer", unique: match[2] !== undefined, cards: /ally/.test(match[3] ?? "") ? "boon ally" : "boon or treasure" }];
  }
  if ((match = /^If there are (\d+) or more treasures recorded in the campaign log, shuffle (.+?) into the encounter deck$/i.exec(sentence))) {
    const codes = names.codesOf(match[2] ?? "");
    return codes.length === 0 ? null : [{ kind: "shuffleInto", codes, into: "encounter deck", set: null, ifTreasures: Number(match[1]) }];
  }

  // Trust in Urdug (campaign card 12184).
  if ((match = /^The first player may put their trust in (.+?) by placing a resource on him \(from the token pool\)$/i.exec(sentence))) {
    const codes = names.allCodesOf(match[1] ?? "");
    return codes.length === 0 ? null : [step("trustInUrdug", { to: codes })];
  }
  if ((match = /^If they don't, shuffle a copy of the (.+?) burden into the encounter deck$/i.exec(sentence))) {
    const codes = names.codesOf(match[1] ?? "");
    return codes.length === 0 || last?.kind !== "step" || last.step !== "trustInUrdug" ? null : [step("cunningUnlessTrusted", { codes })];
  }

  // Keywords the scenario ignores, and Wormsbane (one card, two catalog cards: both sides are the card attached).
  if ((match = /^Ignore the (deep|discover)(?: and (deep|discover))? keywords?(?:\. \(Note:.*\))?$/i.exec(sentence))) {
    return [step("ignoreKeywords", { sets: [match[1], match[2]].filter((word): word is string => word !== undefined).map((word) => word.toLowerCase()) })];
  }
  if ((match = /^Attach (.+?) to a hero, (Broken|Reforged) side face-up$/i.exec(sentence))) {
    const codes = names.allCodesOf(match[1] ?? "");
    return codes.length === 0 ? null : [{ kind: "attachChosen", codes, who: "anyPlayer" }];
  }
  return null;
}
