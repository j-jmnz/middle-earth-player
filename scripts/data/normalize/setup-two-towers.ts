import { distance, titleKey } from "./names.ts";
import { namedBy, setsOf, stepWith } from "./setup-names.ts";
import type { NameIndex, SetupClause } from "./setup-text.ts";

// The Two Towers' Setup sentences (docs/brief.md, The Two Towers): the six stage 1A cards' and the six campaign cards'. Every pattern is quoted from a
// ledger line (data/printed/the-two-towers.json), names the cards (and, for the burden removal, the burden sets) it moves, and returns null for a sentence it
// does not read, so the other patterns try it. A step that names cards returns null when a name finds no card: the sentence ends up unread and the
// scenario is not built, a name is never dropped silently.
// A name one letter off a card of the scenario, when exactly one card is that near: Hall of Beorn's candidate of Follow the Orcs prints "Estemnet" for Eastemnet.
// The ledger text is read from the scan and its names are matched exactly (named); this only keeps a candidate's typo from hiding the Setup line.
function nearName(phrase: string | undefined, names: NameIndex): string[] {
  const key = titleKey(phrase ?? "");
  const hits = key.length < 6 ? [] : [...names.aliases].filter(([name]) => distance(titleKey(name), key) <= 1);
  const only = hits.length === 1 ? hits[0] : undefined;
  return only ? [only[1]] : [];
}

export function readTwoTowers(sentence: string, names: NameIndex): SetupClause[] | null {
  const step = stepWith([]);
  const named = namedBy(names);
  let match: RegExpExecArray | null;

  // The campaign cards (143071 to 144073).
  if ((match = /^Remove (.+?) from the Campaign Pool$/i.exec(sentence))) {
    const pool = named(match[1]);
    return pool.length === 0 ? null : [step("removeFromPool", { to: pool })];
  }
  if ((match = /^Remove each burden with (?:the following|these) burden set icons from the encounter deck( and each player['’]s deck)?:?\s*(.+)$/i.exec(sentence))) {
    return [step("removeBurdens", { sets: setsOf(match[2] ?? ""), ...(match[1] ? { players: true } : {}) })];
  }
  if ((match = /^Each player shuffles (\d+|an?|one) cop(?:y|ies) of (.+?) into (?:his|their) deck$/i.exec(sentence))) {
    const codes = names.codesOf(match[2] ?? "");
    return codes.length === 0 ? null : [stepWith(codes)("shuffleIntoDecks", { count: /^\d+$/.test(match[1] ?? "") ? Number(match[1]) : 1 })];
  }
  if ((match = /^Each player must choose: either add (\d+) resources? to each of (?:his|their) heroes['’] pools?, or shuffle (\d+) cop(?:y|ies) of (.+?) into (?:his|their) deck$/i.exec(sentence))) {
    const codes = names.codesOf(match[3] ?? "");
    return codes.length === 0 ? null : [stepWith(codes)("chooseResourceOrCopy", { count: Number(match[2]) })];
  }

  // The Uruk-hai (143069): the captives and the pursuit value.
  if ((match = /^Each player chooses (?:1|one) non-Fellowship hero (?:he|they) controls? to be a Captive and places it faceup underneath (.+?) \(If playing campaign mode, choose each ["'‘’“”]?captive["'‘’“”]? from the Campaign Log instead\)$/i.exec(sentence))) {
    const under = named(match[1]);
    return under.length === 0 ? null : [step("chooseCaptives", { to: under })];
  }
  if ((match = /^Set the pursuit value to (\d+)$/i.exec(sentence))) return [step("setPursuit", { count: Number(match[1]) })];
  if ((match = /^Make (.+?) the active location$/i.exec(sentence))) {
    const exact = named(match[1]);
    const codes = exact.length > 0 ? exact : nearName(match[1], names);
    return codes.length === 0 ? null : [{ kind: "active", codes }];
  }

  // Helm's Deep (143072): the copies each player sets aside, and the choice that ends stage 1.
  if ((match = /^Each player sets (\d+|an?|one) cop(?:y|ies) of (.+?) aside,? out of play$/i.exec(sentence))) {
    const codes = named(match[2]);
    return codes.length === 0 ? null : [{ kind: "aside", codes, allCopies: false }];
  }
  if ((match = /^(?:Then, )?the players must choose: either each player shuffles (\d+|an?|one) cop(?:y|ies) of (.+?) into (?:his|their) deck, or advance to stage (\d+)A \(bypassing stage (\d+)B\)$/i.exec(sentence))) {
    const codes = names.codesOf(match[2] ?? "");
    return codes.length === 0 ? null : [stepWith(codes)("chooseCounselsOrAdvance", { count: Number(match[3]) })];
  }

  // The Passage of the Marshes (144064), Journey to the Cross-roads (144068) and Shelob's Lair (144070).
  if ((match = /^Put (.+?) into play engaged with the first player$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [{ kind: "putIntoPlay", codes, under: "engagedFirstPlayer" }];
  }
  if ((match = /^Put (.+?) into play under the first player['’]s control$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [step("takeControl", { codes })];
  }
  if (/^Each player searches the encounter deck for (?:1|one|a) location, reveals it, and adds it to the staging area$/i.test(sentence)) return [{ kind: "eachPlayerAddsLocation", count: 1 }];
  if (/^Each player, except for the first player, searches the encounter deck for a different non-unique location and adds it to the staging area$/i.test(sentence)) return [step("eachOtherPlayerAddsLocation", { count: 1 })];
  if ((match = /^Shuffle the (.+?) encounter set and place it facedown under (.+)$/i.exec(sentence))) {
    const under = names.codesOf(match[2] ?? "");
    return under.length === 0 ? null : [step("shuffleSetUnder", { asideSets: [(match[1] ?? "").trim()], to: under })];
  }
  return null;
}
