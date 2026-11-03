// Where each zone, pile and card sits on the one table canvas, which is always wider than it is tall: the table is played
// in landscape (docs/design-system-table.md). Pure geometry: the canvas draws these rectangles, and the drag worklets
// hit-test them on the UI thread (the functions marked "worklet" run there; in Node the directive is an unused string).
//
// The quest stage, the active location and the player's deck and discard pile make a column at the left. To its right, top
// to bottom: staging (the encounter deck and its discard pile at its right end), the engagement area (each engaged enemy
// with its shadow cards and the characters fighting it), the play area, and the hand, which peeks up from the bottom edge.
import type { CardInstance } from "../rules/core/state.ts";

import { unturn } from "./frame.ts";
import { pictureKey } from "./picture-key.ts";
import { hidesFace } from "./selectors.ts";
import type { BasePileId, FightKind, PileId, PileView, SecondPileId, VictoryPileId, ZoneEntry, ZoneId, ZoneView } from "./selectors.ts";
import { ASPECT, cardRect, deepestUnder, footprint, MIN_TARGET, PAIR_STEP, placeStaging, placeUnder, rowXs, slotOf, type Metrics } from "./layout-slots.ts";
import { placePlay, playPlan } from "./play-area.ts";
import { foldRow, groupCards, keeps, stagingRank, type FoldGroup } from "./row-fold.ts";
import { lookBands, lookStrip } from "./look-strip.ts";
import { areaGroupFold, areaWidth, isAreaGroup, placeArea } from "./stormcaller-layout.ts";
import type { AreaRole } from "./stormcaller-table.ts";
import { acrossGaps, DOWN, downGaps, SLACK } from "./table-spacing.ts";
import { touch } from "./ui-scale.ts";

export { MIN_TARGET } from "./layout-slots.ts";
export { PLAY_FLOOR, SHIP_GAP } from "./play-area.ts";

export type Rect = { x: number; y: number; w: number; h: number };

// A "pile" is a deck, a discard pile, or a row's fold stack (`fold:staging`, `fold:engaged`: row-fold.ts).
export type SlotKind = "card" | "attachment" | "shadow" | "pile";

export type SlotZone = ZoneId | PileId;

export type CardSlot = Rect & {
  id: string;
  code: string;
  // The picture drawn for it (picture-key.ts): `<code>.B` on a card turned to its B side. Its code when absent.
  picture?: string;
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
  // The one peek of a staging card with more than one card under it (a grappled arm, Black Key on the Raider Flagship): how many are under it, drawn as "×2".
  stack?: number;
  // A card of a Sailing test's look (look-strip.ts): how many success symbols its ledger side prints; absent on every other slot. Drawn over the table, face up, with its medallion.
  success?: number;
  // A row's fold stack (`fold:staging`): the zone it folds, with the count strip "+n" and the word "More" (row-fold.ts). `count` is the cards in it.
  fold?: "staging" | "engaged";
  // The fold stack that holds only the Stormcaller's area (its title and word say so): the row list opens as "Stormcaller's area".
  areaFold?: true;
  // A card of the Stormcaller's area (stormcaller-table.ts): `stage` its current quest stage, drawn sideways; `apart` a card of the area while the players are at another stage, under the night veil.
  stormcaller?: AreaRole;
  // The stage's width its area cards leave uncovered: the strip, the tokens and the pops are drawn in that part (`shownBounds`).
  shown?: number;
  // A card of the back row of two stacked play rows: the screen y where the front row starts. Its tokens, effects and pops are drawn
  // in the band above it, so a hero's resources are not hidden under the row in front (user request, 2026-11-01; `shownBounds`).
  coveredFrom?: number;
  // The victory display's pile: the pictures of the cards fanned behind its top (the oldest first) and the Victory points its cards score, on its gold coin.
  fan?: readonly string[];
  points?: number;
};

// The mark between an engaged enemy and the characters fighting it: a defense, the hero an undefended attack hits, or an
// attack by the players.
// `preview` marks a fight the player has picked but not confirmed yet.
export type CombatMark = { x: number; y: number; kind: FightKind; enemyId: string; preview: boolean };

// The four piles every table has, the second slot's when the scenario declares it (the Corsair pair: dcce.corsair-deck), and the victory display while a card is in it.
export type TablePiles<T> = Readonly<Record<BasePileId, T>> & Partial<Readonly<Record<SecondPileId | VictoryPileId, T>>>;

