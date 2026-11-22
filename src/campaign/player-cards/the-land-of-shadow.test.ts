// Rules: rr.engaged, rr.engagement-check, rr.optional-engagement, rr.limits, rr.response, rr.then, rr.triggered-ability, rr.enters-play,
// rr.restricted, rr.staging, rr.cost, rr.modifiers, rr.lasting-effects (data/rules/entries.json).
// The Land of Shadow heroes and allies, each printed line tested from the words on the card (lineSpec, test/harness/line-spec.ts): Faramir
// 144002:A:2, Damrod 144003:A:1, Anborn 144004:A:1, Mablung 144005:A:1, Skinbark 144006:A:1 and A:2. Damrod's line is the text of
// data/cards/LoS.json (data/printed/the-two-towers.json holds no entry for him), so every intent goes through sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { modifiedStat } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withMode, type ScenarioState } from "../../rules/core/state.ts";
import { settle } from "../../rules/engine/machine.ts";
import { playCost } from "../../rules/player/attach.ts";
import { payFor, refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attacking, choices, playerTable, sendUnledgered, triggers } from "../../../test/harness/player-table.ts";

const FARAMIR = "144002";
const DAMROD = "144003";
const ANBORN = "144004";
const MABLUNG = "144005";
const SKINBARK = "144006";
const AMBUSH = "144009";
// Core Aragorn (Leadership), Gimli (Tactics), Denethor (Lore).
const ARAGORN = "01001";
const GIMLI = "01004";
const DENETHOR = "01010";
// Round Shield: "Attach to a character. Restricted."
const SHIELD = "19118";
// Green Hill Country: a location of scenario 1's encounter deck.
const GREEN_HILL = "141036";
const WEAK = "weak";
const ORC = "orc";
const NEAR = "near";
const PAL = "pal";
const ALLY = "ally";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([FARAMIR, DAMROD, ANBORN, MABLUNG, SKINBARK, AMBUSH, ARAGORN, GIMLI, DENETHOR, SHIELD, GREEN_HILL]))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 0, engagementCost: 30, attack: 1, defense: 3, health: 9 }));
  cards.set(ORC, definePrinted({ code: ORC, name: "Orc", type: "enemy", traits: ["Orc"], threat: 0, engagementCost: 30, attack: 1, defense: 3, health: 9 }));
  // An enemy the engagement check engages (engagement cost 5, the threat is 8).
  cards.set(NEAR, definePrinted({ code: NEAR, name: "Near", type: "enemy", threat: 0, engagementCost: 5, attack: 1, defense: 1, health: 9 }));
  base = { ...starter, cards };
});

function engagementCost(state: ScenarioState, tab: Table, id: string): number {
  const card = state.cards[id];
  if (!card) throw new Error(`no card ${id}`);
  return modifiedStat(state, card, "engagementCost", tab.ctx.cards);
}

function play(tab: Table, cardId: string, run: Run = begin(tab.state)): Run {
  return sendUnledgered(run, { type: "PlayCard", cardId, payments: payFor(run.state, tab.ctx, cardId) }, tab.ctx);
}

// The round ends and the next begins; the engine runs to its next window.
function nextRound(state: ScenarioState, tab: Table): ScenarioState {
  return settle({ ...withMode(state, "beginRound"), window: null }, tab.ctx, []);
}

