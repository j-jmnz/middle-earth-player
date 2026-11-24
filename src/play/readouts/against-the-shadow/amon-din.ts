// Rules: ats.villagers, ats.villager-tokens-discarded, rr.cannot, rr.winning-the-game (data/rules/entries.json); ledger lines 06066:B:1, 06066:B:2, 06066:B:3, 06067:B:1, 06067:B:2, 06068:A:2, 06069:A:1, 06069:A:2, 06070:A:1, 06070:A:3, 06071:A:1, 06071:A:3, 06075:A:1, 06076:A:1, 06077:A:1.
//
// The pieces Encounter at Amon Dîn's cards hold on the table: the villager tokens (the `resources` of a location, of Rescued Villagers and of stage 1B, said as villager tokens, with the Villagers X chip read from the card's own record), the two top-bar dials that compare Rescued
// Villagers with Dead Villagers, the lines of the two stages (the progress that moves tokens, the undefended attack that discards them, the held end), the readout of an undefended attack on Rescued Villagers, the quest readout of stage 1B, the preview lines of the objectives, Lord
// Alcaron and Ghulat, and the banner's lines for tokens that moved or were discarded. Every hook keys on this scenario's id, so a card of another scenario that holds resource tokens still says resources. The engine decided every number; nothing here changes one. Pure, so a test reads it.
import type { Effect } from "../../../catalog/boundary.ts";
import { inPlay, flagged, type CardInstance, type ScenarioState } from "../../../rules/core/state.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { placeQuestProgress } from "../../../rules/quest/quest.ts";
import { effectsOf } from "../../../rules/windows/listen.ts";

import { alcaronLeftWords, alcaronWords, questDialName, questDialWords, changedWords, deadChangedWords, deadDialName, deadDialWords, deadWords, endWords, ghulatWords, ghulatDialName, ghulatDialWords, ghulatHeldWords, heldLine, heldTitle, heldWords, movesWords, notWinningWords, protectWords, rescuedDialName, rescuedDialWords, rescuedWords, savageryWords, undefendedVillagersResult, undefendedVillagersWords, villagerTokens, winWords } from "../../words/scenarios/against-the-shadow/amon-din.ts";
import { ownerWords } from "../../words/owner.ts";
import type { TableDial } from "../dials.ts";

const SCENARIO = "encounter-at-amon-din";
const STAGE_ONE = "06066";
const STAGE_TWO = "06067";
const RESCUED = "06068";
const DEAD = "06069";
const ALCARON = "06070";
const GHULAT = "06071";
// The cards that hold villager tokens: the quest card of stage 1B, Rescued Villagers and the three locations that print Villagers X.
const HOLDERS: ReadonlySet<string> = new Set([STAGE_ONE, RESCUED, "06075", "06076", "06077"]);

/** Whether the game is Encounter at Amon Dîn: every hook below keys on it. */
export const live = (game: ScenarioState): boolean => game.scenarioId === SCENARIO;

/** Whether the card holds villager tokens in this scenario: its `resources` are villager tokens, never resources. A card of another scenario is never one. */
export const holdsVillagers = (game: ScenarioState, card: Pick<CardInstance, "code">): boolean => live(game) && HOLDERS.has(card.code);

/** The word for one counter of the card's `resources`: "villager token" on a card that holds them, else null (the caller keeps "resource"). */
export const villagerUnit = (game: ScenarioState, card: Pick<CardInstance, "code">): string | null => (holdsVillagers(game, card) ? "villager token" : null);

const cardWith = (game: ScenarioState, code: string): CardInstance | undefined => Object.values(game.cards).find((card) => card.code === code && inPlay(card.zone));
const ghulatIn = (game: ScenarioState): boolean => live(game) && cardWith(game, GHULAT) != null;
const tableHolds = (game: ScenarioState, stat: "gameEnding" | "endingLost"): boolean => live(game) && game.modifiers.length > 0 && flagged(game, "table", stat);

const counts = (game: ScenarioState): { rescued: number; dead: number } => ({ rescued: cardWith(game, RESCUED)?.resources ?? 0, dead: cardWith(game, DEAD)?.damage ?? 0 });

/** The X of the card's Villagers X, read from its own record: a Forced record that places X tokens on it as it enters play, or the When Revealed of stage 1B. 0 for a card without one and in any other scenario. */
export function villagersValue(game: ScenarioState, ctx: ReduceContext, cardId: string): number {
  const card = game.cards[cardId];
  if (!card || !live(game) || !HOLDERS.has(card.code) || card.code === RESCUED) return 0;
  for (const effect of effectsOf(ctx, card.code) as readonly Effect[]) {
    if (effect.trigger !== "encounterEnteredPlay" && effect.timing !== "whenRevealed") continue;
    for (const step of effect.instructions) if (step.verb === "PlaceResourceTokens" && step.on === "self" && typeof step.amount === "number") return step.amount;
  }
  return 0;
}

