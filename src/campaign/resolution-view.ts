// Rules: ltp.campaign-cards, rr.campaign-cards, ltp.campaign-pool, rr.campaign-pool (data/rules/entries.json).
//
// What the resolution screen shows for the open scenario: Defeat (a loss writes nothing), the choice the campaign card's
// Resolution is asking now (one seat at a time when the card says each player chooses), or, once every choice is answered,
// what confirming will write. The options are the ChooseResolution intents the reducer lists; the screen sends the one the
// player picks and nothing else.
import { legalIntents, type ScenarioState } from "../rules/reduce.ts";
import { resolutionResult, SKIP } from "../rules/resolution.ts";

import { contextOf } from "./session.ts";
import type { World } from "./world.ts";

export type ResolutionTile = { optionId: string; code: string | null; name: string; hero: string | null };

export type ResolutionView =
  | { kind: "playing" }
  | { kind: "lost"; reason: string | null }
  | { kind: "choosing"; step: number; seat: number; eyebrow: string; seatLabel: string | null; tiles: readonly ResolutionTile[]; to: "pool" | "hand" | "hero" | "captive" }
  | { kind: "settled"; earned: readonly string[]; fallen: readonly string[]; captives: readonly string[] };

function nameOf(world: World, code: string): string {
  return world.cards.get(code)?.name ?? code;
}

export function resolutionView(state: ScenarioState, world: World): ResolutionView {
  if (state.lost) return { kind: "lost", reason: state.lossReason };
  const settled = resolutionResult(state);
  if (settled) {
    return {
      kind: "settled",
      earned: settled.earned.map((item) => item.code),
      fallen: [...settled.fallen],
      captives: settled.captives.map((item) => item.hero),
    };
  }
  const window = state.window;
  if (!state.stageCleared || window?.kind !== "resolution") return { kind: "playing" };
  const instruction = state.resolution[window.step];
  if (instruction?.verb !== "ChooseCards" && instruction?.verb !== "NameCaptives") return { kind: "playing" };
  const tiles: ResolutionTile[] = legalIntents(state, contextOf(world)).flatMap((intent): ResolutionTile[] => {
    if (intent.type !== "ChooseResolution") return [];
    if (intent.optionId === SKIP) return [{ optionId: SKIP, code: null, name: "Record nothing", hero: null }];
    if (instruction.verb === "NameCaptives") {
      const code = state.cards[intent.optionId]?.code ?? intent.optionId;
      return [{ optionId: intent.optionId, code, name: nameOf(world, code), hero: null }];
    }
    const [code = "", heroId] = intent.optionId.split(">");
    const heroCode = heroId ? state.cards[heroId]?.code : undefined;
    return [{ optionId: intent.optionId, code, name: nameOf(world, code), hero: heroCode ? nameOf(world, heroCode) : null }];
  });
  let eyebrow = "Name a captive";
  if (instruction.verb === "ChooseCards") {
    const kinds = new Set(instruction.codes.map((code) => world.cards.get(code)?.campaignKind ?? null));
    eyebrow = kinds.size === 1 && kinds.has("burden") ? "Choose a burden" : kinds.size === 1 && kinds.has("boon") ? "Choose a boon" : "Choose a card";
  }
  const eachSeat = instruction.verb === "NameCaptives" || instruction.who === "eachSeat";
  return {
    kind: "choosing",
    step: window.step,
    seat: window.seat,
    eyebrow,
    seatLabel: eachSeat && state.seatCount > 1 ? `Player ${window.seat + 1} chooses` : null,
    tiles,
    to: instruction.verb === "NameCaptives" ? "captive" : instruction.to,
  };
}

/** The sentence above Confirm: what choosing this tile writes. */
export function choiceSentence(view: Extract<ResolutionView, { kind: "choosing" }>, tile: ResolutionTile): string {
  if (tile.optionId === SKIP) return "Nothing is recorded for this choice.";
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

/** The sentence above the final Confirm: what the log will hold, and the scenario that unlocks. */
export function settledSentence(view: Extract<ResolutionView, { kind: "settled" }>, world: World, next: string | null): string {
  const earned = view.earned.map((code) => nameOf(world, code));
  const records = earned.length > 0 ? `Confirming records ${earned.join(" and ")} in the campaign` : "Confirming records the win";
  return next ? `${records} and unlocks ${next}.` : `${records}.`;
}
