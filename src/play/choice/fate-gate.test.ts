// Rules: rr.first-player, rr.response, rr.shadow-effects (data/rules/entries.json); ledger lines 19156:A:2, 19157:A:2, 19158:A:1, 19167:A:1.
// The words of The Fate of Wilderland are told only in The Fate of Wilderland (words/fate.ts, inFate). Each record below is a copy of one of the scenario's own, laid on a card of another scenario's table (The Withered Heath): the Choose that exhausts a character or puts progress on a named
// objective, the Response that puts a resource on the card that counts them, the attack that discards the encounter deck's top card for its Threat, the treachery that raises the staging area's Threat. In The Withered Heath they read as they did before this scenario had words; the same
// record on the scenario's own table reads with them (the positive control, so a gate that never opens would fail here).
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { legalIntents } from "../../rules/engine/legal.ts";
import { settle } from "../../rules/engine/machine.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { updateCard } from "../../rules/core/state.ts";
import { spawn } from "../../rules/core/zones.ts";
import { pushCardEffects } from "../../rules/interpret/effect-frames.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { CODES as HEATH, heathTable, loadHeathWorld, type HeathWorld } from "../../../test/scenarios/the-withered-heath/scene.ts";
import { CODES, loadWilderlandWorld, send, start, wilderlandTable, type Run, type WilderlandWorld } from "../../../test/scenarios/the-fate-of-wilderland/scene.ts";

import { fateNames } from "../words/fate-beats.ts";
import { sheetFor } from "./sheets.ts";

let fate: WilderlandWorld;
let heath: HeathWorld;
beforeAll(async () => {
  [fate, heath] = await Promise.all([loadWilderlandWorld(), loadHeathWorld()]);
}, 120_000);

type Scene = { state: ScenarioState; ctx: ReduceContext; hero: string };
const OBJECTIVE = "lookalike-objective";
const COUNTER = "lookalike-counter";
const record = (ctx: ReduceContext, id: string): Effect => {
  const found = ctx.effects.find((effect) => effect.id === id);
  if (!found) throw new Error(`no record ${id}`);
  return found;
};
// A copy of the scenario's record on another card.
const copy = (ctx: ReduceContext, id: string, code: string): Effect => ({ ...record(ctx, id), id: `${code}:copy:${id}`, cardCode: code, lines: [] });

const sheetOf = (scene: Scene, state: ScenarioState) => {
  const sheet = sheetFor(state, scene.ctx, legalIntents(state, scene.ctx), { card: (id) => (fate.cards.get(state.cards[id]?.code ?? "") ?? heath.cards.get(state.cards[id]?.code ?? ""))?.name ?? id, line: () => null });
  if (sheet?.kind !== "pick" && sheet?.kind !== "trigger") throw new Error(`no pick or trigger sheet: ${JSON.stringify(state.window)}`);
  return { note: sheet.note, labels: sheet.options.map((option) => option.label) };
};

// The Withered Heath's table with the copies in its effect list, an objective that bears the scenario's title, and a card that counts resources.
function heathScene(extra: Effect[]): { scene: Scene; world: HeathWorld } {
  heath.cards.set(OBJECTIVE, definePrinted({ code: OBJECTIVE, name: "The Goblins' Assault", type: "objective" }));
  heath.cards.set(COUNTER, definePrinted({ code: COUNTER, name: "The Heroes' Defense", type: "objective" }));
  const made = heathTable(heath, { phase: "Encounter", staging: [OBJECTIVE, COUNTER] });
  return { scene: { ...made, ctx: { ...made.ctx, effects: [...made.ctx.effects, ...extra] } }, world: heath };
}

// The scenario's own table with the same copies, and a Watchtower in the discard pile (a game of The Fate of Wilderland deals them).
function fateScene(extra: Effect[]): Scene {
  const made = wilderlandTable(fate, { phase: "Encounter", discard: [CODES.dwarvenWatchtower], staging: [CODES.theGoblinsAssault, CODES.theHeroesDefense, CODES.urdug] });
  return { ...made, ctx: { ...made.ctx, effects: [...made.ctx.effects, ...extra] } };
}

function opened(scene: Scene, state: ScenarioState, code: string, timing: "forced" | "whenRevealed", zone: "engaged" | "staging"): ScenarioState {
  const spawned = zone === "engaged" ? spawn(state, code, { zone: "engaged", seat: 0 }) : spawn(state, code, { zone });
  const effects = scene.ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === timing).map((effect) => ({ ...effect, condition: undefined }) as Effect);
  const pushed = pushCardEffects(spawned.state, timing === "whenRevealed" ? "whenRevealed" : "forced", spawned.id, spawned.state.firstPlayer, false, effects, scene.ctx, []);
  return settle({ ...pushed, window: null, mode: "stopped" }, scene.ctx, []);
}