/** The two dials that decide the game: the villager tokens on Rescued Villagers and the damage tokens on Dead Villagers (a tap shows each card). Empty in any other scenario and before the two objectives are in play. */
export function amonDinDials(game: ScenarioState, ctx: ReduceContext): readonly TableDial[] {
  const rescued = cardWith(game, RESCUED);
  const dead = cardWith(game, DEAD);
  if (!live(game) || !rescued || !dead) return [];
  const { rescued: saved, dead: lost } = counts(game);
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  // Stage 1B has no quest points: the villager tokens left on its card are what the progress uses up (06066:B:2).
  const quest: TableDial[] = stage?.code === STAGE_ONE ? [{ id: "quest-villagers", testID: "din-quest", label: "Stage", name: questDialName, value: stage.resources, cardId: stage.id, note: questDialWords(stage.resources) }] : [];
  // Not more villager tokens than damage tokens (a tie loses) is not winning: the dial says so once either count is above 0.
  const behind = saved <= lost && saved + lost > 0 ? { warn: { level: lost > saved ? ("critical" as const) : ("near" as const), words: notWinningWords(saved, lost) } } : {};
  // The end is held while stage 2B is defeated and Ghulat is in play: his hit points left are what the players have to use up.
  const ghulat = amonDinHeld(game) ? cardWith(game, GHULAT) : undefined;
  const left = ghulat ? Math.max(0, modifiedStat(game, ghulat, "hitPoints", ctx.cards) - ghulat.damage) : 0;
  const held: TableDial[] = ghulat ? [{ id: "ghulat", testID: "din-ghulat", label: "Ghulat", name: ghulatDialName, value: left, cardId: ghulat.id, warn: { level: "near", words: ghulatHeldWords }, note: ghulatDialWords(left) }] : [];
  return [
    ...quest,
    { id: "rescued", testID: "din-rescued", label: "Rescued", name: rescuedDialName, value: saved, cardId: rescued.id, note: rescuedDialWords(saved, lost), ...behind },
    { id: "dead", testID: "din-dead", label: "Dead", name: deadDialName, value: lost, icon: "damage", cardId: dead.id, note: deadDialWords(lost, saved) },
    ...held,
  ];
}

/** Whether stage 2B is defeated while Ghulat is in play: the end of the game is held until he leaves play (06067:B:2, 06071:A:3). False in any other scenario. */
export const amonDinHeld = (game: ScenarioState, code?: string): boolean => {
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  return live(game) && stage?.code === STAGE_TWO && (code == null || code === STAGE_TWO) && tableHolds(game, "gameEnding") && ghulatIn(game);
};

/** Stage 1's "To win" line, naming Rescued Villagers where the printed line says "here" (06068:A:2): null on any other stage and in any other scenario, where the printed objective line is used. */
export function amonDinWin(game: ScenarioState): string | null {
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  return live(game) && stage?.code === STAGE_ONE ? winWords : null;
}

/** The lines the current stage adds to its preview and to the screen that tells the advance to it: stage 1B's tokens and what progress does to them, stage 2B's undefended attack and the end (or the held end). Empty for another stage and in any other scenario. */
export function amonDinStageLines(game: ScenarioState, code: string): string[] {
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  if (!live(game) || !stage || stage.code !== code) return [];
  if (code === STAGE_ONE) return [savageryWords()];
  if (code !== STAGE_TWO) return [];
  const { rescued, dead } = counts(game);
  const left = tableHolds(game, "endingLost") && ghulatIn(game);
  // The held end leads with the action (destroy Ghulat); the undefended line is the last line of the text, so it ends the sentence.
  if (amonDinHeld(game)) return [heldLine(rescued, dead, left), `${protectWords}.`];
  return [protectWords, left ? alcaronLeftWords : endWords(rescued, dead)];
}

/** The preview line of Rescued Villagers, Dead Villagers, Lord Alcaron and Ghulat in play: what only the table knows about them. Null for any other card and in any other scenario. */
export function amonDinDetail(game: ScenarioState, cardId: string): string | null {
  const card = game.cards[cardId];
  if (!card || !live(game) || !inPlay(card.zone)) return null;
  const { rescued, dead } = counts(game);
  if (card.code === RESCUED) return rescuedWords(dead);
  if (card.code === DEAD) return deadWords(rescued);
  if (card.code === ALCARON) return alcaronWords(game.seatCount > 1 && card.controller != null ? `${ownerWords(game.seatCount, card.controller)}` : card.controller != null ? "your" : null, ghulatIn(game));
  return card.code === GHULAT ? ghulatWords(dead) : null;
}

