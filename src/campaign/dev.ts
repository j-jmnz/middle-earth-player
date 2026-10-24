// DEV ONLY, and not rules-faithful: `boostedContext` rewrites the printed willpower, defense and health of the dealt
// heroes, so a result it produces is a shell check, not a game played by the printed cards. Delete in phase 11, when the real table and resolution screen exist.
//
// While the table is absent, the dev control plays the open scenario with a fixed policy that answers every window from
// the intents the reducer lists (it never types a number), then submits the Resolution choices through the same reducer.
// The shipped starter decks do not win against a naive policy, so the dev context gives the dealt heroes other than the
// Ring-bearer big numbers (the device the whole-game test uses). The codes are the player's, so the log records the real
// heroes. Nothing in the engine or in a card record changes: it is a different context handed to the same reducer.
import { definePrinted } from "../rules/printed.ts";
import { legalIntents, legalTargets, reduce, type PlayerIntent, type ReduceContext, type ScenarioState } from "../rules/reduce.ts";

import { isWon, resume, record, type Resumed } from "./session.ts";
import type { Save } from "./save.ts";
import type { World } from "./world.ts";

export type DevOutcome = "win" | "loss";

export function boostedContext(world: World, heroes: readonly string[]): ReduceContext {
  const cards = new Map(world.cards);
  for (const code of heroes) {
    const card = cards.get(code);
    if (!card || card.type !== "hero" || card.traits.includes("Ring-bearer")) continue;
    cards.set(code, definePrinted({ ...card, willpower: 12, defense: 2, health: 100 }));
  }
  return { effects: world.effects, cards };
}

function heroesOf(save: Save): string[] {
  return [...(save.loadout?.seats.flatMap((seat) => seat.heroes) ?? []), ...(save.loadout?.ringBearer ? [save.loadout.ringBearer] : [])];
}

export function devWorld(world: World, save: Save): World {
  return { ...world, cards: boostedContext(world, heroesOf(save)).cards };
}

type Hold = { scout: string; protect: string };

function codeOf(state: ScenarioState, id: string): string {
  return state.cards[id]?.code ?? "";
}

// The next intent of the policy. A win quests with every hero but the scout and defends with a hero that is not the
// Ring-bearer. A loss never quests, so the threat climbs.
function next(state: ScenarioState, ctx: ReduceContext, outcome: DevOutcome, hold: Hold): PlayerIntent {
  const intents = legalIntents(state, ctx);
  const first = intents[0];
  switch (state.window?.kind) {
    case "mulligan":
      return { type: "Keep" };
    case "hideCommit":
      return { type: "CommitHide", cardIds: legalTargets(state, { type: "CommitHide" }, ctx) };
    case "choose":
      return first?.type === "Choose" ? { type: "Choose", optionId: first.optionId } : { type: "Pass" };
    case "resolution":
      return first?.type === "ChooseResolution" ? { type: "ChooseResolution", optionId: first.optionId } : { type: "Pass" };
    case "travel": {
      const target = legalTargets(state, { type: "Travel" }, ctx)[0];
      return target ? { type: "Travel", locationId: target } : { type: "DeclineTravel" };
    }
    case "optionalEngage":
      return { type: "DeclineEngage" };
    case "chooseEnemy": {
      const enemy = legalTargets(state, { type: "ChooseEnemy" }, ctx)[0];
      return enemy ? { type: "ChooseEnemy", enemyId: enemy } : { type: "Pass" };
    }
    case "defense": {
      const defenders = intents.some((intent) => intent.type === "DeclareDefender") ? legalTargets(state, { type: "DeclareDefender" }, ctx) : [];
      const defender = defenders.find((id) => codeOf(state, id) !== hold.protect);
      if (defender) return { type: "DeclareDefender", defenderId: defender };
      const heroes = legalTargets(state, { type: "Undefended" }, ctx);
      const hero = heroes.find((id) => codeOf(state, id) !== hold.protect) ?? heroes[0];
      return hero ? { type: "Undefended", heroId: hero } : { type: "Undefended" };
    }
    case "archery": {
      const recipient = legalTargets(state, { type: "Distribute" }, ctx)[0];
      return recipient ? { type: "Distribute", assignments: [{ cardId: recipient, amount: state.window.total }] } : { type: "Pass" };
    }
    case "playerAttack":
      return { type: "DeclineAttack" };
    case "pass": {
      const quested = Object.values(state.cards).some((card) => card.committed);
      if (outcome === "win" && state.mode === "questCommit" && !quested && intents.some((intent) => intent.type === "Commit")) {
        const ids = legalTargets(state, { type: "Commit" }, ctx).filter((id) => codeOf(state, id) !== hold.scout);
        if (ids.length > 0) return { type: "Commit", cardIds: ids };
      }
      return { type: "Pass" };
    }
    default:
      return { type: "Pass" };
  }
}

