// Where each zone, pile and card sits on the one table canvas, which is always wider than it is tall: the table is played
// in landscape (docs/design-system-table.md). Pure geometry: the canvas draws these rectangles, and the drag worklets
// hit-test them on the UI thread (the functions marked "worklet" run there; in Node the directive is an unused string).
//
// The quest stage, the active location and the player's deck and discard pile make a column at the left. To its right, top
// to bottom: staging (the encounter deck and its discard pile at its right end), the engagement area (each engaged enemy
// with its shadow cards and the characters fighting it), the play area, and the hand, which peeks up from the bottom edge.
import type { CardInstance } from "../../rules/core/state.ts";

import { pictureKey } from "../canvas/picture-key.ts";
import type { BasePileId, FightKind, PileId, PileView, SecondPileId, VictoryPileId, ZoneId, ZoneView } from "../store/selectors.ts";
import { ASPECT, deepestUnder, heldDepth, holdsStrip, MIN_TARGET, placeCounted, placeUnder, rowXs, slotOf, stackedDepth, type Metrics } from "./slots.ts";
import { placePlay, playPlan } from "./play-area.ts";
import { placeEngaged, placeRow, type RowFolding } from "./row-place.ts";
import type { RowReach } from "./row-reach.ts";
import { lookBands, lookStrip } from "./look-strip.ts";
import type { AreaRole } from "../store/stormcaller-table.ts";
import { acrossGaps, DOWN, downGaps, SLACK } from "./table-spacing.ts";
import { touch } from "../../ui/ui-scale.ts";

export { MIN_TARGET } from "./slots.ts";
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
  // An unconscious character (hob.unconscious-characters): turned 180 degrees, upright in its footprint, and no sideways exhausted card.
  unconscious?: true;
  faceDown: boolean;
  // Quest cards are printed sideways.
  landscape: boolean;
  resources: number;
  damage: number;
  progress: number;
  // A slight turn for the hand fan, in radians.
  tilt: number;
  // An attachment's tap band (`bandBounds`): the peek it was laid out with and the lowest y the band may reach, the top of the hand (hits.ts).
  bandPeek?: number;
  bandFloor?: number;
  // A held character under its host (a hero, an ally or Abaan an encounter card holds, slots.ts HELD_STRIP): its strip is this many peeks tall, and reads its name at full size and its owner.
  strip?: number;
  // How many cards a pile holds; 0 for anything else.
  count: number;
  // Committed to the quest: drawn a step higher, with its willpower.
  committed: boolean;
  // The facedown prisoner of Escape from Dol Guldur (01123:B:1): its back wears a small hero mark and a tap still opens its preview.
  held?: true;
  // A facedown card of The Steward's Fear's underworld stack: the location it lies under, which a tap or a hold on the card opens in its place (the card has no code here, so nothing names it).
  opens?: string;
  // A facedown Reanimated Dead (The Dread Realm): a player card back with a small mark, and a tap or a hold opens a preview that says what it is.
  dead?: true;
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
  // The width of a back-row card the next card in its row leaves visible (its own width on the last one): its effect pills stay inside it.
  coveredStep?: number;
  // The victory display's pile: the pictures of the cards fanned behind its top (the oldest first) and the Victory points its cards score, on its gold coin.
  fan?: readonly string[];
  points?: number;
};

// The mark between an engaged enemy and the characters fighting it: a defense, the hero an undefended attack hits, or an
// attack by the players.
// `preview` marks a fight the player has picked but not confirmed yet.
export type CombatMark = { x: number; y: number; kind: FightKind; enemyId: string; preview: boolean };

