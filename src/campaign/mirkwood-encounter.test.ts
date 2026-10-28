// Rules: rr.step-3-3, rr.travel, rr.search, rr.first-player, rr.exhausted, rr.step-6-4-2, rr.shadow-effects, rr.step-7-3 (data/rules/entries.json).
// The Passage Through Mirkwood encounter cards: each line of the ledger (data/printed/mirkwood-paths.json) has a record, and these tests
// run them on a table of plain-number heroes (scripts/mirkwood-scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../rules/constants.ts";
import { legalIntents, legalTargets } from "../rules/legal.ts";
import { modifiedStat } from "../rules/keywords.ts";
import type { PlayerIntent, ReduceContext } from "../rules/reduce.ts";
import { flagged, type ScenarioState } from "../rules/state.ts";
import { pushCardEffects } from "../rules/effect-frames.ts";
import type { EngineStep } from "../rules/intents.ts";
import { settle } from "../rules/machine.ts";
import { spawn } from "../rules/zones.ts";
import { pickCandidates } from "../rules/pick.ts";
import { loadPrinted } from "../../scripts/test-catalog.ts";
import { causeProblems } from "../../scripts/cause-check.ts";
import { HERO, HERO2, loadMirkwoodWorld, mirkwoodTable, type MirkwoodLayout, type MirkwoodWorld } from "../../scripts/mirkwood-scene.ts";
import { codesOf, first, reveal, send, start, type Run } from "../../scripts/past-scene.ts";

let world: MirkwoodWorld;

beforeAll(async () => {
  world = await loadMirkwoodWorld();
});

