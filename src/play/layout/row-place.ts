// Where the cards of the staging and the engagement rows stand: the groups a row holds (a guard over its objective, the Stormcaller's area), the
// fold stack that takes the cards a crowded row cannot show, and each enemy's shadow cards and the characters fighting it (layout.ts calls these).
import type { CardInstance } from "../../rules/core/state.ts";
import { pictureKey } from "../canvas/picture-key.ts";
import { hidesFace } from "../store/selectors.ts";
import type { ZoneEntry, ZoneId } from "../store/selectors.ts";
import type { CardSlot, CombatMark, FoldPlace, Rect } from "./layout.ts";
import { cardRect, footprint, MIN_TARGET, PAIR_STEP, placeStaging, placeUnder, rowXs, slotOf, type Metrics } from "./slots.ts";
import { groupCards, keeps, stagingRank, type FoldGroup } from "./row-fold.ts";
import { reachRow, type RowReach } from "./row-reach.ts";
import { areaGroupFold, areaWidth, isAreaGroup, placeArea } from "./stormcaller-layout.ts";
import { touch } from "../../ui/ui-scale.ts";

// A face-up shadow card sits beside its enemy at this scale.
const SHADOW_SCALE = 0.8;
// What a row needs to fold: the cards to keep, the fold stack's size and the sink for the stacks (row-fold.ts).
export type RowFolding = { keep: ReadonlySet<string> | undefined; pile: { w: number; h: number }; folds: FoldPlace[]; target: number; stacks: boolean };

// A fold stack as a pile-sized slot at the row's left end: the first folded card's face, "+n" and "More" (row-fold.ts).
function foldSlot(zone: "staging" | "engaged", stack: { x: number; w: number; cards: readonly string[]; top: string }, y: number, row: { h: number }, pile: { w: number; h: number }, byId: ReadonlyMap<string, CardInstance>, out: CardSlot[], folds: FoldPlace[], areaOnly = false): void {
  const rect: Rect = { x: stack.x, y: y + Math.round((row.h - pile.h) / 2), w: pile.w, h: pile.h };
  const top = byId.get(stack.top);
  const id = `fold:${zone}`;
  folds.push({ id, zone, rect, cards: stack.cards, top: stack.top, ...(areaOnly ? { area: true as const } : {}) });
  // The top card shows the side it lies on (the Stormcaller's Campaign Mode only side), never its code's other side.
  const side = top && top.face === "B" && !hidesFace(top) ? { picture: pictureKey(top) } : {};
  out.push({ ...rect, id, code: top && !hidesFace(top) ? top.code : "", ...side, zone, kind: "pile", exhausted: false, faceDown: top == null || hidesFace(top), landscape: false, resources: 0, damage: 0, progress: 0, tilt: 0, count: stack.cards.length, committed: false, fold: zone, ...(areaOnly ? { areaFold: true as const } : {}) });
}

/** Lays a row's cards into `out`, folding and reaching as `folding` and `reach` allow; true when it took the room past its own span. */
export function placeRow(placed: readonly ZoneEntry[], zone: ZoneId, area: Rect, size: { w: number; h: number }, out: CardSlot[], m: Metrics, folding?: RowFolding, reach: RowReach | null = null): boolean {
  // The selector orders a guard right after the objective it guards (selectors.ts, stagingOrder). A guard lies over the objective it guards, shifted by PAIR_STEP of its width, and the pair keeps a wider gap from its neighbours (rr.guarded).
  const groups: ZoneEntry[][] = [];
  // The guard's step over its objective: PAIR_STEP of a card, and never less than a 44 pt target of the objective left bare, so the objective's name and Guarded chip are not cut to a few letters on a small card (as the Stormcaller's area steps, stormcaller-layout.ts).
  const step = size.w * PAIR_STEP;
  for (const entry of placed) {
    const last = groups[groups.length - 1];
    if (zone === "staging" && entry.card.guard === true && last && last[0]?.card.id === entry.card.host) last.push(entry);
    else if (zone === "staging" && entry.area != null && entry.area !== "stage" && last && isAreaGroup(last)) last.push(entry);
    else groups.push([entry]);
  }
  const widths = groups.map((group) => (isAreaGroup(group) ? areaWidth(group.length - 1, size, m) : footprint((group[0] as ZoneEntry).card, size) + (group.length - 1) * step + (group.length > 1 ? m.gap : 0)));
  // The area's group never folds its stage, which carries the Stormcaller's progress; its cards fold first, those the moment does not ask about (stormcaller-layout.ts).
  const fold = folding && zone === "staging" ? reachRow(groups.map((group, at): FoldGroup => areaGroupFold(group, widths[at] ?? 0, size, m, folding.keep) ?? { id: group[0]?.card.id ?? "", width: widths[at] ?? 0, cards: groupCards(group), rank: stagingRank(group), pinned: keeps(group, folding.keep) }), { x: area.x, width: area.w, gap: m.gap, target: folding.target, stackW: folding.pile.w }, reach) : null;
  const xs = fold ? fold.xs : rowXs(widths, area.x, area.w, m.gap);
  if (fold?.stack && folding) {
    const areaIds = new Set(placed.filter((entry) => entry.area != null).map((entry) => entry.card.id));
    const areaOnly = fold.stack.cards.length > 0 && fold.stack.cards.every((id) => areaIds.has(id));
    foldSlot("staging", fold.stack, area.y, { h: size.h }, folding.pile, new Map(placed.map((entry) => [entry.card.id, entry.card])), out, folding.folds, areaOnly);
  }
  const gone = new Set(fold?.stack?.cards ?? []);
  groups.forEach((group, groupAt) => {
    const left = xs[groupAt];
    if (left == null) return;
    if (isAreaGroup(group)) {
      // The cards stand up to the next shown group's left edge, a target of the last one showing, or to the row's edge when it is the last group.
      const nextX = xs.slice(groupAt + 1).find((x): x is number => x != null);
      placeArea(group.filter((entry) => !gone.has(entry.card.id)), left, area.y, size, out, m, folding?.stacks === true, nextX ?? null, area.x + area.w, folding?.target ?? touch(m.scale, MIN_TARGET));
      return;
    }
    group.forEach((entry, at) => {
      const rect = cardRect(entry.card, left + at * step, area.y, size);
      if (zone === "staging" && folding?.stacks) placeStaging(entry, rect, out, m);
      else placeUnder(entry, zone, rect, out, [], m.peek);
      // A committed character stands a step higher, sent toward the quest.
      const lift = entry.card.committed ? -m.peek / 2 : 0;
      // An objective its guard lies over shows its name, pills and tokens in the part the guard leaves uncovered (`shown`, shownBounds).
      const covered = zone === "staging" && at < group.length - 1;
      out.push({ ...slotOf(entry.card, zone, "card", { ...rect, y: rect.y + lift }), ...(covered ? { shown: step } : {}) });
    });
  });
  // Whether the row took the room past its own span (row-reach.ts).
  return fold?.reached === true;
}