describe("Faramir (144002:A:2)", () => {
  // The encounter phase opens on the optional engagement; two exhausted allies of the first player, an exhausted ally of the other player.
  function faramirTable(effects: readonly Effect[], staging: readonly string[]): { tab: Table; mine: string; spare: string; theirs: string } {
    const scene = table(effects, { seats: 2, start: "encounter", heroes: [{ code: FARAMIR, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 0 }, { code: ALLY, seat: 0 }, { code: ALLY, seat: 1 }], staging });
    const [mine, spare, theirs] = scene.ids[ALLY] ?? [];
    let state = scene.state;
    for (const id of [mine, spare, theirs]) state = updateCard(state, id ?? "", { exhausted: true });
    state = updateCard(state, idsOf(scene, FARAMIR), { exhausted: true });
    return { tab: { ...scene, state }, mine: mine ?? "", spare: spare ?? "", theirs: theirs ?? "" };
  }

  // "Response: After you engage an enemy, ready an ally you control.": the first player optionally engages; an exhausted ally he controls
  // is readied. Faramir (a hero) and the other player's ally are no choice.
  lineSpec("144002:A:2", "Faramir: after you engage an enemy, ready an ally you control", (effects) => {
    const { tab, mine, spare, theirs } = faramirTable(effects, [WEAK]);
    let run = sendUnledgered(begin(tab.state), { type: "Engage", enemyId: idsOf(tab, WEAK) }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("144002:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, FARAMIR), effectId: "144002:response:1" }, tab.ctx);
    if (run.state.window?.kind === "choose") {
      expect(choices(run.state, tab).sort()).toEqual([mine, spare].sort());
      run = sendUnledgered(run, { type: "Choose", optionId: mine }, tab.ctx);
    }
    expect(run.state.cards[mine]?.exhausted).toBe(false);
    expect(run.state.cards[theirs]?.exhausted).toBe(true);
    expect(run.state.cards[idsOf(tab, FARAMIR)]?.exhausted).toBe(true);
  });

  // "(Limit once per phase.)": the engagement check then engages a second enemy in the same phase (rr.engaged: the player has engaged it
  // too), and the Response is not offered again.
  lineSpec("144002:A:2", "Faramir: limit once per phase", (effects) => {
    const { tab, mine } = faramirTable(effects, [WEAK, NEAR]);
    let run = sendUnledgered(begin(tab.state), { type: "Engage", enemyId: idsOf(tab, WEAK) }, tab.ctx);
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, FARAMIR), effectId: "144002:response:1" }, tab.ctx);
    if (run.state.window?.kind === "choose") run = sendUnledgered(run, { type: "Choose", optionId: mine }, tab.ctx);
    expect(run.state.cards[mine]?.exhausted).toBe(false);
    for (let guard = 0; guard < 10 && run.state.cards[idsOf(tab, NEAR)]?.zone !== "engaged"; guard += 1) {
      const intent = run.state.window?.kind === "optionalEngage" ? ({ type: "DeclineEngage" } as const) : ({ type: "Pass" } as const);
      run = sendUnledgered(run, intent, tab.ctx);
    }
    expect(run.state.cards[idsOf(tab, NEAR)]?.zone).toBe("engaged");
    expect(triggers(run.state, tab)).not.toContain("144002:response:1");
  });

  // "After you engage": the first player declines and the other player engages the enemy: no Response for Faramir's player.
  it("144002:A:2 Faramir: not offered when another player engages an enemy", () => {
    const { tab } = faramirTable(EFFECTS, [WEAK]);
    let run = sendUnledgered(begin(tab.state), { type: "DeclineEngage" }, tab.ctx);
    expect(run.state.activeSeat).toBe(1);
    run = sendUnledgered(run, { type: "Engage", enemyId: idsOf(tab, WEAK) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, WEAK)]?.zone).toBe("engaged");
    expect(triggers(run.state, tab)).not.toContain("144002:response:1");
  });

  // With no exhausted ally to ready the Response would change nothing, so it is not offered (rr.triggered-ability).
  it("144002:A:2 Faramir: not offered when no ally you control is exhausted", () => {
    const tab = table(EFFECTS, { start: "encounter", heroes: [{ code: FARAMIR, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], staging: [WEAK] });
    const run = sendUnledgered(begin(tab.state), { type: "Engage", enemyId: idsOf(tab, WEAK) }, tab.ctx);
    expect(triggers(run.state, tab)).not.toContain("144002:response:1");
  });
});

