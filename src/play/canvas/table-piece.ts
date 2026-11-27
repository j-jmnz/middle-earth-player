// What one card on the table draws from, and when two draws of it are the same (docs/architecture.md, Performance). The canvas builds a
// `PieceProps` for every slot on each render and `TablePiece` (table-piece.native.tsx) skips a card whose props `samePiece` calls equal, so a
// pick, a token or a game step rebuilds the cards it changed and not the other forty. Pure, so it is tested without a canvas.
//
// Everything a card's drawing reads is a field here, as a primitive or a stable reference; the callbacks the screen hands the canvas
// (name, sphere, inactive, the engine's numbers) are asked once per slot and their answers are the fields. The comparison is conservative: a
// field that cannot be compared with `===` is compared by its contents, and a field this file does not know how to compare is a type error.
import type { SkImage } from "@shopify/react-native-skia";

import type { ScenarioState } from "../../rules/core/state.ts";
import type { SlotNumbers } from "../cards/card-effects.ts";
import type { Clock } from "../motion/card-motion.native.tsx";
import type { BackImages, Fonts, TokenImages } from "./pieces.native.tsx";
import type { CardSlot } from "../layout/layout.ts";
import { shownBounds } from "../layout/hits.ts";
import { footStop } from "./badge-room.ts";
import { nameFitsOne } from "./placeholder-name.ts";
import { underRect } from "./under-mark.ts";
import { AT_REST, still, type Motion } from "../motion/motion.ts";
import type { OptionMark } from "../choice/sheet-types.ts";
import type { StagePill } from "../words/scenarios/stormcaller.ts";
import type { TableHighlight } from "./table-canvas-types.ts";
import type { TableTokens } from "../../ui/tokens.ts";

/** What a card's body (the card, its glow, a pile) draws from. The leaving ghosts draw this much and no more. */
export type BodyProps = {
  slot: CardSlot;
  /** The decoded picture, or null while it loads (the card is drawn as its name). */
  image: SkImage | null;
  /** The victory pile's cards fanned behind its top, each decoded or null while it loads; empty on every other slot. */
  fan: readonly (SkImage | null)[];
  name: string;
  /** How many lines the name of a card drawn as its name may take, 3 when unset: one on a card with effect pills (they stand down the left edge from 17 pt and never cover a second line). */
  nameLines?: number;
  /** A card lying sideways: where the highest pill at its foot stands from its turned top, so its placeholder name stops above it (placeholder-name.ts); null with none. */
  nameFoot?: number | null;
  /** The sphere the card prints, for the icon of a card drawn as its name and the ring of its resource token. */
  sphere: string | null;
  /** A hand card lifted by a press: its place on the table is dimmed under the lifted copy. */
  lifted: boolean;
  /** The open moment glows this card (a card to tap, or a discard pile the seat may play from). */
  tappable: boolean;
  /** How many times the open moment has picked this card (0 when it has not). */
  picked: number;
  fonts: Fonts;
  backs: BackImages;
  t: TableTokens;
  s: number;
};

/** Everything one card's drawing reads. */
export type PieceProps = BodyProps & {
  motion: Motion;
  clock: Clock;
  /** A veiled card (the open pick dims the others, a muted hand card, the Sailing test's look): card kinds only. */
  dimmed: boolean;
  /** The face a card turning over in place shows until the turn's midpoint (motion.fromPicture): its picture, image and name; null for any other card. */
  turnedFrom: { picture: string; image: BodyProps["image"]; name: string } | null;
  /** How many lines the placeholder name takes (1, or 2 when it does not fit one on a card with effect pills): the effect column starts under them (badge-room.ts, badgeLayout). */
  titleRows: number;
  /** The banner's line names this card. */
  beat: boolean;
  /** The night veil: a peek at the other seat's hand veils its cards, and the Stormcaller's area veils its cards while the players are at another stage (docs/design-system-table.md, Cards). */
  veiledHand: boolean;
  /** The Stormcaller's stage: its number pill and, while the players are at another stage, the Apart plate; null on every other card. */
  stageMarks: StageMarksView | null;
  /** The engine's numbers on the card, or null where none are drawn (a hand card, the deck, a face-down card). */
  info: SlotNumbers | null;
  optionMark: OptionMark | undefined;
  /** A face-up card with a printed line the app does not apply. */
  inactive: boolean;
  /** The seat tag drawn on a quest stage once the table is split between players. */
  owner: string | null;
  /** The owner's chip ("P2") on the strip of a hero or ally an encounter card holds, in a game of several players; null on any other slot. */
  stripChip: string | null;
  share: TableHighlight["share"];
  contrast: boolean;
  tokens: TokenImages;
};

