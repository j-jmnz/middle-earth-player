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
import { CODES, idOf, loadWilderlandWorld, send, start, wilderlandTable, type Run, type WilderlandWorld } from "../../../test/scenarios/the-fate-of-wilderland/scene.ts";

import { fateAsk, fateBranchCaution, fateBranchRows, fateBranchWords, fateChooseNote, fateTargetNote } from "../words/fate.ts";
import { fateNames, fateShieldedLine, fateStrikeLine } from "../words/fate-beats.ts";
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
    expect(fateSheet.note).toBe("Stray Goblin: it engaged you. The Goblins' Assault: 0 of 4 progress, +1 at the end of the round (1 for each enemy in the staging area). At 4 the goblins push the quest on.");
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
    expect(sheetOf(own, dead).note).toBe("Stray Goblin was destroyed. The Heroes' Defense holds 0 of the 5 resources that make Urdug engaged with each player. Use it to place 1 resource. Pass and it stays at 0.");
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

  it("every entry point of the scenario's words is gated: the real instruction against a game of The Withered Heath is told in no word, and against the scenario's own table it is", () => {
    const base = fateScene([]);
    const watchtower = record(base.ctx, "19163:response:1").instructions[0];
    const elite = record(base.ctx, "19158:forced:1").instructions[0];
    if (watchtower?.verb !== "Choose" || elite?.verb !== "Choose") throw new Error("the records changed shape");
    const exhaust = elite.options[0]?.instructions ?? [];
    const names = { card: (id: string) => id, code: (code: string) => code, line: () => null };
    // The Heath's table with a Snow Troll that carries the records of Urdug and the objective that shields him, and one of the objective's own title for the branches to read.
    const shield = { ...record(base.ctx, "19155:constant:2"), id: "lookalike:shield", cardCode: HEATH.snowTroll, lines: [], condition: { kind: "not" as const, condition: { kind: "attackedThisPhase" as const, name: "Snow Troll" } } };
    const { scene } = heathScene([copy(base.ctx, "19157:forced:1", HEATH.snowTroll), shield]);
    const troll = spawn(scene.state, HEATH.snowTroll, { zone: "staging" });
    const outside = { game: troll.state, ctx: scene.ctx };
    const urdug = idOf(base.state, CODES.urdug);
    const rows = { exhaust: "Exhaust a character you control", progress: "Place 1 progress on The Goblins' Assault" };

    // The Watchtower's branch of the note over a Choose.
    expect(fateChooseNote(watchtower, outside.game, outside.ctx, names, troll.id)).toBeNull();
    expect(fateChooseNote(watchtower, base.state, base.ctx, names, idOf(base.state, CODES.dwarvenWatchtower))).toContain("was explored");
    // The rows and the words of a branch, the caution before the second tap, and the pick of a character to exhaust.
    expect(fateBranchRows(outside.game, outside.ctx, elite, troll.id)).toEqual({});
    expect(fateBranchRows(base.state, base.ctx, elite, urdug)).toMatchObject({ progress: "Place 1 progress on The Goblins' Assault" });
    expect(fateBranchWords(elite, "progress", rows, outside.game, outside.ctx)).toBeNull();
    expect(fateBranchWords(elite, "progress", rows, base.state, base.ctx)).toBe(rows.progress);
    expect(fateBranchWords(elite, "progress", rows, undefined, undefined)).toBeNull();
    const last = wilderlandTable(fate, { phase: "Encounter", discard: [CODES.dwarvenWatchtower], stage: "19170", staging: [{ code: CODES.theGoblinsAssault, progress: 14 }, CODES.theHeroesDefense, CODES.urdug] });
    expect(fateBranchCaution(elite, "progress", outside.game, outside.ctx)).toBeNull();
    expect(fateBranchCaution(elite, "progress", last.state, last.ctx)).toContain("Tap again: with 1 for each enemy in play");
    expect(fateBranchCaution(watchtower, "resource", outside.game, outside.ctx)).toBeNull();
    expect(fateAsk(exhaust[0] as never, null, names, exhaust[1], outside.game, outside.ctx)).toBeNull();
    expect(fateAsk(exhaust[0] as never, null, names, exhaust[1], base.state, base.ctx)).not.toBeNull();

    // The banner's lines under an attack: the enemy that discards a card for its Threat, and the one shielded until he has attacked. And the note of the Attack on him.
    const card = (id: string) => id;
    expect(fateStrikeLine(outside.ctx, outside.game, outside.game, troll.id, card)).toBeNull();
    expect(fateStrikeLine(base.ctx, base.state, base.state, urdug, card)).toContain("discarded");
    expect(fateShieldedLine(outside.ctx, outside.game, troll.id)).toBeNull();
    expect(fateShieldedLine(base.ctx, { ...base.state, phase: "Combat" }, urdug)).toContain("takes no damage");
    expect(fateTargetNote(outside.game, outside.ctx, troll.id, 3, "Snow Troll")).toBeNull();
    expect(fateTargetNote(base.state, base.ctx, urdug, 2, "Urdug")).toContain("He takes no damage until he has attacked this phase");
  });
});
