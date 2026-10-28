// Where each zone, pile and card sits on the one table canvas, which is always wider than it is tall: the table is played
// in landscape (docs/design-system.md, Table). Pure geometry: the canvas draws these rectangles, and the drag worklets
// hit-test them on the UI thread (the functions marked "worklet" run there; in Node the directive is an unused string).
//
// The quest stage, the active location and the player's deck and discard pile make a column at the left. To its right, top
// to bottom: staging (the encounter deck and its discard pile at its right end), the engagement area (each engaged enemy
// with its shadow cards and the characters fighting it), the play area, and the hand, which peeks up from the bottom edge.
import type { CardInstance } from "../rules/state.ts";

import { unturn } from "./frame.ts";
import type { FightKind, PileId, PileView, ZoneEntry, ZoneId, ZoneView } from "./selectors.ts";
import { isPrisoner } from "./selectors.ts";
import { touch } from "./ui-scale.ts";

export type Rect = { x: number; y: number; w: number; h: number };

export type SlotKind = "card" | "attachment" | "shadow" | "pile";

export type SlotZone = ZoneId | PileId;

export type CardSlot = Rect & {
  id: string;
  code: string;
  zone: SlotZone;
  kind: SlotKind;
  exhausted: boolean;
  faceDown: boolean;
  // Quest cards are printed sideways.
  landscape: boolean;
  resources: number;
  damage: number;
  progress: number;
  // A slight turn for the hand fan, in radians.
  tilt: number;
  // How many cards a pile holds; 0 for anything else.
  count: number;
  // Committed to the quest: drawn a step higher, with its willpower.
  committed: boolean;
  // The facedown prisoner of Escape from Dol Guldur (01123:B:1): its back wears a small hero mark and a tap still opens its preview.
  held?: true;
  // A deck with an encounter card attached to it (Iron Shackles, 01105:A:1): a chain on its count strip.
  chained?: true;
};

// The mark between an engaged enemy and the characters fighting it: a defense, the hero an undefended attack hits, or an
// attack by the players.
// `preview` marks a fight the player has picked but not confirmed yet.
export type CombatMark = { x: number; y: number; kind: FightKind; enemyId: string; preview: boolean };

export type TableLayout = {
  width: number;
  height: number;
  card: { w: number; h: number };
  zones: Readonly<Record<ZoneId, Rect>>;
  piles: Readonly<Record<PileId, Rect>>;
  slots: readonly CardSlot[];
  marks: readonly CombatMark[];
  // The enemy whose attack is in progress, edged on the table from the moment it attacks.
  attacker: string | null;
  // The UI scale the table was laid out at (ui-scale.ts), for the worklets that hit-test and spread it; absent means 1.
  scale?: number;
};

export type LayoutViews = Readonly<Record<ZoneId, ZoneView>>;
export type PileViews = Readonly<Record<PileId, PileView>>;

export type LayoutOptions = {
  // The hand card the player has picked: drawn whole above the bottom edge.
  raised?: string | null;
  // The bottom safe-area inset: the hand is laid out above it, out of the home indicator's zone.
  bottomInset?: number;
  // The enemy whose attack is in progress.
  attacker?: string | null;
  // A fight the player has picked and not confirmed: those characters are drawn beside that enemy already.
  preview?: { enemyId: string; ids: readonly string[]; kind: FightKind } | null;
  // The top card of the deck when the rules let the player play it (Gandalf, 142002): face up on the deck, and a card.
  deckTop?: CardInstance | null;
  // The UI scale (ui-scale.ts, user request, 2026-10-28): the gutter, the gaps, the peeks, the hand's strip, the combat marks' room and the
  // card's cap and floor are Medium's sizes times it. The 44 pt hit target is a floor (`touch`). Default 1.
  scale?: number;
};

// These are Medium's sizes; `metricsOf` multiplies them by the UI scale.
const GUTTER = 8;
const GAP = 6;
export const PEEK = 10;
const ASPECT = 1.4;
// How much of a hand card shows above the bottom edge: a share of the card, and never less than a 44 pt target plus the
// fan's drop at the ends (at a UI scale the target is `touch`, and the drop is scaled).
export const HAND_SHOW = 0.56;
const HAND_MIN = 52;
// The left column is one and a half cards wide: the quest card is printed sideways.
const LEFT = 1.5;
// A face-up shadow card sits beside its enemy at this scale.
const SHADOW_SCALE = 0.8;
// Characters fighting the same enemy overlap by this much of a card.
const PAIR_STEP = 0.72;
// Room for the mark between an enemy and the characters fighting it.
const MARK = 16;
// The card's widest and narrowest, and the fan's drop per card from the middle.
const CARD_MAX = 96;
const CARD_MIN = 34;
const FAN_DROP = 2;