/** The marks a quest area's stage wears (words/area-words.ts, pill). */
export type StageMarksView = { pill: StagePill; apart: boolean };

/** What the canvas knows for one render, from which every slot's props are made. */
export type PieceContext = {
  /** The area stage's marks for this render, or null in a game with no quest area. */
  stageMarks: StageMarksView | null;
  highlight: TableHighlight;
  targetIds: ReadonlySet<string>;
  looking: boolean;
  peeking: boolean;
  beating: ReadonlySet<string>;
  /** The card lifted by a press, if any. */
  liftedId: string | null;
  motions: ReadonlyMap<string, Motion>;
  clock: Clock;
  images: ReadonlyMap<string, SkImage>;
  game: ScenarioState;
  seat: number;
  owner: string | null;
  contrast: boolean;
  nameOf: (key: string) => string;
  sphereOf: (code: string) => string | null;
  inactive: (key: string) => boolean;
  info: (game: ScenarioState, seat: number, cardId: string) => SlotNumbers;
  fonts: Fonts;
  backs: BackImages;
  tokens: TokenImages;
  t: TableTokens;
  s: number;
};

const NO_FAN: readonly (SkImage | null)[] = [];

const isTappable = (slot: CardSlot, ctx: PieceContext) => ctx.highlight.tappable.has(slot.id) || ctx.targetIds.has(slot.id);
const pickedCount = (slot: CardSlot, ctx: PieceContext) => ctx.highlight.picked.get(slot.id) ?? 0;
// A look (a Sailing test's, or Discover's) veils staging, the engagement area and the play area under the strip (docs/design-system-table.md, The Sailing test); the cards the banner's beat rings stand above the veil.
const veiledByLook = (slot: CardSlot, ctx: PieceContext) => ctx.looking && slot.success == null && slot.kind !== "pile" && !ctx.beating.has(slot.id) && (slot.zone === "staging" || slot.zone === "engaged" || slot.zone === "play");
const isDimmed = (slot: CardSlot, ctx: PieceContext) =>
  (ctx.highlight.dimOthers && !isTappable(slot, ctx) && pickedCount(slot, ctx) === 0) || ctx.highlight.muted.has(slot.id) || veiledByLook(slot, ctx);

// The card wears something at its foot (a stage's or active location's progress, a committed character's Willpower, a defender's or attacker's combat number, or a resource token): a pill with no count stands one row up, clear of it.
export const wearsFootNumber = (info: { questPoints: number | null; willpower: number | null; combat?: unknown }, resources: number) => info.questPoints != null || info.willpower != null || info.combat != null || resources > 0;

/** Where the highest pill at the card's foot stands from the top of its rect on screen, which the effect pills stop above (footStop in badge-room.ts), or null with none. */
export function footStopOf(slot: CardSlot, info: SlotNumbers | null, optionMark: OptionMark | undefined, s: number): number | null {
  if (!info) return null;
  const rect = shownBounds(slot);
  const under = info.under ? { height: underRect(rect, slot.zone === "hand", s).h, counted: info.under.count != null, strip: wearsFootNumber(info, slot.resources) } : null;
  const plain = info.engagement != null || info.fire != null || info.side?.loses != null || info.loss != null;
  return footStop(rect.h, s, { under, lifted: slot.kind === "card" && optionMark != null, plain, committed: info.willpower != null, combat: info.combat != null });
}

/** What a card's body draws from: used on its own by the cards that are leaving the table. */
export function bodyProps(slot: CardSlot, ctx: PieceContext): BodyProps {
  const key = slot.picture ?? slot.code;
  return {
    slot,
    image: ctx.images.get(key) ?? null,
    fan: slot.fan ? slot.fan.map((picture) => ctx.images.get(picture) ?? null) : NO_FAN,
    name: ctx.nameOf(key),
    sphere: slot.kind === "pile" ? null : ctx.sphereOf(slot.code),
    lifted: ctx.liftedId === slot.id && slot.kind === "card",
    tappable: isTappable(slot, ctx),
    picked: pickedCount(slot, ctx),
    fonts: ctx.fonts,
    backs: ctx.backs,
    t: ctx.t,
    s: ctx.s,
  };
}

