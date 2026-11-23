// Rules: rr.attachment-cards, rr.restricted, rr.action, rr.limits, rr.staging-area, rr.lasting-effects, rr.enters-play, rr.response, rr.damage,
// rr.modifiers, rr.cost, rr.engagement-check, rr.step-6-4-3, ltp.undefended-attack (data/rules/entries.json).
// The Black Riders player cards, written from their card text (data/cards/TBR.json; data/printed holds Dagger of Westernesse only, so the steps go
// through sendUnledgered): Dagger of Westernesse 141014:A:1, Hobbit Pipe 141015:A:1, Fatty Bolger 141005:A:1, Farmer Maggot 141008:A:1,
// Smoke Rings 141010:A:1, Take No Notice 141011:A:1 and A:2, Barliman Butterbur 141007:A:1.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { playCost } from "../../rules/player/attach.ts";
import { engagementCostOf, stagingThreat } from "../../rules/quest/quest.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, MERRY, SAM, type Run, type Table } from "../../../test/harness/scene.ts";
import { attach, choices, chooseIfAsked, combat, enter, hosts, passWhile, playCode, playerTableFor, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const FATTY = "141005";
const BARLIMAN = "141007";
const MAGGOT = "141008";
const SMOKE_RINGS = "141010";
const TAKE_NO_NOTICE = "141011";
const DAGGER = "141014";
const PIPE = "141015";
// Secret Vigil (The Lost Realm): "Attached enemy gets -1 Threat."
const VIGIL = "09012";
// Core heroes: Aragorn (Leadership, Dúnedain Ranger), Legolas (Tactics, Silvan), Beravor (Lore, Dúnedain Ranger), Glóin (Leadership, Dwarf).
const ARAGORN = "01001";
const GLOIN = "01003";
const LEGOLAS = "01005";
const BERAVOR = "01012";
// Stand-in enemies of the scene kit and the starter scene: f3 (Threat 3), Cheap (engagement cost 2) and Dear (engagement cost 50).
const F3 = "f3";
const CHEAP = "cheap";
const DEAR = "dear";
const WEAK = "weak";
const ALLY = "ally";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([FATTY, BARLIMAN, MAGGOT, SMOKE_RINGS, TAKE_NO_NOTICE, DAGGER, PIPE, VIGIL, ARAGORN, GLOIN, LEGOLAS, BERAVOR]))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 6, attack: 2, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

describe("Dagger of Westernesse (141014:A:1)", () => {
  // "Attach to a hero. Restricted.": Legolas and Aragorn are offered; a plain ally is not.
  lineSpec("141014:A:1", "goes on a hero and not on an ally", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: DAGGER, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, DAGGER))).toEqual([idsOf(tab, LEGOLAS), idsOf(tab, ARAGORN)].sort());
  });
});

describe("Hobbit Pipe (141015:A:1)", () => {
  // "Attach to a Hobbit character. Limit 1 per character.": Sam (Hobbit hero) and Farmer Maggot (Hobbit ally) are offered; Aragorn (not a Hobbit)
  // and Merry (a Hobbit that already holds a Pipe) are not.
  lineSpec("141015:A:1", "goes on a Hobbit character that holds no Pipe yet", (effects) => {
    const scene = table(effects, { heroes: [{ code: SAM, seat: 0 }, { code: MERRY, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: MAGGOT, seat: 0 }, { code: PIPE, seat: 0 }], hand: [{ code: PIPE, seat: 0 }] });
    const [worn, held] = scene.ids[PIPE] ?? [];
    const tab = attach(scene, [[worn ?? "", idsOf(scene, MERRY)]]);
    expect(hosts(tab, held ?? "")).toEqual([idsOf(tab, SAM), idsOf(tab, MAGGOT)].sort());
  });
});

