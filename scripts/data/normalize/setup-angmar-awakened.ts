import { namedBy, stepWith } from "./setup-names.ts";
import type { NameIndex, SetupClause } from "./setup-text.ts";

// Angmar Awakened's Setup sentences (mec108.*): the nine stage 1A cards' and the nine campaign cards'. Every pattern is quoted from a ledger line
// (data/printed/angmar-awakened.json), names the cards it moves, and returns null for a sentence it does not read, so the other patterns try it. A step that names cards
// returns null when a name finds no card: the sentence ends up unread and the scenario is not built, a name is never dropped silently.
// The three Across the Ettenmoors side quests and the four safe locations its Setup sets aside.
const ETTENMOORS_SAFE_AND_QUESTS = "Lie Low, Forage for Food, Scavenge for Supplies, Secluded Cave, The Hoarwell, Abandoned Camp, Patch of Woods";

// "2" is 2, "a" and "an" are 1.
const countOf = (word: string | undefined): number => (/^\d+$/.test(word ?? "") ? Number(word) : 1);

export function readAngmarAwakened(sentence: string, names: NameIndex, before: readonly SetupClause[]): SetupClause[] | null {
  const last = before.at(-1);
  const step = stepWith([]);
  const named = namedBy(names);
  let match: RegExpExecArray | null;

  // Intruders in Chetwood, The Weather Hills, Deadmen's Dike: Protect the Innocent and the damage the Campaign Log notes for it.
  if ((match = /^Attach (.+?) to (.+?) and add the (.+?) side quest to the staging area$/i.exec(sentence))) {
    const [attached, to, staged] = [names.codesOf(match[1] ?? ""), named(match[2]), named(match[3])];
    return attached.length === 0 || to.length === 0 || staged.length === 0 ? null : [{ kind: "step", step: "attach", codes: attached, to }, { kind: "stage", codes: staged, perPlayer: null, count: 1 }];
  }
  if ((match = /^Starting with the first player, each player may place (\d+) damage on (.+?) to add (\d+) resources? to each of their heroes' resource pools$/i.exec(sentence))) {
    const codes = named(match[2]);
    return codes.length === 0 ? null : [step("placeDamageForResources", { codes, count: Number(match[1]), resources: Number(match[3]) })];
  }
  if ((match = /^Add the (.+?) side quest to the staging area and place damage on it equal to the amount of damage noted(?: for it)? in the Campaign Log$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [{ kind: "stage", codes, perPlayer: null, count: 1 }, step("placeLoggedDamage", { codes })];
  }
  if ((match = /^Add the (.+?) side quest to the Campaign Log and shuffle it into the encounter deck$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [{ kind: "shuffleInto", codes, into: "encounter deck", set: null }, { kind: "addToCampaignPool", codes }];
  }
  if (/^Create the Orc deck \(see insert\) and set it next to the quest deck$/i.test(sentence)) return [step("buildOrcDeck")];

  // The Wastes of Eriador: the Time objective and Determination.
  if (/^Add the Time objective to the staging area with Daybreak faceup$/i.test(sentence)) {
    const codes = named("Daybreak");
    return codes.length === 0 ? null : [{ kind: "stage", codes, perPlayer: null, count: 1 }];
  }
  if ((match = /^Reveal (\d+|an?) cards? from the encounter deck per player$/i.exec(sentence))) return [step("revealPerPlayer", { count: countOf(match[1]) })];
  if ((match = /^Each player adds (\d+|an?) cop(?:y|ies) of (.+?) to their starting hand$/i.exec(sentence))) {
    const codes = names.codesOf(match[2] ?? "");
    return codes.length === 0 ? null : [step("addToStartingHand", { codes, count: countOf(match[1]) })];
  }
  if (/^Add each of those events to the Campaign Pool$/i.test(sentence)) return last?.kind === "step" && last.step === "addToStartingHand" ? [{ kind: "addToCampaignPool", codes: last.codes }] : null;

  // Escape from Mount Gram: the captured decks.
  if (/^Each player shuffles his starting hand into his deck$/i.test(sentence)) return [step("shuffleHandIntoDeck")];
  if (/^Each player prepares a separate captured deck \(see insert\)$/i.test(sentence)) return [step("prepareCapturedDeck")];
  if (/^Each player adds 2 resources to his starting hero and sets his threat to that hero's threat cost$/i.test(sentence)) return [step("startingHero", { resources: 2 })];
  if ((match = /^Each player draws a new starting hand of (\d+) cards$/i.exec(sentence))) return [step("drawNewHand", { count: Number(match[1]) })];
  if (/^Set aside any permanent boon attachments on heroes that are added to a player's captured deck$/i.test(sentence)) return [step("setAsideCapturedBoons")];
  if ((match = /^Add the (.+?) side quest to the staging area, capturing the bottom (\d+) cards of each player's captured deck underneath it$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [{ kind: "stage", codes, perPlayer: null, count: 1 }, step("captureUnder", { codes, count: Number(match[2]) })];
  }

  // Across the Ettenmoors: the three side quests and the four safe locations.
  if ((match = /^Set aside each of the 3 Across the Ettenmoors side quests and each of the 4 locations with the safe keyword$/i.exec(sentence))) {
    const codes = named(ETTENMOORS_SAFE_AND_QUESTS);
    return codes.length === 7 ? [{ kind: "aside", codes, allCopies: false }] : null;
  }
  if (/^Reveal 1 of those side quests at random and 1 of those safe locations at random, adding them to the staging area with the safe location guarded by the side quest$/i.test(sentence)) {
    const codes = named(ETTENMOORS_SAFE_AND_QUESTS);
    return codes.length === 7 ? [step("revealSafeLocationGuarded", { codes })] : null;
  }
  if ((match = /^Search the encounter deck for 1 copy of (.+?) per player and add them to the staging area$/i.exec(sentence))) {
    const codes = names.codesOf(match[1] ?? "");
    return codes.length === 0 ? null : [{ kind: "stage", codes, perPlayer: 1, count: 0 }];
  }
  if (/^Shuffle the remaining side quests and safe locations back into the encounter deck$/i.test(sentence)) return [step("shuffleRemainingSafe")];

  // The Treachery of Rhudaur and The Battle of Carn Dûm.
  // Only the active locations Angmar's stage 1 cards name, so this reader cannot take another box's "Make X the active location" (setup-two-towers.ts).
  if ((match = /^Make (Exposed Ridge|Shrouded Hills|The Great Hall) the active location$/i.exec(sentence))) {
    const codes = names.codesOf(match[1] ?? "");
    return codes.length === 0 ? null : [{ kind: "active", codes }];
  }
  if (/^Add the 3 Treachery of Rhudaur side quests to the staging area, quest side faceup$/i.test(sentence)) {
    const codes = named("Quiet the Spirits, Sift through the Debris, Decipher Ancient Texts");
    return codes.length === 3 ? [{ kind: "stage", codes, perPlayer: null, count: 1 }] : null;
  }
  if ((match = /^Search the encounter deck for 1 copy of (.+?), and add it to the staging area \((\d+) copies instead if there are (\d+) or (\d+) players in the game\)$/i.exec(sentence))) {
    const codes = names.codesOf(match[1] ?? "");
    return codes.length === 0 ? null : [{ kind: "stage", codes, perPlayer: null, count: 1, many: { count: Number(match[2]), from: Number(match[3]) } }];
  }
  // The Battle of Carn Dûm: the Garrison copies are staged one per player, the rest of the box's copies stay in the encounter deck (10125:A:1).
  if ((match = /^Add 1 cop(?:y|ies) of (.+?) per player to the staging area$/i.exec(sentence))) {
    const codes = names.codesOf(match[1] ?? "");
    return codes.length === 0 ? null : [{ kind: "stage", codes, perPlayer: 1, count: 0 }];
  }
  if ((match = /^Add (.+?) to the staging area, (Captain|Champion) side faceup$/i.exec(sentence))) {
    const codes = names.codesOf(match[1] ?? "");
    return codes.length === 0 ? null : [{ kind: "stage", codes, perPlayer: null, count: 1 }];
  }
  if ((match = /^Each player may change hero cards without incurring the \+1 threat penalty, and (.+?) may be included among a player's heroes$/i.exec(sentence))) {
    const codes = names.allCodesOf(match[1] ?? "");
    return codes.length === 0 ? null : [{ kind: "waivePenalty" }, step("mayBeHero", { to: codes })];
  }
  if ((match = /^Then, each player in turn order may select one of the following boons and add it to their opening hand: (.+)$/i.exec(sentence))) {
    const codes = names.codesOf(match[1] ?? "");
    return codes.length === 0 ? null : [{ kind: "choose", codes, who: "eachPlayer", attach: false }];
  }

  // The Dread Realm.
  if (/^Each player reveals an encounter card from the top of the encounter deck$/i.test(sentence)) return [{ kind: "eachPlayerReveals", count: 1 }];
  if (/^Each player reanimates the top card of his deck$/i.test(sentence)) return [step("reanimateTopCard")];
  if (/^Each player may search their deck for a boon card and add it to their opening hand$/i.test(sentence)) return [{ kind: "searchDeckForBoon", who: "eachPlayer", unique: false, cards: "boon" }];
  if (/^Each hero begins the game with damage on them equal to the amount noted for them in the Campaign Log$/i.test(sentence)) return [step("heroesBeginDamaged")];
  return null;
}