/** A hand card draws no numbers but the pill of a card that cannot leave it (Ill Tidings, 07023:A:1): its numbers hold that pill alone, and a card without one has none. */
function handInfo(slot: CardSlot, ctx: PieceContext): SlotNumbers | null {
  if (slot.kind !== "card" || slot.faceDown || slot.zone !== "hand") return null;
  const under = ctx.info(ctx.game, ctx.seat, slot.id).under;
  if (under == null) return null;
  return { effects: { stats: [], flags: [] }, willpower: null, commitStat: "willpower", questPoints: null, stageLoses: false, engagement: null, delayed: false, under, fire: null, loss: null, place: null, side: null, determined: null, dead: null, combat: null };
}

// The face a card turning over in place leaves: what its picture key names.
function turnedFace(motion: Motion | undefined, ctx: PieceContext): PieceProps["turnedFrom"] {
  const picture = motion?.fromPicture;
  return picture ? { picture, image: ctx.images.get(picture) ?? null, name: ctx.nameOf(picture) } : null;
}

/** Everything the drawing of one slot reads, from the canvas's context for this render. */
export function pieceProps(slot: CardSlot, ctx: PieceContext): PieceProps {
  const card = slot.kind === "card";
  // A staging card with more than one card under it shows one peek and how many: "×2" (layout.ts, placeStaging).
  const numbered = card && !slot.faceDown && slot.zone !== "hand" && slot.zone !== "deck";
  const info = numbered ? ctx.info(ctx.game, ctx.seat, slot.id) : handInfo(slot, ctx);
  const pills = info ? info.effects.stats.length + info.effects.flags.length : 0;
  const body = bodyProps(slot, ctx);
  // A card lying sideways has its tokens and foot pills upright over the turned name: the name stops above the highest foot pill.
  const nameFoot = slot.exhausted && body.image == null ? footStopOf(slot, info, ctx.highlight.marks.get(slot.id), ctx.s) : null;
  // A card with effect pills names itself on one line, since the pills stand down its left edge; a name that does not fit one line, even shrunk to the floor, takes a second and the pills start under it (the rest wait behind "N more").
  const box = { name: body.name, w: slot.w, s: ctx.s, shown: slot.shown ?? null, lines: 1, damage: slot.damage > 0, sideways: slot.exhausted, foot: nameFoot, measure: (text: string) => ctx.fonts.names.getTextWidth(text) };
  const twoLines = pills > 0 && body.image == null && !slot.faceDown && !nameFitsOne(box);
  // A quest area's stage wears its number pill above its progress strip: its title keeps one line (shrunk, then cut) so the pill never covers a second.
  const nameLines = twoLines ? 2 : pills > 0 || slot.stormcaller === "stage" ? 1 : slot.zone === "questStage" || slot.zone === "activeLocation" ? 2 : undefined;
  return {
    ...body,
    ...(nameLines != null ? { nameLines } : {}),
    nameFoot,
    titleRows: twoLines && !slot.exhausted ? 2 : 1,
    motion: ctx.motions.get(slot.id) ?? AT_REST,
    clock: ctx.clock,
    turnedFrom: turnedFace(ctx.motions.get(slot.id), ctx),
    dimmed: card && isDimmed(slot, ctx),
    beat: ctx.beating.has(slot.id),
    veiledHand: card && ((ctx.peeking && slot.zone === "hand") || slot.stormcaller === "apart"),
    stageMarks: slot.stormcaller === "stage" ? ctx.stageMarks : null,
    info,
    optionMark: ctx.highlight.marks.get(slot.id),
    inactive: card && !slot.faceDown && ctx.inactive(slot.picture ?? slot.code),
    owner: slot.zone === "questStage" ? ctx.owner : null,
    stripChip: slot.strip != null ? (ctx.info(ctx.game, ctx.seat, slot.id).seat?.chip ?? null) : null,
    share: ctx.highlight.share,
    contrast: ctx.contrast,
    tokens: ctx.tokens,
  };
}