describe("Fatty Bolger (141005:A:1)", () => {
  // "Action: Exhaust Fatty Bolger to choose an enemy in the staging area and raise your threat by that enemy's Threat. Until the end of the phase,
  // that enemy does not contribute its Threat. (Limit once per round.)"
  lineSpec("141005:A:1", "exhausts to raise the threat by a staged enemy's Threat, which stops counting to the end of the phase", (effects) => {
    const tab = table(effects, { heroes: [{ code: FATTY, seat: 0 }, { code: SAM, seat: 0 }], staging: [F3, "f0"], engaged: [{ code: WEAK, seat: 0 }] });
    const [fatty, enemy] = [idsOf(tab, FATTY), idsOf(tab, F3)];
    const before = stagingThreat(tab.state, tab.ctx.cards);
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: fatty, effectId: "141005:action:1" }, tab.ctx);
    // The engaged enemy is not in the staging area: it is no choice.
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab)).not.toContain(idsOf(tab, WEAK));
    run = chooseIfAsked(run, tab, enemy);
    expect(run.state.cards[fatty]?.exhausted).toBe(true);
    expect(run.state.seats[0]?.threat).toBe(8 + 3);
    expect(stagingThreat(run.state, tab.ctx.cards)).toBe(before - 3);
    // The phase ends: the enemy counts again.
    expect(stagingThreat(enter(run.state, tab, "questCommit").state, tab.ctx.cards)).toBe(before);
    // Readied in the same round, Fatty cannot use it again (limit once per round).
    expect(triggers(updateCard(run.state, fatty, { exhausted: false }), tab)).not.toContain("141005:action:1");
  });

  // "that enemy's Threat" is its Threat now: Secret Vigil (09012, "Attached enemy gets -1 Threat") on f3 makes it 2.
  it("141005:A:1 raises the threat by the enemy's Threat as modified", () => {
    const scene = table(EFFECTS, { heroes: [{ code: FATTY, seat: 0 }, { code: SAM, seat: 0 }], allies: [{ code: VIGIL, seat: 0 }], staging: [F3] });
    const tab = attach(scene, [[idsOf(scene, VIGIL), idsOf(scene, F3)]]);
    const before = stagingThreat(tab.state, tab.ctx.cards);
    const run = chooseIfAsked(sendUnledgered(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, FATTY), effectId: "141005:action:1" }, tab.ctx), tab, idsOf(tab, F3));
    expect(run.state.seats[0]?.threat).toBe(8 + 2);
    expect(stagingThreat(run.state, tab.ctx.cards)).toBe(before - 2);
  });

  it("141005:A:1 is not offered with no enemy in the staging area", () => {
    const tab = table(EFFECTS, { heroes: [{ code: FATTY, seat: 0 }, { code: SAM, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }] });
    expect(triggers(tab.state, tab)).not.toContain("141005:action:1");
  });
});

describe("Farmer Maggot (141008:A:1)", () => {
  // "Response: After Farmer Maggot enters play, deal 1 damage to an enemy engaged with you. (Deal 2 damage instead if that enemy's engagement cost
  // is higher than your threat.)": threat 8; Cheap (engagement cost 2) takes 1, Dear (engagement cost 50) takes 2.
  for (const [enemy, damage] of [[CHEAP, 1], [DEAR, 2]] as const) {
    lineSpec("141008:A:1", `after it enters play, deals ${damage} damage to an engaged enemy of engagement cost ${enemy === CHEAP ? "2" : "50"}`, (effects) => {
      const tab = table(effects, { seats: 2, heroes: [{ code: LEGOLAS, seat: 0 }, { code: "pal", seat: 1 }], hand: [{ code: MAGGOT, seat: 0 }], engaged: [{ code: enemy, seat: 0 }, { code: WEAK, seat: 1 }] });
      let run = playCode(tab, MAGGOT);
      expect(triggers(run.state, tab)).toContain("141008:response:1");
      run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, MAGGOT), effectId: "141008:response:1" }, tab.ctx);
      // The enemy engaged with the other player is no choice.
      expect(run.state.window?.kind).not.toBe("choose");
      run = chooseIfAsked(run, tab, idsOf(tab, enemy));
      expect(run.state.cards[idsOf(tab, enemy)]?.damage).toBe(damage);
      expect(run.state.cards[idsOf(tab, WEAK)]?.damage).toBe(0);
    });
  }

  // "After Farmer Maggot enters play": another ally entering play while Maggot is already in play is not his triggering condition.
  it("141008:A:1 is not offered when another ally enters play", () => {
    const tab = table(EFFECTS, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: SAM, seat: 0 }], allies: [{ code: MAGGOT, seat: 0 }], hand: [{ code: ALLY, seat: 0 }], engaged: [{ code: DEAR, seat: 0 }] });
    const run = playCode(tab, ALLY);
    expect(run.state.cards[idsOf(tab, ALLY)]?.zone).toBe("play");
    expect(triggers(run.state, tab)).not.toContain("141008:response:1");
  });

  it("141008:A:1 is not offered with no enemy engaged with you", () => {
    const tab = table(EFFECTS, { heroes: [{ code: LEGOLAS, seat: 0 }], hand: [{ code: MAGGOT, seat: 0 }], staging: [WEAK] });
    expect(triggers(playCode(tab, MAGGOT).state, tab)).not.toContain("141008:response:1");
  });
});

