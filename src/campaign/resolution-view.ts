// Rules: ltp.campaign-cards, rr.campaign-cards, ltp.campaign-pool, rr.campaign-pool, rr.first-player
// (data/rules/entries.json).
//
// What the resolution screen shows for the open scenario: Defeat (a loss writes nothing), the choice the campaign card's
// Resolution is asking now (one seat at a time when the card says each player chooses, starting with the first player, as
// 141044:B:1 does), or, once every choice is answered, what confirming will write. The options are the ChooseResolution
// intents the reducer lists; the screen sends the one the player picks and nothing else. A choice the card lets a seat pass
// ("each player may choose") lists the reducer's `skip` as `decline`, a visible "No boon", not as one more tile.
import { legalIntents, type ScenarioState } from "../rules/reduce.ts";
import { answeredSeats, resolutionResult, SKIP } from "../rules/resolution.ts";

import { contextOf } from "./session.ts";
import type { World } from "./world.ts";

export type ResolutionTile = { optionId: string; code: string | null; name: string; hero: string | null };

// The decline of an optional choice: the reducer's `skip` option, with its words ("No boon").
export type ResolutionDecline = { optionId: string; label: string };

// A choice a seat already confirmed in this group: its words ("Tireless Ranger on Sam Gamgee", "No boon").
export type ResolutionAnswer = { seat: number; words: string };

// A card the log will hold, with the hero it goes on when it is attached.
export type SettledCard = { code: string; hero: string | null; seat: number | null };

export type ResolutionView =
  | { kind: "playing" }
  | { kind: "lost"; reason: string | null }
  | {
      kind: "choosing";
      step: number;
      seat: number;
      seatCount: number;
      eyebrow: string;
      seatLabel: string | null;
      // What is chosen: boon, burden, card or captive.
      noun: string;
      answered: readonly ResolutionAnswer[];
      tiles: readonly ResolutionTile[];
      decline: ResolutionDecline | null;
      to: "pool" | "hand" | "hero" | "captive";
    }
  | {
      kind: "settled";
      earned: readonly SettledCard[];
      fallen: readonly string[];
      captives: readonly string[];
      prisoner?: string;
      // Cards the log keeps for the next campaign (01131:B:2), a copy for each player when `eachPlayer`.
      carried?: readonly { code: string; eachPlayer: boolean }[];
    };

function nameOf(world: World, code: string): string {
  return world.cards.get(code)?.name ?? code;
}

export function resolutionView(state: ScenarioState, world: World): ResolutionView {
  if (state.lost) return { kind: "lost", reason: state.lossReason };
  const settled = resolutionResult(state);
  if (settled) {
    return {
      kind: "settled",
      earned: settled.earned.map((item) => ({ code: item.code, hero: item.to === "hero" ? item.hero : null, seat: item.seat })),
      fallen: [...settled.fallen],
      captives: settled.captives.map((item) => item.hero),
      ...(settled.prisoner ? { prisoner: settled.prisoner } : {}),
      ...(settled.carryOver && settled.carryOver.length > 0 ? { carried: settled.carryOver.map((item) => ({ code: item.code, eachPlayer: item.perPlayer === true })) } : {}),
    };
  }
  const window = state.window;
  if (!state.stageCleared || window?.kind !== "resolution") return { kind: "playing" };
  const instruction = state.resolution[window.step];
  if (instruction?.verb !== "ChooseCards" && instruction?.verb !== "NameCaptives") return { kind: "playing" };
  let decline: ResolutionDecline | null = null;
  let eyebrow = "Name a captive";
  let noun = "captive";
  if (instruction.verb === "ChooseCards") {
    const kinds = new Set(instruction.codes.map((code) => world.cards.get(code)?.campaignKind ?? null));
    noun = kinds.size === 1 && kinds.has("burden") ? "burden" : kinds.size === 1 && kinds.has("boon") ? "boon" : "card";
    eyebrow = `Choose a ${noun}`;
  }
  const tiles: ResolutionTile[] = legalIntents(state, contextOf(world)).flatMap((intent): ResolutionTile[] => {
    if (intent.type !== "ChooseResolution") return [];
    if (intent.optionId === SKIP) {
      decline = { optionId: SKIP, label: `No ${noun}` };
      return [];
    }
    if (instruction.verb === "NameCaptives") {
      const code = state.cards[intent.optionId]?.code ?? intent.optionId;
      return [{ optionId: intent.optionId, code, name: nameOf(world, code), hero: null }];
    }
    const [code = "", heroId] = intent.optionId.split(">");
    const heroCode = heroId ? state.cards[heroId]?.code : undefined;
    return [{ optionId: intent.optionId, code, name: nameOf(world, code), hero: heroCode ? nameOf(world, heroCode) : null }];
  });
  const eachSeat = instruction.verb === "NameCaptives" || instruction.who === "eachSeat";
  const first = window.seat === state.firstPlayer ? " (first player)" : "";
  // The seats before this one have confirmed: each recorded card in this group, or the decline when nothing was recorded.
  const answered = answeredSeats(state).map((seat): ResolutionAnswer => {
    if (instruction.verb === "NameCaptives") {
      const captive = state.resolutionLog.captives.find((item) => item.seat === seat);
      return { seat, words: captive ? nameOf(world, captive.hero) : `No ${noun}` };
    }
    const card = state.resolutionLog.earned.find((item) => item.step === window.step && item.seat === seat);
    return { seat, words: card ? cardWords(world, { code: card.code, hero: card.hero, seat }) : `No ${noun}` };
  });
  return {
    kind: "choosing",
    step: window.step,
    seat: window.seat,
    seatCount: state.seatCount,
    eyebrow,
    seatLabel: eachSeat && state.seatCount > 1 ? `Player ${window.seat + 1}${first} chooses` : null,
    noun,
    answered,
    tiles,
    decline,
    to: instruction.verb === "NameCaptives" ? "captive" : instruction.to,
  };
}