/** A row's fold stack: where it stands, the cards that left the row, and the card whose face it shows (row-fold.ts). */
export type FoldPlace = { id: string; zone: "staging" | "engaged"; rect: Rect; cards: readonly string[]; top: string; area?: true };

export type TableLayout = {
  width: number;
  height: number;
  card: { w: number; h: number };
  zones: Readonly<Record<ZoneId, Rect>>;
  piles: TablePiles<Rect>;
  // The cards that left staging or the engagement area for a fold stack are on no slot: the row list shows them.
  folds?: readonly FoldPlace[];
  slots: readonly CardSlot[];
  marks: readonly CombatMark[];
  // The enemy whose attack is in progress, edged on the table from the moment it attacks.
  attacker: string | null;
  // The UI scale the table was laid out at (ui-scale.ts), for the worklets that hit-test and spread it; absent means 1.
  scale?: number;
};

export type LayoutViews = Readonly<Record<ZoneId, ZoneView>>;
export type PileViews = TablePiles<PileView>;

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
  // The cards a Sailing test looked at, top of the deck first, with the success symbols each prints: laid in a strip over staging (look-strip.ts).
  look?: readonly { card: CardInstance; success: number }[];
  // The sea family's staging stacks: a staging card with more than one card under it shows one peek and a count (placeStaging). Off, every attachment peeks as it always did.
  stacks?: boolean;
  // The cards a fold must keep on the table (row-fold.ts): those the open moment asks about, the picked ones and the one the banner's beat names.
  keep?: ReadonlySet<string>;
  // The UI scale (ui-scale.ts, user request, 2026-10-28): the gutter, the gaps, the peeks, the hand's strip, the combat marks' room and the
  // card's cap and floor are Medium's sizes times it. The 44 pt hit target is a floor (`touch`). Default 1.
  scale?: number;
};

// These are Medium's sizes; `metricsOf` multiplies them by the UI scale.
const GUTTER = 8;
const GAP = 6;
export const PEEK = 10;
// How much of a hand card shows above the bottom edge: a share of the card, and never less than a 44 pt target plus the
// fan's drop at the ends (at a UI scale the target is `touch`, and the drop is scaled).
export const HAND_SHOW = 0.56;
const HAND_MIN = 52;
// The left column is one and a half cards wide: the quest card is printed sideways.
const LEFT = 1.5;
// A face-up shadow card sits beside its enemy at this scale.
const SHADOW_SCALE = 0.8;
// Room for the mark between an enemy and the characters fighting it.
const MARK = 16;
// The card's widest and narrowest, and the fan's drop per card from the middle.
const CARD_MAX = 120;
const CARD_MIN = 34;
const FAN_DROP = 2;
// How far the victory pile's fan reaches left of the pile, as a share of the pile's height (canvas-pieces.native.tsx turns the cards behind it up to 14 degrees).
export const VICTORY_FAN = 0.25;

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


/**
 * The size of a hand card: the table's card while `count` cards fit across `width` with each covering at most half of the one under
 * it; past that, the largest card that does (user request, 2026-11-01: a long hand overlaps by up to half a card before its cards
 * shrink, and fills the strip). Never under 36 pt; at the floor the cards overlap more.
 */
export function handCardSize(card: { w: number; h: number }, width: number, count: number, scale = 1): { w: number; h: number } {
  if (count <= 1) return card;
  const w = Math.max(Math.round(HAND_FLOOR * scale), Math.min(card.w, Math.floor((2 * width) / (count + 1))));
  return w === card.w ? card : { w, h: Math.round(w * ASPECT) };
}

// The narrowest hand card, in Medium's points.
const HAND_FLOOR = 36;

// What a row needs to fold: the cards to keep, the fold stack's size and the sink for the stacks (row-fold.ts).
type RowFolding = { keep: ReadonlySet<string> | undefined; pile: { w: number; h: number }; folds: FoldPlace[]; target: number; stacks: boolean };

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

