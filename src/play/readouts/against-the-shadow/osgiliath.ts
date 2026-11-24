// Rules: ats.controlling-locations, ats.losing-control-of-locations, rr.winning-the-game, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 06091:B:1, 06091:B:2, 06091:B:3, 06096:A:2, 06097:A:2, 06098:A:3, 06099:A:3, 06103:A:1, 06103:A:2, 06104:A:1, 06095:A:1.
//
// The pieces Assault on Osgiliath's cards hold on the table: the locations a player controls (in that player's play area, with whose they are), the top-bar dial of the win (Osgiliath locations controlled, and how many are in play), the lines of stage 1B (the win, the bar on
// progress and the taking of control), the locations an undefended attack returns, the lines of Pinned Down, Southron Commander and Ruined Tower, and the control that was taken or lost in one intent (the banner and the log). The engine decided every number; nothing here
// changes one. Every hook keys on this scenario's id and is empty in another. Pure, so a test reads it.
import type { Effect } from "../../../catalog/boundary.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import type { CardInstance, ScenarioState } from "../../../rules/core/state.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { controllerOf, controlledLocations } from "../../../rules/families/pelargir/location-control.ts";
import { TOWER } from "../../../rules/families/pelargir/ruined-tower.ts";
import { effectsOf } from "../../../rules/windows/listen.ts";

import { commanderWords, controlledWords, dialName, gateHeldWords, lostWords, pinnedWords, PROGRESS_BAR_WORDS, TAKE_CONTROL_WORDS, tookWords, towerActiveWords, towerHeldWords, towerStagedWords, undefendedLocationsWords, undefendedReturnWords, winWords } from "../../words/scenarios/against-the-shadow/osgiliath.ts";
import type { TableDial } from "../dials.ts";

const SCENARIO = "assault-on-osgiliath";
const STAGE = "06091";
const PINNED_DOWN = "06104";
const COMMANDER = "06095";
const WEST_GATE = "06096";

/** Whether the game is Assault on Osgiliath: every hook below keys on it. */
export const live = (game: ScenarioState): boolean => game.scenarioId === SCENARIO;

const isOsgiliath = (ctx: ReduceContext, card: CardInstance | undefined): boolean => {
  if (!card) return false;
  const printed = printedOf(ctx.cards, card.code);
  return printed.type === "location" && printed.traits.includes("Osgiliath");
};

const recordsOf = (ctx: ReduceContext, code: string): readonly Effect[] => effectsOf(ctx, code) as readonly Effect[];

/** The Osgiliath locations a player controls now, and the ones still in the staging area or active (the win needs none of those). Empty lists in any other scenario. */
export function osgiliathNow(game: ScenarioState, ctx: ReduceContext): { controlled: readonly string[]; left: readonly string[] } {
  if (!live(game)) return { controlled: [], left: [] };
  const controlled = controlledLocations(game).filter((id) => isOsgiliath(ctx, game.cards[id]));
  const left = [...game.staging, game.activeLocation, game.secondActiveLocation].filter((id): id is string => id != null && isOsgiliath(ctx, game.cards[id]));
  return { controlled, left };
}

const nameIn = (ctx: ReduceContext, id: string, game: ScenarioState): string => printedOf(ctx.cards, game.cards[id]?.code ?? "").name;

/** The dial of the win while the stage is in play: the locations controlled over every Osgiliath location in play, a goal that fills in the accent. A tap shows the stage, whose preview names the ones left. */
export function osgiliathDials(game: ScenarioState, ctx: ReduceContext): readonly TableDial[] {
  if (!live(game) || game.questStage == null || game.cards[game.questStage]?.code !== STAGE) return [];
  const { controlled, left } = osgiliathNow(game, ctx);
  const total = controlled.length + left.length;
  return [{ id: "osgiliath", testID: "osgiliath-controlled", label: "Controlled", name: dialName(controlled.length, left.length), value: controlled.length, limit: Math.max(total, 1), word: `${controlled.length}/${total}`, goal: true, cardId: game.questStage }];
}

/** Stage 1B's own win line, with the locations that stop it now. Null for any other stage or scenario. */
export function osgiliathWin(game: ScenarioState, ctx: ReduceContext, stageCode: string): string | null {
  if (!live(game) || stageCode !== STAGE) return null;
  const { controlled, left } = osgiliathNow(game, ctx);
  return winWords(left.map((id) => nameIn(ctx, id, game)), controlled.map((id) => ({ name: nameIn(ctx, id, game), seat: controllerOf(game, id) ?? 0 })), game.seatCount, game.phase === "Setup");
}

/** The other lines of stage 1B: the bar on player card progress and the taking of control. */
export const osgiliathStageLines = (game: ScenarioState, stageCode: string): string[] => (live(game) && stageCode === STAGE ? [`${PROGRESS_BAR_WORDS}. ${TAKE_CONTROL_WORDS}.`] : []);

// Whether a card has a Forced record that hears an undefended attack: the four unique locations.
const returnsWhenUndefended = (ctx: ReduceContext, code: string): boolean => recordsOf(ctx, code).some((effect) => effect.trigger === "attackUndefended");

