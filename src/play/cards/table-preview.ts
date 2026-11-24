// What a long press on a table card shows (card-preview.tsx): the card, the cards attached to it and its face-up shadow cards,
// each with the effects on it now, opened on the card that was pressed. Pure: the screen hands over how a code is pictured.
import { stageSeat, viewOf } from "../../rules/families/breaking/areas.ts";
import { isLostIsland } from "../../rules/families/uncharted/pick.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import type { CardInstance } from "../../rules/core/state.ts";
import { flagged, isExhausted } from "../../rules/core/state.ts";
import { BLIZZARD_LIMIT } from "../../rules/families/quest/blizzard.ts";


import { dungeonDetail } from "./dungeon-preview.ts";
import { deadPreview } from "./realm-preview.ts";
import { earlierStages, heldStage } from "./earlier-stages.ts";
import { grappleDetail, shipLoss } from "../words/scenarios/grapple.ts";
import { oathDetail } from "./oath-preview.ts";
import { delayedLines, effectLines } from "./card-effects.ts";
import type { PreviewCard } from "./card-preview.tsx";
import { stageDetail } from "../readouts/fortress.ts";
import { removalLimit } from "../readouts/against-the-shadow/cair-andros.ts";
import { enemyProgress } from "../readouts/against-the-shadow/druadan.ts";
import { amonDinStageLines, amonDinWin, damageUnit, villagerUnit } from "../readouts/against-the-shadow/amon-din.ts";
import { stewardsFearStageLines } from "../readouts/against-the-shadow/stewards-fear.ts";
import { advanceHold, questObjective, stagePoints } from "../readouts/objective.ts";
import { pictureKey } from "../canvas/picture-key.ts";
import { forestScore, forestStageWords } from "../readouts/standalone-scenarios/old-forest-words.ts";
import { headingLook, headingPreviewSteps, headingPreviewTitle, headingStepOf } from "../dream-chaser/heading.ts";
import { inspectTargets } from "../store/selectors.ts";
import { whyNotPlayable } from "../choice/why.ts";
import { previewKeywords } from "./preview-keywords.ts";
import { contractSides } from "./contract-sides.ts";
import { LOOT_ROLE } from "../words/loot.ts";
import { printedOf } from "../../rules/core/printed.ts";

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
  const detail = stageDetail(game, ctx, stage.code, points, hold, null).join(". ");
  if (points != null) return { title: `${name} · ${stage.progress} / ${points}`, ...(detail ? { detail } : {}) };
  const objective = questObjective(game, ctx, line);
  // A stage 2 of The Old Forest has no quest points: it says what its Victory points test sends the quest to.
  const forest = forestScore(game, ctx);
  // Stages 1 and 2 of The Steward's Fear have no quest points either: their tokens against the 4 that advance them follow (06011:B:3, 06012:B:3).
  const own = amonDinWin(game) ?? (objective ? `To win: ${objective}` : forest ? forestStageWords(forest) : "No quest points");
  return { title: name, detail: [own, ...stewardsFearStageLines(game, ctx, stage.code), ...amonDinStageLines(game, stage.code)].join(". ") };
}

/**
 * What lies on the card now, one phrase a counter: its damage, progress and resource tokens, and whether it is exhausted or committed to the
 * quest. Empty for a card with none (a card in the hand, a fresh enemy). `progressLimit`: the progress is counted against a limit ("3 / 5 progress", Blinding Blizzard, 901307:A:2). `unit`: the word for a resource token ("villager token" on a card of Encounter at Amon Dîn that holds them). `damageWord`: the word for a damage token ("damage token" on its Dead Villagers).
 */