// The second slot's decks, which stand in its left place, and its discard piles, in its right one.
const SECOND_DECKS = ["corsairDeck", "unchartedDeck", "grottoDeck", "evilCreaturesDeck", "balrogDeck", "ravenDeck", "cavesDeck", "haradDeck", "angmarOrcDeck", "powerOfMordorDeck", "smaugDeck", "investigationDeck", "sackDeck"] as const;
const SECOND_DISCARDS = ["corsairDiscard", "evilCreaturesDiscard", "balrogDiscard", "ravenDiscard", "smaugDiscard"] as const;
// The four piles every table has, the second slot's when the game has one (the Corsair pair: dcce.corsair-deck; the Evil Creatures pair or the Caves deck: emce.evil-creatures-deck, emce.caves-deck), and the victory display while a card is in it.
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
  // The staging row's foot with every staging card's peeks drawn, folded or not (column-reach.ts reads it, so the row's foot never depends on the fold).
  stagingFoot?: number;
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
  // The top card of the deck when the rules let the player play it now (Gandalf, 142002): face up on the deck, and a card picked up like a hand card.
  deckTop?: CardInstance | null;
  // The top card of a deck the seat plays with faceup but cannot play now (142002:A:1): drawn face up, and the deck stays a pile, whose tap opens the card.
  deckShown?: CardInstance | null;
  // The cards a Sailing test looked at, top of the deck first, with the success symbols each prints: laid in a strip over staging (look-strip.ts).
  look?: readonly { card: CardInstance; success: number }[];
  // The strip leaves the staging band to the cards that stand there (Discover's Loot objective and Hazard, which the banner rings above the veil): it lies in the engagement and play bands only (emce.discover).
  lookLeavesStaging?: boolean;
  // The sea family's staging stacks: a staging card with more than one card under it shows one peek and a count (placeStaging). Off, every attachment peeks as it always did.
  stacks?: boolean;
  // The cards a fold must keep on the table (row-fold.ts): those the open moment asks about, the picked ones and the one the banner's beat names.
  keep?: ReadonlySet<string>;
  // The command column lies over the canvas's right edge, `column` points wide past `width`; `reach` is how many top rows (staging, then the
  // engagement area) lie wholly above its dock and head (column-reach.ts). A crowded row it covers runs on under the column (row-reach.ts).
  column?: number;
  reach?: 0 | 1 | 2;
  // The UI scale (ui-scale.ts, user request, 2026-10-28): the gutter, the gaps, the peeks, the hand's strip, the combat marks' room and the
  // card's cap and floor are Medium's sizes times it. The 44 pt hit target is a floor (`touch`). Default 1.
  scale?: number;
};

// These are Medium's sizes; `metricsOf` multiplies them by the UI scale.
const GUTTER = 8;
const GAP = 6;
export const PEEK = 10;
// The gaps between a covered row's piles and the cards carried past them.
const PILE_BREAK = 3;
// How much of a hand card shows above the bottom edge: a share of the card, and never less than a 44 pt target plus the
// fan's drop at the ends (at a UI scale the target is `touch`, and the drop is scaled).
export const HAND_SHOW = 0.56;
const HAND_MIN = 52;
// The left column is one and a half cards wide: the quest card is printed sideways.
const LEFT = 1.5;
// Room for the mark between an enemy and the characters fighting it.
const MARK = 16;
// The card's widest and narrowest, and the fan's drop per card from the middle.
const CARD_MAX = 120;
const CARD_MIN = 34;
const FAN_DROP = 2;
// How far the victory pile's fan reaches left of the pile, as a share of the pile's height (canvas/pieces.native.tsx turns the cards behind it up to 14 degrees).
export const VICTORY_FAN = 0.25;

/** How much of a hand card shows above the bottom edge at rest: what a mark on a hand card must stay inside (canvas/under-mark.ts, handUnder). */
export function handShown(cardH: number, scale = 1): number {
  return Math.max(touch(scale, MIN_TARGET) + (HAND_MIN - MIN_TARGET) * scale, Math.round(cardH * HAND_SHOW));
}

/**
 * The height the held characters' strips take beyond what the rows keep: the staging row hangs a strip below its cards (the gap it replaces counts), and the engagement row is as deep as its deepest strip, each beyond the one peek the three rows keep.
 * Only a row that holds a strip adds anything, so no other table moves.
 */
function heldRoom(views: LayoutViews, m: Metrics, stacks: boolean): number {
  const staging = holdsStrip(views.staging.entries) ? Math.max(0, m.peek * (stacks ? stackedDepth(views.staging.entries) : heldDepth(views.staging.entries)) - m.gap) : 0;
  const engaged = holdsStrip(views.engaged.entries) ? m.peek * Math.max(0, deepestUnder(views.engaged.entries) - 1) : 0;
  return staging + engaged;
}

function metricsOf(scale: number): Metrics {
  return { scale, gutter: GUTTER * scale, gap: GAP * scale, peek: PEEK * scale, handMin: touch(scale, MIN_TARGET) + (HAND_MIN - MIN_TARGET) * scale, mark: MARK * scale };
}

