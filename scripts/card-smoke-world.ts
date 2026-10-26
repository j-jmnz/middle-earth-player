import type { Card } from "../src/catalog/card-facts.ts";
import type { Effect } from "../src/catalog/boundary.ts";
import { EFFECTS } from "../src/effects/index.ts";
import { expectOk } from "../src/rules/fixture.ts";
import { hasResourceMatch } from "../src/rules/payments.ts";
import { printedOf, type Sphere } from "../src/rules/printed.ts";
import { legalTargets, reduce, startScenario, type ReduceContext, type ScenarioState } from "../src/rules/reduce.ts";
import { updateCard } from "../src/rules/state.ts";
import { spawn } from "../src/rules/zones.ts";

import { nextIntent, type PolicyOptions } from "./auto-player.ts";
import { loadCards } from "./data/load-cards.ts";
import { RING_BEARER, starterStart, starterWorld } from "./starter-game.ts";
import { loadPrinted } from "./test-catalog.ts";

// Test helper for scripts/card-smoke.ts: the table a card is smoked on. One seeded Stealth and Steadfastness game played to
// its first planning phase, built once, and the heroes the harness adds so the card can be played: one whose sphere pays
// for it, and one an attachment that names a trait, a name or a sphere can go on.

export const SMOKE_DECK = "stealth-and-steadfastness";
// The deal. The auto-player loses every starter game; on this seed it lasts longest (6 rounds, 128 steps, on 2026-10-26).
export const SMOKE_SEED = 34;
export const POLICY: PolicyOptions = { scout: "", prefer: "141035", protect: RING_BEARER, play: true, act: true };
const PLAYER_TYPES = new Set(["hero", "ally", "attachment", "event", "player-side-quest", "contract"]);
// The resources each hero holds when a copy is put in the hand (at least the card's cost).
const RESOURCES = 5;
// A hero added when none of Frodo, Sam and Merry can pay the card's sphere. Their text has no record (2026-10-26).
const PAYERS: Partial<Record<Sphere, string>> = { spirit: "01008", lore: "01012", baggins: "131001" };

export type SmokeWorld = {
  ctx: ReduceContext;
  planning: ScenarioState;
  // Attachment code to the hero added when no character on the table can take it.
  hosts: ReadonlyMap<string, string>;
};

/** Every player card (hero, ally, attachment, event) that has at least one effect record. */
export function smokeCodes(effects: readonly Effect[] = EFFECTS): string[] {
  const recorded = new Set(effects.map((effect) => effect.cardCode));
  return loadCards()
    .filter((card) => recorded.has(card.code) && PLAYER_TYPES.has(card.type))
    .map((card) => card.code);
}

// The first deck-legal hero an attachment's AttachesTo record accepts, one with no record of its own when there is one.
function hostHero(code: string, cards: readonly Card[], recorded: ReadonlySet<string>): string | null {
  const rule = EFFECTS.flatMap((effect) => (effect.cardCode === code ? effect.instructions : [])).find((instruction) => instruction.verb === "AttachesTo");
  if (rule?.verb !== "AttachesTo") return null;
  // A host filter list: the first filter's trait, name or sphere stands for it.
  const filter = rule.hosts?.[0];
  if (filter && filter.type !== "hero" && filter.type !== "character") return null;
  if (!filter && rule.host && rule.host.kind !== "hero" && rule.host.kind !== "character") return null;
  const trait = filter ? (filter.trait ?? filter.traits?.[0]) : rule.host?.trait;
  const name = filter ? filter.names?.[0] : rule.host?.name;
  const sphere = filter ? (filter.sphere ?? filter.spheres?.[0]) : rule.host?.sphere;
  if (!trait && !name && !sphere) return null;
  const fits = cards.filter((card) => card.type === "hero" && card.deckLegal && (!trait || card.traits.includes(trait)) && (!name || card.name === name) && (!sphere || card.sphere === sphere));
  return (fits.find((card) => !recorded.has(card.code)) ?? fits[0])?.code ?? null;
}

/** The printed cards for these codes and the starter game, dealt on `deal`, at its first planning phase. Build it once. */
export async function smokeWorld(codes: readonly string[], deal = SMOKE_SEED): Promise<SmokeWorld> {
  const all = loadCards();
  const recorded = new Set(EFFECTS.map((effect) => effect.cardCode));
  const hosts = new Map(codes.flatMap((code) => {
    const host = hostHero(code, all, recorded);
    return host ? [[code, host] as const] : [];
  }));
  const { cards: base } = await starterWorld(SMOKE_DECK);
  const extra = [...new Set([...codes, ...Object.values(PAYERS), ...hosts.values()])].filter((code) => !base.has(code));
  const ctx: ReduceContext = { effects: EFFECTS, cards: new Map([...base, ...(await loadPrinted(extra))]) };
  let state = expectOk(reduce(startScenario(starterStart(SMOKE_DECK, deal), ctx), { type: "Keep" }, ctx)).state;
  for (let turn = 0; turn < 400 && state.mode !== "planning"; turn += 1) state = expectOk(reduce(state, nextIntent(state, ctx, POLICY), ctx)).state;
  if (state.mode !== "planning") throw new Error("The starter game did not reach the planning phase");
  return { ctx, planning: state, hosts };
}

function topUp(state: ScenarioState, ctx: ReduceContext, code: string): ScenarioState {
  const amount = Math.max(RESOURCES, printedOf(ctx.cards, code).cost ?? 0);
  return state.seats[0].heroes.reduce((next, id) => updateCard(next, id, { resources: Math.max(next.cards[id]?.resources ?? 0, amount) }), state);
}

/**
 * A new copy of the card in the first seat's hand, with resources to pay for it, a hero that can pay its sphere and, for an
 * attachment no character can take, a hero it can go on. `added` collects the codes of the heroes added.
 */
export function handCopy(world: SmokeWorld, state: ScenarioState, code: string, added: string[]): { state: ScenarioState; id: string } {
  const { ctx } = world;
  const spawned = spawn(state, code, { zone: "hand", seat: 0 });
  let next = spawned.state;
  const sphere = printedOf(ctx.cards, code).sphere;
  const payer = sphere ? PAYERS[sphere] : undefined;
  if (payer && !hasResourceMatch(next, 0, sphere, ctx, spawned.id)) {
    next = spawn(next, payer, { zone: "heroes", seat: 0 }).state;
    added.push(payer);
  }
  const host = world.hosts.get(code);
  if (host && legalTargets(next, { type: "PlayCard", cardId: spawned.id }, ctx).length === 0) {
    next = spawn(next, host, { zone: "heroes", seat: 0 }).state;
    added.push(host);
  }
  return { state: topUp(next, ctx, code), id: spawned.id };
}
