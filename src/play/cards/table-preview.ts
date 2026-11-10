// What a long press on a table card shows (card-preview.tsx): the card, the cards attached to it and its face-up shadow cards,
// each with the effects on it now, opened on the card that was pressed. Pure: the screen hands over how a code is pictured.
import { stageSeat, viewOf } from "../../rules/families/breaking/areas.ts";
import { isLostIsland } from "../../rules/families/uncharted/pick.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import type { CardInstance } from "../../rules/core/state.ts";


import { dungeonDetail } from "./dungeon-preview.ts";
import { earlierStages, heldStage } from "./earlier-stages.ts";
import { grappleDetail, shipLoss } from "../words/scenarios/grapple.ts";
import { oathDetail } from "./oath-preview.ts";
import { delayedLines, effectLines } from "./card-effects.ts";
import type { PreviewCard } from "./card-preview.tsx";
import { stageRuleLines } from "../readouts/fortress.ts";
import { advanceHold, questObjective, stagePoints } from "../readouts/objective.ts";
import { pictureKey } from "../canvas/picture-key.ts";
import { headingLook, headingPreviewSteps, headingPreviewTitle, headingStepOf } from "../dream-chaser/heading.ts";
import { inspectTargets } from "../store/selectors.ts";
import { whyNotPlayable } from "../choice/why.ts";

// A card code as the preview draws it: its name, its picture (or null) by picture key (picture-key.ts: side B of a revealed quest
// stage), whether it is printed sideways, its text, and the lines of it the app does not apply.
export type Describe = (code: string, picture?: string) => Omit<PreviewCard, "code" | "effects" | "role" | "note" | "title" | "detail">;

/**
 * The quest stage's title line in its preview: its name and its progress over its quest points ("Flight to the Ford · 2 / 8"). A
 * stage with no quest points is won some other way: the title is the name and the detail line says how (objective.ts). Null for
 * any card that is not the quest stage. Once stages are separate every seat's stage is one, read as that seat sees it (its stage, its
 * staging area).
 */
export function questTitle(whole: ScenarioState, ctx: ReduceContext, cardId: string, name: string, line: (id: string) => string | null): Pick<PreviewCard, "title" | "detail"> | null {
  const owner = stageSeat(whole, cardId);
  const game = viewOf(whole, owner ?? undefined);
  const stage = game.questStage === cardId ? game.cards[cardId] : undefined;
  if (!stage) return null;
  const points = stagePoints(game, stage, ctx);
  // A stage held back says what holds it, so progress past its quest points reads as the rule and not a fault (13 / 8).
  const hold = points != null ? advanceHold(game, ctx, line) : null;
  // A stage with Defense says where questing's progress goes, and a stage whose filling loses the game says so (mec112.defense, 143075:B:3).
  const detail = [hold, ...stageRuleLines(game, ctx, stage.code)].filter((text) => text != null).join(". ");
  if (points != null) return { title: `${name} · ${stage.progress} / ${points}`, ...(detail ? { detail } : {}) };
  const objective = questObjective(game, ctx, line);
  return { title: name, detail: objective ? `To win: ${objective}` : "No quest points" };
}

/**
 * What lies on the card now, one phrase a counter: its damage, progress and resource tokens, and whether it is exhausted or committed to the
 * quest. Empty for a card with none (a card in the hand, a fresh enemy).
 */
export function tokenLines(card: Pick<CardInstance, "damage" | "progress" | "resources" | "exhausted" | "committed">): string[] {
  return [
    ...(card.damage > 0 ? [`${card.damage} damage`] : []),
    ...(card.progress > 0 ? [`${card.progress} progress`] : []),
    ...(card.resources > 0 ? [`${card.resources} resource${card.resources === 1 ? "" : "s"}`] : []),
    ...(card.exhausted ? ["Exhausted"] : []),
    ...(card.committed ? ["Committed"] : []),
  ];
}

