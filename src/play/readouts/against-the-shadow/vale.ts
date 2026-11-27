// Rules: ats.captain-enemies, ats.setup-the-morgul-vale, ats.setup-the-morgul-vale-to-the-tower, rr.cannot, rr.destroy, rr.damage, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 06144:A:1, 06144:B:1, 06145:B:1, 06146:B:2, 06146:B:3, 06147:A:1, 06147:A:2, 06147:A:3, 06148:A:1, 06148:A:2, 06151:A:1, 06152:A:1, 06152:A:2, 06153:A:1, 06153:A:2, 06156:A:1.
//
// The pieces The Morgul Vale's cards hold on the table: the To the Tower dial (its tokens against the 10 that lose the game, warming from 7), the lines of the three stages and the Captain each needs destroyed, the previews of the Captains, the Morgul Bodyguard, To the Tower and The White Bridge, the attack
// sheets' lines (the damage a Bodyguard takes in a Captain's place, the Nazgûl's cut, Murzag's reveal, an immediate attack) and the refusals that a Captain or the Nazgûl gives a player card. Every hook keys on this scenario's id and is empty in another. The engine decided every number; nothing here changes
// one. Pure, so a test reads it.
import { flagged, inPlay, type CardInstance, type ScenarioState } from "../../../rules/core/state.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { attachmentHostIds } from "../../../rules/player/attach.ts";
import { playWindowReason } from "../../../rules/player/planning.ts";
import { bodyguardTarget } from "../../../rules/families/pelargir/vale/bodyguard.ts";

import {
  additionalAttackWords,
  alcaronAttackWords,
  alcaronWords,
  bodyguardWords,
  bridgeTravelWords,
  bridgeWords,
  CAPTAIN_REFUSAL,
  captainWhere,
  captainWords,
  murzagAttackWords,
  murzagWords,
  NAZGUL_REFUSAL,
  NAZGUL_SHEET,
  nazgulWords,
  SHIELD_WORD,
  shieldMarkWords,
  shieldReadout,
  shieldWords,
  stageLines,
  stageWinWords,
  switchedAttackWords,
  towerDialName,
  towerLimitWords,
  TOWER_CRITICAL,
  TOWER_LIMIT,
  TOWER_NEAR,
  towerNote,
  towerWarn,
  towerWords,
} from "../../words/scenarios/against-the-shadow/vale.ts";
import type { TableDial } from "../dials.ts";

const SCENARIO = "the-morgul-vale";
const TOWER = "06147";
const BODYGUARD = "06148";
const BRIDGE = "06156";
const MURZAG = "06151";
const ALCARON = "06152";
const NAZGUL = "06153";
// Each stage and the Captain whose destruction ends it, in the order of the quest deck.
const STAGES: Readonly<Record<string, { at: number; captain: string }>> = { "06144": { at: 1, captain: MURZAG }, "06145": { at: 2, captain: ALCARON }, "06146": { at: 3, captain: NAZGUL } };
const CAPTAINS: ReadonlyMap<string, number> = new Map([[MURZAG, 1], [ALCARON, 2], [NAZGUL, 3]]);

/** Whether the game is The Morgul Vale: every hook below keys on it. */
export const live = (game: ScenarioState): boolean => game.scenarioId === SCENARIO;

const named = (ctx: ReduceContext, card: CardInstance): string => printedOf(ctx.cards, card.code).name;
const cardOf = (game: ScenarioState, code: string, zones: readonly string[]): CardInstance | undefined => Object.values(game.cards).find((card) => card.code === code && zones.includes(card.zone));
const PLAY = ["staging", "engaged", "activeLocation", "secondActiveLocation"] as const;

/** To the Tower in the staging area, where its own line keeps it: undefined in another scenario and before it is dealt. */
const towerOf = (game: ScenarioState): CardInstance | undefined => (live(game) ? cardOf(game, TOWER, ["staging"]) : undefined);

/** The progress tokens on To the Tower, or 0. */
export const towerTokens = (game: ScenarioState): number => towerOf(game)?.progress ?? 0;

const bodyguardsIn = (game: ScenarioState): CardInstance[] => Object.values(game.cards).filter((card) => card.code === BODYGUARD && inPlay(card.zone));

// The seat a Captain is engaged with, or null.
const engagedSeat = (game: ScenarioState, id: string): number | null => {
  const seat = game.seats.findIndex((entry, at) => at < game.seatCount && entry.engaged.includes(id));
  return seat < 0 ? null : seat;
};

