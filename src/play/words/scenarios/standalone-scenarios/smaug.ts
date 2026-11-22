// Rules: docs/scenarios/standalone-scenarios.md (The Battle of Lake-town: the Smaug deck and Burn X, from the Quest Companion), rr.first-player, rr.damage (data/rules/entries.json); ledger lines 50201:A:1, 50202:B:2, 50205:A:2, 50209:A:2, 50210:A:1, 50210:A:2, 50221:A:2, 50223:A:2, 50214:A:2.
// The choices the Lake-town engine asks that no record holds (src/rules/families/smaug/): where the first player reveals the next Smaug, each player's turn to take Burn damage on a character (exhaust one, how much of the pool it takes, or done), how many progress tokens stage 2B
// discards to heal Lake-town, and how Fisherman's Dock's two active locations divide the progress. The keep row of the Shadow cancel offers (50209, 50210) is worded here too, since it says whether another player is asked next. Each sentence says the number, the side of the table and the
// player; the Burn rows name the player (two-handed), and a row that loses the game, or destroys the character, is armed. Pure.
import type { Instruction } from "../../../../catalog/boundary.ts";
import type { ScenarioState } from "../../../../rules/core/state.ts";
import { lakeTownDamage, lakeTownLimit, smaugInPlay, turnOrder } from "../../../../rules/families/smaug/cards.ts";
import { readyCharacters, room } from "../../../../rules/families/smaug/burn.ts";
import { questPointsOf } from "../../../../rules/quest/quest.ts";
import type { ReduceContext } from "../../../../rules/interpret/interpret.ts";
import { pileOf } from "../../../../rules/core/piles.ts";
import { damageOutcome } from "../../../store/foresight.ts";

import type { ChoiceNames } from "../../choice.ts";
import { seatSays } from "../../seat.ts";

type Choose = Extract<Instruction, { verb: "Choose" }>;
type Burn = Extract<Instruction, { verb: "ResolveBurn" }>;

type Kind = "reveal" | "burn" | "share" | "heal" | "split" | "offer";

const burnOf = (choose: Choose): Burn | null => {
  for (const option of choose.options) for (const step of option.instructions) if (step.verb === "ResolveBurn") return step;
  return null;
};

// Which of the scenario's engine-made choices a Choose is, from the instructions of its options; null for another Choose.
function kindOf(choose: Choose): Kind | null {
  const steps = choose.options.flatMap((option) => option.instructions);
  if (steps.some((step) => step.verb === "RevealSmaug")) return "reveal";
  if (steps.some((step) => step.verb === "HealLakeTownByProgress")) return "heal";
  if (steps.some((step) => step.verb === "SplitProgress")) return "split";
  // "Any player may discard a hero to cancel this effect" (50209:A:2, 50210:A:2): the discard row cancels, the keep row lets it go on.
  if (choose.options.length === 2 && choose.options[0]?.id === "discard" && choose.options[1]?.id === "keep" && steps.some((step) => step.verb === "CancelEffect")) return "offer";
  const burn = burnOf(choose);
  if (burn == null) return null;
  return steps.some((step) => step.verb === "ResolveBurn" && step.assign != null) ? "share" : "burn";
}

/** The damage Lake-town holds and the limit it loses at (docs/scenarios/standalone-scenarios.md, The Battle of Lake-town). */
const lakeNow = (game: ScenarioState): { damage: number; limit: number } => ({ damage: lakeTownDamage(game), limit: lakeTownLimit(game) });

// The first of `seats` the engine asks next: the one with a ready character that can still take damage (families/smaug/burn.ts skips the others), or null.
const askedNext = (game: ScenarioState, ctx: ReduceContext, seats: readonly number[]): number | null => seats.find((seat) => readyCharacters(game, seat, ctx).length > 0) ?? null;

