// Rules: rr.damage, rr.exhausted, rr.resources, rr.engagement-check (data/rules/entries.json).
//
// What a screen reader hears of a card on the table and of a zone's heading (docs/design-system-table.md, Screen reader). A card says its
// whole state in one label and what a tap does in the open moment in its hint; both are built here from the state and the table's own
// readings (the engine's numbers through `info`, what the open moment marks through `highlight`), so they are plain strings a test
// reads. The reader table (reader-table.tsx) puts them on its buttons. A pile's words stay in pile-speech.ts. Pure.
import type { PrintedCard } from "../../rules/core/printed.ts";
import { printedOf } from "../../rules/core/printed.ts";
import { modifiedStat } from "../../rules/core/keywords.ts";
import { type CardInstance, type ScenarioState } from "../../rules/core/state.ts";
import { shadowCards } from "../../rules/core/zones.ts";
import { stagingThreat } from "../../rules/quest/quest.ts";

import { nameOfCard, pictureKey } from "../canvas/picture-key.ts";
import type { SlotInfo, TableHighlight } from "../canvas/table-canvas-types.ts";
import { controlSpeech, treasureSpeech } from "../cards/dungeon-preview.ts";
import { shareHint, shareValue, wordOf } from "../choice/tray-logic.ts";
import type { OptionMark, Sheet } from "../choice/sheet-types.ts";
import { actingSeat, hidesFace, isLooked, isPrisoner, type ZoneFacts, type ZoneId } from "../store/selectors.ts";
import { areaRoleOf, areaSpeech } from "../store/stormcaller-table.ts";
import { plural } from "./list.ts";
import { seatTag } from "./scenarios/area.ts";
import { grappleDetail } from "./scenarios/grapple.ts";
import { areaTell } from "./scenarios/stormcaller.ts";
import { islandTell } from "./scenarios/uncharted.ts";

/** Everything the speech reads besides the state, so the function stays pure: the table's lookups, the engine's numbers, what the open moment marks. */
export type CardSpeechDeps = {
  // A card's name by its picture key.
  nameOf: (key: string) => string;
  // True for a card with a printed line the app does not apply.
  inactive: (key: string) => boolean;
  facts: ZoneFacts;
  info: (game: ScenarioState, seat: number, cardId: string) => SlotInfo;
  highlight: TableHighlight;
  cards: ReadonlyMap<string, PrintedCard>;
  // The sheet of the open moment: the window's plays and commit, a pick's verb. Null before the table has one.
  sheet: Sheet | null;
  // The table shows the other seat: a tap only previews, so no action is promised.
  peeking: boolean;
};

export type CardWords = { label: string; hint: string | null };


const capital = (word: string): string => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`;

// "you" for the seat the engine is asking, "player 2" for another seat of a table with several.
function whom(game: ScenarioState, seat: number): string {
  return game.seatCount > 1 && seat !== actingSeat(game) ? `player ${seat + 1}` : "you";
}

// "Your" or "Player 2's".
function whose(game: ScenarioState, seat: number): string {
  return game.seatCount > 1 && seat !== actingSeat(game) ? `Player ${seat + 1}'s` : "Your";
}

// The card's type as a word, unless its name already holds it ("Hill Troll" is told it is an enemy, a name with "hero" in it needs no "hero" twice).
function typeWord(name: string, type: string | null): string | null {
  if (!type) return null;
  const word = type.replace(/-/g, " ");
  return name.toLowerCase().includes(word) ? null : word;
}

// The printed numbers each kind of card carries, in the order the card shows them.
function statList(printed: PrintedCard): readonly ("willpower" | "attack" | "defense" | "threat")[] {
  switch (printed.type) {
    case "enemy":
      return ["threat", "attack", "defense"];
    case "location":
      return ["threat"];
    case "quest":
      return [];
    default:
      return printed.willpower != null || printed.attack != null || printed.defense != null ? ["willpower", "attack", "defense"] : [];
  }
}