/** The sentence above Confirm: what choosing this tile writes. */
export function choiceSentence(view: Extract<ResolutionView, { kind: "choosing" }>, tile: ResolutionTile): string {
  if (tile.optionId === SKIP) return declineSentence(view);
  switch (view.to) {
    case "pool":
      return `${tile.name} is added to the campaign pool.`;
    case "hero":
      return `${tile.name} is attached to ${tile.hero ?? "the hero"} and recorded on the log.`;
    case "hand":
      return `${tile.name} is recorded and starts the next scenario in hand.`;
    case "captive":
      return `${tile.name} is recorded as a captive.`;
  }
}

/** The sentence above Confirm when the seat declines: nothing is written for this choice. */
export function declineSentence(view: Extract<ResolutionView, { kind: "choosing" }>): string {
  const who = view.seatCount > 1 && view.seatLabel ? `Player ${view.seat + 1}` : "You";
  const what = view.decline?.label.replace(/^No /, "") ?? "card";
  return `${who} ${who === "You" ? "take" : "takes"} no ${what}. Nothing is recorded for this choice.`;
}

/** The sentence above Confirm before anything is chosen, built from the noun: "Choose a boon and a hero, or tap No boon." */
export function promptSentence(view: Extract<ResolutionView, { kind: "choosing" }>): string {
  const what = view.to === "hero" ? `a ${view.noun} and a hero` : view.to === "captive" ? "a hero to name as a captive" : `a ${view.noun}`;
  const decline = view.decline ? `, or tap ${view.decline.label}` : "";
  return `Choose ${what}${decline}. Your choice is written to the campaign log when you confirm.`;
}

/** The sentence above Confirm: what the chosen tile or the decline writes, or the prompt while nothing is chosen. */
export function consequenceSentence(view: Extract<ResolutionView, { kind: "choosing" }>, picked: ResolutionTile | null, declined: boolean): string {
  if (picked) return choiceSentence(view, picked);
  return declined ? declineSentence(view) : promptSentence(view);
}

function cardWords(world: World, card: SettledCard): string {
  return card.hero ? `${nameOf(world, card.code)} on ${nameOf(world, card.hero)}` : nameOf(world, card.code);
}

/** The sentence above the final Confirm: what the log will hold (a boon on its hero), and the scenario that unlocks. */
export function settledSentence(view: Extract<ResolutionView, { kind: "settled" }>, world: World, next: string | null): string {
  // A card on its hero already reads as a boon. When every card goes to the pool, a single card says what it is ("the burden Ungoliant's Swarm").
  const kinded = view.earned.every((card) => card.hero == null);
  const words = view.earned.map((card) => cardWords(world, card));
  // Copies of one card are one phrase ("each player earns 1 copy of Mendor's Support": "2 copies of Mendor's Support").
  const earned = [...new Set(words)].map((text) => {
    const copies = words.filter((other) => other === text).length;
    const kind = kinded ? world.cards.get(view.earned[words.indexOf(text)]?.code ?? "")?.campaignKind : null;
    return copies > 1 ? `${copies} copies of ${text}` : kind ? `the ${kind} ${text}` : text;
  });
  // "A and B", "A, B and C": an "and" only before the last.
  const list = earned.length > 1 ? `${earned.slice(0, -1).join(", ")} and ${earned.at(-1)}` : (earned[0] ?? "");
  const records = earned.length > 0 ? `Confirming records ${list} in the campaign` : "Confirming records the win";
  const sentence = next ? `${records} and unlocks ${next}.` : `${records}.`;
  // The hero a Resolution takes prisoner is written to the log too (01130:B:1): a sentence of its own, with the reason.
  const prisoner = view.prisoner ? `${sentence} ${nameOf(world, view.prisoner)}, the hero with the most damage, is taken prisoner.` : sentence;
  // The cards a Resolution keeps for the next campaign, not this one (01131:B:2): a sentence of its own.
  if (!view.carried || view.carried.length === 0) return prisoner;
  const names = view.carried.map((card) => (card.eachPlayer ? `a ${nameOf(world, card.code)} for each player` : nameOf(world, card.code)));
  const carried = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "");
  return `${prisoner} ${carried} ${view.carried.length > 1 || view.carried[0]?.eachPlayer ? "are" : "is"} kept for your next campaign.`;
}