function placeRow(entries: readonly ZoneEntry[], zone: ZoneId, area: Rect, size: { w: number; h: number }, out: CardSlot[], m: Metrics, folding?: RowFolding): void {
  // A guard lies over the objective it guards, shifted by PAIR_STEP of its width, and the pair keeps a wider gap from its neighbours (rr.guarded).
  const groups: ZoneEntry[][] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (zone === "staging" && entry.card.guard === true && last && last[0]?.card.id === entry.card.host) last.push(entry);
    else if (zone === "staging" && entry.area != null && entry.area !== "stage" && last && isAreaGroup(last)) last.push(entry);
    else groups.push([entry]);
  }
  const widths = groups.map((group) => (isAreaGroup(group) ? areaWidth(group.length - 1, size, m) : footprint((group[0] as ZoneEntry).card, size) + (group.length - 1) * size.w * PAIR_STEP + (group.length > 1 ? m.gap : 0)));
  // The area's group never folds its stage, which carries the Stormcaller's progress; its cards fold first, those the moment does not ask about (stormcaller-layout.ts).
  const fold = folding && zone === "staging" ? foldRow(groups.map((group, at): FoldGroup => areaGroupFold(group, widths[at] ?? 0, size, m, folding.keep) ?? { id: group[0]?.card.id ?? "", width: widths[at] ?? 0, cards: groupCards(group), rank: stagingRank(group), pinned: keeps(group, folding.keep) }), { x: area.x, width: area.w, gap: m.gap, target: folding.target, stackW: folding.pile.w }) : null;
  const xs = fold ? fold.xs : rowXs(widths, area.x, area.w, m.gap);
  if (fold?.stack && folding) {
    const areaIds = new Set(entries.filter((entry) => entry.area != null).map((entry) => entry.card.id));
    const areaOnly = fold.stack.cards.length > 0 && fold.stack.cards.every((id) => areaIds.has(id));
    foldSlot("staging", fold.stack, area.y, { h: size.h }, folding.pile, new Map(entries.map((entry) => [entry.card.id, entry.card])), out, folding.folds, areaOnly);
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
      const rect = cardRect(entry.card, left + at * size.w * PAIR_STEP, area.y, size);
      if (zone === "staging" && folding?.stacks) placeStaging(entry, rect, out, m);
      else placeUnder(entry, zone, rect, out, [], m.peek);
      // A committed character stands a step higher, sent toward the quest.
      const lift = entry.card.committed ? -m.peek / 2 : 0;
      out.push(slotOf(entry.card, zone, "card", { ...rect, y: rect.y + lift }));
    });
  });
}

// The engagement area: each enemy, its resolved shadow cards beside it, then the characters fighting it.
function groupWidth(entry: ZoneEntry, size: { w: number; h: number }, m: Metrics): number {
  const shadowsUp = entry.attached.filter((card) => card.zone === "shadow" && card.face !== "down").length;
  const shadows = shadowsUp * (Math.round(size.w * SHADOW_SCALE) + m.gap / 2);
  const paired = entry.paired.length === 0 ? 0 : m.mark + footprint(entry.paired[0] as CardInstance, size) + (entry.paired.length - 1) * size.w * PAIR_STEP;
  return footprint(entry.card, size) + shadows + paired;
}