describe("Damrod (144003:A:1)", () => {
  // "Reduce the cost of the first Trap card you play each round by 1 (to a minimum of 0).": Ambush (a Trap, cost 2) costs 1, the second
  // Ambush that round its printed 2, and the first one of the next round 1 again. Mablung (not a Trap) keeps his cost.
  lineSpec("144003:A:1", "Damrod: the first Trap card you play each round costs 1 less", (effects) => {
    const tab = table(effects, { heroes: [{ code: DAMROD, seat: 0 }, { code: DENETHOR, seat: 0 }], hand: [{ code: AMBUSH, seat: 0 }, { code: AMBUSH, seat: 0 }, { code: AMBUSH, seat: 0 }, { code: MABLUNG, seat: 0 }] });
    const [first, second, third] = tab.ids[AMBUSH] ?? [];
    expect(playCost(tab.state, idsOf(tab, MABLUNG), 0, tab.ctx)).toBe(2);
    expect(playCost(tab.state, first ?? "", 0, tab.ctx)).toBe(1);
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: first ?? "", hostId: "staging", payments: [{ heroId: idsOf(tab, DAMROD), amount: 1 }] }, tab.ctx);
    expect(run.state.cards[first ?? ""]?.zone).toBe("staging");
    expect(playCost(run.state, second ?? "", 0, tab.ctx)).toBe(2);
    const later = settle({ ...withMode(nextRound(run.state, tab), "planning"), window: null }, tab.ctx, []);
    expect(playCost(later, third ?? "", 0, tab.ctx)).toBe(1);
  });
});

describe("Anborn (144004:A:1)", () => {
  // The quest phase: Denethor commits, the player passes and the staging step reveals the top card of the encounter deck.
  function staged(effects: readonly Effect[], revealed: string): { tab: Table; run: Run } {
    const tab = table(effects, { start: "quest", heroes: [{ code: DENETHOR, seat: 0 }], allies: [{ code: ANBORN, seat: 0 }], deck: [revealed] });
    const run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, DENETHOR)] }, tab.ctx);
    // The player is done committing: the staging step begins.
    return { tab, run: sendUnledgered(run, { type: "Pass" }, tab.ctx) };
  }

  // "Response: After an enemy is added to the staging area, exhaust Anborn to give that enemy +5 engagement cost until the end of the round.
  // Then, deal 1 damage to that enemy.": the revealed enemy gets 30 + 5 and 1 damage, Anborn is exhausted; the next round its cost is 30.
  lineSpec("144004:A:1", "Anborn: after an enemy is added to the staging area, exhaust him to give it +5 engagement cost, then 1 damage", (effects) => {
    const { tab, run: revealed } = staged(effects, WEAK);
    const weak = idsOf(tab, WEAK);
    expect(revealed.state.cards[weak]?.zone).toBe("staging");
    expect(triggers(revealed.state, tab)).toContain("144004:response:1");
    const run = sendUnledgered(revealed, { type: "Trigger", cardId: idsOf(tab, ANBORN), effectId: "144004:response:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, ANBORN)]?.exhausted).toBe(true);
    expect(engagementCost(run.state, tab, weak)).toBe(35);
    expect(run.state.cards[weak]?.damage).toBe(1);
    expect(engagementCost(nextRound(run.state, tab), tab, weak)).toBe(30);
  });

  // A location added to the staging area is not an enemy: no Response.
  it("144004:A:1 Anborn: not offered after a location is added to the staging area", () => {
    const { tab, run } = staged(EFFECTS, GREEN_HILL);
    expect(run.state.cards[idsOf(tab, GREEN_HILL)]?.zone).toBe("staging");
    expect(triggers(run.state, tab)).not.toContain("144004:response:1");
  });
});