export type DevState = { ok: true; save: Save; state: ScenarioState } | { ok: false; reason: Exclude<Resumed, { ok: true }>["reason"] | "refused" };

// The open scenario of a save under the dev context.
export function devResume(save: Save, world: World, dataHash: number): DevState {
  const resumed = resume(save, devWorld(world, save), dataHash);
  return resumed.ok ? { ok: true, save, state: resumed.state } : { ok: false, reason: resumed.reason };
}

const LIMIT = 4000;

// Plays until the scenario is lost, or won and a Resolution choice is waiting, or won and settled. Every intent is
// written to the save, so a relaunch replays the same game.
export function devPlay(save: Save, world: World, dataHash: number, outcome: DevOutcome): DevState {
  const opened = devResume(save, world, dataHash);
  if (!opened.ok) return opened;
  const ctx = boostedContext(world, heroesOf(save));
  const heroes = heroesOf(save);
  const hold: Hold = { scout: heroes.find((code) => code !== save.loadout?.ringBearer) ?? "", protect: save.loadout?.ringBearer ?? "" };
  let { state } = opened;
  let written = save;
  for (let turn = 0; turn < LIMIT; turn += 1) {
    if (state.lost || (state.stageCleared && state.window?.kind !== "resolution")) break;
    if (state.window?.kind === "resolution") break;
    const intent = next(state, ctx, outcome, hold);
    const result = reduce(state, intent, ctx);
    if (!result.ok) return { ok: false, reason: "refused" };
    state = result.state;
    written = record(written, intent);
  }
  return { ok: true, save: written, state };
}

export type DevChoice = { optionId: string; label: string };

// The Resolution choices the reducer offers, named by card.
export function devChoices(state: ScenarioState, world: World, save: Save): DevChoice[] {
  const ctx = boostedContext(world, heroesOf(save));
  const name = (code: string) => world.cards.get(code)?.name ?? code;
  return legalIntents(state, ctx).flatMap((intent) => {
    if (intent.type !== "ChooseResolution") return [];
    const [code = "", host] = intent.optionId.split(">");
    const label = intent.optionId === "skip" ? "Skip" : host ? `${name(code)} on ${name(state.cards[host]?.code ?? host)}` : name(code);
    return [{ optionId: intent.optionId, label }];
  });
}

export function devChoose(save: Save, world: World, state: ScenarioState, optionId: string): DevState {
  const ctx = boostedContext(world, heroesOf(save));
  const intent: PlayerIntent = { type: "ChooseResolution", optionId };
  const result = reduce(state, intent, ctx);
  return result.ok ? { ok: true, save: record(save, intent), state: result.state } : { ok: false, reason: "refused" };
}

export function devSettled(state: ScenarioState): "lost" | "won" | "choosing" | "playing" {
  if (state.lost) return "lost";
  if (isWon(state)) return "won";
  return state.stageCleared ? "choosing" : "playing";
}