// The sizes the layout works in, at one UI scale.
type Metrics = { scale: number; gutter: number; gap: number; peek: number; handMin: number; mark: number };
function metricsOf(scale: number): Metrics {
  return { scale, gutter: GUTTER * scale, gap: GAP * scale, peek: PEEK * scale, handMin: touch(scale, MIN_TARGET) + (HAND_MIN - MIN_TARGET) * scale, mark: MARK * scale };
}

/**
 * The card size that fits three rows, the hand's strip and seven cards across the canvas: the left column is one and a half
 * cards, the rest holds six.
 */
export function cardSize(width: number, height: number, scale = 1): { w: number; h: number } {
  const m = metricsOf(scale);
  const room = height - m.gutter - 3 * m.gap - 3 * m.peek;
  const byHeight = Math.min(room / (3 + HAND_SHOW), (room - m.handMin) / 3) / ASPECT;
  const byWidth = (width - 3 * m.gutter - 5 * m.gap) / (6 + LEFT);
  const w = Math.max(Math.round(CARD_MIN * scale), Math.floor(Math.min(byWidth, byHeight, CARD_MAX * scale)));
  return { w, h: Math.round(w * ASPECT) };
}

export const MIN_TARGET = 44;

/** The size of a hand card: the table's card, narrowed so `count` cards overlap by no more than leaves a 44 pt strip of each (more at Large, `touch`). */
export function handCardSize(card: { w: number; h: number }, width: number, count: number, scale = 1): { w: number; h: number } {
  if (count <= 1) return card;
  const w = Math.max(Math.round(36 * scale), Math.min(card.w, Math.floor(width - touch(scale, MIN_TARGET) * (count - 1))));
  return w === card.w ? card : { w, h: Math.round(w * ASPECT) };
}

function slotOf(card: CardInstance, zone: SlotZone, kind: SlotKind, rect: Rect, landscape = false, tilt = 0): CardSlot {
  return {
    ...rect,
    id: card.id,
    code: card.code,
    zone,
    kind,
    exhausted: card.exhausted,
    faceDown: card.face === "down",
    landscape,
    resources: card.resources,
    damage: card.damage,
    progress: card.progress,
    tilt,
    count: 0,
    committed: card.committed,
    ...(card.face === "down" && isPrisoner(card) ? { held: true as const } : {}),
  };
}

// The width a card takes in a row: an exhausted card is turned sideways.
function footprint(card: CardInstance, size: { w: number; h: number }): number {
  return card.exhausted ? size.h : size.w;
}

// Left edges for items of these widths across a row from `x` to `x + width`: spaced by one gap, squeezed (overlapping) when
// they do not fit.
function rowXs(widths: readonly number[], x: number, width: number, gap: number): number[] {
  if (widths.length === 0) return [];
  const natural = widths.reduce((sum, w) => sum + w, 0) + gap * (widths.length - 1);
  const squeeze = widths.length > 1 && natural > width ? (natural - width) / (widths.length - 1) : 0;
  const xs: number[] = [];
  let at = x;
  for (const w of widths) {
    xs.push(at);
    at += w + gap - squeeze;
  }
  return xs;
}

// A card at the left edge `x` of its footprint: an exhausted card is drawn centered in its sideways footprint.
function cardRect(card: CardInstance, x: number, y: number, size: { w: number; h: number }): Rect {
  const offset = card.exhausted ? (size.h - size.w) / 2 : 0;
  return { x: x + offset, y, w: size.w, h: size.h };
}

// Attachments and face-down shadow cards peek out from under the host, the most recent lowest.
function placeUnder(entry: ZoneEntry, zone: ZoneId, rect: Rect, out: CardSlot[], faceUpShadows: CardInstance[], peek: number): void {
  const under = entry.attached.filter((attached) => !(attached.zone === "shadow" && attached.face !== "down"));
  under.forEach((attached, at) => {
    const kind: SlotKind = attached.zone === "shadow" ? "shadow" : "attachment";
    out.push(slotOf(attached, zone, kind, { x: rect.x, y: rect.y + (under.length - at) * peek, w: rect.w, h: rect.h }));
  });
  faceUpShadows.push(...entry.attached.filter((attached) => attached.zone === "shadow" && attached.face !== "down"));
}