export function tokenLines(card: Pick<CardInstance, "damage" | "progress" | "resources" | "exhausted" | "unconscious" | "committed">, progressLimit?: number, unit = "resource", damageWord?: string): string[] {
  return [
    ...(card.damage > 0 ? [damageWord ? `${card.damage} ${damageWord}${card.damage === 1 ? "" : "s"}` : `${card.damage} damage`] : []),
    ...(card.progress > 0 ? [`${card.progress}${progressLimit == null ? "" : ` / ${progressLimit}`} progress`] : []),
    ...(card.resources > 0 ? [`${card.resources} ${unit}${card.resources === 1 ? "" : "s"}`] : []),
    ...(isExhausted(card) ? ["Exhausted"] : []),
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
 * cards (earlier-stages.ts), so a swipe or the strip steps back through the quest. A two-sided contract shows the side it lies on
 * with that side's lines, and its other side right after it (contract-sides.ts).
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
  // `ruleDoc`: the document whose wording a keyword's rule is quoted from first (the open scenario's own booklet; glossary.ts, scenarioRuleDoc), or null for the Rules Reference.
  options: { ruleDoc?: string | null } = {},
): { cards: PreviewCard[]; start: number } {
  // A choice whose rows are card codes, not cards on the table (the random undiscovered treasures to choose among, 120165:A:3;
  // a boon of the campaign pool): a long press shows the printed card.
  if (!game.cards[cardId] && ctx.cards.has(cardId)) return { cards: [{ code: cardId, ...describe(cardId), effects: [] }], start: 0 };
  const earlier = earlierStages(game, ctx, cardId);
  const ids = [...inspectTargets(game, cardId), ...extra.filter((id) => id !== cardId), ...earlier];
  const groups = ids.map((id, index): PreviewCard[] => {
    const card = game.cards[id];
    if (!card) return [];
    if (earlier.includes(id)) return [earlierStage(game, ctx, card.code, describe)];
    // The loot a location guards is under it, out of play, and still its player's (22024:B:2).
    const loot = game.lootDecks != null && card.zone === "under" && card.controller != null;
    const role = index === 0 ? null : card.zone === "shadow" ? "Shadow card" : loot ? LOOT_ROLE : card.host ? "Attachment" : null;
    // The effects on it, then what a delayed effect will do to it (Sneak Attack's return); for the pressed hand card, why it
    // does not glow.
    const effects = [...effectLines(game, ctx, id, cardName), ...delayedLines(game, id, cardName)];
    const refusal = id === cardId ? chosen(id) : null;
    const note = id === cardId ? (whyNotPlayable(game, ctx, id, cardName) ?? refusal) : null;
    // A look at the facedown side of a Lost Island shows the real side (dcce.uncharted); the card on the table keeps lying on its Lost Island side.
    // A Reanimated Dead is a facedown card: the preview says what it is and whose card it is on paper, never its face, and offers no Details (which would open the card behind it).
    const dead = deadPreview(game, ctx, id, cardName);
    if (dead) return [{ code: card.code, name: dead.name, source: null, text: dead.text, ...(tokenLines(card).length > 0 ? { tokens: tokenLines(card) } : {}), effects, ...(role ? { role } : {}), ...(note ? { note } : {}), faceless: true }];
    const looked = game.window?.kind === "look" && game.window.side === "A" && game.window.cardIds.includes(id);
    const described = describe(card.code, looked ? card.code : pictureKey(card));
    const lostIsland = !looked && isLostIsland(card, ctx);
    const detail = dungeonDetail(game, ctx, id, cardName) ?? oathDetail(game, ctx, id) ?? ([grappleDetail(game, id), shipLoss(game, ctx, id)?.speech].filter((part) => part != null).join(". ") || null);
    // The Heading card: titled by its step and its course, listing the four steps with the current one marked, and drawn turned a quarter turn per step (dcce.heading). A peek never changes the dial.
    const heading = game.sea?.headingCard === id ? headingStepOf(game.sea?.heading) : null;
    const turned = heading ? { title: headingPreviewTitle(heading), turn: headingLook(heading).turn } : {};
    const steps = heading ? { steps: headingPreviewSteps(heading).map((row) => ({ text: row.line, current: row.current })) } : {};
    // A Battleground location's preview line says its damage against its limit, and an enemy of stage 3 its progress against its hit points, so the token line does not say them a second time.
    const tokens = tokenLines(removalLimit(game, id) > 0 ? { ...card, damage: 0 } : enemyProgress(game, ctx, id) ? { ...card, progress: 0 } : card, flagged(game, id, "progressRedirect") ? BLIZZARD_LIMIT : undefined, villagerUnit(game, card) ?? "resource", damageUnit(game, card) ?? undefined);
    const keywords = previewKeywords(game, ctx, id, described.text, options.ruleDoc ?? null);
    const sides = contractSides(printedOf(ctx.cards, card.code).type, described.text);
    if (sides) {
      const other = card.face === "B" ? "A" : "B";
      const back = describe(card.code, pictureKey({ code: card.code, face: other }));
      const up: PreviewCard = { code: card.code, ...described, text: sides[card.face === "B" ? "B" : "A"], ...(tokens.length > 0 ? { tokens } : {}), effects, role: role ?? `Side ${card.face === "B" ? "B" : "A"}`, ...(note ? { note } : {}) };
      return [up, { code: card.code, ...back, text: sides[other], effects: [], role: `Side ${other}` }];
    }
    return [{ code: card.code, ...described, ...(keywords.length > 0 ? { keywords } : {}), ...(tokens.length > 0 ? { tokens } : {}), ...(detail ? { detail } : {}), ...questTitle(game, ctx, id, described.name, line), ...turned, ...steps, effects, ...(lostIsland ? { lostIsland } : {}), ...(role ? { role } : {}), ...(note ? { note } : {}), ...(refusal && note === refusal ? { noteTitle: "Cannot be chosen now" } : {}) }];
  });
  // The pressed card's place among the cards: each id before it gave none, one, or two (a contract's two sides).
  const pressed = Math.max(0, ids.indexOf(cardId));
  return { cards: groups.flat(), start: groups.slice(0, pressed).reduce((sum, group) => sum + group.length, 0) };
}
