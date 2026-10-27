import type { Card } from "../../../src/catalog/card-facts.ts";
import type { RawData } from "./load-raw.ts";
import type { SetupClause } from "./setup-text.ts";

// A difficulty's piles: "<code>\0<pile>" -> copies, the cards the player decks hold, and the campaign cards.
export type Loaded = { placements: Map<string, number>; player: string[]; campaign: Set<string> };

// A box with no DragnCards load list: Hall of Beorn's counts put every card in the encounter deck, and the quest card's
// printed Setup (read from the ledger) moves cards out of it: staged, set aside, searched for. A move the deck cannot make
// is a problem, never a silent shortfall.
export function pilesFromSetup(args: {
  id: string;
  difficulty: "Normal" | "Easy";
  hob: RawData["scenarios"][number];
  stages: readonly string[];
  bySlug: ReadonlyMap<string, Card>;
  byCode: ReadonlyMap<string, Card>;
  clauses: readonly SetupClause[];
  nameOf: (code: string) => string;
  problems: string[];
}): Loaded {
  const { id, difficulty, hob, stages, bySlug, byCode, clauses, nameOf, problems } = args;
  const placements = new Map<string, number>();
  const add = (code: string, pile: string, count: number) => placements.set(`${code}\u0000${pile}`, (placements.get(`${code}\u0000${pile}`) ?? 0) + count);
  for (const code of stages) add(code, "quest", 1);
  for (const item of hob.ScenarioCards) {
    const card = bySlug.get(item.Slug);
    if (!card || /\(Campaign\)$/.test(item.Title) || /Nightmare$/.test(item.EncounterSet ?? "")) continue;
    // Boons, burdens and the campaign card are dealt by the campaign card's records, not by the load list.
    if (card.type === "campaign" || card.campaignKind != null) continue;
    const count = difficulty === "Normal" ? item.NormalQuantity : item.EasyQuantity;
    if (count > 0) add(card.code, "encounter", count);
  }
  const move = (code: string, pile: string, wanted: number | "all") => {
    const have = placements.get(`${code}\u0000encounter`) ?? 0;
    const take = wanted === "all" ? have : Math.min(wanted, have);
    if (take === 0 || (wanted !== "all" && take < wanted)) problems.push(`${id}: Setup takes ${nameOf(code)} from the ${difficulty} encounter deck, which has ${have}`);
    if (take === 0) return;
    if (take === have) placements.delete(`${code}\u0000encounter`);
    else placements.set(`${code}\u0000encounter`, have - take);
    add(code, pile, take);
  };
  for (const clause of clauses) {
    if (clause.kind === "stage") for (const code of clause.codes) move(code, "staging", clause.count);
    else if (clause.kind === "aside") for (const code of clause.codes) move(code, "setAside", clause.allCopies ? "all" : 1);
    else if (clause.kind === "active") for (const code of clause.codes) move(code, "activeLocation", 1);
    else if (clause.kind === "attachChosen") for (const code of clause.codes) move(code, "attachedChosen", 1);
    else if (clause.kind === "searchObjectives") {
      const objectives = [...placements.keys()].map((key) => key.split("\u0000")[0] ?? "").filter((code) => byCode.get(code)?.type === "objective" && placements.has(`${code}\u0000encounter`));
      if (objectives.length !== clause.count) problems.push(`${id}: Setup searches for ${clause.count} objective cards, the ${difficulty} encounter deck has ${objectives.length}`);
      for (const code of objectives) move(code, "staging", 1);
    }
  }
  return { placements, player: [], campaign: new Set<string>() };
}
