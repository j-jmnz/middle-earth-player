import { namedBy, stepWith } from "./setup-names.ts";
import type { NameIndex, SetupClause } from "./setup-text.ts";

// Rules: sotm.setup-a-journey-to-rhosgobel, sotm.setup-the-hills-of-emyn-muil, sotm.setup-the-dead-marshes, sotm.setup-return-to-mirkwood, sotm.guarding-gollum (data/rules/entries.json).
// The sentences of the six Adventure Packs' stage 1A cards that the other readers do not read. The rulesheets print the encounter sets and the special rules, not the Setup, so the
// quest card's own Setup line is what the load list's piles are checked against (docs/brief.md, Data sources). Each pattern is quoted from a Setup line, names the cards it moves, and
// returns null for a sentence it does not read (or whose card names find no card), so the scenario stays unbuilt and a name is never dropped silently. "Search the encounter deck for X, and
// add it to the staging area" finds X and stages it in one sentence; the bare "Search the encounter deck for X" and "Add X to the staging area" are read by setup-text.ts.
export function readShadowsOfMirkwood(sentence: string, names: NameIndex): SetupClause[] | null {
  const named = namedBy(names);
  let match: RegExpExecArray | null;

  // The Hunt for Gollum, The Dead Marshes, Return to Mirkwood: "Reveal 1 card per player from the encounter deck, and add it to the staging area"; the Marshes shuffle first ("Shuffle the encounter deck, then reveal ...").
  if ((match = /^(?:Shuffle the encounter deck, then r|R)eveal (\d+|an?|one) cards? per player from the encounter deck,? and add it to the staging area$/i.exec(sentence))) {
    const count = /^\d+$/.test(match[1] ?? "") ? Number(match[1]) : 1;
    return [...(/^Shuffle/i.test(sentence) ? [{ kind: "shuffleEncounterDeck" } as const] : []), { kind: "eachPlayerReveals", count }];
  }

  // A Journey to Rhosgobel, The Hills of Emyn Muil, The Dead Marshes: "Search the encounter deck for X and Y, and add them to the staging area" (Rhosgobel: "with 2 damage tokens on Wilyador").
  if (!/\bcop(?:y|ies) of\b/i.test(sentence) && (match = /^Search the encounter deck for (.+?),? and add (?:it|them) to the staging area(?: with (\d+) damage tokens? on (.+))?$/i.exec(sentence))) {
    const codes = named(match[1]);
    if (codes.length === 0) return null;
    const damaged = match[3] === undefined ? [] : named(match[3]);
    if (match[3] !== undefined && damaged.length === 0) return null;
    return [{ kind: "search", codes }, { kind: "stage", codes, perPlayer: null, count: 1 }, ...(match[2] === undefined ? [] : [{ kind: "damageOn", codes: damaged, amount: Number(match[2]) } as const])];
  }

  // Conflict at the Carrock: the four unique Trolls and four 'Sacked!' are set aside, and one 'Sacked!' per player is shuffled back.
  if ((match = /^Remove (\d+) unique Troll cards and (\d+) copies of the 'Sacked!' card from the encounter deck and set them aside, out of play$/i.exec(sentence))) {
    const trolls = names.cards.filter((card) => card.isUnique && card.type === "enemy" && card.traits.includes("Troll")).map((card) => card.code);
    const sacked = named("Sacked!");
    return trolls.length !== Number(match[1]) || sacked.length === 0 ? null : [{ kind: "aside", codes: [...trolls, ...sacked], allCopies: false }];
  }
  if ((match = /^Then,? shuffle (\d+) 'Sacked!' cards? per player back into the encounter deck$/i.exec(sentence))) {
    const codes = named("Sacked!");
    return codes.length === 0 ? null : [stepWith(codes)("shuffleAsideBack", { count: Number(match[1]), players: true })];
  }

  // The Hills of Emyn Muil, Return to Mirkwood: the deck is shuffled with no comma after "Then".
  if (/^Then shuffle the encounter deck$/i.test(sentence)) return [{ kind: "shuffleEncounterDeck" }];

  // Return to Mirkwood: Gollum is a guarded objective, in front of the player the players choose.
  if ((match = /^Choose a player to guard (.+?) at the start of the game, and place (.+?) in front of that player$/i.exec(sentence))) {
    const codes = named(match[1]);
    return codes.length === 0 || named(match[2]).join() !== codes.join() ? null : [{ kind: "putIntoPlay", codes, under: "guardian" }];
  }
  return null;
}
