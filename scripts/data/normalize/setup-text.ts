import type { Card } from "../../../src/catalog/card-facts.ts";

// What a Setup line says, as data. A sentence the patterns do not read is returned in `unread`, so a new Setup
// verb fails a build loudly instead of being skipped. Names are found by matching the known card names of the
// scenario (longest first), because a name can hold commas ("Doom, Doom, Doom") or a period ("Mr. Underhill").
export type SetupClause =
  | { kind: "aside"; codes: string[]; allCopies: boolean }
  | { kind: "stage"; codes: string[]; perPlayer: number | null; count: number }
  | { kind: "active"; codes: string[] }
  | { kind: "attachRingBearer"; codes: string[] }
  | { kind: "shuffleInto"; codes: string[]; into: "encounter deck" | "burden deck"; set: string | null }
  | { kind: "lifeSet"; amount: number }
  | { kind: "damageOn"; codes: string[]; amount: number }
  | { kind: "eachPlayerAddsLocation"; count: number }
  | { kind: "shuffleEncounterDeck" }
  | { kind: "choose"; codes: string[]; who: string; attach: boolean }
  | { kind: "earned"; codes: string[] }
  | { kind: "waivePenalty" }
  | { kind: "leftoverIntoFirstPlayerDeck" }
  // Mirkwood Paths and The Dark of Mirkwood (docs/plans/mirkwood-paths.md, phase 27). Each is quoted from a ledger line.
  // "Search the encounter deck for X and Y": finds the cards; the next clause says where they go.
  | { kind: "search"; codes: string[] }
  // "Search the encounter deck for the 3 objective cards, reveal and place them in the staging area."
  | { kind: "searchObjectives"; count: number }
  // "Each player reveals 1 card from the top of the encounter deck, and adds it to the staging area."
  | { kind: "eachPlayerReveals"; count: number }
  // "Attach 1 encounter card to each objective card."
  | { kind: "attachEncounterToObjectives"; count: number }
  // "Put Mendor into play."
  | { kind: "putIntoPlay"; codes: string[] }
  // "Attach X to a hero of the first player's choice." / "The first player attaches X to one of his heroes."
  | { kind: "attachChosen"; codes: string[]; who: "firstPlayer" }
  // "Each player chooses 1 Adaptation boon attachment and attaches it to one of their heroes."
  | { kind: "eachPlayerChoosesBoon"; trait: string }
  // "Add each copy of X in a player's hand to the Campaign Pool." / "... and add it to the Campaign Pool."
  | { kind: "addToCampaignPool"; codes: string[] }
  // "Each player adds 1 copy of X to their hand after drawing their starting hand (including taking a mulligan)."
  | { kind: "addToHandAfterMulligan"; codes: string[]; count: number };

export type ParsedSetup = { clauses: SetupClause[]; unread: string[] };

export type NameIndex = { codesOf(sentence: string): string[]; aliases: ReadonlyMap<string, string> };

// Builds the name matcher from the cards a scenario can name. When two cards share a name (the burden Pursued by the
// Enemy and the quest of the same name), the one in `prefer` wins.
export function nameIndex(cards: readonly Card[], prefer: ReadonlySet<string>): NameIndex {
  const byName = new Map<string, Card>();
  for (const card of cards) {
    const key = card.name.toLowerCase();
    const have = byName.get(key);
    if (!have || (prefer.has(card.code) && !prefer.has(have.code))) byName.set(key, card);
  }
  const names = [...byName.keys()].sort((a, b) => b.length - a.length);
  return {
    aliases: new Map([...byName].map(([name, card]) => [name, card.code])),
    codesOf(sentence) {
      const lower = sentence.toLowerCase();
      const found: { at: number; code: string; length: number }[] = [];
      const taken: [number, number][] = [];
      for (const name of names) {
        let from = 0;
        for (;;) {
          const at = lower.indexOf(name, from);
          if (at < 0) break;
          const end = at + name.length;
          const word = (i: number) => /[\p{L}\p{N}]/u.test(lower[i] ?? " ");
          const clean = !word(at - 1) && !word(end);
          if (clean && !taken.some(([a, b]) => at < b && end > a)) {
            taken.push([at, end]);
            found.push({ at, code: byName.get(name)?.code ?? "", length: name.length });
          }
          from = at + 1;
        }
      }
      return found.sort((a, b) => a.at - b.at).map((hit) => hit.code);
    },
  };
}

function sentencesOf(text: string): string[] {
  return text
    .replaceAll("Mr. ", "Mr_ ")
    .split(/(?<=\.)\s+(?=[A-Z])/)
    .map((sentence) => sentence.replaceAll("Mr_ ", "Mr. ").trim())
    .filter((sentence) => sentence !== "");
}