function placeRow(entries: readonly ZoneEntry[], zone: ZoneId, area: Rect, size: { w: number; h: number }, out: CardSlot[], m: Metrics): void {
  // A guard lies over the objective it guards, shifted by PAIR_STEP of its width, and the pair keeps a wider gap from its neighbours (rr.guarded).
  const groups: ZoneEntry[][] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (zone === "staging" && entry.card.guard === true && last && last[0]?.card.id === entry.card.host) last.push(entry);
    else groups.push([entry]);
  }
  const widths = groups.map((group) => footprint((group[0] as ZoneEntry).card, size) + (group.length - 1) * size.w * PAIR_STEP + (group.length > 1 ? m.gap : 0));
  const xs = rowXs(widths, area.x, area.w, m.gap);
  groups.forEach((group, groupAt) => {
    group.forEach((entry, at) => {
      const rect = cardRect(entry.card, (xs[groupAt] ?? area.x) + at * size.w * PAIR_STEP, area.y, size);
      placeUnder(entry, zone, rect, out, [], m.peek);
      // A committed character stands a step higher, sent toward the quest.
      const lift = entry.card.committed ? -m.peek / 2 : 0;
      out.push(slotOf(entry.card, zone, "card", { ...rect, y: rect.y + lift }));
    });
  });
}

// The most cards peeking out under one card of these entries: attachments and face-down shadow cards.
function deepestUnder(entries: readonly ZoneEntry[]): number {
  return Math.max(0, ...entries.map((entry) => entry.attached.filter((attached) => !(attached.zone === "shadow" && attached.face !== "down")).length));
}

// The engagement area: each enemy, its resolved shadow cards beside it, then the characters fighting it.
function groupWidth(entry: ZoneEntry, size: { w: number; h: number }, m: Metrics): number {
  const shadowsUp = entry.attached.filter((card) => card.zone === "shadow" && card.face !== "down").length;
  const shadows = shadowsUp * (Math.round(size.w * SHADOW_SCALE) + m.gap / 2);
  const paired = entry.paired.length === 0 ? 0 : m.mark + footprint(entry.paired[0] as CardInstance, size) + (entry.paired.length - 1) * size.w * PAIR_STEP;
  return footprint(entry.card, size) + shadows + paired;
}

