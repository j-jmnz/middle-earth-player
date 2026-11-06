// Rules: rr.engaged, rr.quest-advancement, rr.shadow-effects, rr.attacks-outside-the-combat-phase (data/rules/entries.json); ledger lines 19155:A:1, 19156:A:1, 19157:A:2, 19167:A:1, 19168:B:1, 19169:B:2, 19170:B:1.
// What the banner says of The Fate of Wilderland: where the objective stands after progress was placed on it or taken off, the resources on the card that counts them and the moment the enemy becomes engaged with each player, the card an attack discards for its Threat, the enemy that took no
// damage because he had not attacked, and the treachery that raises the staging area's Threat for the phase. The words read the records and the numbers the table holds, never a card code or a title, and they are told only in The Fate of Wilderland (`inFate`). Pure.
import type { Instruction } from "../../catalog/boundary.ts";
import { printedOf } from "../../rules/core/printed.ts";
import { inPlay, type ScenarioState } from "../../rules/core/state.ts";
import { attackedThisPhase } from "../../rules/families/wilderland/assault.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { effectsOf } from "../../rules/windows/listen.ts";

import { assaultCount, defenseFacts, inFate } from "./fate.ts";
import { plural } from "./list.ts";

/** A group of lines the banner adds: its rank among the groups, its title (empty for a continuation of the lead's lines) and its lines. */
export type FateBeat = { rank: number; title: string; lines: readonly string[] };

/** What the banner asks of the scenario's words: the groups an intent added, the line under an enemy's attack, the line under a player attack that did no damage, and the line under a revealed card. */
export type FateNames = {
  beats: (before: ScenarioState, after: ScenarioState) => readonly FateBeat[];
  strike: (state: ScenarioState, enemyId: string) => string | null;
  shielded: (before: ScenarioState, enemyId: string) => string | null;
  revealed: (after: ScenarioState, cardId: string, ahead: boolean) => string | null;
};

const named = (state: ScenarioState, ctx: ReduceContext, test: (id: string) => boolean) => Object.values(state.cards).find((card) => inPlay(card.zone) && test(card.id));

// The objective whose progress the scenario's records take off: the title a RemoveProgressFrom names, wherever it sits in a record.
function objectiveTitles(ctx: ReduceContext): string[] {
  const titles: string[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node !== null && typeof node === "object") {
      const record = node as Record<string, unknown>;
      if (record.verb === "RemoveProgressFrom" && typeof record.named === "string") titles.push(record.named);
      Object.values(record).forEach(walk);
    }
  };
  walk(ctx.effects.map((effect) => effect.instructions));
  return [...new Set(titles)];
}

/** The beats of The Fate of Wilderland an intent made: the objective's progress and what it is worth now, the resources on the card that counts them. */
export function fateBeats(ctx: ReduceContext, before: ScenarioState, after: ScenarioState): FateBeat[] {
  if (!inFate(after, ctx)) return [];
  const beats: FateBeat[] = [];
  for (const title of objectiveTitles(ctx)) {
    const was = named(before, ctx, (id) => printedOf(ctx.cards, before.cards[id]?.code ?? "").name === title);
    const now = named(after, ctx, (id) => printedOf(ctx.cards, after.cards[id]?.code ?? "").name === title);
    if (now && was && now.progress !== was.progress) beats.push({ rank: 9, title: "", lines: [assaultCount(after, ctx, title)] });
  }
  for (const card of Object.values(after.cards)) {
    const facts = inPlay(card.zone) ? defenseFacts(after, ctx, card.id) : null;
    const was = before.cards[card.id];
    if (!facts || !was || card.resources === was.resources || card.resources < was.resources) continue;
    const placed = card.resources - was.resources;
    const crossed = was.resources < facts.need && card.resources >= facts.need;
    const engaged = crossed ? ` ${facts.enemy ?? "The enemy"} is engaged with each player now.` : "";
    beats.push({ rank: 9, title: "", lines: [`${plural(placed, "resource")} on ${printedOf(ctx.cards, card.code).name}: it holds ${card.resources} of ${facts.need}.${engaged}`] });
  }
  return beats;
}

