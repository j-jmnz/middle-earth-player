import type { Card } from "../../../src/catalog/card-facts.ts";

// What a Setup line says, as data. A sentence the patterns do not read is returned in `unread`, so a new Setup
// verb fails a build loudly instead of being skipped. Names are found by matching the known card names of the
// scenario (longest first), because a name can hold commas ("Doom, Doom, Doom") or a period ("Mr. Underhill").
export type SetupClause =
  | { kind: "aside"; codes: string[]; allCopies: boolean }
  // `many`: "(2 instead if there are 3 or more players in the game)" -- that many copies from that many players on.
  | { kind: "stage"; codes: string[]; perPlayer: number | null; count: number; many?: { count: number; from: number } }
  | { kind: "active"; codes: string[] }
  | { kind: "attachRingBearer"; codes: string[] }
  | { kind: "shuffleInto"; codes: string[]; into: "encounter deck" | "burden deck" | "Corsair deck"; set: string | null }
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
  | { kind: "putIntoPlay"; codes: string[]; under?: "dreamChaser" | "anyPlayer" }
  // "Attach X to a hero of the first player's choice." / "The first player attaches X to one of his heroes."
  | { kind: "attachChosen"; codes: string[]; who: "firstPlayer" }
  // "Each player chooses 1 Adaptation boon attachment and attaches it to one of their heroes."
  | { kind: "eachPlayerChoosesBoon"; trait: string }
  // "Add each copy of X in a player's hand to the Campaign Pool." / "... and add it to the Campaign Pool."
  | { kind: "addToCampaignPool"; codes: string[] }
  // "Each player adds 1 copy of X to their hand after drawing their starting hand (including taking a mulligan)."
  | { kind: "addToHandAfterMulligan"; codes: string[]; count: number }
  | { kind: "step"; step: SetupStep; codes: string[]; to?: string[]; count?: number; many?: { count: number; from: number }; sets?: string[]; asideSets?: string[] };

// Dream-chaser (docs/plans/dream-chaser.md, phase 37): the Setup steps of its stage 1A and campaign cards. Every one is quoted from a
// ledger line (data/printed/dream-chaser.json) and names the cards (and, for the deck steps, the encounter sets) it moves; the build checks
// that each card the load list puts in a pile is placed by one of them, the engine families of phases 39 to 48 run them.
export type SetupStep =
  | "prepareCorsairDeck" // dcce.corsair-deck
  | "prepareUnchartedDeck" // dcce.uncharted-deck
  | "prepareGrottoDeck" // dcce.grotto-deck
  | "prepareIslandMap" // dcce.island-map
  | "prepareStormcallerArea" // dcce.stormcallers-area
  | "prepareFleet" // dcce.prepare-your-fleet
  | "shuffleStageTwos" // the quest deck's stage 2 cards in random order
  | "damageTrade" // "its controller may deal N damage to it to ..."
  | "threatTrade" // "raise their threat by N to attach X to a hero"
  | "addFromDeck" // locations from the top of the Uncharted or Grotto deck to the staging area
  | "takeControl" // "The first player takes control of X"
  | "attach" // "Attach X to Y"
  | "flipToCampaignSide" // "Flip the Stormcaller to its 'Campaign Mode only' side"
  | "discardAflame" // Raid on the Grey Havens: discard from the encounter deck until X Aflame locations are discarded
  | "reshuffleDiscard"
  | "chooseCopies" // "Each player may choose one copy of X and add it to their hand"
  | "plusOneX" // "For this game, X is plus 1 for each of those copies"
  | "buildDeck" // the encounter sets the encounter deck is built from
  | "secondDeck" // an encounter set set aside as an inactive second encounter deck
  | "islandMapStart" // the starting active location of the Island Map
  | "secrets" // cards placed facedown under locations
  | "searchChoice" // "Search the encounter deck for a Dol Amroth objective of your choice"
  | "putIntoPlayIfLogged" // 'If "Gavin returned," put him into play under any player's control': codes are the card the log fact is about
  | "flipCampaignCard" // "Flip this card over": the campaign card turns to its standing back
  | "resolveGuarded";

export type ParsedSetup = { clauses: SetupClause[]; unread: string[] };

