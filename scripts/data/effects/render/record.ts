// A record's header: its timing, trigger, limit, cost, subject and condition, then its instructions. `src/catalog/effect-schema.ts` owns the fields.
import { renderCondition } from "./conditions.ts";
import { done, isObj, jsonOf, str, type Ctx, type Obj } from "./kit.ts";
import { renderPick } from "./picks.ts";
import { barNote } from "./bars.ts";
import { renderInstruction } from "./verbs.ts";

const TIMING: Readonly<Record<string, string>> = {
  setup: "Setup",
  forced: "Forced",
  triggered: "Triggered (mandatory, not printed as Forced)",
  whenRevealed: "When revealed",
  response: "Response",
  action: "Action",
  shadow: "Shadow",
  constant: "Constant",
  questResolution: "Quest resolution",
  campaignSetup: "Campaign setup",
  resolution: "Resolution",
  travel: "Travel",
  engagement: "Engagement",
  beginningOfPhase: "Beginning of phase",
  endOfPhase: "End of phase",
  endOfRound: "End of round",
};

// Each trigger as the moment it fires, with its lead word (src/catalog/effect-schema.ts, triggerSchema, says when the engine announces it).
const TRIGGER: Readonly<Record<string, string>> = {
  questFailed: "after the players quest unsuccessfully",
  questSucceeded: "after the players quest successfully",
  enemyDestroyed: "after an enemy is destroyed",
  attacks: "when this enemy attacks, before the defender is declared",
  revealed: "after a card is revealed",
  engaged: "after an enemy engages a player",
  traveled: "after the players travel",
  leftPlay: "after a card leaves play",
  played: "after this card is played",
  enteredPlay: "after a card enters play",
  committed: "after a card is committed to the quest",
  damaged: "after a card takes damage",
  endOfPhase: "at the end of the phase",
  endOfRound: "at the end of the round",
  attackResolved: "once an enemy's attack is over (its damage and shadow effect resolved; the event names the attacking enemy and its defender)",
  attackDestroyed: "after a player's attack destroys an enemy",
  addedToStaging: "after an encounter card is added to the staging area",
  declaredDefender: "after a character is declared as a defender",
  declaredAttacker: "after a character is declared as an attacker",
  threatRaised: "after a player's threat is raised",
  beginningOfPhase: "when a phase begins",
  stagingStepBegins: "when the staging step begins, before the first card is revealed",
  becameActive: "after this location becomes the active location",
};

const LIMIT: Readonly<Record<string, string>> = {
  oncePerPhase: "once per phase",
  oncePerRound: "once per round",
  oncePerRoundEachPlayer: "once per round for each player",
  twicePerPhase: "twice per phase",
  twicePerRound: "twice per round",
  oncePerAttack: "once per attack",
  oncePerGame: "once per game",
  oncePerCampaign: "once per campaign",
};

const COSTS: Readonly<Record<string, (c: Obj) => string | null>> = {
  exhaustSelf: () => "exhaust this card",
  discardSelf: () => "discard this card",
  exhaustHost: () => "exhaust the attached card",
  raiseThreat: (c) => `raise your threat by ${str(c.amount)}`,
  damageSelf: (c) => `deal ${str(c.amount)} damage to this card`,
  returnSelfToHand: () => "return this card to hand",
  resources: (c) => `pay ${str(c.amount)} ${typeof c.sphere === "string" ? `${c.sphere} ` : ""}resource(s)${c.from === "self" ? " from this card's pool" : c.from === "host" ? " from the host's pool" : ""}`,
  playEvent: () => "pay the event's printed cost",
};

function renderCost(value: unknown, ctx: Ctx): string {
  if (Array.isArray(value)) return value.map((one) => renderCost(one, ctx)).join(" and ");
  if (!isObj(value) || typeof value.kind !== "string") return jsonOf(ctx, "cost", value);
  const said = COSTS[value.kind]?.(value);
  return said ? done(ctx, said, value, ["kind", "amount", "sphere", "from"]) : jsonOf(ctx, "cost", value);
}

function renderSubject(value: unknown, ctx: Ctx): string {
  if (value === "self") return "this card";
  if (value === "host") return "the host";
  return renderPick(value, ctx);
}

export function renderRecord(effect: Obj, ctx: Ctx): string[] {
  const timing = TIMING[str(effect.timing)] ?? str(effect.timing);
  const trigger = typeof effect.trigger === "string" ? ` ${TRIGGER[effect.trigger] ?? `on the event ${effect.trigger}`}` : "";
  const notes: string[] = [];
  if (effect.subject !== undefined) notes.push(`heard about ${renderSubject(effect.subject, ctx)}`);
  if (effect.eventSeat !== undefined) notes.push(`event happened to ${effect.eventSeat === "you" ? "the controller" : "another player"}`);
  if (typeof effect.limit === "string") notes.push(`limit ${LIMIT[effect.limit] ?? effect.limit}`);
  if (effect.cost !== undefined) notes.push(`cost: ${renderCost(effect.cost, ctx)}`);
  if (effect.anyPlayer === true) notes.push("any player may use it");
  if (effect.answeredBy === "eventSeat") notes.push("answered by the player the event happened to");
  if (effect.fromHand === true) notes.push("used from hand");
  if (effect.byEncounterDeck === true) notes.push("only when the encounter deck revealed it");
  if (isObj(effect.cancel)) notes.push(`may be canceled by paying ${str(effect.cancel.cost)}`);
  if (isObj(effect.uncancelable)) notes.push(`cannot be canceled while ${renderCondition(effect.uncancelable, ctx)}`);
  const head = done(ctx, `${timing}${trigger}${notes.length > 0 ? ` (${notes.join("; ")})` : ""}`, effect, ["id", "cardCode", "lines", "timing", "trigger", "subject", "eventSeat", "limit", "cost", "anyPlayer", "answeredBy", "fromHand", "byEncounterDeck", "cancel", "uncancelable", "condition", "instructions"]);
  const lines = [`${str(effect.id)}: ${head}`];
  if (effect.condition !== undefined) lines.push(`  only if ${renderCondition(effect.condition, ctx)}`);
  const instructions = Array.isArray(effect.instructions) ? effect.instructions : [];
  const barred = barNote(effect, ctx);
  if (barred) lines.push(`  note: ${barred}`);
  if (instructions.length === 0) lines.push("  (no instructions)");
  if (instructions.length > 1) lines.push("  (steps run in order; a step depends on an earlier one only through its own condition)");
  instructions.forEach((instruction, at) => lines.push(...renderInstruction(instruction, ctx, 1, at > 0)));
  return lines;
}