/** The To the Tower dial: its tokens against the 10 that lose the game, warm from 7, critical at 9 (06147:A:3). A tap shows the card. None before To the Tower is in the staging area. */
export function valeDials(game: ScenarioState): readonly TableDial[] {
  const tower = towerOf(game);
  if (!tower) return [];
  const count = tower.progress;
  const bridge = cardOf(game, BRIDGE, PLAY) != null;
  const warn = count >= TOWER_NEAR ? { level: count >= TOWER_CRITICAL ? ("critical" as const) : ("near" as const), words: towerWarn(count) } : undefined;
  return [
    {
      id: "tower",
      testID: "vale-tower",
      label: "Tower",
      name: towerDialName(count),
      value: count,
      limit: TOWER_LIMIT,
      warms: true,
      word: `${count}/${TOWER_LIMIT}`,
      icon: "progress" as const,
      cardId: tower.id,
      note: `${towerNote(count)}${bridge ? ` The White Bridge has Threat ${count} and quest points ${count}.` : ""}`,
      limitWords: towerLimitWords,
      ...(warn ? { warn } : {}),
    },
  ];
}

/** The win line of the current stage, in place of the quest points it does not print: the Captain to destroy. Null for another stage and scenario. */
export function valeWin(game: ScenarioState, ctx: ReduceContext): string | null {
  const stage = live(game) && game.questStage ? game.cards[game.questStage] : undefined;
  const entry = stage ? STAGES[stage.code] : undefined;
  return entry ? stageWinWords(printedOf(ctx.cards, entry.captain).name, entry.at === 3) : null;
}

/** The lines the current stage adds to its preview and to the screen that tells the advance to it, after its win line: where its Captain is, that no progress advances it, the Bodyguards and the loss. Empty for another stage and scenario. */
export function valeStageLines(game: ScenarioState, ctx: ReduceContext, code: string): string[] {
  const stage = live(game) && game.questStage ? game.cards[game.questStage] : undefined;
  const entry = STAGES[code];
  if (!stage || stage.code !== code || !entry) return [];
  const captain = cardOf(game, entry.captain, ["staging", "engaged"]);
  const seat = captain ? engagedSeat(game, captain.id) : null;
  const where = captainWhere(printedOf(ctx.cards, entry.captain).name, captain ? (captain.zone === "engaged" ? { zone: "engaged", ...(seat != null ? { seat } : {}) } : { zone: "staging" }) : null, game.seatCount);
  // Faramir is taken out at Setup: the first screen of the game says so, once.
  const removed = entry.at === 1 && game.round <= 1 ? Object.values(game.cards).filter((card) => card.zone === "removed" && printedOf(ctx.cards, card.code).name === "Faramir").length : 0;
  return stageLines({ where, last: entry.at === 3, bodyguards: bodyguardsIn(game).length, count: towerTokens(game), faramir: removed });
}

/** The card preview's muted line for a card of this scenario: a Captain's stay in play and what he does, the Bodyguard, To the Tower, The White Bridge. Null for any other card. */
export function valeDetail(game: ScenarioState, ctx: ReduceContext, cardId: string): string | null {
  const card = game.cards[cardId];
  if (!live(game) || !card) return null;
  const guards = bodyguardsIn(game).length;
  const at = CAPTAINS.get(card.code);
  if (at != null) {
    const current = STAGES[game.questStage ? (game.cards[game.questStage]?.code ?? "") : ""]?.at ?? 0;
    const held = flagged(game, cardId, "cannotLeavePlay");
    if (!held && current >= at) return null;
    const parts = [captainWords(at, held, at === 3, guards)];
    if (held && card.code === MURZAG) parts.push(murzagWords(game.seatCount, engagedSeat(game, cardId)));
    if (card.code === ALCARON) parts.push(alcaronWords(towerTokens(game)));
    if (card.code === NAZGUL) parts.push(nazgulWords(guards));
    return parts.join(" ");
  }
  if (card.code === BODYGUARD && inPlay(card.zone)) return bodyguardWords(guards, card.damage, printedOf(ctx.cards, card.code).health ?? 0);
  if (card.code === TOWER && card.zone === "staging") return towerWords(card.progress);
  if (card.code === BRIDGE && inPlay(card.zone)) return bridgeWords(towerTokens(game), card.zone !== "staging");
  return null;
}

/** The Morgul Bodyguard that takes the damage meant for this card, when it is a shielded Captain: the engine's own pick. */
const shielder = (game: ScenarioState, id: string): CardInstance | null => {
  const target = live(game) ? bodyguardTarget(game, id) : null;
  return target ? (game.cards[target] ?? null) : null;
};