describe("another game's lookalike choices keep their ordinary words", () => {
  it("the Choose that exhausts a character or puts progress on a named objective (19158:A:1): ordinary words in The Withered Heath, the scenario's words in its own", () => {
    const base = fateScene([]);
    const effect = (ctx: ReduceContext, code: string) => copy(ctx, "19158:forced:1", code);
    const { scene } = heathScene([]);
    const lookalike = { ...scene, ctx: { ...scene.ctx, effects: [...scene.ctx.effects, effect(base.ctx, HEATH.snowTroll)] } };
    const heathSheet = sheetOf(lookalike, opened(lookalike, lookalike.state, HEATH.snowTroll, "forced", "engaged"));
    expect(heathSheet).toEqual({ note: "Choose one.", labels: ["Choose a character, then exhaust the chosen card", "Choose an objective, then place 1 progress on it"] });
    const own = fateScene([effect(base.ctx, CODES.strayGoblin)]);
    const fateSheet = sheetOf(own, opened(own, own.state, CODES.strayGoblin, "forced", "engaged"));
    expect(fateSheet.note).toBe("Stray Goblin: it engaged you. The Goblins' Assault holds 0 of the 4 progress that advance the quest at the end of the round.");
    expect(fateSheet.labels).toEqual(["Exhaust a character you control", "Place 1 progress on The Goblins' Assault"]);
  });

  it("the Response that puts a resource on the card that counts them (19156:A:2): the ordinary Response note in The Withered Heath", () => {
    const base = fateScene([]);
    const response = (code: string): Effect => ({ ...copy(base.ctx, "19156:response:1", code), subject: { type: "enemy", control: "any", staging: true } });
    const { scene } = heathScene([response(COUNTER)]);
    const goblin = spawn(scene.state, HEATH.snowTroll, { zone: "engaged", seat: 0 });
    const lethal = settle({ ...updateCard(goblin.state, goblin.id, { damage: 99 }), window: null, mode: "stopped" }, scene.ctx, []);
    expect(lethal.window?.kind).toBe("response");
    expect(sheetOf(scene, lethal).note).toBe("A Response may be used now, or passed.");
    const own = fateScene([]);
    const target = spawn(own.state, CODES.strayGoblin, { zone: "engaged", seat: 0 });
    const dead = settle({ ...updateCard(target.state, target.id, { damage: 99 }), window: null, mode: "stopped" }, own.ctx, []);
    expect(sheetOf(own, dead).note).toBe("Stray Goblin was destroyed. The Heroes' Defense holds 0 of the 5 resources that engage Urdug with each player. Place 1 resource on it. Pass and it stays at 0.");
  });

  it("the attack that discards the top card for its Threat (19157:A:2): the ordinary defense note in The Withered Heath", () => {
    const base = fateScene([]);
    const attacker = copy(base.ctx, "19157:forced:1", HEATH.snowTroll);
    const withDeck = heathTable(heath, { phase: "Combat", engaged: [{ code: HEATH.snowTroll, seat: 0 }], deck: ["f0", HEATH.mountainPass, "f0"] });
    const lookalike = { ...withDeck, ctx: { ...withDeck.ctx, effects: [...withDeck.ctx.effects, attacker] } };
    let run: Run = start(lookalike.state);
    for (let guard = 0; guard < 30 && run.state.window?.kind !== "defense"; guard += 1) {
      const pass = legalIntents(run.state, lookalike.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack");
      if (!pass) break;
      run = send(run, pass as never, lookalike.ctx);
    }
    expect(run.state.window?.kind).toBe("defense");
    expect(sheetOf(lookalike, run.state).note).toMatch(/^Attack \d+\. Choose a defender, or leave it undefended\.$/);
  });

  it("the banner: the treachery that raises the staging area's Threat, the objective's progress and the attack's discard are told only in The Fate of Wilderland", () => {
    const base = fateScene([]);
    const treachery = copy(base.ctx, "19167:whenRevealed:1", HEATH.heavySnow);
    const { scene } = heathScene([treachery]);
    const outside = fateNames(scene.ctx, (id) => scene.state.cards[id]?.code ?? id);
    const snow = spawn(scene.state, HEATH.heavySnow, { zone: "staging" });
    expect(outside.revealed(snow.state, snow.id, true)).toBeNull();
    const objective = Object.values(scene.state.cards).find((card) => card.code === OBJECTIVE)!;
    expect(outside.beats(scene.state, updateCard(scene.state, objective.id, { progress: 2 }))).toEqual([]);
    const own = fateScene([copy(base.ctx, "19167:whenRevealed:1", CODES.strayGoblin)]);
    const inside = fateNames(own.ctx, (id) => own.state.cards[id]?.code ?? id);
    const stray = spawn(own.state, CODES.strayGoblin, { zone: "staging" });
    expect(inside.revealed(stray.state, stray.id, true)).toContain("+1 Threat until the end of the phase");
  });

  it("the optional engagement: nothing is said of an enemy that cannot be engaged in The Withered Heath", () => {
    const base = fateScene([]);
    const lock = { ...copy(base.ctx, "19157:constant:1", HEATH.snowTroll), id: "lookalike:constant" };
    const { scene } = heathScene([lock]);
    const troll = spawn(scene.state, HEATH.snowTroll, { zone: "staging" });
    const state = { ...troll.state, window: { kind: "optionalEngage" as const }, mode: "optionalEngage" as const };
    expect(sheetOf(scene, state).note).not.toContain("cannot be engaged");
  });
});