describe("Mablung (144005:A:1)", () => {
  // Mablung is played from the hand; an enemy is in the staging area and one is engaged with the player.
  function entered(effects: readonly Effect[]): { tab: Table; run: Run; staged: string; engaged: string } {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], hand: [{ code: MABLUNG, seat: 0 }], staging: [WEAK], engaged: [{ code: WEAK, seat: 0 }] });
    const [staged, engaged] = tab.ids[WEAK] ?? [];
    let run = play(tab, idsOf(tab, MABLUNG));
    expect(triggers(run.state, tab)).toContain("144005:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, MABLUNG), effectId: "144005:response:1" }, tab.ctx);
    // "choose an enemy": the enemy in the staging area and the engaged one.
    expect(choices(run.state, tab).sort()).toEqual([staged ?? "", engaged ?? ""].sort());
    return { tab, run, staged: staged ?? "", engaged: engaged ?? "" };
  }

  // "Response: After Mablung enters play, choose an enemy to get +5 engagement cost until the end of the round. Then, you may engage that
  // enemy, or return it to the staging area.": the staging area's enemy gets +5 and the player engages it.
  lineSpec("144005:A:1", "Mablung: the chosen enemy gets +5 engagement cost until the end of the round, then the player may engage it", (effects) => {
    const { tab, run: chosen, staged } = entered(effects);
    let run = sendUnledgered(chosen, { type: "Choose", optionId: staged }, tab.ctx);
    expect(engagementCost(run.state, tab, staged)).toBe(35);
    expect(choices(run.state, tab)).toContain("engage");
    run = sendUnledgered(run, { type: "Choose", optionId: "engage" }, tab.ctx);
    expect(run.state.cards[staged]?.zone).toBe("engaged");
    expect(engagementCost(nextRound(run.state, tab), tab, staged)).toBe(30);
  });

  // The engaged enemy is chosen and returned to the staging area.
  lineSpec("144005:A:1", "Mablung: or the player returns the chosen enemy to the staging area", (effects) => {
    const { tab, run: chosen, engaged } = entered(effects);
    let run = sendUnledgered(chosen, { type: "Choose", optionId: engaged }, tab.ctx);
    expect(engagementCost(run.state, tab, engaged)).toBe(35);
    expect(choices(run.state, tab)).toContain("return");
    run = sendUnledgered(run, { type: "Choose", optionId: "return" }, tab.ctx);
    expect(run.state.cards[engaged]?.zone).toBe("staging");
  });

  // "you may": the player can also leave the enemy where it is.
  it("144005:A:1 Mablung: the player may do neither", () => {
    const { tab, run: chosen, engaged } = entered(EFFECTS);
    const run = sendUnledgered(sendUnledgered(chosen, { type: "Choose", optionId: engaged }, tab.ctx), { type: "Choose", optionId: "neither" }, tab.ctx);
    expect(run.state.cards[engaged]?.zone).toBe("engaged");
    expect(engagementCost(run.state, tab, engaged)).toBe(35);
  });
});

describe("Skinbark (144006:A:1, A:2)", () => {
  // "Cannot have restricted attachments. Enters play exhausted."
  lineSpec("144006:A:1", "Skinbark: enters play exhausted", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], hand: [{ code: SKINBARK, seat: 0 }] });
    const run = play(tab, idsOf(tab, SKINBARK));
    expect(run.state.cards[idsOf(tab, SKINBARK)]).toMatchObject({ zone: "play", exhausted: true });
  });

  lineSpec("144006:A:1", "Skinbark: a restricted attachment cannot go on him; it can on another character", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], allies: [{ code: SKINBARK, seat: 0 }], hand: [{ code: SHIELD, seat: 0 }] });
    const shield = idsOf(tab, SHIELD);
    const pay = payFor(tab.state, tab.ctx, shield);
    expect(refusal(tab.state, { type: "PlayCard", cardId: shield, hostId: idsOf(tab, SKINBARK), payments: pay }, tab.ctx)).not.toBeNull();
    expect(refusal(tab.state, { type: "PlayCard", cardId: shield, hostId: idsOf(tab, GIMLI), payments: pay }, tab.ctx)).toBeNull();
  });

  // The damage each enemy takes from one attack declared against it.
  function strike(effects: readonly Effect[], enemy: string, alone: boolean): number {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], allies: [{ code: SKINBARK, seat: 0 }], engaged: [{ code: enemy, seat: 0 }] });
    const attackers = alone ? [idsOf(tab, SKINBARK)] : [idsOf(tab, SKINBARK), idsOf(tab, GIMLI)];
    const run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, enemy), attackerIds: attackers }, tab.ctx);
    return run.state.cards[idsOf(tab, enemy)]?.damage ?? 0;
  }

  // "While Skinbark is attacking alone against an Orc enemy, that enemy does not count its Defense.": Skinbark (Attack 4) alone against the
  // Orc (Defense 3) deals 4; with Gimli (Attack 2) beside him the Defense counts, 6 - 3; alone against an enemy that is not an Orc, 4 - 3.
  lineSpec("144006:A:2", "Skinbark: attacking alone against an Orc enemy, its Defense does not count", (effects) => {
    expect(strike(effects, ORC, true)).toBe(4);
    expect(strike(effects, ORC, false)).toBe(4 + 2 - 3);
    expect(strike(effects, WEAK, true)).toBe(4 - 3);
  });
});
