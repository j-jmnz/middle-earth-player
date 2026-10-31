// What a long press on a table card shows (card-preview.tsx): the card, the cards attached to it and its face-up shadow cards,
// each with the effects on it now, opened on the card that was pressed. Pure: the screen hands over how a code is pictured.
import type { ReduceContext, ScenarioState } from "../rules/reduce.ts";


import { dungeonDetail } from "./dungeon-preview.ts";
import { oathDetail } from "./oath-preview.ts";
import { delayedLines, effectLines } from "./card-effects.ts";
import type { PreviewCard } from "./card-preview.tsx";
import { advanceHold, questObjective, stagePoints } from "./objective.ts";
import { pictureKey } from "./picture-key.ts";
import { headingLook, headingPreviewSteps, headingPreviewTitle, headingStepOf } from "./heading.ts";
import { inspectTargets } from "./selectors.ts";
import { whyNotPlayable } from "./why.ts";

// A card code as the preview draws it: its name, its picture (or null) by picture key (picture-key.ts: side B of a revealed quest
// stage), whether it is printed sideways, its text, and the lines of it the app does not apply.
export type Describe = (code: string, picture?: string) => Omit<PreviewCard, "code" | "effects" | "role" | "note" | "title" | "detail">;

/**
 * The quest stage's title line in its preview: its name and its progress over its quest points ("Flight to the Ford · 2 / 8"). A
 * stage with no quest points is won some other way: the title is the name and the detail line says how (objective.ts). Null for
 * any card that is not the quest stage.
 */
export function questTitle(game: ScenarioState, ctx: ReduceContext, cardId: string, name: string, line: (id: string) => string | null): Pick<PreviewCard, "title" | "detail"> | null {
  const stage = game.questStage === cardId ? game.cards[cardId] : undefined;
  if (!stage) return null;
  const points = stagePoints(game, stage, ctx);
  // A stage held back says what holds it, so progress past its quest points reads as the rule and not a fault (13 / 8).
  const hold = points != null ? advanceHold(game, ctx, line) : null;
  if (points != null) return { title: `${name} · ${stage.progress} / ${points}`, ...(hold ? { detail: hold } : {}) };
  const objective = questObjective(game, ctx, line);
  return { title: name, detail: objective ? `To win: ${objective}` : "No quest points" };
}

/**
 * The cards the preview lists, and which of them it opens on. `extra` adds cards that are not on the table (Look). `line` reads a
 * printed line of the ledger by id, for the quest stage's objective.
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
  const ids = [...inspectTargets(game, cardId), ...extra.filter((id) => id !== cardId)];
  const cards = ids.flatMap((id, index): PreviewCard[] => {
    const card = game.cards[id];
    if (!card) return [];
    const role = index === 0 ? null : card.zone === "shadow" ? "Shadow card" : card.host ? "Attachment" : null;
    // The effects on it, then what a delayed effect will do to it (Sneak Attack's return); for the pressed hand card, why it
    // does not glow.
    const effects = [...effectLines(game, ctx, id, cardName), ...delayedLines(game, id, cardName)];
    const refusal = id === cardId ? chosen(id) : null;
    const note = id === cardId ? (whyNotPlayable(game, ctx, id, cardName) ?? refusal) : null;
    const described = describe(card.code, pictureKey(card));
    const detail = dungeonDetail(game, ctx, id, cardName) ?? oathDetail(game, ctx, id);
    // The Heading card: titled by its step and its course, listing the four steps with the current one marked, and drawn turned a quarter turn per step (dcce.heading). A peek never changes the dial.
    const heading = game.sea?.headingCard === id ? headingStepOf(game.sea?.heading) : null;
    const turned = heading ? { title: headingPreviewTitle(heading), turn: headingLook(heading).turn } : {};
    const steps = heading ? headingPreviewSteps(heading).map((row) => (row.current ? `Now · ${row.line}` : row.line)) : [];
    return [{ code: card.code, ...described, ...(detail ? { detail } : {}), ...questTitle(game, ctx, id, described.name, line), ...turned, effects: [...steps, ...effects], ...(role ? { role } : {}), ...(note ? { note } : {}), ...(refusal && note === refusal ? { noteTitle: "Cannot be chosen now" } : {}) }];
  });
  return { cards, start: Math.max(0, ids.indexOf(cardId)) };
}