// An earlier stage as the quest stage's preview lists it: "Stage 1B" over its name, on its B side, the side it was played on. Its number
// is the stage number it holds (earlier-stages.ts heldStage).
function earlierStage(game: ScenarioState, ctx: ReduceContext, code: string, describe: Describe): PreviewCard {
  const place = heldStage(game, ctx, code);
  const described = describe(code, pictureKey({ code, face: "B" }));
  return { code, ...described, ...(place ? { title: `Stage ${place.at}B`, detail: described.name } : {}), effects: [], role: "Earlier stage" };
}

/**
 * The cards the preview lists, and which of them it opens on. `extra` adds cards that are not on the table (Look). `line` reads a
 * printed line of the ledger by id, for the quest stage's objective. The quest stage lists the stages defeated before it after its own
 * cards (earlier-stages.ts), so a swipe or the strip steps back through the quest.
 */
export function previewCards(
  game: ScenarioState,
  ctx: ReduceContext,
  cardId: string,
  describe: Describe,
  cardName: (cardId: string) => string,
  extra: readonly string[] = [],
  line: (id: string) => string | null = () => null,
  // Why the card the player pressed cannot be chosen in the pick that is open (why.ts, whyNotChosen), or null.
  chosen: (cardId: string) => string | null = () => null,
): { cards: PreviewCard[]; start: number } {
  const earlier = earlierStages(game, ctx, cardId);
  const ids = [...inspectTargets(game, cardId), ...extra.filter((id) => id !== cardId), ...earlier];
  const cards = ids.flatMap((id, index): PreviewCard[] => {
    const card = game.cards[id];
    if (!card) return [];
    if (earlier.includes(id)) return [earlierStage(game, ctx, card.code, describe)];
    const role = index === 0 ? null : card.zone === "shadow" ? "Shadow card" : card.host ? "Attachment" : null;
    // The effects on it, then what a delayed effect will do to it (Sneak Attack's return); for the pressed hand card, why it
    // does not glow.
    const effects = [...effectLines(game, ctx, id, cardName), ...delayedLines(game, id, cardName)];
    const refusal = id === cardId ? chosen(id) : null;
    const note = id === cardId ? (whyNotPlayable(game, ctx, id, cardName) ?? refusal) : null;
    // A look at the facedown side of a Lost Island shows the real side (dcce.uncharted); the card on the table keeps lying on its Lost Island side.
    const looked = game.window?.kind === "look" && game.window.side === "A" && game.window.cardIds.includes(id);
    const described = describe(card.code, looked ? card.code : pictureKey(card));
    const lostIsland = !looked && isLostIsland(card, ctx);
    const detail = dungeonDetail(game, ctx, id, cardName) ?? oathDetail(game, ctx, id) ?? ([grappleDetail(game, id), shipLoss(game, ctx, id)?.speech].filter((part) => part != null).join(". ") || null);
    // The Heading card: titled by its step and its course, listing the four steps with the current one marked, and drawn turned a quarter turn per step (dcce.heading). A peek never changes the dial.
    const heading = game.sea?.headingCard === id ? headingStepOf(game.sea?.heading) : null;
    const turned = heading ? { title: headingPreviewTitle(heading), turn: headingLook(heading).turn } : {};
    const steps = heading ? { steps: headingPreviewSteps(heading).map((row) => ({ text: row.line, current: row.current })) } : {};
    const tokens = tokenLines(card);
    return [{ code: card.code, ...described, ...(tokens.length > 0 ? { tokens } : {}), ...(detail ? { detail } : {}), ...questTitle(game, ctx, id, described.name, line), ...turned, ...steps, effects, ...(lostIsland ? { lostIsland } : {}), ...(role ? { role } : {}), ...(note ? { note } : {}), ...(refusal && note === refusal ? { noteTitle: "Cannot be chosen now" } : {}) }];
  });
  return { cards, start: Math.max(0, ids.indexOf(cardId)) };
}