// What a character can take: "dh1 can take 1 without being destroyed; 2 destroys it" while the pool reaches its hit points, nothing to say otherwise.
const destroysWords = (name: string, room: number, pool: number): string | null => {
  if (room > pool) return null;
  return room <= 1 ? `any damage destroys ${name}` : `${name} can take ${room - 1} without being destroyed; ${room} destroys it`;
};

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? "" : "s"}`;

/** The sentence over one of the engine-made choices, or null for another Choose. Two-handed it leads with the player. */
export function smaugChooseNote(choose: Choose, game: ScenarioState, ctx: ReduceContext, names: ChoiceNames, seat?: number): string | null {
  const kind = kindOf(choose);
  if (kind == null) return null;
  const says = seatSays(game, seat);
  const lake = lakeNow(game);
  if (kind === "reveal") {
    const smaug = smaugInPlay(game);
    const swap = smaug == null ? "" : ` The new Smaug takes all the damage on ${names.card(smaug)}.`;
    return says.say(`choose where the next Smaug is revealed, before you see it. In the play area he engages you at once; in the staging area he adds his Threat.${swap} The Smaug deck holds ${plural(pileOf(game, "smaugDeck").length, "card")}.`);
  }
  if (kind === "heal") {
    const step = choose.options.flatMap((option) => option.instructions).find((entry) => entry.verb === "HealLakeTownByProgress");
    const progress = step?.verb === "HealLakeTownByProgress" ? (step.progress ?? 0) : 0;
    return says.say(`${plural(progress, "progress token")} would go on the quest. Discard some to remove as much damage from Lake-town (${lake.damage} of ${lake.limit}). The rest go on the quest.`);
  }
  if (kind === "split") {
    const step = choose.options.flatMap((option) => option.instructions).find((entry) => entry.verb === "SplitProgress");
    const amount = step?.verb === "SplitProgress" ? (step.amount ?? 0) : 0;
    return says.say(`two locations are active. Divide the ${plural(amount, "progress token")} between them, as you choose. Each row says how many go on the first location; the rest go on the second.`);
  }
  if (kind === "offer") return says.say("any player may discard a hero to cancel this Shadow effect. Discard a hero you control, or keep your heroes.");
  const burn = burnOf(choose);
  const pool = burn?.pool ?? 0;
  if (kind === "share") {
    const assign = choose.options.flatMap((option) => option.instructions).find((entry) => entry.verb === "ResolveBurn" && entry.assign != null);
    const id = assign?.verb === "ResolveBurn" ? assign.assign?.id : undefined;
    const who = id ? names.card(id) : "The character";
    const ends = destroysWords(who, room(game, id ?? "", ctx), pool);
    return says.say(`${who} is exhausted. It must take at least 1 of the ${pool} burn damage, up to the ${room(game, id ?? "", ctx)} it can still take${ends ? ` (${ends})` : ""}. The rest goes to the next player or onto Lake-town.`);
  }
  return says.say(`resolve burn damage: ${pool} left. Exhaust a ready character to give it some of the damage, or choose Done. What nobody takes goes on Lake-town (${lake.damage} of ${lake.limit}).`);
}

/** The row of one branch of the engine-made choices: the player named two-handed on each Burn row. Null for another Choose. */
export function smaugBranchWords(choose: Choose, optionId: string, game: ScenarioState, ctx: ReduceContext, names: ChoiceNames, source?: string | null, seat?: number): string | null {
  const kind = kindOf(choose);
  if (kind == null) return null;
  const who = game.seatCount > 1 ? `Player ${(seat ?? seatSays(game).seat) + 1}` : null;
  const lake = lakeNow(game);
  if (kind === "reveal") return optionId === "play" ? "Reveal Smaug in the play area: he engages the first player" : "Reveal Smaug in the staging area";
  if (kind === "heal") {
    const heal = Number(optionId.slice("discard:".length));
    return heal === 0 ? "Discard none: all the progress goes on the quest" : `Discard ${plural(heal, "progress token")}: Lake-town drops to ${Math.max(0, lake.damage - heal)} of ${lake.limit}`;
  }
  if (kind === "split") {
    const step = choose.options.find((option) => option.id === optionId)?.instructions.find((entry) => entry.verb === "SplitProgress");
    if (step?.verb !== "SplitProgress") return null;
    const onFirst = step.onFirst ?? 0;
    const rest = (step.amount ?? 0) - onFirst;
    const place = (id: string | null, count: number): string => {
      const card = id == null ? undefined : game.cards[id];
      const points = card == null ? null : questPointsOf(game, card, ctx.cards);
      return `${count} on ${id == null ? "the location" : names.card(id)}${card != null && points != null ? ` (${card.progress + count} of ${points})` : ""}`;
    };
    return `${place(game.activeLocation, onFirst)}, ${place(game.secondActiveLocation, rest)}`;
  }
  if (kind === "offer") {
    if (optionId !== "keep") return null;
    const order = turnOrder(game);
    const next = order[order.indexOf(seat ?? seatSays(game).seat) + 1];
    if (next != null) return `Keep your heroes: Player ${next + 1} is asked next`;
    return `Keep your heroes: ${(source != null ? game.cards[source]?.code : null) === "50210" ? "all burn damage is resolved" : "the Shadow effect resolves: 1 damage to each character in play"}`;
  }
  const burn = burnOf(choose);
  const pool = burn?.pool ?? 0;
  if (kind === "share") {
    const step = choose.options.find((option) => option.id === optionId)?.instructions.find((entry) => entry.verb === "ResolveBurn");
    const assign = step?.verb === "ResolveBurn" ? step.assign : undefined;
    const name = assign ? names.card(assign.id) : "The character";
    return `${who ? `${who}: ` : ""}${name} takes ${assign?.amount ?? 0} of the ${pool}${assign && assign.amount >= room(game, assign.id, ctx) ? ", enough to destroy it" : ""}`;
  }
  if (optionId === "done") {
    const later = choose.options.find((option) => option.id === "done")?.instructions.find((entry) => entry.verb === "ResolveBurn");
    const seats = later?.verb === "ResolveBurn" ? (later.seats ?? []) : [];
    const next = pool <= 0 ? null : askedNext(game, ctx, seats);
    const rest = next == null ? `the ${pool} left goes on Lake-town (${Math.min(lake.limit, lake.damage + pool)} of ${lake.limit})` : `Player ${next + 1} chooses for the ${pool} left`;
    return `${who ? `${who} is done: ` : "Done: "}${rest}`;
  }
  const exhaust = choose.options.find((option) => option.id === optionId)?.instructions.find((entry) => entry.verb === "ResolveBurn");
  const id = exhaust?.verb === "ResolveBurn" ? exhaust.pending : undefined;
  const name = id ? names.card(id) : "a character";
  const space = id ? room(game, id, ctx) : 0;
  const ends = id ? destroysWords(name, space, pool) : null;
  return `${who ? `${who} exhausts` : "Exhaust"} ${name}: it must take at least 1, up to ${Math.min(pool, space)} of the ${pool}${ends ? `; ${ends}` : ""}`;
}

/** The warning before a row that loses the game or destroys a character: the share that destroys the character, and Done when the rest has nobody to take it and Lake-town would reach its limit. Null otherwise. */
export function smaugBranchCaution(choose: Choose, optionId: string, game: ScenarioState, ctx: ReduceContext, names: ChoiceNames): string | null {
  const kind = kindOf(choose);
  if (kind !== "share" && kind !== "burn") return null;
  const step = choose.options.find((option) => option.id === optionId)?.instructions.find((entry) => entry.verb === "ResolveBurn");
  if (step?.verb !== "ResolveBurn") return null;
  if (kind === "share" && step.assign != null) {
    const outcome = damageOutcome(game, ctx, step.assign.id, step.assign.amount);
    const name = names.card(step.assign.id);
    return outcome.loss ? `Tap again: ${name} falls and the game is lost` : outcome.destroyed ? `Tap again: ${name} is destroyed` : null;
  }
  if (optionId !== "done") return null;
  const pool = step.pool ?? 0;
  const lake = lakeNow(game);
  const asked = askedNext(game, ctx, step.seats ?? []);
  return asked == null && lake.damage + pool >= lake.limit ? `Tap again: Lake-town would hold ${lake.limit} damage and the game is lost` : null;
}