const discards = (ctx: ReduceContext, code: string): boolean => effectsOf(ctx, code).some((effect) => effect.timing === "forced" && effect.trigger === "attacks" && effect.instructions.some((step) => step.verb === "DiscardEncounterTop"));

/** The line under the attack of the enemy that discards the top card of the encounter deck and adds its printed Threat to the Attack. Null for any other enemy. */
export function fateStrikeLine(ctx: ReduceContext, state: ScenarioState, enemyId: string, name: string): string | null {
  const enemy = state.cards[enemyId];
  return enemy && inFate(state, ctx) && discards(ctx, enemy.code) ? `${name} discarded the top card of the encounter deck: its printed Threat is part of this Attack.` : null;
}

// The titles of the enemies that take no damage unless they have resolved an attack this phase (a constant record's `not attackedThisPhase`).
const shieldedTitles = (ctx: ReduceContext): string[] => ctx.effects.flatMap((effect) => (effect.condition?.kind === "not" && effect.condition.condition.kind === "attackedThisPhase" ? [effect.condition.condition.name] : []));

/** The line under a player attack that did no damage to the enemy shielded until he has attacked. Null for any other enemy, and for one that has attacked. */
export function fateShieldedLine(ctx: ReduceContext, before: ScenarioState, enemyId: string): string | null {
  const enemy = before.cards[enemyId];
  const title = enemy ? printedOf(ctx.cards, enemy.code).name : "";
  return enemy && inFate(before, ctx) && shieldedTitles(ctx).includes(title) && !attackedThisPhase(before, title, ctx) ? `${title} takes no damage until he has resolved an attack this phase.` : null;
}

// The steps of a revealed card's When Revealed record, found at any depth of a Delay.
const flat = (steps: readonly Instruction[]): Instruction[] => steps.flatMap((step) => (step.verb === "Delay" ? [step, ...flat(step.instructions)] : [step]));

/** The line under a revealed card whose When Revealed raises the Threat of the staging area for the phase and puts progress on the objective if the quest fails: what it does, and whether the quest is still to come. Null for any other card. */
export function fateRevealLine(ctx: ReduceContext, after: ScenarioState, cardId: string, ahead: boolean): string | null {
  const code = after.cards[cardId]?.code;
  if (!code || !inFate(after, ctx)) return null;
  const steps = flat(effectsOf(ctx, code).filter((effect) => effect.timing === "whenRevealed").flatMap((effect) => effect.instructions));
  const raise = steps.find((step) => step.verb === "ModifyStat" && step.stat === "threat" && step.target === "stagingCards" && step.until === "endOfPhase");
  const delay = steps.find((step) => step.verb === "Delay" && step.until === "questFailed");
  if (raise?.verb !== "ModifyStat" || typeof raise.amount !== "number") return null;
  const place = delay?.verb === "Delay" ? flat(delay.instructions).find((step) => step.verb === "PlaceProgressOn") : undefined;
  const pick = delay?.verb === "Delay" ? flat(delay.instructions).find((step) => step.verb === "Pick") : undefined;
  const objective = pick?.verb === "Pick" ? pick.pick.names?.[0] : undefined;
  const raised = `Each enemy and location in the staging area gets +${raise.amount} Threat until the end of the phase.`;
  if (!place || place.verb !== "PlaceProgressOn" || typeof place.amount !== "number" || !objective) return raised;
  return `${raised} ${ahead ? `If the players quest unsuccessfully this phase, ${objective} gets ${plural(place.amount, "progress", "progress")}.` : `The quest is already over this round, so ${objective} gets no progress from it.`}`;
}

/** The words the banner asks of The Fate of Wilderland, over the records in `ctx` and the card names `card` gives. */
export function fateNames(ctx: ReduceContext, card: (cardId: string) => string): FateNames {
  return {
    beats: (before, after) => fateBeats(ctx, before, after),
    strike: (state, enemyId) => fateStrikeLine(ctx, state, enemyId, card(enemyId)),
    shielded: (before, enemyId) => fateShieldedLine(ctx, before, enemyId),
    revealed: (after, cardId, ahead) => fateRevealLine(ctx, after, cardId, ahead),
  };
}