// The engagement area: each enemy, its resolved shadow cards beside it, then the characters fighting it.
function groupWidth(entry: ZoneEntry, size: { w: number; h: number }, m: Metrics): number {
  const shadowsUp = entry.attached.filter((card) => card.zone === "shadow" && card.face !== "down").length;
  const shadows = shadowsUp * (Math.round(size.w * SHADOW_SCALE) + m.gap / 2);
  const paired = entry.paired.length === 0 ? 0 : m.mark + footprint(entry.paired[0] as CardInstance, size) + (entry.paired.length - 1) * size.w * PAIR_STEP;
  return footprint(entry.card, size) + shadows + paired;
}

export function placeEngaged(entries: readonly ZoneEntry[], area: Rect, size: { w: number; h: number }, out: CardSlot[], marks: CombatMark[], preview: string | null, m: Metrics, folding?: RowFolding, attacker?: string | null, reach: RowReach | null = null): void {
  const widths = entries.map((entry) => groupWidth(entry, size, m) + (entry.paired.length > 0 ? m.gap : 0));
  // Enemies that are not attacking, not fighting and not in the open moment fold, oldest first (row-fold.ts).
  const fold = folding
    ? reachRow(entries.map((entry, at): FoldGroup => ({ id: entry.card.id, width: widths[at] ?? 0, cards: groupCards([entry]), rank: 1, pinned: keeps([entry], folding.keep) || entry.paired.length > 0 || entry.card.id === attacker })), { x: area.x, width: area.w, gap: m.gap, target: folding.target, stackW: folding.pile.w }, reach)
    : null;
  const xs = fold ? fold.xs : rowXs(widths, area.x, area.w, m.gap);
  if (fold?.stack && folding) foldSlot("engaged", fold.stack, area.y, { h: size.h }, folding.pile, new Map(entries.map((entry) => [entry.card.id, entry.card])), out, folding.folds);
  entries.forEach((entry, index) => {
    const left = xs[index];
    if (left == null) return;
    const x = left;
    const rect = cardRect(entry.card, x, area.y, size);
    const faceUp: CardInstance[] = [];
    placeUnder(entry, "engaged", rect, out, faceUp, m.peek);
    out.push(slotOf(entry.card, "engaged", "card", rect));
    let at = x + footprint(entry.card, size) + m.gap / 2;
    const small = { w: Math.round(size.w * SHADOW_SCALE), h: Math.round(size.h * SHADOW_SCALE) };
    for (const shadow of faceUp) {
      out.push(slotOf(shadow, "engaged", "shadow", { x: at, y: area.y + (size.h - small.h), w: small.w, h: small.h }));
      at += small.w + m.gap / 2;
    }
    if (entry.paired.length === 0) return;
    marks.push({ x: at + m.mark / 2 - m.gap / 4, y: area.y + size.h / 2, kind: entry.fight ?? "defense", enemyId: entry.card.id, preview: preview === entry.card.id });
    at += m.mark;
    // A character drawn here brings no attachment strips with it; the preview still lists them.
    entry.paired.forEach((fighter, pairIndex) => {
      out.push(slotOf(fighter, "engaged", "card", cardRect(fighter, at + pairIndex * size.w * PAIR_STEP, area.y, size)));
    });
  });
}