// "2 willpower, 3 attack (+1), 2 defense": the engine's value with every effect counted, and how far an effect moved it from the printed one.
function statWords(game: ScenarioState, card: CardInstance, printed: PrintedCard, deps: CardSpeechDeps, info: SlotInfo): string[] {
  const words: string[] = [];
  for (const stat of statList(printed)) {
    // A committed character says its willpower with its commitment.
    if (stat === "willpower" && info.willpower != null) continue;
    if (printed[stat] == null) continue;
    const value = modifiedStat(game, card, stat, deps.cards);
    const delta = info.effects.stats.find((badge) => badge.stat === stat)?.delta ?? 0;
    words.push(`${value} ${stat}${delta !== 0 ? ` (${delta > 0 ? "+" : ""}${delta})` : ""}`);
  }
  return words;
}

// Damage against hit points, "3 damage of 4 hit points"; a card without hit points says only its damage (an Aflame location says it with its pill).
function damageWords(game: ScenarioState, card: CardInstance, printed: PrintedCard, deps: CardSpeechDeps, info: SlotInfo): string | null {
  if (printed.health != null) {
    const points = modifiedStat(game, card, "hitPoints", deps.cards);
    return card.damage > 0 ? `${card.damage} damage of ${points} hit points` : `${points} hit points`;
  }
  return card.damage > 0 && info.fire == null && info.side?.loses == null ? plural(card.damage, "damage", "damage") : null;
}

// The names of the cards attached to this one; a card the table keeps facedown is not named.
function attachedWords(game: ScenarioState, card: CardInstance, nameOf: CardSpeechDeps["nameOf"]): string[] {
  const words: string[] = [];
  const attached = card.attachments.flatMap((id) => (game.cards[id] && game.cards[id]?.guard !== true ? [game.cards[id]] : []));
  const named = attached.filter((other): other is CardInstance => other != null && !hidesFace(other));
  // The attachments follow the host on the reader table as buttons of their own, which say their names; the host says how many.
  if (named.length > 0) words.push(plural(named.length, "attachment", "attachments"));
  const hidden = attached.length - named.length;
  if (hidden > 0) words.push(plural(hidden, "facedown card attached", "facedown cards attached"));
  // A shadow card is named once it lies faceup; until then only that it is there (the table never tells a facedown card).
  const shadows = shadowCards(card).flatMap((id) => (game.cards[id] ? [game.cards[id]] : []));
  const shown = shadows.filter((other): other is CardInstance => other != null && !hidesFace(other));
  if (shown.length > 0) words.push(`shadow: ${shown.map((other) => nameOfCard(game.cards, other.id, nameOf)).join(", ")}`);
  if (shadows.length > shown.length) words.push(plural(shadows.length - shown.length, "facedown shadow card", "facedown shadow cards"));
  return words;
}

function costWords(printed: PrintedCard): string | null {
  const sphere = printed.sphere != null && printed.sphere !== "neutral" ? ` ${capital(printed.sphere)}` : "";
  if (printed.costX) return `costs X${sphere}`;
  return printed.cost != null ? `costs ${printed.cost}${sphere}` : null;
}

