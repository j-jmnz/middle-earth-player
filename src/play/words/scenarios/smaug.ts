// Rules: docs/brief.md (The Battle of Lake-town: the Smaug deck and Burn X, from the Quest Companion), rr.first-player, rr.damage (data/rules/entries.json); ledger lines 50201:A:1, 50202:B:2, 50205:A:2, 50210:A:1, 50210:A:2, 50221:A:2, 50214:A:2.
// The choices the Lake-town engine asks that no record holds (src/rules/families/smaug/): where the first player reveals the next Smaug, each player's turn to take Burn damage on a character (exhaust one, how much of the pool it takes, or done), and how many progress tokens stage 2B
// discards to heal Lake-town. Each sentence says the number, the side of the table and the player; the Burn rows name the player (two-handed), and a row that loses the game, or destroys the character, is armed. Pure.
import type { Instruction } from "../../../catalog/boundary.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { heldAmount } from "../../../rules/core/state.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { lakeTownDamage, lakeTownId, smaugInPlay } from "../../../rules/families/smaug/cards.ts";
import type { ReduceContext } from "../../../rules/interpret/interpret.ts";
import { pileOf } from "../../../rules/core/piles.ts";
import { damageOutcome } from "../../store/foresight.ts";

import type { ChoiceNames } from "../choice.ts";
import { seatSays } from "../seat.ts";

type Choose = Extract<Instruction, { verb: "Choose" }>;
type Burn = Extract<Instruction, { verb: "ResolveBurn" }>;

type Kind = "reveal" | "burn" | "share" | "heal";

const burnOf = (choose: Choose): Burn | null => {
  for (const option of choose.options) for (const step of option.instructions) if (step.verb === "ResolveBurn") return step;
  return null;
};

// Which of the scenario's engine-made choices a Choose is, from the instructions of its options; null for another Choose.
function kindOf(choose: Choose): Kind | null {
  const steps = choose.options.flatMap((option) => option.instructions);
  if (steps.some((step) => step.verb === "RevealSmaug")) return "reveal";
  if (steps.some((step) => step.verb === "HealLakeTownByProgress")) return "heal";
  const burn = burnOf(choose);
  if (burn == null) return null;
  return steps.some((step) => step.verb === "ResolveBurn" && step.assign != null) ? "share" : "burn";
}

/** The damage Lake-town holds and the limit it loses at (its record's `loseAtDamage`), 50 when the game does not say. */
function lakeNow(game: ScenarioState): { damage: number; limit: number } {
  const id = lakeTownId(game);
  const limit = id == null ? 0 : heldAmount(game, id, "loseAtDamage");
  return { damage: lakeTownDamage(game), limit: limit > 0 ? limit : 50 };
}

// The hit points a character can still take.
const roomOf = (game: ScenarioState, ctx: ReduceContext, id: string): number => {
  const card = game.cards[id];
  return card == null ? 0 : Math.max(0, modifiedStat(game, card, "hitPoints", ctx.cards) - card.damage);
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
    return says.say(`${plural(progress, "progress token")} would go on the quest. Discard some to remove as many damage from Lake-town (${lake.damage} of ${lake.limit}). The rest go on the quest.`);
  }
  const burn = burnOf(choose);
  const pool = burn?.pool ?? 0;
  if (kind === "share") {
    const assign = choose.options.flatMap((option) => option.instructions).find((entry) => entry.verb === "ResolveBurn" && entry.assign != null);
    const id = assign?.verb === "ResolveBurn" ? assign.assign?.id : undefined;
    const who = id ? names.card(id) : "The character";
    return says.say(`${who} is exhausted. Choose how much of the ${pool} burn damage it takes, up to the ${roomOf(game, ctx, id ?? "")} it can still take. The rest goes to the next player or onto Lake-town.`);
  }
  return says.say(`resolve burn damage: ${pool} left. Exhaust a ready character to give it some of the damage, or choose Done. What nobody takes goes on Lake-town (${lake.damage} of ${lake.limit}).`);
}

/** The row of one branch of the engine-made choices: the player named two-handed on each Burn row. Null for another Choose. */
export function smaugBranchWords(choose: Choose, optionId: string, game: ScenarioState, ctx: ReduceContext, names: ChoiceNames, seat?: number): string | null {
  const kind = kindOf(choose);
  if (kind == null) return null;
  const who = game.seatCount > 1 ? `Player ${(seat ?? seatSays(game).seat) + 1}` : null;
  const lake = lakeNow(game);
  if (kind === "reveal") return optionId === "play" ? "Reveal Smaug in the play area: he engages the first player" : "Reveal Smaug in the staging area";
  if (kind === "heal") {
    const heal = Number(optionId.slice("discard:".length));
    return heal === 0 ? "Discard none: all the progress goes on the quest" : `Discard ${plural(heal, "progress token")}: Lake-town drops to ${Math.max(0, lake.damage - heal)} of ${lake.limit}`;
  }
  const burn = burnOf(choose);
  const pool = burn?.pool ?? 0;
  if (kind === "share") {
    const step = choose.options.find((option) => option.id === optionId)?.instructions.find((entry) => entry.verb === "ResolveBurn");
    const assign = step?.verb === "ResolveBurn" ? step.assign : undefined;
    const name = assign ? names.card(assign.id) : "The character";
    return `${who ? `${who}: ` : ""}${name} takes ${assign?.amount ?? 0} of the ${pool}${assign && assign.amount >= roomOf(game, ctx, assign.id) ? ", enough to destroy it" : ""}`;
  }
  if (optionId === "done") {
    const later = choose.options.find((option) => option.id === "done")?.instructions.find((entry) => entry.verb === "ResolveBurn");
    const seats = later?.verb === "ResolveBurn" ? (later.seats ?? []) : [];
    const next = seats[0];
    const rest = next === undefined ? `the ${pool} left goes on Lake-town (${Math.min(lake.limit, lake.damage + pool)} of ${lake.limit})` : `Player ${next + 1} chooses next`;
    return `${who ? `${who} is done: ` : "Done: "}${rest}`;
  }
  const exhaust = choose.options.find((option) => option.id === optionId)?.instructions.find((entry) => entry.verb === "ResolveBurn");
  const id = exhaust?.verb === "ResolveBurn" ? exhaust.pending : undefined;
  const name = id ? names.card(id) : "a character";
  return `${who ? `${who} exhausts` : "Exhaust"} ${name}: it can take up to ${Math.min(pool, id ? roomOf(game, ctx, id) : 0)} of the ${pool}`;
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
  const ready = (step.seats ?? []).some((seat) => (game.seats[seat]?.heroes ?? []).some((id) => game.cards[id]?.exhausted === false));
  return !ready && lake.damage + pool >= lake.limit ? `Tap again: Lake-town would hold ${lake.limit} damage and the game is lost` : null;
}