// The clauses of one kind, and the cards the clauses of the given kinds name.
export function clausesOf<K extends SetupClause["kind"]>(parsed: ParsedSetup, kind: K): Extract<SetupClause, { kind: K }>[] {
  return parsed.clauses.filter((clause): clause is Extract<SetupClause, { kind: K }> => clause.kind === kind);
}
export function codesOf(parsed: ParsedSetup, kinds: readonly SetupClause["kind"][]): Set<string> {
  return new Set(parsed.clauses.flatMap((clause) => (kinds.includes(clause.kind) && "codes" in clause ? clause.codes : [])));
}

// `without` is the sentence with every card name blanked out: what is left says whether the sentence is only a list of names.
// `allCodesOf` returns every card that bears a name found in the sentence ("all copies of Galdor's Counsel": four cards of one name).
export type NameIndex = { codesOf(sentence: string): string[]; allCodesOf(sentence: string): string[]; without(sentence: string): string; aliases: ReadonlyMap<string, string> };

// A name as the matcher compares it: lowercase, accents and curly apostrophes folded ("Círdan's Blessing" is "Cirdan's Blessing" in a
// source that drops the accent). Folding keeps every character's position, so a hit's offsets index the original sentence.
const fold = (text: string): string => text.normalize("NFD").replace(/\p{M}/gu, "").replaceAll("’", "'").toLowerCase();

// Builds the name matcher from the cards a scenario can name. When two cards share a name (the burden Pursued by the
// Enemy and the quest of the same name), the one in `prefer` wins.
export function nameIndex(cards: readonly Card[], prefer: ReadonlySet<string>): NameIndex {
  const byName = new Map<string, Card>();
  const everyone = new Map<string, string[]>();
  for (const card of cards) {
    const key = fold(card.name);
    const have = byName.get(key);
    if (!have || (prefer.has(card.code) && !prefer.has(have.code))) byName.set(key, card);
    everyone.set(key, [...(everyone.get(key) ?? []), card.code]);
  }
  // A boon and a burden can bear one name (Black Key): the sentence says "Black Key (boon)", which names the boon.
  for (const card of cards) {
    if (card.campaignKind == null) continue;
    const key = `${fold(card.name)} (${card.campaignKind})`;
    if (!byName.has(key)) byName.set(key, card);
    everyone.set(key, [...(everyone.get(key) ?? []), card.code]);
  }
  const names = [...byName.keys()].sort((a, b) => b.length - a.length);
  return {
    aliases: new Map([...byName].map(([name, card]) => [name, card.code])),
    codesOf(sentence) {
      return scan(sentence).map((hit) => hit.code);
    },
    // Every card bearing the matched name itself: "Black Key (boon)" is the boon alone, "Black Key" both cards.
    allCodesOf(sentence) {
      return scan(sentence).flatMap((hit) => everyone.get(hit.name) ?? [hit.code]);
    },
    without(sentence) {
      let rest = fold(sentence);
      for (const hit of [...scan(sentence)].sort((a, b) => b.at - a.at)) rest = `${rest.slice(0, hit.at)} ${rest.slice(hit.at + hit.length)}`;
      return rest;
    },
  };
  function scan(sentence: string): { at: number; code: string; length: number; name: string }[] {
    {
      const lower = fold(sentence);
      const found: { at: number; code: string; length: number; name: string }[] = [];
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
            found.push({ at, code: byName.get(name)?.code ?? "", length: name.length, name });
          }
          from = at + 1;
        }
      }
      return found.sort((a, b) => a.at - b.at);
    }
  }
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

// Only separators and the quantity words are left once the names are blanked: "1 copy of  and  copy of ", ",  , and ".
const isNameList = (rest: string): boolean => rest.replace(/\b(?:and|an?|the|\d+|copy|copies|of)\b/g, " ").replace(/[\s,.]/g, "") === "";

// "(2 instead if there are 3 or more players in the game)", "(3 copies instead if there are 3 or 4 players in the game)",
// "(the top 3 instead if there are 3 or more players in the game)": the larger count from that many players on.
const MANY = /\s*\((?:the top )?(\d+)(?: copies)? instead if there are (\d+) or (?:more|\d+) players in the game\)/i;