const WORD: Readonly<Record<string, number>> = { a: 1, an: 1, one: 1, two: 2, three: 3 };
const amount = (word: string | undefined): number => (word === undefined ? 1 : (WORD[word.toLowerCase()] ?? Number(word)));

export function parseSetup(text: string, names: NameIndex, set: (name: string) => string | null = () => null): ParsedSetup {
  const clauses: SetupClause[] = [];
  const unread: string[] = [];
  for (const raw of sentencesOf(text.replace(/^Setup:\s*/i, ""))) {
    const sentence = raw.replace(/\.$/, "");
    let match: RegExpExecArray | null;
    if ((match = /^Set (all copies of |each copy of )?(.+?) aside,? out of play$/i.exec(sentence))) {
      clauses.push({ kind: "aside", codes: names.codesOf(match[2] ?? ""), allCopies: match[1] !== undefined });
    } else if ((match = /^Search the encounter deck for (?:\d+ )?(?:cop(?:y|ies) of )?(.+?),? and add them to the staging area$/i.exec(sentence)) && /\bcopy of\b/i.test(sentence)) {
      // "1 copy of the Forest Spider and 1 copy of the Old Forest Road": one copy of each, found and staged.
      clauses.push({ kind: "stage", codes: names.codesOf(match[1] ?? ""), perPlayer: null, count: 1 });
    } else if ((match = /^Search the encounter deck for the (\d+|an?|one) objective cards?, reveal and place them in the staging area$/i.exec(sentence))) {
      clauses.push({ kind: "searchObjectives", count: amount(match[1]) });
    } else if ((match = /^Search the encounter deck for (?:\d+ copy of )?(.+)$/i.exec(sentence))) {
      clauses.push({ kind: "search", codes: names.codesOf(match[1] ?? "") });
    } else if ((match = /^Add (.+?) to the staging area and set (.+?) aside,? out of play$/i.exec(sentence))) {
      clauses.push({ kind: "stage", codes: names.codesOf(match[1] ?? ""), perPlayer: null, count: 1 });
      clauses.push({ kind: "aside", codes: names.codesOf(match[2] ?? ""), allCopies: false });
    } else if ((match = /^(?:Also, )?place (.+?) face up but out of play, alongside the quest deck$/i.exec(sentence))) {
      clauses.push({ kind: "aside", codes: names.codesOf(match[1] ?? ""), allCopies: false });
    } else if ((match = /^(?:Then, )?shuffle the encounter deck, and attach (\d+|an?|one) encounter(?: cards?)? to each objective card$/i.exec(sentence))) {
      clauses.push({ kind: "shuffleEncounterDeck" });
      clauses.push({ kind: "attachEncounterToObjectives", count: amount(match[1]) });
    } else if ((match = /^Each player reveals (\d+|an?|one) cards? from the top of the encounter deck, and adds it to the staging area$/i.exec(sentence))) {
      clauses.push({ kind: "eachPlayerReveals", count: amount(match[1]) });
    } else if ((match = /^Put (.+?) into play$/i.exec(sentence))) {
      clauses.push({ kind: "putIntoPlay", codes: names.codesOf(match[1] ?? "") });
    } else if ((match = /^Attach (.+?) to a hero of the first player's choice$/i.exec(sentence)) ?? (match = /^The first player attaches (.+?) to one of his heroes$/i.exec(sentence))) {
      clauses.push({ kind: "attachChosen", codes: names.codesOf(match[1] ?? ""), who: "firstPlayer" });
    } else if ((match = /^Each player chooses (?:1|one) ([A-Z][a-z]+) boon attachment and attaches it to one of their heroes$/.exec(sentence))) {
      clauses.push({ kind: "eachPlayerChoosesBoon", trait: match[1] ?? "" });
    } else if ((match = /^Shuffle (.+?) into the encounter deck and add it to the Campaign Pool$/i.exec(sentence))) {
      clauses.push({ kind: "shuffleInto", codes: names.codesOf(match[1] ?? ""), into: "encounter deck", set: null });
      clauses.push({ kind: "addToCampaignPool", codes: names.codesOf(match[1] ?? "") });
    } else if ((match = /^Add (.+?) (?:and each attached [A-Z][a-z]+ )?to the Campaign Pool$/i.exec(sentence)) || (match = /^Add each copy of (.+?) in a player's hand to the Campaign Pool$/i.exec(sentence))) {
      clauses.push({ kind: "addToCampaignPool", codes: names.codesOf(match[1] ?? "") });
    } else if ((match = /^Each player adds (\d+|an?|one) cop(?:y|ies) of (.+?) to their hand after drawing their starting hand \(including taking a mulligan\)$/i.exec(sentence))) {
      clauses.push({ kind: "addToHandAfterMulligan", codes: names.codesOf(match[2] ?? ""), count: amount(match[1]) });
    } else if (/^(?:Then, )?shuffle the encounter deck$/i.test(sentence)) {
      clauses.push({ kind: "shuffleEncounterDeck" });
    } else if ((match = /^Add (.+?) to the staging area and make (.+?) the active location$/i.exec(sentence))) {
      clauses.push({ kind: "stage", codes: names.codesOf(match[1] ?? ""), perPlayer: null, count: amount(/^(\d+|an?|one) /i.exec(match[1] ?? "")?.[1]) });
      clauses.push({ kind: "active", codes: names.codesOf(match[2] ?? "") });
    } else if ((match = /^Add (.+?) and (\d+|an?|one) (.+?) per player to the staging area$/i.exec(sentence))) {
      clauses.push({ kind: "stage", codes: names.codesOf(match[1] ?? ""), perPlayer: null, count: 1 });
      clauses.push({ kind: "stage", codes: names.codesOf(match[3] ?? ""), perPlayer: amount(match[2]), count: 0 });
    } else if ((match = /^Add (.+?) to the staging area and place (\d+) damage tokens on it$/i.exec(sentence))) {
      clauses.push({ kind: "stage", codes: names.codesOf(match[1] ?? ""), perPlayer: null, count: 1 });
      clauses.push({ kind: "damageOn", codes: names.codesOf(match[1] ?? ""), amount: Number(match[2]) });
    } else if ((match = /^Add (?:the burden (?:objective|treachery) cards )?(.+?) to the staging area$/i.exec(sentence))) {
      clauses.push({ kind: "stage", codes: names.codesOf(match[1] ?? ""), perPlayer: null, count: amount(/^(\d+|an?|one) /i.exec(match[1] ?? "")?.[1]) });
    } else if ((match = /^Attach (.+?) to the Ring-bearer$/i.exec(sentence))) {
      clauses.push({ kind: "attachRingBearer", codes: names.codesOf(match[1] ?? "") });
    } else if ((match = /^Shuffle each burden card from the (.+?) burden set into a Burden deck$/i.exec(sentence))) {
      clauses.push({ kind: "shuffleInto", codes: [], into: "burden deck", set: match[1] ?? null });
    } else if ((match = /^Shuffle (?:the burden treachery cards )?(.+?) into the encounter deck$/i.exec(sentence))) {
      clauses.push({ kind: "shuffleInto", codes: names.codesOf(match[1] ?? ""), into: "encounter deck", set: null });
    } else if ((match = /^Set the Ring-bearer's life at (\d+)$/i.exec(sentence))) {
      clauses.push({ kind: "lifeSet", amount: Number(match[1]) });
    } else if ((match = /^Each player adds (\d+|an?|one) different locations? to the staging area$/i.exec(sentence))) {
      clauses.push({ kind: "eachPlayerAddsLocation", count: amount(match[1]) });
    } else if (/^Shuffle the encounter deck$/i.test(sentence)) {
      clauses.push({ kind: "shuffleEncounterDeck" });
    } else if (/^Each player may change hero cards he controls without incurring the \+1 threat penalty$/i.test(sentence)) {
      clauses.push({ kind: "waivePenalty" });
    } else if ((match = /^The players have earned the boon cards: (.+)$/i.exec(sentence))) {
      clauses.push({ kind: "earned", codes: names.codesOf(match[1] ?? "") });
    } else if ((match = /^Each player chooses one and adds it to his hand$/i.exec(sentence))) {
      clauses.push({ kind: "choose", codes: [], who: "eachPlayer", attach: false });
    } else if (/^If any of those boon cards remain unchosen, shuffle them into the first player's deck$/i.test(sentence)) {
      clauses.push({ kind: "leftoverIntoFirstPlayerDeck" });
    } else if ((match = /^Starting with the first player, each player chooses 1 of the following boon cards: (.+?), and attaches it to a hero he controls$/i.exec(sentence))) {
      clauses.push({ kind: "choose", codes: names.codesOf(match[1] ?? ""), who: "eachPlayer", attach: true });
    } else if (/^The chosen boon cards have been earned by the players$/i.test(sentence)) {
      // Said once after a choice; the choice clause above carries the earning.
    } else unread.push(sentence);
  }
  void set;
  return { clauses, unread };
}
