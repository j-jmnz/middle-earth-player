import { isNameList, stepWith } from "./setup-names.ts";
import type { NameIndex, SetupClause } from "./setup-text.ts";

// Rules: mec113.setting-up-the-game, mec113.setup-the-passing-of-the-grey-company, mec113.setup-the-siege-of-gondor, mec113.setup-the-battle-of-the-pelennor-fields,
// mec113.setup-the-tower-of-cirith-ungol, mec113.setup-the-black-gate-opens, mec113.setup-mount-doom (data/rules/entries.json).
// The Return of the King's Setup sentences (mec113.* in data/rules/entries.json): the six stage 1A cards' and the six campaign cards'. Every pattern is quoted from a
// ledger line (data/printed/the-return-of-the-king.json), names the cards it moves, and returns null for a sentence it does not read, so the other patterns try it. A step that
// names cards returns null when a name finds no card: the sentence ends up unread and the scenario is not built, a name is never dropped silently. The sentences The Two Towers
// prints too (the burden removal, "Make X the active location", "Put X into play under the first player's control") are read by setup-two-towers.ts.
export function readReturnOfTheKing(sentence: string, names: NameIndex): SetupClause[] | null {
  const step = stepWith([]);
  // The phrase is only card names (a leading "The" is part of a title: The Corsair Fleet, The One Ring).
  const named = (phrase: string | undefined): string[] => (isNameList(names.without(phrase ?? "")) ? names.codesOf(phrase ?? "") : []);
  let match: RegExpExecArray | null;

  // The Passing of the Grey Company (145063, 145066).
  if ((match = /^Each player attaches (?:1|a|one) cop(?:y|ies) of (.+?) to (?:his|their) threat dial$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [stepWith(codes)("attachToThreatDial", { copies: 1 })];
  }
  if ((match = /^Remove each unattached copy of (.+?) from the game$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [stepWith(codes)("removeFromGame")];
  }
  // The campaign cards of scenarios 14 to 17: the heroes a player may change, and the Andúril search.
  if (/^Each player may (?:trade|change) hero(?:es| cards) (?:he )?(?:controls? )?without incurring (?:the \+1|a) threat penalty$/i.test(sentence)) return [{ kind: "waivePenalty" }];
  if ((match = /^The first player may raise each player['’]s threat by (\d+) to search (?:his|their) deck for (.+?) and add it to (?:his|their) hand$/i.exec(sentence))) {
    const codes = named(match[2]);
    return codes.length === 0 ? null : [stepWith(codes)("raiseThreatForSearch", { count: Number(match[1]) })];
  }

  // The Siege of Gondor (145069) and The Battle of the Pelennor Fields (145073, 145078).
  if ((match = /^Each player searches the encounter deck for an? ([A-Z][a-z]+) location and adds it to the staging area$/.exec(sentence))) return [step("eachPlayerAddsTraitLocation", { trait: match[1] ?? "" })];
  if ((match = /^Search the encounter deck for (?:a|1|one) copy of (.+?) and make it the active location$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [{ kind: "search", codes }, { kind: "active", codes }];
  }
  if ((match = /^The players may attach (.+?) to different heroes$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [stepWith(codes)("attachToDifferentHeroes")];
  }
  if ((match = /^The first player attaches (.+?) to (.+?) and sets? (?:him|her|it) aside,? out of play$/i.exec(sentence))) {
    const [attached, to] = [named(match[1]), named(match[2])];
    return attached.length === 0 || to.length === 0 ? null : [stepWith(attached)("attach", { to }), { kind: "aside", codes: to, allCopies: false }];
  }
  if (/^Set each Harad enemy recorded in the campaign log aside,? out of play$/i.test(sentence)) return [step("asideLogged")];
  if ((match = /^Add (.+?) to the staging area \((?:Gondor|Corsair) side faceup\) and place X resources on it, where X is the number recorded in the campaign log$/i.exec(sentence))) {
    // The Corsair Fleet is one physical card of two sides, each a catalog card; the side the Setup names is the Gondor side.
    const codes = named(match[1]).length === 0 ? [] : names.allCodesOf(match[1] ?? "");
    return codes.length === 0 ? null : [{ kind: "stage", codes, perPlayer: null, count: 1 }, stepWith(codes)("placeLoggedResources")];
  }
  if ((match = /^Add (.+?) \(Corsair side faceup\) and (.+?) to the staging area$/i.exec(sentence))) {
    const codes = [...named(match[1]), ...named(match[2])];
    return codes.length < 2 ? null : [{ kind: "stage", codes, perPlayer: null, count: 1 }];
  }

  // The Tower of Cirith Ungol (146066, 146069).
  if ((match = /^The first player loses control of the Ring-bearer and places? it faceup under (.+?) as a guarded objective$/i.exec(sentence))) {
    const to = named(match[1]);
    return to.length === 0 ? null : [step("loseRingBearer", { to })];
  }
  if ((match = /^(?:Then, )?the first player attaches (.+?) to a hero he controls and attaches (.+?) to that hero$/i.exec(sentence))) {
    const codes = [...named(match[1]), ...named(match[2])];
    return codes.length < 2 ? null : [stepWith(codes)("attachToRingBearerHero")];
  }
  if ((match = /^Attach (.+?) to the hero with (.+?) attached$/i.exec(sentence))) {
    const [codes, to] = [named(match[1]), named(match[2])];
    return codes.length === 0 || to.length === 0 ? null : [stepWith(codes)("attachToCarrier", { to })];
  }
  if ((match = /^Each player chooses an? ([A-Z][a-z]+) boon \(excluding (.+?)\) from the campaign pool and sets it aside,? out of play$/i.exec(sentence))) {
    const codes = named(match[2]);
    return codes.length === 0 ? null : [stepWith(codes)("chooseItemBoons", { sets: [match[1] ?? ""] })];
  }

  // Mount Doom (146075, 146079): the resource tokens that count the rounds left.
  if ((match = /^Place X resource tokens on this card, where X is the number of resource tokens on (.+?), as recorded in the campaign log$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [stepWith(codes)("placeLoggedResources", { to: codes })];
  }
  if ((match = /^Each player searches the encounter deck for a different location and adds it to the staging area$/i.exec(sentence))) return [{ kind: "eachPlayerAddsLocation", count: 1 }];
  return null;
}