function labelOf(game: ScenarioState, seat: number, card: CardInstance, deps: CardSpeechDeps): string {
  // The same three facedown words the web list uses.
  if (isPrisoner(card)) return `Prisoner: ${deps.nameOf(card.code)}, face down`;
  if (card.prisoner === true) return "Face down, held with the prisoner";
  if (card.face === "down") return "Face down";

  const key = pictureKey(card);
  const name = deps.nameOf(key);
  const printed = printedOf(deps.cards, card.code);
  const info = deps.info(game, seat, card.id);
  // The Stormcaller's stage says its name, numbers, area and reach in one sentence of its own (stormcaller-table.ts).
  const stage = areaRoleOf(game, card.id) === "stage" ? areaSpeech(game, card.id, (other) => deps.nameOf(pictureKey(other)), info.questPoints) : null;
  const type = typeWord(name, deps.facts.typeOf(card.code));
  const parts: string[] = [stage ?? (type ? `${name}, ${type}` : name)];

  // The controller is told only when it is not the seat the zone is listed for.
  if (game.seatCount > 1 && card.controller != null && card.controller !== seat && (card.zone === "heroes" || card.zone === "play" || card.zone === "engaged")) {
    parts.push(card.zone === "engaged" && printed.type === "enemy" ? `engaged with player ${card.controller + 1}` : `controlled by player ${card.controller + 1}`);
  }
  if (card.zone === "attached" && card.host && game.cards[card.host]) parts.push(`attached to ${nameOfCard(game.cards, card.host, deps.nameOf)}`);
  if (card.exhausted) parts.push("exhausted");
  if (card.committed) parts.push(info.willpower != null ? `committed to the quest, ${info.willpower} willpower` : "committed to the quest");

  const damage = damageWords(game, card, printed, deps, info);
  if (damage) parts.push(damage);
  if (card.resources > 0) parts.push(plural(card.resources, "resource", "resources"));
  const island = islandTell(game, card);
  if (!stage) {
    if (info.questPoints != null) parts.push(`${card.progress} of ${info.questPoints} progress`);
    else if (card.progress > 0 && !island) parts.push(`${card.progress} progress`);
  }
  if (info.fire) parts.push(`Aflame ${info.fire.text}${info.fire.danger ? ", one more damage destroys it" : ""}`);
  if (info.determined) parts.push(info.determined.speech);
  if (info.side?.current) parts.push("the current quest");
  if (info.side?.loses) parts.push(`${info.side.loses.speech}${info.side.loses.danger ? ", one more damage loses the game" : ""}`);
  parts.push(...statWords(game, card, printed, deps, info));
  // A card not yet in play says what it costs.
  if (card.zone === "hand" || card.zone === "discard" || card.zone === "deck") {
    const cost = costWords(printed);
    if (cost) parts.push(cost);
  }
  if (info.engagement) parts.push(`engagement cost ${info.engagement.cost}, ${info.engagement.engages ? `engages ${whom(game, seat)}` : `does not engage ${whom(game, seat)}`}`);
  for (const flag of info.effects.flags) parts.push(flag.word.toLowerCase());
  if (info.delayed) parts.push("an effect comes later");
  parts.push(...attachedWords(game, card, deps.nameOf));
  if (deps.inactive(key)) parts.push("Not applied");

  // The sentences a card whose number or place is only drawn on the canvas has always said.
  const role = areaRoleOf(game, card.id);
  const said = [
    stage == null && role != null && role !== "stage" ? areaTell(role) : null,
    island,
    info.under?.speech,
    grappleDetail(game, card.id),
    info.loss?.speech,
    controlSpeech(game, card.id),
    deps.facts.typeOf(card.code) === "treasure" ? treasureSpeech(game, card.id, (id) => nameOfCard(game.cards, id, deps.nameOf)) : null,
  ].filter((part): part is string => part != null);
  return [parts.join(", "), ...said].join(". ");
}

// The word for a mark the open pick draws on a card: "takes 3 damage", and ", destroyed" when it does.
function markWords(mark: OptionMark): string {
  const what = mark.icon === "damage" ? `takes ${mark.value} damage` : `${mark.value} ${mark.icon}`;
  return `${what}${mark.danger ? ", destroyed" : ""}`;
}

const SHOW_HINT = "Double tap to show the card";

// A face-up card the moment does not ask about opens large on a tap; a facedown one shows nothing.
function previewHint(game: ScenarioState, cardId: string): string | null {
  const card = game.cards[cardId];
  return card && hidesFace(card) && !isLooked(game, cardId) ? null : SHOW_HINT;
}