function placeEngaged(entries: readonly ZoneEntry[], area: Rect, size: { w: number; h: number }, out: CardSlot[], marks: CombatMark[], preview: string | null, m: Metrics, folding?: RowFolding, attacker?: string | null): void {
  const widths = entries.map((entry) => groupWidth(entry, size, m) + (entry.paired.length > 0 ? m.gap : 0));
  // Enemies that are not attacking, not fighting and not in the open moment fold, oldest first (row-fold.ts).
  const fold = folding
    ? foldRow(entries.map((entry, at): FoldGroup => ({ id: entry.card.id, width: widths[at] ?? 0, cards: groupCards([entry]), rank: 1, pinned: keeps([entry], folding.keep) || entry.paired.length > 0 || entry.card.id === attacker })), { x: area.x, width: area.w, gap: m.gap, target: folding.target, stackW: folding.pile.w })
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
  // The Uncharted deck is drawn as its top card's Lost Island side, never the real one.
  const lostIsland = view.pile === "unchartedDeck" && top ? { picture: pictureKey(top) } : {};
  // The victory display: its top on the side it lies, the cards fanned behind it and its Victory points.
  const victory = view.pile === "victory" && top ? { picture: pictureKey(top), fan: (view.fan ?? []).map(pictureKey), points: view.points ?? 0 } : {};
  return view.pile === "deck" && deckTop ? { ...base, ...chained, id: deckTop.id, kind: "card" } : { ...base, ...chained, ...lostIsland, ...victory };
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
  // Across: a canvas wider than a table of capped cards needs widens its edges and the gap beside the left column, within caps;
  // the rest widens the rows. A phone's card is not at its cap, so nothing moves.
  const capped = card.w >= Math.floor(CARD_MAX * scale);
  const across = acrossGaps(capped ? width - (3 * gutter + 5 * gap + (6 + LEFT) * card.w) : 0, card.w);
  const leftX = gutter + across.left;
  const rightGutter = gutter + across.right;
  const leftW = Math.round(card.w * LEFT);
  const pile = { w: Math.floor((leftW - gap) / 2), h: Math.round(Math.floor((leftW - gap) / 2) * ASPECT) };
  const centerX = leftX + leftW + gutter + across.column;
  const centerW = width - rightGutter - centerX;

  // Rows, top to bottom, laid out at their minimum gaps first. The band is as deep as its deepest stack: an enemy with two
  // face-down shadow cards peeks out two steps under it.
  const engagedH = card.h + peek * Math.max(1, deepestUnder(views.engaged.entries));
  const oneRow = card.h + 2 * peek;
  // The peek of a staging card with cards under it (a grappled enemy: one peek and its count) hangs below the card by a peek, deeper than the gap: the engagement row starts under it.
  const stagingDrop = options.stacks ? Math.max(gap, peek * Math.min(1, deepestUnder(views.staging.entries))) : gap;
  const shown = Math.max(m.handMin, Math.round(card.h * HAND_SHOW));
  const restY = height - bottom - shown;
  // The room under the play area's one row, down to a gap above the hand: the play area's extra rows take it first, and the gaps
  // share what is left (table-spacing.ts).
  const spare = restY - gap - (gutter + card.h + stagingDrop + engagedH + gap + oneRow);
  const plan = playPlan(views.play.entries, centerW, card, oneRow, oneRow + Math.max(0, spare), m);
  const grow = downGaps(spare, card.h, scale, plan.h - oneRow);
  const stagingY = gutter + grow.top;
  const engagedY = stagingY + card.h + stagingDrop + grow.stagingEngaged;
  const playY = engagedY + engagedH + gap + grow.engagedPlay;
  const playH = plan.h;
  // Ground no gap can take (a tall tablet) raises the hand, up to its whole card: a tablet player reads the hand without the scrub.
  const ground = grow.playHand - DOWN.playHand.cap * card.h - SLACK * scale;
  const handY = restY - Math.min(Math.max(0, ground), Math.max(0, card.h - shown));

  // The encounter deck and its discard pile at the right end of staging, and right of them the victory display while a card is in it, with
  // room on its left for the cards fanned behind its top (docs/design-system-table.md, Piles).
  const encounterW = 2 * pile.w + gap;
  const victoryW = piles.victory ? pile.w + Math.round(pile.h * VICTORY_FAN) + gap : 0;
  const staging: Rect = { x: centerX, y: stagingY, w: Math.max(card.w, centerW - encounterW - victoryW - gap), h: card.h };
  const pileY = stagingY + Math.round((card.h - pile.h) / 2);
  const encounterDeck: Rect = { x: width - rightGutter - victoryW - encounterW, y: pileY, w: pile.w, h: pile.h };
  const victory: Rect = { x: width - rightGutter - pile.w, y: pileY, w: pile.w, h: pile.h };
  const encounterDiscard: Rect = { x: encounterDeck.x + pile.w + gap, y: pileY, w: pile.w, h: pile.h };
  // The second slot of piles (a scenario with a second deck: the Corsair pair) stands under the encounter pair, at the right end of the engagement area, as wide as the pair;
  // the engagement area narrows by that width and a gap only while the slot is declared. A deck alone takes the left place (docs/design-system-table.md, Piles).
  const second = piles.corsairDeck != null || piles.corsairDiscard != null || piles.unchartedDeck != null;
  const secondY = engagedY + Math.round((card.h - pile.h) / 2);
  const corsairDeck: Rect = { x: encounterDeck.x, y: secondY, w: pile.w, h: pile.h };
  const corsairDiscard: Rect = { x: encounterDiscard.x, y: secondY, w: pile.w, h: pile.h };
  const unchartedDeck = corsairDeck;

  // The left column: the quest card (sideways) level with staging, the active location level with the engagement area, the
  // player's deck and discard pile level with the play area.
  const questW = leftW;
  const questH = Math.round(questW / ASPECT);
  const questStage: Rect = { x: leftX, y: stagingY + Math.max(0, Math.round((card.h - questH) / 2)), w: questW, h: questH };
  const hasSecond = views.secondActiveLocation.entries.length > 0;
  const location = hasSecond ? { w: Math.floor((leftW - gap) / 2), h: Math.round(Math.floor((leftW - gap) / 2) * ASPECT) } : card;
  const activeLocation: Rect = { x: leftX + (hasSecond ? 0 : Math.round((leftW - card.w) / 2)), y: engagedY, w: location.w, h: location.h };
  const secondActiveLocation: Rect = hasSecond ? { x: leftX + location.w + gap, y: engagedY, w: location.w, h: location.h } : { x: leftX, y: engagedY, w: 0, h: 0 };
  const deck: Rect = { x: leftX, y: playY + Math.round((card.h - pile.h) / 2), w: pile.w, h: pile.h };
  const discard: Rect = { x: leftX + pile.w + gap, y: deck.y, w: pile.w, h: pile.h };

  const engaged: Rect = { x: centerX, y: engagedY, w: second ? Math.max(card.w, centerW - encounterW - victoryW - gap) : centerW, h: engagedH };
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
  // Staging and the engagement area squeeze to 44 pt steps and then fold the groups the moment does not ask about into a stack at the row's left end (row-fold.ts).
  const folds: FoldPlace[] = [];
  const folding: RowFolding = { keep: options.keep, pile, folds, target: touch(scale, MIN_TARGET), stacks: options.stacks === true };
  placeRow(views.staging.entries, "staging", staging, card, slots, m, folding);
  placeEngaged(views.engaged.entries, engaged, card, slots, marks, options.preview?.enemyId ?? null, m, folding, options.attacker ?? null);
  placePlay(plan, play, slots, m);
  const pileRects: TablePiles<Rect> = { deck, discard, encounterDeck, encounterDiscard, ...(piles.corsairDeck ? { corsairDeck } : {}), ...(piles.corsairDiscard ? { corsairDiscard } : {}), ...(piles.unchartedDeck ? { unchartedDeck } : {}), ...(piles.victory ? { victory } : {}) };
  // An encounter card attached to the deck (Iron Shackles) peeks out above it, drawn before the deck, so the "Deck" label under the deck never
  // covers it; a tap on the deck opens it (table-view.tsx).
  const held = piles.deck.attached ?? [];
  held.forEach((attached, at) => slots.push(slotOf(attached, "play", "attachment", { x: deck.x, y: deck.y - (held.length - at) * peek, w: deck.w, h: deck.h })));
  for (const id of ["deck", "discard", "encounterDeck", "encounterDiscard"] as const) slots.push(pileSlot(piles[id], pileRects[id], options.deckTop));
  for (const id of ["corsairDeck", "corsairDiscard", "unchartedDeck", "victory"] as const) {
    const view = piles[id];
    const rect = pileRects[id];
    if (view && rect) slots.push(pileSlot(view, rect, undefined));
  }

  // A Sailing test's look: the cards come off the encounter deck face up and stand in a strip over staging, then the engagement band and the play band (look-strip.ts).
  if (options.look && options.look.length > 0) {
    const strip = lookStrip(options.look.length, lookBands({ zones: { staging, engaged, play } }), card, gap, touch(scale, MIN_TARGET));
    options.look.forEach((row, index) => {
      const place = strip.places[index];
      if (place) slots.push({ ...slotOf(row.card, "encounterDeck", "card", place), faceDown: false, success: row.success });
    });
  }

  // The hand fans along the bottom edge, a slight turn from the middle out, overlapping evenly when it is long, each card covering at
  // most half of the one under it before the cards narrow (handCardSize). The picked card rises whole.
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
    folds,
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

/**
 * The part of a slot the strip, the tokens and the pops are drawn in: its bounds, narrowed to what the Stormcaller's area cards leave
 * uncovered of the stage, and cut off where the front row of stacked play rows starts.
 */
export function shownBounds(slot: CardSlot): Rect {
  const bounds = slotBounds(slot);
  const wide = slot.shown != null ? { ...bounds, w: Math.min(bounds.w, slot.shown) } : bounds;
  return slot.coveredFrom != null ? { ...wide, h: Math.max(0, Math.min(wide.h, slot.coveredFrom - wide.y)) } : wide;
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