const setsOf = (list: string): string[] => list.split(/,\s*(?:and\s+)?|\s+and\s+/).map((name) => name.trim()).filter((name) => name !== "");

// The Dream-chaser Setup steps (SetupStep). A sentence none of them reads returns null, and the other patterns try it. A step that
// names cards (take control, attach, a threat trade, the choices, the secrets) returns null when a name finds no card, so the sentence
// ends up unread and the scenario is not built; a name is never dropped silently.
function readDreamChaser(sentence: string, names: NameIndex): SetupClause[] | null {
  const step = (kind: SetupStep, extra: Partial<Extract<SetupClause, { kind: "step" }>> = {}): SetupClause => ({ kind: "step", step: kind, codes: names.codesOf(sentence), ...extra });
  // A card name in the sentence, "the Stormcaller" as "Stormcaller"; a phrase that is not one card's name finds none.
  const named = (phrase: string | undefined): string[] => {
    const text = (phrase ?? "").replace(/^the /i, "");
    return isNameList(names.without(text)) ? names.codesOf(text) : [];
  };
  let match: RegExpExecArray | null;
  if ((match = /^Prepare the (Corsair|Uncharted|Grotto) deck$/i.exec(sentence))) {
    const kind = { corsair: "prepareCorsairDeck", uncharted: "prepareUnchartedDeck", grotto: "prepareGrottoDeck" } as const;
    return [step(kind[(match[1] ?? "").toLowerCase() as "corsair" | "uncharted" | "grotto"], { codes: [] })];
  }
  if (/^Prepare the Island Map(?: \(see insert\))?$/i.test(sentence)) return [step("prepareIslandMap", { codes: [] })];
  if (/^Players prepare their fleet$/i.test(sentence)) return [step("prepareFleet", { codes: [] })];
  if (/^Prepare the Stormcaller['’]s area with a second quest deck consisting of only stages 2C, 3C, and 4C, as well as the Stormcaller(?: \(see insert\))?$/i.test(sentence)) {
    const codes = named("Stormcaller");
    return codes.length === 0 ? null : [step("prepareStormcallerArea", { codes })];
  }
  if (/^Shuffle each stage 2 card in the quest deck so that their order is random, leaving stage 3 on the bottom$/i.test(sentence)) return [step("shuffleStageTwos", { codes: [] })];
  if ((match = /^Each player chooses a ([A-Z][a-z]+) boon for each of their ship-objectives and attaches it to that ship-objective$/.exec(sentence))) return [{ kind: "eachPlayerChoosesBoon", trait: match[1] ?? "" }];
  if ((match = /^For each (?:ship-objective|character in play), its controller may deal (\d+) damage to it to (?:add 1 resource to a hero['’]s resource pool|reduce their threat by 1)$/i.exec(sentence))) return [step("damageTrade", { codes: [], count: Number(match[1]) })];
  if ((match = /^One player may raise their threat by (\d+) to attach (.+?) to a hero$/i.exec(sentence))) {
    const codes = named(match[2]);
    return codes.length === 0 ? null : [step("threatTrade", { codes, count: Number(match[1]) })];
  }
  if ((match = /^Shuffle (.+?) into the Corsair deck$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [{ kind: "shuffleInto", codes, into: "Corsair deck", set: null }];
  }
  if ((match = /^Add (\d+) copies of Lost Island from the top of the Uncharted deck to the staging area/i.exec(sentence))) {
    const many = MANY.exec(sentence);
    return [step("addFromDeck", { codes: [], count: Number(match[1]), ...(many ? { many: { count: Number(many[1]), from: Number(many[2]) } } : {}) })];
  }
  if ((match = /^Add the top (\d+) locations from the Grotto deck to the staging area, Grotto side faceup/i.exec(sentence))) {
    const many = MANY.exec(sentence);
    return [step("addFromDeck", { codes: [], count: Number(match[1]), ...(many ? { many: { count: Number(many[1]), from: Number(many[2]) } } : {}) })];
  }
  if ((match = /^The first player takes control of (.+?) and attaches (.+?) to him$/i.exec(sentence))) {
    const [who, what] = [named(match[1]), names.codesOf(match[2] ?? "")];
    return who.length === 0 || what.length === 0 ? null : [step("takeControl", { codes: who }), step("attach", { codes: what, to: who })];
  }
  if ((match = /^The first player takes control of (.+?), and the last player takes control of (.+?) \(objective-ally sides? faceup\)$/i.exec(sentence))) {
    const codes = [...named(match[1]), ...named(match[2])];
    return codes.length < 2 ? null : [step("takeControl", { codes })];
  }
  if ((match = /^The first player takes control of (.+)$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [step("takeControl", { codes })];
  }
  // "Attach X to <a card>": the card is any one the scenario can name (Calphon, Captain Sahír, the Raider Flagship), else another pattern reads it.
  if ((match = /^Attach (.+?) to (.+)$/i.exec(sentence)) && named(match[2]).length > 0) {
    const codes = names.codesOf(match[1] ?? "");
    return codes.length === 0 ? null : [step("attach", { codes, to: named(match[2]) })];
  }
  if ((match = /^Flip (.+?) to its ['"“”]Campaign Mode only['"“”] side, then attach (.+?) to it$/i.exec(sentence))) {
    const [flipped, attached] = [named(match[1]), names.codesOf(match[2] ?? "")];
    return flipped.length === 0 || attached.length === 0 ? null : [step("flipToCampaignSide", { codes: flipped }), step("attach", { codes: attached, to: flipped })];
  }
  if ((match = /^Put (.+?) into play under (?:the control of the player with the Dream-chaser|any player['’]s control)$/i.exec(sentence))) {
    const codes = names.codesOf(match[1] ?? "");
    return codes.length === 0 ? null : [{ kind: "putIntoPlay", codes, under: /Dream-chaser/.test(sentence) ? "dreamChaser" : "anyPlayer" }];
  }
  if (/^(?:Then, )?shuffle the encounter deck and discard cards from the top of the encounter deck until X locations with the Aflame keyword are discarded, where X is the number of players in the game$/i.test(sentence)) return [step("discardAflame", { codes: [] })];
  if (/^Then, shuffle the encounter discard pile back into the encounter deck$/i.test(sentence)) return [step("reshuffleDiscard", { codes: [] })];
  if ((match = /^(?:Each|One) player may choose (?:one|a) copy of (.+?)(?: not in the Campaign Pool)? and add it to their hand$/i.exec(sentence)) || (match = /^One player adds (.+?) to their hand$/i.exec(sentence))) {
    const codes = names.allCodesOf(match[1] ?? "");
    return codes.length === 0 ? null : [step("chooseCopies", { codes })];
  }
  if (/^For this game, X is plus 1 for (?:each of those copies|.+)$/i.test(sentence)) return [step("plusOneX", { codes: [] })];
  if ((match = /^Search the encounter deck for 1 copy of (.+?), and add it to the staging area \(\d+ copies instead if there are \d+ or more players in the game\)$/i.exec(sentence)) || (match = /^Add 1 copy of (.+?) to the staging area \(\d+ instead if there are \d+ or \d+ players in the game\)$/i.exec(sentence))) {
    const many = MANY.exec(sentence);
    return [{ kind: "stage", codes: names.codesOf(match[1] ?? ""), perPlayer: null, count: 1, ...(many ? { many: { count: Number(many[1]), from: Number(many[2]) } } : {}) }];
  }
  if ((match = /^Build the encounter deck using only (.+?) encounter sets, setting (.+?) encounter sets aside, out of play(?: \(enemy side faceup\))?$/i.exec(sentence))) {
    return [step("buildDeck", { codes: [], sets: setsOf(match[1] ?? ""), asideSets: setsOf(match[2] ?? "") })];
  }
  if ((match = /^Shuffle the (.+?) encounter sets into one encounter deck and make it the active encounter deck$/i.exec(sentence))) return [step("buildDeck", { codes: [], sets: setsOf(match[1] ?? "") })];
  if ((match = /^Set (.+?) encounter set aside, as an inactive second encounter deck$/i.exec(sentence))) return [step("secondDeck", { codes: [], asideSets: [(match[1] ?? "").trim()] })];
  if (/^Flip over the top-left and bottom-left locations of the Island Map .+ using a resource token to represent which location is active$/i.test(sentence)) return [step("islandMapStart", { codes: [] })];
  if ((match = /^Add (.+?) to the staging area and attach (.+?) to it, guarded$/i.exec(sentence))) {
    const [staged, attached] = [names.codesOf(match[1] ?? ""), names.codesOf(match[2] ?? "")];
    return staged.length === 0 || attached.length === 0 ? null : [{ kind: "stage", codes: staged, perPlayer: null, count: 1 }, step("attach", { codes: attached, to: staged })];
  }
  if ((match = /^Shuffle (.+?) together and place one facedown under each (.+?) location, as secrets$/i.exec(sentence))) {
    const codes = names.allCodesOf(match[1] ?? "");
    return codes.length === 0 ? null : [step("secrets", { codes })];
  }
  if ((match = /^If ["“]([A-Z][\p{L}'’ -]+?) returned,?["”],? put him into play under any player['’]s control$/u.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 ? null : [step("putIntoPlayIfLogged", { codes })];
  }
  if (/^Flip this card over$/i.test(sentence)) return [step("flipCampaignCard", { codes: [] })];
  if (/^Search the encounter deck for a Dol Amroth objective of your choice and add it to the staging area$/i.test(sentence)) return [step("searchChoice", { codes: [] })];
  if (/^Then, shuffle the encounter deck and resolve the Guarded keyword on that objective$/i.test(sentence)) return [step("resolveGuarded", { codes: [] }), { kind: "shuffleEncounterDeck" }];
  return null;
}

export function parseSetup(text: string, names: NameIndex, set: (name: string) => string | null = () => null): ParsedSetup {
  const clauses: SetupClause[] = [];
  const unread: string[] = [];
  const searches: { sentence: string; codes: string[] }[] = [];
  for (const raw of sentencesOf(text.replace(/^Setup:\s*/i, ""))) {
    const sentence = raw.replace(/\.$/, "");
    let match: RegExpExecArray | null;
    const dreamChaser = readDreamChaser(sentence, names);
    if (dreamChaser) {
      clauses.push(...dreamChaser);
    } else if ((match = /^Set (all copies of |each copy of )?(.+?) aside,? out of play$/i.exec(sentence))) {
      clauses.push({ kind: "aside", codes: names.codesOf(match[2] ?? ""), allCopies: match[1] !== undefined });
    } else if ((match = /^Search the encounter deck for (?:\d+ )?(?:cop(?:y|ies) of )?(.+?),? and add them to the staging area$/i.exec(sentence)) && /\bcopy of\b/i.test(sentence)) {
      // "1 copy of the Forest Spider and 1 copy of the Old Forest Road": one copy of each, found and staged.
      clauses.push({ kind: "stage", codes: names.codesOf(match[1] ?? ""), perPlayer: null, count: 1 });
    } else if ((match = /^Search the encounter deck for the (\d+|an?|one) objective cards?, reveal and place them in the staging area$/i.exec(sentence))) {
      clauses.push({ kind: "searchObjectives", count: amount(match[1]) });
    } else if ((match = /^Search the encounter deck for (.+)$/i.exec(sentence)) && isNameList(names.without(match[1] ?? ""))) {
      // A bare list of names ("1 copy of X and Y", "X, Y, and Z"); a longer sentence is unread.
      searches.push({ sentence, codes: names.codesOf(match[1] ?? "") });
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
  // "Search the encounter deck for X" only finds a card: a later clause must place every card it finds, else the sentence is
  // reported unread and the scenario stays unbuilt.
  const placing = new Set<SetupClause["kind"]>(["stage", "aside", "active", "attachChosen", "attachRingBearer", "putIntoPlay", "shuffleInto", "choose", "addToCampaignPool"]);
  const placed = new Set(clauses.flatMap((clause) => (placing.has(clause.kind) && "codes" in clause ? clause.codes : [])));
  for (const search of searches) if (search.codes.length === 0 || search.codes.some((code) => !placed.has(code))) unread.push(search.sentence);
  return { clauses, unread };
}