function hintOf(game: ScenarioState, cardId: string, deps: CardSpeechDeps): string | null {
  const { highlight, sheet } = deps;
  if (!highlight.tappable.has(cardId)) return highlight.muted.has(cardId) ? "Cannot be played now, double tap to hear why" : previewHint(game, cardId);
  const picked = (highlight.picked.get(cardId) ?? 0) > 0;
  const mark = highlight.marks.get(cardId);
  const marked = mark ? `, ${markWords(mark)}` : "";
  switch (sheet?.kind) {
    case "window": {
      const said: string[] = [];
      // The willpower and the cost are in the label; the picked state is the button's own.
      if (sheet.commit?.options.some((item) => item.id === cardId)) said.push(picked ? "Double tap to take it back" : "Can commit");
      if (sheet.plays.includes(cardId)) said.push("Can be played");
      const timings = [...new Set(sheet.triggers.filter((item) => item.cardId === cardId).map((item) => item.timing))];
      if (timings.length > 0) said.push(`Can use its ${timings.join(" or ")}`);
      return said.length > 0 ? said.join(". ") : null;
    }
    case "pick": {
      const verb = wordOf(sheet.verb).toLowerCase();
      return picked ? `${mark ? `${markWords(mark)}. ` : ""}Double tap to unpick` : `Pick to ${verb}${marked}`;
    }
    case "multi": {
      const verb = wordOf(sheet.verb).toLowerCase();
      return picked ? "Double tap to take it back" : `Can ${verb}${marked}`;
    }
    case "distribute": {
      // The shares so far, as the table marks them (a share is the amount a card holds).
      const shares = [...highlight.picked].map(([id, amount]) => ({ id, amount }));
      return `${shareValue(sheet, shares, cardId).text}. ${shareHint(sheet, shares, cardId)}`;
    }
    case "trigger": {
      const abilities = sheet.options.filter((item) => item.cardId === cardId);
      const timings = [...new Set(abilities.map((item) => item.timing))];
      return picked ? "Double tap to unpick" : `Can use its ${timings.length > 0 ? timings.join(" or ") : "ability"}`;
    }
    default:
      return null;
  }
}

/**
 * What a screen reader hears of one card: `label` is its whole state (name and type, controller, exhausted or committed, damage against hit
 * points, resources, progress against quest points, the engine's numbers, what is attached, "Not applied", and every sentence a special card
 * says), `hint` is what a tap does in the open moment ("Can be played", "Can commit", "Pick to defend, takes 3 damage, destroyed", "Double tap
 * to show the card"), or null when it does nothing. The numbers a hint would repeat (the cost, the willpower) are in the label. While the
 * table peeks at the other seat a tap only previews the card.
 */
export function cardSpeech(game: ScenarioState, seat: number, cardId: string, deps: CardSpeechDeps): CardWords {
  const card = game.cards[cardId];
  if (!card) return { label: cardId, hint: null };
  // While the table peeks at the other seat a tap only opens the card large.
  return { label: labelOf(game, seat, card, deps), hint: deps.peeking ? previewHint(game, cardId) : hintOf(game, cardId, deps) };
}

/** The shown seat's staging threat, the number a staging heading says. */
export function stagingThreatOf(game: ScenarioState, seat: number, cards: ReadonlyMap<string, PrintedCard>): number {
  return stagingThreat(game, cards, seat);
}

const ZONE_TITLE: Record<ZoneId, (game: ScenarioState, seat: number) => string> = {
  questStage: () => "Quest stage",
  staging: (game, seat) => {
    const tag = seatTag(game, seat);
    return tag ? `Player ${seat + 1}'s staging area` : "Staging area";
  },
  activeLocation: () => "Active location",
  secondActiveLocation: () => "Second active location",
  engaged: (game, seat) => `Engaged with ${whom(game, seat)}`,
  play: (game, seat) => `${whose(game, seat)} heroes and play area`,
  hand: (game, seat) => `${whose(game, seat)} hand`,
};

/**
 * A zone's heading: "Staging area, 3 cards, threat 5", "Engaged with you, 2 enemies", "Your hand, 6 cards". `threat` is the staging area's
 * (stagingThreatOf); the other zones ignore it.
 */
export function zoneSpeech(zone: ZoneId, count: number, seat: number, game: ScenarioState, threat?: number | null): string {
  // The quest stage is one card: its heading is its name, with no count.
  if (zone === "questStage") return ZONE_TITLE[zone](game, seat);
  const noun = zone === "engaged" ? (["enemy", "enemies"] as const) : (["card", "cards"] as const);
  const size = count === 0 ? `no ${noun[1]}` : plural(count, noun[0], noun[1]);
  const total = zone === "staging" && threat != null ? `, threat ${threat}` : "";
  return `${ZONE_TITLE[zone](game, seat)}, ${size}${total}`;
}