/** The card preview's line for a card of this scenario: a controlled location's owner and what control gives, a unique location's undefended consequence, Ruined Tower's second active slot, Pinned Down's X and Southron Commander's targets. Null for any other card. */
export function osgiliathDetail(game: ScenarioState, ctx: ReduceContext, cardId: string): string | null {
  const card = game.cards[cardId];
  if (!live(game) || !card) return null;
  const seat = controllerOf(game, cardId);
  const held = seat != null && card.zone === "play";
  const parts: string[] = [];
  if (held) parts.push(controlledWords(game.seatCount, seat));
  if (returnsWhenUndefended(ctx, card.code) && (held || card.zone === "staging" || card.zone === "activeLocation")) parts.push(undefendedReturnWords(game.seatCount, held ? seat : null));
  const active = [game.activeLocation, game.secondActiveLocation].filter((id) => id != null).length;
  if (card.code === TOWER && card.zone === "staging") parts.push(towerStagedWords(active));
  if (card.code === TOWER && (card.zone === "activeLocation" || card.zone === "secondActiveLocation")) parts.push(towerActiveWords(active));
  if (card.code === TOWER && held) parts.push(towerHeldWords(game.seatCount, seat));
  if (card.code === WEST_GATE && held) parts.push(gateHeldWords());
  if (card.code === PINNED_DOWN) parts.push(pinnedWords(osgiliathControlledCount(game)));
  if (card.code === COMMANDER) parts.push(commanderWords(commanderTargets(game)));
  return parts.length > 0 ? parts.join(" ") : null;
}

/** What a screen reader hears of a location a player controls: "controlled by you", or by the player's number two-handed. Null for any other card. */
export function osgiliathControlSpeech(game: ScenarioState, cardId: string): string | null {
  const seat = live(game) && game.cards[cardId]?.zone === "play" ? controllerOf(game, cardId) : null;
  return seat == null ? null : `controlled by ${game.seatCount > 1 ? `Player ${seat + 1}` : "you"}`;
}

/** Every location a player controls: Pinned Down's X. */
const osgiliathControlledCount = (game: ScenarioState): number => controlledLocations(game).length;

/** The seats a Southron Commander would attack now, in player order from the first player, named as the sheet names a player. */
function commanderTargets(game: ScenarioState): string[] {
  const holders = new Set(controlledLocations(game).flatMap((id) => controllerOf(game, id) ?? []));
  return Array.from({ length: game.seatCount }, (_, at) => (game.firstPlayer + at) % game.seatCount).filter((seat) => holders.has(seat)).map((seat) => (game.seatCount > 1 ? `Player ${seat + 1}` : "you"));
}

/** The controlled locations that return to the staging area when the defending seat leaves an attack undefended, by id: the unique ones, and the Ruined Towers that seat controls, which return when another location is lost (06103:A:2). */
function returning(game: ScenarioState, ctx: ReduceContext, seat: number): { unique: string[]; towers: string[] } {
  const mine = controlledLocations(game).filter((id) => controllerOf(game, id) === seat);
  const unique = mine.filter((id) => returnsWhenUndefended(ctx, game.cards[id]?.code ?? ""));
  return { unique, towers: unique.length > 0 ? mine.filter((id) => game.cards[id]?.code === TOWER) : [] };
}

/** The attack sheet's Undefended line while the defending player controls a location that returns, or null. */
export function undefendedLocationsLine(game: ScenarioState, ctx: ReduceContext): string | null {
  const attack = game.pendingAttack;
  if (!live(game) || !attack) return null;
  const { unique, towers } = returning(game, ctx, attack.seat);
  return unique.length > 0 ? undefendedLocationsWords(unique.map((id) => nameIn(ctx, id, game)), game.seatCount, attack.seat, towers.length) : null;
}

/** The dock readout's addition for an undefended attack: the locations that return, as the readout says it ("if nothing changes"). Empty when none returns. */
export function undefendedLocationsReadout(game: ScenarioState, ctx: ReduceContext): string {
  const attack = game.pendingAttack;
  if (!live(game) || !attack) return "";
  const { unique, towers } = returning(game, ctx, attack.seat);
  const ids = [...unique, ...towers];
  return ids.length > 0 ? `; ${ids.map((id) => nameIn(ctx, id, game)).join(" and ")} return${ids.length === 1 ? "s" : ""} to the staging area if nothing changes` : "";
}

/** One location whose control a player took or lost in an intent. `toStaging`: a lost location lies in the staging area now (else it became active). */
export type ControlChange = { id: string; seat: number; kind: "took" | "lost"; progress: number; toStaging: boolean };

/** The control taken or lost between two states. Empty in any other scenario. */
export function controlChanges(before: ScenarioState, after: ScenarioState): readonly ControlChange[] {
  if (!live(after)) return [];
  const had = new Map(controlledLocations(before).map((id) => [id, controllerOf(before, id) ?? 0]));
  const has = new Map(controlledLocations(after).map((id) => [id, controllerOf(after, id) ?? 0]));
  const took = [...has].filter(([id, seat]) => had.get(id) !== seat).map(([id, seat]): ControlChange => ({ id, seat, kind: "took", progress: 0, toStaging: false }));
  const lost = [...had].filter(([id, seat]) => has.get(id) !== seat).map(([id, seat]): ControlChange => ({ id, seat, kind: "lost", progress: before.cards[id]?.progress ?? 0, toStaging: after.cards[id]?.zone === "staging" }));
  return [...took, ...lost];
}

/** The log and banner line of one change. */
export const changeWords = (change: ControlChange, seatCount: number, name: string): string => (change.kind === "took" ? tookWords(name, seatCount, change.seat) : lostWords(name, seatCount, change.seat, change.progress, change.toStaging));