function placeEngaged(entries: readonly ZoneEntry[], area: Rect, size: { w: number; h: number }, out: CardSlot[], marks: CombatMark[], preview: string | null, m: Metrics): void {
  const widths = entries.map((entry) => groupWidth(entry, size, m) + (entry.paired.length > 0 ? m.gap : 0));
  const xs = rowXs(widths, area.x, area.w, m.gap);
  entries.forEach((entry, index) => {
    const x = xs[index] ?? area.x;
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

function pileSlot(view: PileView, rect: Rect, deckTop: CardInstance | null | undefined): CardSlot {
  const top = view.pile === "deck" ? (deckTop ?? null) : view.top;
  const base: CardSlot = {
    ...rect,
    id: `pile:${view.pile}`,
    code: top?.code ?? "",
    zone: view.pile,
    kind: "pile",
    exhausted: false,
    faceDown: top == null,
    landscape: false,
    resources: 0,
    damage: 0,
    progress: 0,
    tilt: 0,
    count: view.ids.length,
    committed: false,
  };
  // A deck whose top card can be played (Gandalf) is that card: it is picked up and played like a card in the hand.
  const chained = view.pile === "deck" && (view.attached?.length ?? 0) > 0 ? { chained: true as const } : {};
  return view.pile === "deck" && deckTop ? { ...base, ...chained, id: deckTop.id, kind: "card" } : { ...base, ...chained };
}

// The views with a picked, unconfirmed fight drawn as if it were declared: the characters leave the play area and stand
// beside the enemy.
function withPreview(views: LayoutViews, preview: NonNullable<LayoutOptions["preview"]>): LayoutViews {
  const moving = new Set(preview.ids);
  const fighters = views.play.entries.filter((entry) => moving.has(entry.card.id)).map((entry) => entry.card);
  if (fighters.length === 0) return views;
  const engaged = views.engaged.entries.map((entry) => (entry.card.id === preview.enemyId && entry.paired.length === 0 ? { ...entry, paired: fighters, fight: preview.kind } : entry));
  return { ...views, play: { ...views.play, entries: views.play.entries.filter((entry) => !moving.has(entry.card.id)) }, engaged: { ...views.engaged, entries: engaged } };
}

/**
 * The table for one seat. `views` are the zones, `piles` the four piles.
 */
export function tableLayout(
  width: number,
  height: number,
  given: LayoutViews,
  piles: PileViews,
  options: LayoutOptions = {},
): TableLayout {
  const views = options.preview ? withPreview(given, options.preview) : given;
  const bottom = options.bottomInset ?? 0;
  const scale = options.scale ?? 1;
  const m = metricsOf(scale);
  const { gutter, gap, peek } = m;
  const card = cardSize(width, height - bottom, scale);
  const leftW = Math.round(card.w * LEFT);
  const pile = { w: Math.floor((leftW - gap) / 2), h: Math.round(Math.floor((leftW - gap) / 2) * ASPECT) };
  const centerX = gutter + leftW + gutter;
  const centerW = width - gutter - centerX;

  // Rows, top to bottom.
  const stagingY = gutter;
  const engagedY = stagingY + card.h + gap;
  // The band is as deep as its deepest stack: an enemy with two face-down shadow cards peeks out two steps under it.
  const engagedH = card.h + peek * Math.max(1, deepestUnder(views.engaged.entries));
  const playY = engagedY + engagedH + gap;
  const playH = card.h + 2 * peek;
  const handY = height - bottom - Math.max(m.handMin, Math.round(card.h * HAND_SHOW));

  // The encounter deck and its discard pile at the right end of staging.
  const encounterW = 2 * pile.w + gap;
  const staging: Rect = { x: centerX, y: stagingY, w: Math.max(card.w, centerW - encounterW - gap), h: card.h };
  const pileY = stagingY + Math.round((card.h - pile.h) / 2);
  const encounterDeck: Rect = { x: width - gutter - encounterW, y: pileY, w: pile.w, h: pile.h };
  const encounterDiscard: Rect = { x: encounterDeck.x + pile.w + gap, y: pileY, w: pile.w, h: pile.h };

  // The left column: the quest card (sideways) level with staging, the active location level with the engagement area, the
  // player's deck and discard pile level with the play area.
  const questW = leftW;
  const questH = Math.round(questW / ASPECT);
  const questStage: Rect = { x: gutter, y: stagingY + Math.max(0, Math.round((card.h - questH) / 2)), w: questW, h: questH };
  const hasSecond = views.secondActiveLocation.entries.length > 0;
  const location = hasSecond ? { w: Math.floor((leftW - gap) / 2), h: Math.round(Math.floor((leftW - gap) / 2) * ASPECT) } : card;
  const activeLocation: Rect = { x: gutter + (hasSecond ? 0 : Math.round((leftW - card.w) / 2)), y: engagedY, w: location.w, h: location.h };
  const secondActiveLocation: Rect = hasSecond ? { x: gutter + location.w + gap, y: engagedY, w: location.w, h: location.h } : { x: gutter, y: engagedY, w: 0, h: 0 };
  const deck: Rect = { x: gutter, y: playY + Math.round((card.h - pile.h) / 2), w: pile.w, h: pile.h };
  const discard: Rect = { x: gutter + pile.w + gap, y: deck.y, w: pile.w, h: pile.h };

  const engaged: Rect = { x: centerX, y: engagedY, w: centerW, h: engagedH };
  const play: Rect = { x: centerX, y: playY, w: centerW, h: playH };
  const hand: Rect = { x: gutter, y: handY, w: width - 2 * gutter, h: height - handY };

  const slots: CardSlot[] = [];
  const marks: CombatMark[] = [];
  const stageEntry = views.questStage.entries[0];
  if (stageEntry) slots.push(slotOf(stageEntry.card, "questStage", "card", questStage, true));
  for (const [id, rect] of [["activeLocation", activeLocation], ["secondActiveLocation", secondActiveLocation]] as const) {
    const entry = views[id].entries[0];
    if (!entry) continue;
    placeUnder(entry, id, rect, slots, [], peek);
    slots.push(slotOf(entry.card, id, "card", rect));
  }
  placeRow(views.staging.entries, "staging", staging, card, slots, m);
  placeEngaged(views.engaged.entries, engaged, card, slots, marks, options.preview?.enemyId ?? null, m);
  placeRow(views.play.entries, "play", play, card, slots, m);
  const pileRects: Record<PileId, Rect> = { deck, discard, encounterDeck, encounterDiscard };
  // An encounter card attached to the deck (Iron Shackles) peeks out above it, drawn before the deck, so the "Deck" label under the deck never
  // covers it; a tap on the deck opens it (table-view.tsx).
  const held = piles.deck.attached ?? [];
  held.forEach((attached, at) => slots.push(slotOf(attached, "play", "attachment", { x: deck.x, y: deck.y - (held.length - at) * peek, w: deck.w, h: deck.h })));
  for (const id of ["deck", "discard", "encounterDeck", "encounterDiscard"] as const) slots.push(pileSlot(piles[id], pileRects[id], options.deckTop));

  // The hand fans along the bottom edge, a slight turn from the middle out, overlapping when it is long. Each card keeps at
  // least a 44 pt strip to touch: a long hand narrows its cards before the strip gets thinner. The picked card rises whole.
  const handEntries = views.hand.entries;
  const handCard = handCardSize(card, hand.w, handEntries.length, scale);
  const xs = rowXs(handEntries.map(() => handCard.w), hand.x, hand.w, gap);
  const middle = (handEntries.length - 1) / 2;
  handEntries.forEach((entry, index) => {
    const offset = index - middle;
    const raised = options.raised === entry.card.id;
    const y = raised ? height - bottom - handCard.h - gap : handY + Math.abs(offset) * FAN_DROP * scale;
    slots.push(slotOf(entry.card, "hand", "card", { x: xs[index] ?? hand.x, y, w: handCard.w, h: handCard.h }, false, raised ? 0 : offset * 0.03));
  });

  return {
    width,
    height,
    card,
    zones: { questStage, staging, activeLocation, secondActiveLocation, engaged, play, hand },
    piles: pileRects,
    slots,
    marks,
    attacker: options.attacker ?? null,
    scale,
  };
}

/** The rectangle a slot covers on screen: an exhausted card is turned sideways about its center. */
export function slotBounds(slot: CardSlot): Rect {
  "worklet";
  if (!slot.exhausted) return slot;
  return { x: slot.x + (slot.w - slot.h) / 2, y: slot.y + (slot.h - slot.w) / 2, w: slot.h, h: slot.w };
}

/** The rectangle a tap or a drag finds a slot in: its bounds, grown to 44 pt for a pile drawn smaller than that. */
export function hitBounds(slot: CardSlot): Rect {
  "worklet";
  const bounds = slotBounds(slot);
  if (slot.kind !== "pile" || (bounds.w >= MIN_TARGET && bounds.h >= MIN_TARGET)) return bounds;
  const w = Math.max(bounds.w, MIN_TARGET);
  const h = Math.max(bounds.h, MIN_TARGET);
  return { x: bounds.x - (w - bounds.w) / 2, y: bounds.y - (h - bounds.h) / 2, w, h };
}

export function contains(rect: Rect, x: number, y: number): boolean {
  "worklet";
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

/** The topmost card slot under a point, or -1. Later slots are drawn on top. A tilted card is hit where it is drawn. */
export function hitSlot(slots: readonly CardSlot[], x: number, y: number): number {
  "worklet";
  for (let index = slots.length - 1; index >= 0; index -= 1) {
    const slot = slots[index];
    if (!slot) continue;
    // A fanned card is tested as it is drawn: the point is turned back by the tilt about the card's center.
    const point = unturn(slot, x, y);
    if (contains(hitBounds(slot), point.x, point.y)) return index;
  }
  return -1;
}

// A drop target with the rectangle it occupies, so the worklet can test it without the layout.
export type DropRect = Rect & { target: string };

/** The drop target under a point, or "" when there is none. Card targets are tested before zones. */
export function hitDrop(drops: readonly DropRect[], x: number, y: number): string {
  "worklet";
  for (let index = 0; index < drops.length; index += 1) {
    const drop = drops[index];
    if (drop && contains(drop, x, y)) return drop.target;
  }
  return "";
}