/** What the attack sheet says of an undefended attack while stage 2B aims it at Rescued Villagers, or null when the damage goes to a hero. */
export function undefendedVillagersLine(game: ScenarioState): string | null {
  const stage = game.questStage;
  const rescued = cardWith(game, RESCUED);
  if (!live(game) || game.modifiers.length === 0 || !stage || !rescued || !flagged(game, stage, "undefendedToVillagers")) return null;
  return undefendedVillagersWords(rescued.resources);
}

/** The dock readout of an undefended attack that lands on Rescued Villagers (`hit`): the tokens it discards, fewer when it holds fewer. Null for any other card. */
export function undefendedVillagersReadout(game: ScenarioState, hit: string, strength: number, shadowNext: boolean): string | null {
  const card = game.cards[hit];
  if (!live(game) || card?.code !== RESCUED) return null;
  return undefendedVillagersResult(Math.min(strength, card.resources), shadowNext);
}

/** The quest readout of `progress` while stage 1B holds the villager tokens: what the active location takes first, the tokens that move to Rescued Villagers and the surplus that is lost. Null on any other stage and in any other scenario. */
export function questMovesWords(game: ScenarioState, ctx: ReduceContext, progress: number, nameOf: (id: string) => string): string | null {
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  if (!live(game) || progress <= 0 || !stage || stage.code !== STAGE_ONE || game.modifiers.length === 0 || !flagged(game, stage.id, "progressToVillagers")) return null;
  const after = placeQuestProgress(game, progress, ctx.cards, [], () => false, true);
  const reaching = after.pendingEvents?.findLast((event) => event.trigger === "progressReplaced")?.amount ?? 0;
  const active = game.activeLocation;
  return movesWords(reaching, stage.resources, active ? { name: nameOf(active), share: progress - reaching } : undefined);
}

/** One card whose villager tokens changed in an intent: the card, the tokens it held and the tokens it holds. */
export type VillagerChange = { id: string; was: number; now: number };

/** The cards of a holder code whose villager tokens changed in one intent, in card order. Empty in any other scenario. A card that was not in play held none. */
export function villagerChanges(before: ScenarioState, after: ScenarioState): readonly VillagerChange[] {
  if (!live(after)) return [];
  const changes: VillagerChange[] = [];
  for (const card of Object.values(after.cards)) {
    if (!inPlay(card.zone) || !HOLDERS.has(card.code)) continue;
    const was = before.cards[card.id];
    const had = was && inPlay(was.zone) ? was.resources : 0;
    if (card.resources !== had) changes.push({ id: card.id, was: had, now: card.resources });
  }
  return changes;
}

/** The banner's lines for the tokens that changed in one intent: each card whose villager tokens changed, and Dead Villagers' damage tokens. Empty in any other scenario. */
export function villagerLines(before: ScenarioState, after: ScenarioState, nameOf: (id: string) => string): string[] {
  const lines = villagerChanges(before, after).map((change) => changedWords(nameOf(change.id), change.was, change.now));
  const dead = live(after) ? cardWith(after, DEAD) : undefined;
  const had = dead ? (before.cards[dead.id]?.damage ?? 0) : 0;
  if (dead && dead.damage !== had) lines.push(deadChangedWords(nameOf(dead.id), had, dead.damage));
  return lines;
}

/** The banner's line when stage 2B's defeat is held because Ghulat is in play, or when Lord Alcaron left play with Ghulat in play. Empty otherwise. */
export function heldBeat(before: ScenarioState, after: ScenarioState): { title: string; lines: string[] } | null {
  if (!live(after) || !ghulatIn(after)) return null;
  const ended = tableHolds(after, "gameEnding") && !tableHolds(before, "gameEnding");
  const lost = tableHolds(after, "endingLost") && !tableHolds(before, "endingLost");
  if (!ended && !lost) return null;
  const { rescued, dead } = counts(after);
  return { title: heldTitle, lines: [ended ? heldWords(rescued, dead, tableHolds(after, "endingLost")) : alcaronLeftWords] };
}

/** Whether Lord Alcaron leaving play loses the game only once Ghulat is gone: the dock says the loss waits (06070:A:3, 06071:A:3). */
export const lossWaits = (game: ScenarioState): boolean => ghulatIn(game);

export { villagerTokens };

/** Whether the card is Rescued Villagers in a game of this scenario: an undefended attack that lands on it damages no hero (06067:B:1). */
export const onVillagers = (game: ScenarioState, cardId: string): boolean => live(game) && game.cards[cardId]?.code === RESCUED;

/** Whether the card is Dead Villagers in a game of this scenario: its damage tokens are told with the villager tokens that put them there. */
export const deadVillagers = (game: ScenarioState, cardId: string): boolean => live(game) && game.cards[cardId]?.code === DEAD;