/** The pill on the Morgul Bodyguard that takes the damage meant for a Captain in play (the engine's own pick, `shielder`), so the table shows which one it is. Null for any other card and in any other scenario. */
export function valeShieldMark(game: ScenarioState, cardId: string): { word: string; speech: string } | null {
  const card = game.cards[cardId];
  if (!card || !live(game) || card.code !== BODYGUARD || !(card.zone === "staging" || card.zone === "engaged")) return null;
  const shields = Object.values(game.cards).some((other) => CAPTAINS.has(other.code) && PLAY.includes(other.zone as (typeof PLAY)[number]) && shielder(game, other.id)?.id === cardId);
  return shields ? { word: SHIELD_WORD, speech: shieldMarkWords } : null;
}

/** The player-attack sheet's line for an attack on a Captain: where his damage goes while a Bodyguard is in play, or the Nazgûl's cut. Empty for any other enemy. */
export function valeAttackNote(game: ScenarioState, ctx: ReduceContext, enemyId: string): string {
  const enemy = game.cards[enemyId];
  if (!live(game) || !enemy) return "";
  const guard = shielder(game, enemyId);
  if (guard) return ` ${shieldWords(named(ctx, enemy), named(ctx, guard), guard.damage, printedOf(ctx.cards, guard.code).health ?? 0)}`;
  return enemy.code === NAZGUL ? ` ${NAZGUL_SHEET}` : "";
}

/** The dock readout for a player's attack on a Captain that a Bodyguard shields: the damage on the Bodyguard and what it has left. Null when no Bodyguard takes it. */
export function valeShieldReadout(game: ScenarioState, ctx: ReduceContext, enemyId: string, damage: number): string | null {
  const enemy = game.cards[enemyId];
  const guard = enemy ? shielder(game, enemyId) : null;
  if (!enemy || !guard) return null;
  const hits = printedOf(ctx.cards, guard.code).health ?? 0;
  return shieldReadout(damage, named(ctx, guard), named(ctx, enemy), Math.max(0, hits - guard.damage));
}

/** The enemy attack sheet's line when its attack is an immediate one of this scenario (Lord Alcaron's additional attack, or a Bodyguard's switch to the next player), or Murzag's reveal that follows his attack. Empty otherwise. */
export function valeAttackSource(game: ScenarioState, ctx: ReduceContext): string {
  const attack = game.pendingAttack;
  const enemy = attack ? game.cards[attack.enemyId] : undefined;
  if (!live(game) || !attack || !enemy) return "";
  const name = named(ctx, enemy);
  if (attack.immediate === true && !attack.shadowAttack) return enemy.code === ALCARON ? `${additionalAttackWords(name)}${alcaronAttackWords(towerTokens(game))}` : switchedAttackWords(name);
  if (enemy.code === ALCARON) return alcaronAttackWords(towerTokens(game));
  return enemy.code === MURZAG ? murzagAttackWords(game.seatCount, attack.seat) : "";
}

/** The travel readout's line for The White Bridge: its quest points once active. Null for any other location. */
export const valeTravel = (game: ScenarioState, locationId: string): string | null => (live(game) && game.cards[locationId]?.code === BRIDGE ? bridgeTravelWords(towerTokens(game)) : null);

/** What a hand card's "no legal target" reason adds: a Captain cannot be moved out of play (said for a card that is no attachment), and an attachment that would have the Nazgûl as a host cannot attach to him (found by asking the engine again with his flag lifted). Empty for any other game. */
export function valeRefusal(game: ScenarioState, ctx: ReduceContext, cardId: string, attachment: boolean): string {
  const card = game.cards[cardId];
  if (!live(game) || !card) return "";
  // The Captain is named only when his flag is the reason: the engine asked again with every flag lifted finds the card a target.
  const unflagged = { ...game, modifiers: game.modifiers.filter((modifier) => modifier.stat !== "cannotLeavePlay") };
  const captain = !attachment && Object.values(game.cards).some((other) => CAPTAINS.has(other.code) && inPlay(other.zone) && flagged(game, other.id, "cannotLeavePlay")) && playWindowReason(unflagged, cardId, ctx) == null;
  const nazgulId = attachment ? Object.values(game.cards).find((other) => other.code === NAZGUL && inPlay(other.zone))?.id : undefined;
  const lifted = nazgulId ? { ...game, modifiers: game.modifiers.filter((modifier) => !(modifier.stat === "cannotHaveAttachments" && modifier.instanceId === nazgulId)) } : null;
  const nazgul = nazgulId != null && lifted != null && attachmentHostIds(lifted, game.activeSeat, card.code, ctx).includes(nazgulId);
  return `${captain ? CAPTAIN_REFUSAL : ""}${nazgul ? NAZGUL_REFUSAL : ""}`;
}