// Every field of CardSlot: adding one to the type is a type error here until it is listed, so the comparison cannot fall behind the drawing.
const SLOT_FIELDS = Object.keys({
  x: true,
  y: true,
  w: true,
  h: true,
  id: true,
  code: true,
  picture: true,
  zone: true,
  kind: true,
  exhausted: true,
  unconscious: true,
  faceDown: true,
  landscape: true,
  resources: true,
  damage: true,
  progress: true,
  tilt: true,
  bandPeek: true,
  bandFloor: true,
  strip: true,
  count: true,
  committed: true,
  held: true,
  opens: true,
  dead: true,
  chained: true,
  stack: true,
  success: true,
  fold: true,
  areaFold: true,
  stormcaller: true,
  shown: true,
  coveredFrom: true,
  coveredStep: true,
  fan: true,
  points: true,
} satisfies Record<keyof CardSlot, true>) as (keyof CardSlot)[];

/** True when two slots are the same card in the same place and state: layout makes a new object for every slot whenever it runs. */
export function sameSlot(a: CardSlot, b: CardSlot): boolean {
  if (a === b) return true;
  for (const field of SLOT_FIELDS) if (field === "fan" ? !sameList(a.fan, b.fan) : a[field] !== b[field]) return false;
  return true;
}

// Two lists of the same items in the same order (absent and absent are the same).
function sameList<T>(a: readonly T[] | undefined, b: readonly T[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((item, at) => item === b[at]);
}

const MOTION_FIELDS = Object.keys({
  dx: true,
  dy: true,
  scale: true,
  fromRot: true,
  toRot: true,
  fromOpacity: true,
  flip: true,
  delay: true,
  arc: true,
  land: true,
  fromPicture: true,
} satisfies Record<keyof Motion, true>) as (keyof Motion)[];

/** True when two motions are the same: a new layout makes a new object for every card, most of them at rest. */
export function sameMotion(a: Motion, b: Motion): boolean {
  if (a === b) return true;
  for (const field of MOTION_FIELDS) if (a[field] !== b[field]) return false;
  return true;
}

// Plain data (numbers, strings, booleans, null, arrays, objects of those) compared by its contents; anything else by identity.
function sameData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, at) => sameData(item, b[at]));
  }
  if (Object.getPrototypeOf(a) !== Object.prototype || Object.getPrototypeOf(b) !== Object.prototype) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => key in right && sameData(left[key], right[key]));
}

/** True when two sets of the engine's numbers on a card are the same: `slotNumbers` builds a new object for every card on every state. */
export function sameNumbers(a: SlotNumbers | null, b: SlotNumbers | null): boolean {
  return sameData(a, b);
}

// A bundle of shared images or fonts: the same when each member is.
function sameBundle<T extends object>(a: T, b: T): boolean {
  if (a === b) return true;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key]);
}

const same = (a: unknown, b: unknown) => a === b;

// One comparison for every field of PieceProps; a field added to the type must be listed here.
const SAME: { readonly [K in keyof PieceProps]-?: (a: PieceProps[K], b: PieceProps[K]) => boolean } = {
  slot: sameSlot,
  image: same,
  fan: sameList,
  name: same,
  nameLines: same,
  nameFoot: same,
  titleRows: same,
  sphere: same,
  lifted: same,
  tappable: same,
  picked: same,
  fonts: sameBundle,
  backs: sameBundle,
  t: same,
  s: same,
  motion: sameMotion,
  clock: same,
  turnedFrom: sameData,
  dimmed: same,
  beat: same,
  veiledHand: same,
  stageMarks: sameData,
  info: sameNumbers,
  optionMark: sameData,
  inactive: same,
  owner: same,
  stripChip: same,
  share: same,
  contrast: same,
  tokens: sameBundle,
};
const PIECE_FIELDS = Object.keys(SAME) as (keyof PieceProps)[];

/**
 * True when drawing `b` would draw what `a` drew. A card at rest ignores the clock (`Moving` draws it without one), so a new state's clock
 * does not redraw the cards that stand still; one that moves is redrawn with its state's clock.
 */
export function samePiece(a: PieceProps, b: PieceProps): boolean {
  if (a === b) return true;
  const resting = still(a.motion) && still(b.motion);
  for (const field of PIECE_FIELDS) {
    if (field === "clock" && resting) continue;
    if (!(SAME[field] as (x: unknown, y: unknown) => boolean)(a[field], b[field])) return false;
  }
  return true;
}