function make(layout: MirkwoodLayout = {}) {
  const made = mirkwoodTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

// Answers the open choices with `pick` (the first option by default) until none is open.
function settleChoices(run: Run, ctx: ReduceContext, pick: (state: ScenarioState) => string = (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")): Run {
  let current = run;
  for (let guard = 0; guard < 20 && current.state.window?.kind === "choose"; guard += 1) current = send(current, { type: "Choose", optionId: pick(current.state) }, ctx);
  return current;
}

// The card's When Revealed records resolve now, in the quest phase (the way a reveal resolves them), and the choices they open are answered.
function resolveReveal(state: ScenarioState, ctx: ReduceContext, code: string, pick?: (state: ScenarioState) => string): Run {
  const spawned = spawn(state, code, { zone: "encounterDiscard" });
  const effects = ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === "whenRevealed");
  const steps: EngineStep[] = [];
  const pushed = pushCardEffects(spawned.state, "whenRevealed", spawned.id, spawned.state.firstPlayer, false, effects, ctx, steps);
  const run = settleChoices({ state: settle({ ...pushed, window: null }, ctx, steps), steps }, ctx, pick);
  expect(causeProblems(run.steps)).toEqual([]);
  return run;
}

function revealed(code: string, layout: MirkwoodLayout = {}, pick?: (state: ScenarioState) => string) {
  const made = make(layout);
  return { ...made, run: resolveReveal(made.state, made.ctx, code, pick) };
}

function exhaustedHeroes(state: ScenarioState): string[] {
  return Object.values(state.cards).filter((card) => card.zone === "heroes" && card.exhausted).map((card) => card.code);
}

describe("treacheries when revealed", () => {
  it("King Spider's When Revealed has each player exhaust a character they control (01074:A:1)", () => {
    const solo = revealed("01074");
    expect(exhaustedHeroes(solo.run.state)).toHaveLength(1);
    const two = revealed("01074", { seats: 2 });
    expect(exhaustedHeroes(two.run.state)).toHaveLength(2);
    expect(exhaustedHeroes(two.run.state)).toContain("mh3");
  });

  it("Eyes of the Forest makes each player discard every event in their hand and keep the rest (01079:A:1)", () => {
    const { run, state } = revealed("01079", { seats: 2, hand: ["mevent", "ally", "mevent"], hand2: ["mevent", "filler"] });
    expect(codesOf(run.state, run.state.seats[0].hand)).toEqual(["ally"]);
    expect(codesOf(run.state, run.state.seats[1].hand)).toEqual([]);
    expect(codesOf(run.state, run.state.seats[0].discard).sort()).toEqual(["mevent", "mevent"]);
    expect(state.seats[0].hand).toHaveLength(3);
  });

  it("Black Forest Bats removes a committed character of each player from the quest, and it stays exhausted (01098:A:1)", () => {
    const made = make();
    const heroes = [first(made.state, HERO), first(made.state, HERO2)];
    const committed = heroes.reduce((state, id) => ({ ...state, cards: { ...state.cards, [id]: { ...state.cards[id]!, committed: true, exhausted: true } } }), made.state);
    const run = resolveReveal(committed, made.ctx, "01098");
    const left = heroes.filter((id) => run.state.cards[id]?.committed);
    expect(left).toHaveLength(1);
    const gone = heroes.find((id) => !run.state.cards[id]?.committed) ?? "";
    expect(run.state.cards[gone]?.exhausted).toBe(true);
  });

  it("Dol Guldur Orcs deals 2 damage to a committed character the first player chooses (01089:A:1)", () => {
    const made = make({ seats: 2 });
    const mine = first(made.state, HERO);
    const theirs = made.seat1Hero ?? "";
    const committed = [mine, theirs].reduce((state, id) => ({ ...state, cards: { ...state.cards, [id]: { ...state.cards[id]!, committed: true } } }), made.state);
    const run = resolveReveal(committed, made.ctx, "01089", () => theirs);
    const done = run;
    expect(done.state.cards[theirs]?.damage).toBe(2);
    expect(done.state.cards[mine]?.damage).toBe(0);
  });

  it("Ungoliant's Spawn gives each committed character -1 Willpower until the end of the phase (01076:A:1)", () => {
    const made = make();
    const mine = first(made.state, HERO);
    const other = first(made.state, HERO2);
    const committed = { ...made.state, cards: { ...made.state.cards, [mine]: { ...made.state.cards[mine]!, committed: true } } };
    const run = resolveReveal(committed, made.ctx, SPAWN_CODE);
    expect(modifiedStat(run.state, run.state.cards[mine]!, "willpower", made.ctx.cards)).toBe(1);
    expect(modifiedStat(run.state, run.state.cards[other]!, "willpower", made.ctx.cards)).toBe(2);
  });

  it("The Necromancer's Reach deals 1 damage to each exhausted character and none to a ready one (01093:A:1)", () => {
    const made = make({ seats: 2 });
    const spent = first(made.state, HERO);
    const exhausted = { ...made.state, cards: { ...made.state.cards, [spent]: { ...made.state.cards[spent]!, exhausted: true }, [made.seat1Hero ?? ""]: { ...made.state.cards[made.seat1Hero ?? ""]!, exhausted: true } } };
    const run = resolveReveal(exhausted, made.ctx, "01093");
    expect(run.state.cards[spent]?.damage).toBe(1);
    expect(run.state.cards[made.seat1Hero ?? ""]?.damage).toBe(1);
    expect(run.state.cards[first(made.state, HERO2)]?.damage).toBe(0);
  });

  it("Driven by Shadow gives the enemies and locations in the staging area +1 Threat for the phase, and gains surge with none there (01092:A:1)", () => {
    const busy = revealed("01092", { staging: ["f3", "01099"] });
    const stagedF3 = first(busy.run.state, "f3");
    expect(modifiedStat(busy.run.state, busy.run.state.cards[stagedF3]!, "threat", busy.ctx.cards)).toBe(4);
    const location = first(busy.run.state, "01099");
    expect(modifiedStat(busy.run.state, busy.run.state.cards[location]!, "threat", busy.ctx.cards)).toBe(modifiedStat(busy.state, busy.state.cards[location]!, "threat", busy.ctx.cards) + 1);
    // The surge is the staging step's: with a card there, revealing it adds nothing; with the area empty, one more card is revealed.
    const crowded = reveal(make({ staging: ["f0", "f0"], deck: ["01092", "f3", "f3"] }).state, busy.ctx);
    expect(crowded.state.staging).toHaveLength(2);
    const emptyRun = reveal(make({ deck: ["01092", "f3", "f3"] }).state, busy.ctx);
    expect(emptyRun.state.staging).toHaveLength(1);
  });
});

// The options of every choose window a reveal opens, and the run once each is answered (`answer` picks from the options; the first by default).
function offered(made: ReturnType<typeof make>, code: string, answer: (options: readonly string[]) => string) {
  const windows: (readonly string[])[] = [];
  const run = resolveReveal(made.state, made.ctx, code, (state) => {
    const options = state.window?.kind === "choose" ? state.window.options : [];
    windows.push(options);
    return answer(options);
  });
  return { windows, run };
}

describe("Lingering Venom when revealed (01137:A:2: either exhaust each damaged character you control, or deal 2 damage to the hero you control with the most damage on it)", () => {
  const damageOption = (options: readonly string[]) => (options.includes("damage") ? "damage" : (options[0] ?? ""));

  it("offers only the hero with the most damage, and deals the 2 damage to it", () => {
    const made = make({ damage: [["mh1", 2], ["mh2", 1]] });
    const { windows, run } = offered(made, "01137", damageOption);
    const [mine, other] = [first(made.state, HERO), first(made.state, HERO2)];
    // One candidate is taken without a window; the other hero is never offered.
    expect(windows.flat()).not.toContain(other);
    expect(run.state.cards[mine]?.damage).toBe(4);
    expect(run.state.cards[other]?.damage).toBe(1);
  });

  it("offers every hero tied for the most damage", () => {
    const made = make({ damage: [["mh1", 2], ["mh2", 2]] });
    const { windows, run } = offered(made, "01137", (options) => (options.includes("damage") ? "damage" : (options[1] ?? "")));
    const [mine, other] = [first(made.state, HERO), first(made.state, HERO2)];
    expect(windows.some((options) => options.includes(mine) && options.includes(other))).toBe(true);
    expect(run.state.cards[other]?.damage).toBe(4);
    expect(run.state.cards[mine]?.damage).toBe(2);
  });

  it("offers every hero when none has damage", () => {
    const made = make();
    const { windows } = offered(made, "01137", damageOption);
    const [mine, other] = [first(made.state, HERO), first(made.state, HERO2)];
    expect(windows.some((options) => options.includes(mine) && options.includes(other))).toBe(true);
  });

  it("the exhaust option exhausts each damaged character the player controls, allies included, and no other", () => {
    const made = make({ allies: ["ally", "ally"], damage: [["mh1", 1], ["ally", 1]] });
    const { run } = offered(made, "01137", (options) => (options.includes("exhaust") ? "exhaust" : (options[0] ?? "")));
    const allies = Object.entries(run.state.cards).filter(([, card]) => card.code === "ally" && card.zone === "play");
    expect(run.state.cards[first(made.state, HERO)]?.exhausted).toBe(true);
    expect(run.state.cards[first(made.state, HERO2)]?.exhausted).toBe(false);
    expect(allies.map(([, card]) => card.exhausted).sort()).toEqual([false, true]);
    for (const [, card] of allies) expect(card.damage > 0).toBe(card.exhausted);
    expect(Object.values(run.state.cards).filter((card) => card.zone === "heroes" || card.zone === "play").every((card) => card.damage === 0 || card.exhausted)).toBe(true);
  });
});

describe("Ungoliant's Swarm engaged (01136:A:1: that player must choose and exhaust 2 characters they control)", () => {
  it("exhausts 2 ready characters of the engaged player", () => {
    const made = make({ staging: ["01136"], phase: "Encounter", allies: ["ally"] });
    const run = engageStaged(made.state, made.ctx, "01136");
    const characters = Object.values(run.state.cards).filter((card) => (card.zone === "heroes" || card.zone === "play") && card.controller === 0 && (card.code === "ally" || card.code.startsWith("mh")));
    expect(characters.filter((card) => card.exhausted)).toHaveLength(2);
  });
});

// An engine decision with no pinned rules span: a controlled objective ally with printed combat stats (Mendor, 01135; Gildor Inglorion, 141077)
// is an ally in play for a character pick and an ally pick, whatever the card type printed on it.
describe("an objective ally with combat stats a player controls", () => {
  it("is matched by a character pick and an ally pick (Gildor Inglorion, 141077)", async () => {
    for (const [code, printed] of await loadPrinted(["141077"])) world.cards.set(code, printed);
    const made = make();
    const gildor = spawn(made.state, "141077", { zone: "play", seat: 0 });
    const offer = (type: "character" | "ally" | "hero") => pickCandidates(gildor.state, { type, control: "you" }, 0, [], null, made.ctx);
    expect(offer("character")).toContain(gildor.id);
    expect(offer("ally")).toContain(gildor.id);
    expect(offer("hero")).not.toContain(gildor.id);
  });
});

describe("enemies", () => {
  it("Hummerhorns deals 5 damage to a single hero of the player it engages (01075:A:1)", () => {
    const made = make({ seats: 2, staging: ["01075"], phase: "Encounter" });
    const run = engageStaged(made.state, made.ctx, "01075");
    const damaged = Object.values(run.state.cards).filter((card) => card.zone === "heroes" && card.damage > 0);
    expect(damaged.map((card) => card.damage)).toEqual([5]);
  });

  it("Dol Guldur Beastmaster deals itself an additional shadow card when it attacks (01091:A:1)", () => {
    const made = make({ phase: "Encounter", engaged: [{ code: "01091", seat: 0 }], deck: ["f0", "f0", "f0", "f0"] });
    const beast = first(made.state, "01091");
    const attacking = attackBegins(made.state, made.ctx, beast);
    expect(attacking.cards[beast]?.shadowId).not.toBeNull();
    expect(attacking.cards[beast]?.extraShadowIds ?? []).toHaveLength(1);
  });

  it("Chieftan Ufthak gets +2 Attack for each resource token on him and a token after each of his attacks (01090:A:1, 01090:A:2)", () => {
    const made = make({ phase: "Encounter", engaged: [{ code: "01090", seat: 0 }], deck: ["f0", "f0", "f0"] });
    const ufthak = first(made.state, "01090");
    const base = modifiedStat(made.state, made.state.cards[ufthak]!, "attack", made.ctx.cards);
    const tokens = { ...made.state, cards: { ...made.state.cards, [ufthak]: { ...made.state.cards[ufthak]!, resources: 3 } } };
    expect(modifiedStat(syncConstants(tokens, made.ctx), tokens.cards[ufthak]!, "attack", made.ctx.cards)).toBe(base + 6);
    const fought = fightOn(made.state, made.ctx);
    expect(fought.cards[ufthak]?.resources).toBe(1);
  });

  it("Forest Spider gets +1 Attack until the end of the round after it engages a player (01096:A:1)", () => {
    const made = make({ staging: ["01096"], phase: "Encounter" });
    const spider = first(made.state, "01096");
    const base = modifiedStat(made.state, made.state.cards[spider]!, "attack", made.ctx.cards);
    const run = engageStaged(made.state, made.ctx, "01096");
    expect(modifiedStat(run.state, run.state.cards[spider]!, "attack", made.ctx.cards)).toBe(base + 1);
  });
});

// The first enemy in the staging area is engaged by the first seat: the optional engagement step lets a player engage it.
function engageStaged(state: ScenarioState, ctx: ReduceContext, code: string): Run {
  const enemy = first(state, code);
  if (!legalTargets(state, { type: "Engage" }, ctx).includes(enemy)) throw new Error(`${code} cannot be engaged`);
  return settleChoices(send(start(state), { type: "Engage", enemyId: enemy }, ctx), ctx);
}

// Passes the Encounter and Combat phases until the first enemy attack begins (the defender window or the end of the attack).
function attackBegins(state: ScenarioState, ctx: ReduceContext, enemyId: string): ScenarioState {
  let run = send(start(state), { type: "DeclineEngage" }, ctx);
  for (let guard = 0; guard < 60 && run.state.window?.kind !== "defense"; guard += 1) {
    const pass = legalIntents(run.state, ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, ctx);
  }
  return run.state.cards[enemyId] ? run.state : state;
}

// Plays the combat phase of the table through to the end of the enemy attacks, the first hero defending.
function fightOn(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  let run = send(start(state), { type: "DeclineEngage" }, ctx);
  for (let guard = 0; guard < 80; guard += 1) {
    if (run.state.window?.kind === "defense") {
      const defenders = legalTargets(run.state, { type: "DeclareDefender" }, ctx);
      run = send(run, defenders[0] ? { type: "DeclareDefender", defenderId: defenders[0] } : { type: "Undefended", heroId: legalTargets(run.state, { type: "Undefended" }, ctx)[0] ?? "" }, ctx);
      continue;
    }
    if (run.state.window?.kind === "choose") {
      run = send(run, { type: "Choose", optionId: run.state.window.options[0] ?? "" }, ctx);
      continue;
    }
    if (run.state.phase === "Refresh" || run.state.phase === "End of round" || run.state.round > 1) break;
    const pass = legalIntents(run.state, ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, ctx);
  }
  return run.state;
}

const SPAWN_CODE = "01076";
void flagged;