describe("Smoke Rings (141010:A:1)", () => {
  // "Action: Reduce your threat by 1 for each Pipe you control. Each hero with a Pipe attachment gets +1 Willpower until the end of the phase.":
  // Fatty and Sam hold a Pipe each, the other player's Merry holds one too. Threat 8 goes to 6 (2 Pipes are yours); the three heroes with a Pipe
  // get +1 Willpower, Pippin, who holds none, does not.
  lineSpec("141010:A:1", "lowers your threat by 1 for each Pipe you control and gives each hero with a Pipe +1 Willpower", (effects) => {
    const scene = table(effects, {
      seats: 2,
      heroes: [{ code: FATTY, seat: 0 }, { code: SAM, seat: 0 }, { code: "141004", seat: 0 }, { code: MERRY, seat: 1 }],
      allies: [{ code: PIPE, seat: 0 }, { code: PIPE, seat: 0 }, { code: PIPE, seat: 1 }],
      hand: [{ code: SMOKE_RINGS, seat: 0 }],
    });
    const [a, b, c] = scene.ids[PIPE] ?? [];
    const tab = attach(scene, [[a ?? "", idsOf(scene, FATTY)], [b ?? "", idsOf(scene, SAM)], [c ?? "", idsOf(scene, MERRY)]]);
    const willpower = (state: ScenarioState, code: string) => stat(state, tab, idsOf(tab, code), "willpower");
    const before = [FATTY, SAM, MERRY, "141004"].map((code) => willpower(tab.state, code));
    let run = playCode(tab, SMOKE_RINGS);
    // The threat is lowered by an event: the Hobbit Pipes' Response (141015:A:2) is offered and passed.
    run = passWhile(run, tab, (run) => run.state.window?.kind === "response", 4);
    expect(run.state.seats[0]?.threat).toBe(6);
    expect(run.state.seats[1]?.threat).toBe(tab.state.seats[1]?.threat);
    expect([FATTY, SAM, MERRY, "141004"].map((code) => willpower(run.state, code))).toEqual([before[0]! + 1, before[1]! + 1, before[2]! + 1, before[3]]);
    const later = enter(run.state, tab, "questCommit").state;
    expect([FATTY, SAM, MERRY, "141004"].map((code) => willpower(later, code))).toEqual(before);
  });
});

describe("Take No Notice (141011:A:1, A:2)", () => {
  // "Lower the cost play Take No Notice by 1 for each Hobbit or Ranger hero you control.": Beravor (Ranger) and Sam (Hobbit) lower it by 2; Glóin
  // does not, nor does the other player's Hobbit, Merry.
  lineSpec("141011:A:1", "costs 1 less for each Hobbit or Ranger hero you control", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: BERAVOR, seat: 0 }, { code: SAM, seat: 0 }, { code: GLOIN, seat: 0 }, { code: MERRY, seat: 1 }], hand: [{ code: TAKE_NO_NOTICE, seat: 0 }] });
    expect(playCost(tab.state, idsOf(tab, TAKE_NO_NOTICE), 0, tab.ctx)).toBe(3 - 2);
    const fewer = table(effects, { heroes: [{ code: BERAVOR, seat: 0 }, { code: GLOIN, seat: 0 }], hand: [{ code: TAKE_NO_NOTICE, seat: 0 }] });
    expect(playCost(fewer.state, idsOf(fewer, TAKE_NO_NOTICE), 0, fewer.ctx)).toBe(3 - 1);
  });

  // "Action: Add 5 to each enemy's engagement cost until the end of the round.": the staged and the engaged enemy both get +5; it lasts through
  // the next phase and is gone in the next round.
  lineSpec("141011:A:2", "adds 5 to each enemy's engagement cost until the end of the round", (effects) => {
    const tab = table(effects, { heroes: [{ code: BERAVOR, seat: 0 }, { code: GLOIN, seat: 0 }], hand: [{ code: TAKE_NO_NOTICE, seat: 0 }], staging: [WEAK], engaged: [{ code: CHEAP, seat: 0 }] });
    const [weak, cheap] = [idsOf(tab, WEAK), idsOf(tab, CHEAP)];
    const cost = (state: ScenarioState, id: string) => engagementCostOf(state, state.cards[id]!, tab.ctx.cards);
    const run = playCode(tab, TAKE_NO_NOTICE);
    expect(cost(run.state, weak)).toBe(6 + 5);
    expect(cost(run.state, cheap)).toBe(2 + 5);
    expect(cost(enter(run.state, tab, "questCommit").state, weak)).toBe(6 + 5);
    expect(cost(enter(run.state, tab, "beginRound").state, weak)).toBe(6);
  });
});

describe("Barliman Butterbur (141007:A:1)", () => {
  // "If each hero you control has the Hobbit trait, damage from undefended attacks against you may be assigned to Barliman Butterbur."
  function undefended(effects: readonly Effect[], heroes: readonly string[]): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: heroes.map((code) => ({ code, seat: 0 })), allies: [{ code: BARLIMAN, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }] });
    let run = combat(tab.state, tab);
    run = passWhile(run, tab, (run) => run.state.window?.kind === "frameAction", 6);
    expect(run.state.window?.kind).toBe("defense");
    return { tab, run };
  }

  lineSpec("141007:A:1", "takes an undefended attack's damage while each of your heroes is a Hobbit", (effects) => {
    const { tab, run } = undefended(effects, [SAM, MERRY]);
    const barliman = idsOf(tab, BARLIMAN);
    const after = sendUnledgered(run, { type: "Undefended", heroId: barliman }, tab.ctx);
    expect(after.state.cards[barliman]?.damage).toBe(2);
    expect(after.state.cards[idsOf(tab, SAM)]?.damage).toBe(0);
  });

  it("141007:A:1 cannot take it while one of your heroes is not a Hobbit", () => {
    const { tab, run } = undefended(EFFECTS, [SAM, ARAGORN]);
    expect(refusal(run.state, { type: "Undefended", heroId: idsOf(tab, BARLIMAN) }, tab.ctx)).not.toBeNull();
    expect(refusal(run.state, { type: "Undefended", heroId: idsOf(tab, SAM) }, tab.ctx)).toBeNull();
  });
});