/**
 * The card size that fits three rows, the hand's strip and seven cards across the canvas: the left column is one and a half
 * cards, the rest holds six. `extra` is the height a held character's strip takes beyond the three peeks the rows keep (`heldRoom`):
 * it comes off the room, so the play area keeps the room it has without a strip and no card or tap band goes under the hand.
 */
export function cardSize(width: number, height: number, scale = 1, extra = 0): { w: number; h: number } {
  const m = metricsOf(scale);
  const room = height - m.gutter - 3 * m.gap - 3 * m.peek - extra;
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

function pileSlot(view: PileView, rect: Rect, deckTop: CardInstance | null | undefined, deckShown?: CardInstance | null): CardSlot {
  const top = view.pile === "deck" ? (deckTop ?? deckShown ?? null) : view.top;
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
  // The Uncharted deck is drawn as its top card's Lost Island side, never the real one; the Grotto deck as its top card's Grotto side, the side the players may look at (it never holds the Underwater side faceup).
  const lostIsland = (view.pile === "unchartedDeck" || view.pile === "grottoDeck") && top ? { picture: pictureKey(top) } : {};
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
  const card = cardSize(width, height - bottom, scale, heldRoom(views, m, options.stacks === true));
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
  const stagingDrop = Math.max(gap, peek * (options.stacks ? stackedDepth(views.staging.entries) : heldDepth(views.staging.entries)));
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
  // `push`: how far right the encounter piles and the victory display stand, past the canvas's edge: by the column's width when a crowded staging row
  // runs on under the command column, so they stay at the row's right end, at the screen's edge (user request, 2026-11-08).
  const stagingPiles = (push: number) => {
    const encounterDeck: Rect = { x: width - rightGutter - victoryW - encounterW + push, y: pileY, w: pile.w, h: pile.h };
    const victory: Rect = { x: width - rightGutter - pile.w + push, y: pileY, w: pile.w, h: pile.h };
    const encounterDiscard: Rect = { x: encounterDeck.x + pile.w + gap, y: pileY, w: pile.w, h: pile.h };
    return { encounterDeck, encounterDiscard, victory };
  };
  // The second slot of piles (a scenario with a second deck: the Corsair pair) stands at the right end of the engagement area, as wide as the encounter pair and
  // right-aligned with the canvas (under the encounter pair, or under the encounter discard pile and the victory display while that is out); the engagement area
  // narrows by that width and a gap only while the slot is declared. A deck alone takes the left place (docs/design-system-table.md, Piles).
  const second = SECOND_DECKS.some((id) => piles[id] != null) || SECOND_DISCARDS.some((id) => piles[id] != null);
  const secondY = engagedY + Math.round((card.h - pile.h) / 2);
  const secondX = width - rightGutter - encounterW;
  const secondDeck: Rect = { x: secondX, y: secondY, w: pile.w, h: pile.h };
  const secondDiscard: Rect = { x: secondX + pile.w + gap, y: secondY, w: pile.w, h: pile.h };

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

  const engaged: Rect = { x: centerX, y: engagedY, w: second ? Math.max(card.w, centerW - encounterW - gap) : centerW, h: engagedH };
  const play: Rect = { x: centerX, y: playY, w: centerW, h: playH };
  const hand: Rect = { x: gutter, y: handY, w: width - 2 * gutter, h: height - handY };

  const slots: CardSlot[] = [];
  const marks: CombatMark[] = [];
  const stageEntry = views.questStage.entries[0];
  // The cards attached to or captured under the quest stage are one counted peek whether or not the table stacks what lies under a card (Grabbed by Spiders on Beneath the Sands, a Condition on the main quest): the peek hangs below the stage within the room the sideways card leaves
  // in its row, half of what the staging card is taller by, so it stays short of the active location's column. A tap on it opens the attachment.
  if (stageEntry) {
    placeCounted(stageEntry, "questStage", questStage, slots, Math.min(peek, Math.max(0, (card.h - questH) / 2)), true);
    slots.push(slotOf(stageEntry.card, "questStage", "card", questStage, true));
  }
  for (const [id, rect] of [["activeLocation", activeLocation], ["secondActiveLocation", secondActiveLocation]] as const) {
    const entry = views[id].entries[0];
    if (!entry) continue;
    if (options.stacks) placeCounted(entry, id, rect, slots, peek);
    else placeUnder(entry, id, rect, slots, [], peek);
    slots.push(slotOf(entry.card, id, "card", rect));
  }
  // Staging and the engagement area squeeze to 44 pt steps and then fold the groups the moment does not ask about into a stack at the row's left end (row-fold.ts).
  const folds: FoldPlace[] = [];
  const folding: RowFolding = { keep: options.keep, pile, folds, target: touch(scale, MIN_TARGET), stacks: options.stacks === true };
  // A covered row runs on past its piles, if it has any, to a gutter short of the column's right edge (row-reach.ts). The cards carried past the piles
  // stand three gaps clear of them, so the piles read as their own block and not as the row's last cards.
  const reach = (options.column ?? 0) > 0 ? (options.reach ?? 0) : 0;
  const reachOf = (row: Rect, piled: boolean): RowReach => {
    const start = piled ? width - rightGutter + PILE_BREAK * gap : row.x + row.w;
    return { hole: start - (row.x + row.w), extra: width + (options.column ?? 0) - rightGutter - start };
  };
  // Staging's cards stay left of its piles: a row that reaches widens by the column's room up to the piles, which move to the screen's edge.
  const stagingReached = placeRow(views.staging.entries, "staging", staging, card, slots, m, folding, reach >= 1 ? { hole: 0, extra: options.column ?? 0 } : null);
  const { encounterDeck, encounterDiscard, victory } = stagingPiles(stagingReached ? (options.column ?? 0) : 0);
  placeEngaged(views.engaged.entries, engaged, card, slots, marks, options.preview?.enemyId ?? null, m, folding, options.attacker ?? null, reach >= 2 ? reachOf(engaged, second) : null);
  placePlay(plan, play, slots, m);
  // Each second-slot deck stands in the slot's left place, its discard pile in the right one (only the Corsair and Evil Creatures pairs have one).
  const pileRects: { -readonly [K in keyof TablePiles<Rect>]: TablePiles<Rect>[K] } = { deck, discard, encounterDeck, encounterDiscard };
  for (const id of SECOND_DECKS) if (piles[id]) pileRects[id] = secondDeck;
  for (const id of SECOND_DISCARDS) if (piles[id]) pileRects[id] = secondDiscard;
  if (piles.victory) pileRects.victory = victory;
  // An encounter card attached to the deck (Iron Shackles) peeks out above it, drawn before the deck, so the "Deck" label under the deck never
  // covers it; a tap on the deck opens it (table/view.tsx).
  const held = piles.deck.attached ?? [];
  held.forEach((attached, at) => slots.push(slotOf(attached, "play", "attachment", { x: deck.x, y: deck.y - (held.length - at) * peek, w: deck.w, h: deck.h })));
  for (const id of ["deck", "discard", "encounterDeck", "encounterDiscard"] as const) slots.push(pileSlot(piles[id], pileRects[id], options.deckTop, options.deckShown));
  for (const id of [...SECOND_DECKS, ...SECOND_DISCARDS, "victory"] as const) {
    const view = piles[id];
    const rect = pileRects[id];
    if (view && rect) slots.push(pileSlot(view, rect, undefined));
  }

  // A Sailing test's look: the cards come off the encounter deck face up and stand in a strip over staging, then the engagement band and the play band (look-strip.ts).
  if (options.look && options.look.length > 0) {
    const bands = lookBands({ zones: { staging, engaged, play } });
    const strip = lookStrip(options.look.length, options.lookLeavesStaging === true ? bands.slice(1) : bands, card, gap, touch(scale, MIN_TARGET));
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

  const zones = { questStage, staging, activeLocation, secondActiveLocation, engaged, play, hand };
  return {
    width,
    height,
    card,
    zones,
    piles: pileRects,
    folds,
    stagingFoot: stagingY + card.h + peek * (options.stacks ? stackedDepth(views.staging.entries) : deepestUnder(views.staging.entries)),
    // An attachment's tap band stops at the hand's top (hits.ts, bandBounds): the strip under a front-row hero lies just above the hand, and the hand strip scrubs.
    slots: slots.map((slot) => (slot.kind === "attachment" ? { ...slot, bandPeek: peek * (slot.strip ?? 1), bandFloor: hand.y } : slot)),
    marks,
    attacker: options.attacker ?? null,
    scale,
  };
}
