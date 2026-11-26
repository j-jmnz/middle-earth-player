// A record's header: its timing, trigger, limit, cost, subject and condition, then its instructions. `src/catalog/effect-schema.ts` owns the fields.
import { travelNote } from "./travel-note.ts";
import { renderCondition } from "./conditions.ts";
import { done, isObj, jsonOf, str, type Ctx, type Obj } from "./kit.ts";
import { renderPick } from "./picks.ts";
import { actorNote } from "./actor.ts";
import { barNote } from "./bars.ts";
import { renderInstruction } from "./verbs.ts";

// A printed line that is a keyword and its reminder in brackets: "Battle. (Characters quest using Attack instead of Willpower.)", "Doomed 3. (...)".
const KEYWORD_REMINDER = /^[A-Z][A-Za-z' -]*?(?: [0-9X]+)?\.\s*\(.*\)\.?$/;

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

// Events that name one card: a record with no subject hears them only when they are about its own card (src/rules/windows/listen.ts, hears).
const ABOUT_ONE_CARD: ReadonlySet<string> = new Set(["questDefeated", "lastTimeCounterRemoved", "flipped", "leftPlay", "traveled"]);

// Each trigger as the moment it fires, with its lead word (src/catalog/effect-schema.ts, triggerSchema, says when the engine announces it).
const TRIGGER: Readonly<Record<string, string>> = {
  questFailed: "after the players quest unsuccessfully",
  questDefeated: "after a side quest is defeated (its progress reached its quest points)",
  lastTimeCounterRemoved: "after the last time counter is removed from a card, at the end of the refresh phase or by a card effect",
  timeCounterRemoved: "after a time counter is removed from the current quest, at the end of the refresh phase or by a card effect",
  flipped: "after a card is flipped over (the FlipCard verb)",
  questSucceeded: "after the players quest successfully",
  enemyDestroyed: "after an enemy is destroyed",
  attacks: "when this enemy attacks, before the defender is declared",
  revealed: "after a card is revealed",
  engaged: "after an enemy engages a player (by an engagement check, or put into play engaged or moved to a player by an effect)",
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
  lost: "when the \"Lost:\" effects are triggered (only a card effect triggers them; each faceup card in play with a Lost line hears it, a shadow card does not)",
  progressWouldBePlaced: "before progress is placed on this location (the whole placement, the effect's X, waits for this effect)",
  progressPlacedOnSelf: "after progress is placed on this card, the placement that explores it included (X is the amount placed; the card may have left play)",
  questProgressPlacedOnStage: "once, after a quest that succeeded has placed progress on the stage itself",
  escapeFailed: "after an escape test that this card's own effect made is failed (no other card hears it; the event happened to the player who made the test)",
  burgleFailed: "after the first player's burgle attempt fails (every card in play hears it)",
  escapePassed: "after an escape test that this card's own effect made is passed (no other card hears it; the event happened to the player who made the test)",
  attackUndefended: "after an enemy attack on a player has dealt its damage with no defender declared (any enemy attack, whatever its damage; the event happened to the defending player)",
  controlLost: "after a player loses control of a location (it left his play area for any reason; the event happened to that player, about that location)",
  questProgressPlaced: "once, after a quest that succeeded has placed progress (on the active location, on a location that takes it first or on the stage)",
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
  raiseThreat: (c) => (c.each === true ? `raise each player's threat by ${str(c.amount)}` : `raise your threat by ${str(c.amount)}`),
  damageSelf: (c) => `deal ${str(c.amount)} damage to this card`,
  returnSelfToHand: () => "return this card to hand",
  resources: (c) => `pay ${str(c.amount)} ${typeof c.sphere === "string" ? `${c.sphere} ` : ""}resource(s)${c.from === "self" ? " from this card's pool" : c.from === "host" ? " from the host's pool" : ""}`,
  playEvent: () => "pay the event's printed cost",
  addSelfToVictory: () => "add this card to the victory display (payable too from its owner's discard pile, when its host just left play)",
  exhaustCode: (c) => `exhaust the card in play with code ${str(c.code)} that the acting player controls`,
  exhaustNamed: (c) => `exhaust the card titled ${str(c.name)} in play that the acting player controls`,
  discardDeckTop: (c) => `discard the top ${str(c.amount)} card(s) of your deck`,
};

export function renderCost(value: unknown, ctx: Ctx): string {
  if (Array.isArray(value)) return value.map((one) => renderCost(one, ctx)).join(" and ");
  if (!isObj(value) || typeof value.kind !== "string") return jsonOf(ctx, "cost", value);
  const said = COSTS[value.kind]?.(value);
  return said ? done(ctx, said, value, ["kind", "amount", "sphere", "from", "code", "name", "each"]) : jsonOf(ctx, "cost", value);
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
  else if (typeof effect.trigger === "string" && ABOUT_ONE_CARD.has(effect.trigger)) notes.push("heard about this card only: with no subject, an event about one card is heard by that card alone");
  if (effect.eventSeat !== undefined) notes.push(`event happened to ${effect.eventSeat === "you" ? "the controller" : "another player"}`);
  if (typeof effect.limit === "string") notes.push(`limit ${LIMIT[effect.limit] ?? effect.limit}`);
  if (effect.cost !== undefined) notes.push(`cost: ${renderCost(effect.cost, ctx)}`);
  if (effect.anyPlayer === true) notes.push("any player may use it");
  if (effect.answeredBy === "eventSeat") notes.push("answered by the player the event happened to");
  if (effect.answeredBy === "guardian") notes.push("answered by the player guarding Gollum");
  if (effect.fromHand === true) notes.push("used from hand");
  if (effect.fromVictory === true) notes.push("used from the victory display");
  if (effect.byEncounterDeck === true) notes.push("only when the encounter deck revealed it");
  if (effect.notFromDiscard === true) notes.push("not for a card found in the encounter discard pile");
  if (effect.byPlay === true) notes.push("only when a player played the attachment");
  if (effect.early === true) notes.push("resolves before the other Forced effects of the moment");
  if (isObj(effect.cancel)) notes.push(`may be canceled by paying ${str(effect.cancel.cost)}`);
  if (isObj(effect.uncancelable)) notes.push(`cannot be canceled while ${renderCondition(effect.uncancelable, ctx)}`);
  const head = done(ctx, `${timing}${trigger}${notes.length > 0 ? ` (${notes.join("; ")})` : ""}`, effect, ["id", "cardCode", "lines", "timing", "trigger", "subject", "eventSeat", "limit", "cost", "anyPlayer", "answeredBy", "fromHand", "fromVictory", "byEncounterDeck", "notFromDiscard", "byPlay", "early", "cancel", "uncancelable", "condition", "instructions"]);
  const lines = [`${str(effect.id)}: ${head}`];
  if (effect.condition !== undefined) lines.push(`  only if ${renderCondition(effect.condition, ctx)}`);
  const instructions = Array.isArray(effect.instructions) ? effect.instructions : [];
  const actor = actorNote(effect, ctx);
  if (actor && instructions.length > 0) lines.push(`  who acts: ${actor}`);
  const barred = barNote(effect, ctx);
  if (barred) lines.push(`  note: ${barred}`);
  const travel = travelNote(effect, ctx);
  if (travel) lines.push(`  note: ${travel}`);
  // The last stage's win is the engine's own rule, not a record's: a constant on its side B that runs nothing only names the printed line.
  const winsOnDefeat = ctx.finalStage === true && effect.timing === "constant" && Array.isArray(effect.lines) && effect.lines.every((id) => typeof id === "string" && id.includes(":B:"));
  // On the last stage, a constant that runs nothing and names only printed keyword lines with their reminder text ("Siege. (Characters quest using Defense instead of Willpower.)") is the keyword's reminder, not the stage's defeat.
  const keywordReminder = ctx.finalStage === true && effect.timing === "constant" && Array.isArray(effect.lines) && effect.lines.length > 0 && effect.lines.every((id) => typeof id === "string" && KEYWORD_REMINDER.test(ctx.lineTexts?.get(id) ?? ""));
  if (instructions.length === 0 && keywordReminder) lines.push("  (no instructions: the record only names the printed keyword reminder; the keyword is the card's own and the engine reads it from the card)");
  else if (instructions.length === 0) lines.push(winsOnDefeat ? "  (no instructions: this is the quest's last stage, so when the players defeat it no stage follows and the engine ends the game as a win by its own rule)" : "  (no instructions: the record only names the printed line, and the engine runs no step for it)");
  // A final stage whose printed line also says "If the players defeat this stage, they win the game" has the same win, beside the record's own instructions (a Restrict that holds the defeat).
  const printedWin = ctx.finalStage === true && effect.timing === "constant" && instructions.length > 0 && Array.isArray(effect.lines) && effect.lines.some((id) => typeof id === "string" && /they win the game/i.test(ctx.lineTexts?.get(id) ?? ""));
  if (printedWin) lines.push("  note: this is the quest's last stage, so when the players defeat it no stage follows and the engine ends the game as a win by its own rule");
  if (instructions.length > 1) lines.push("  (steps run in order; a step depends on an earlier one only through its own condition)");
  const inner = { ...ctx, timing: typeof effect.timing === "string" ? effect.timing : undefined, ...(effect.trigger === "engaged" ? { engagedSeat: true } : {}) };
  instructions.forEach((instruction, at) => lines.push(...renderInstruction(instruction, inner, 1, at > 0)));
  return lines;
}
