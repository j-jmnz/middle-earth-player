// Rules: emce.side-quests, emce.side-quests-in-play, rr.first-player, rr.attacks-outside-the-combat-phase, emce.boon-allies, emce.campaign-log (data/rules/entries.json); ledger lines 12188:A:1, 19067:A:2, 19075:A:1, 19076:A:1, 19083:B:1.
// Fire in the Night's choices and prompts on the live sheet: each opens a real window (the engine's own frame, not a hand-made instruction), and the sheet says the number, the side of the table, the player and what declining does (Choice tray).
// Two-handed the sentence leads with the player and the sheet adds no "Player N chooses."; solo it has no lead.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { legalIntents } from "../../rules/engine/legal.ts";
import { reduce } from "../../rules/engine/reduce.ts";
import { settle } from "../../rules/engine/machine.ts";
import { modifiedStat } from "../../rules/core/keywords.ts";
import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { spawn } from "../../rules/core/zones.ts";
import { pushCardEffects } from "../../rules/interpret/effect-frames.ts";
import { currentSideQuest } from "../../rules/families/wilderland/night-quest.ts";
import { expectOk } from "../../rules/core/test-fixture.ts";
import { CODES, idOf, loadNightWorld, nightTable, send, start, type NightWorld } from "../../../test/scenarios/fire-in-the-night/scene.ts";
import { momentOf } from "../store/outcome.ts";

import { windowSheet } from "./bar-sheets.ts";
import { sheetFor, triggerOptions } from "./sheets.ts";

let world: NightWorld;
beforeAll(async () => {
  world = await loadNightWorld();
}, 120_000);

type Table = ReturnType<typeof nightTable>;
const nameOf = (code: string): string => world.cards.get(code)?.name ?? code;
const names = (state: ScenarioState) => ({ card: (id: string) => nameOf(state.cards[id]?.code ?? id), line: () => null });

// The record's frame is pushed and settled until the engine opens its window: the live state the sheet is built from.
function opened(t: Table, state: ScenarioState, code: string, timing: Effect["timing"], source: string, frame: "whenRevealed" | "forced" = "forced"): ScenarioState {
  const effects = t.ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === timing).map((effect) => ({ ...effect, condition: undefined }) as Effect);
  const pushed = pushCardEffects(state, frame, source, state.firstPlayer, false, effects, t.ctx, []);
  return settle({ ...pushed, window: null, mode: "stopped" }, t.ctx, []);
}

const sheetOf = (t: Table, state: ScenarioState) => {
  const sheet = sheetFor(state, t.ctx, legalIntents(state, t.ctx), names(state));
  if (!sheet || (sheet.kind !== "pick" && sheet.kind !== "trigger")) throw new Error(`no pick or trigger sheet: ${JSON.stringify(state.window)}`);
  return sheet;
};
const labels = (sheet: ReturnType<typeof sheetOf>) => sheet.options.map((option) => option.label);
// The caution that arms Leave undefended: only the sheet that sends the intent itself has one.
const leaveCaution = (sheet: ReturnType<typeof sheetOf>): string | undefined => (sheet.kind === "pick" && sheet.alternative && "caution" in sheet.alternative ? sheet.alternative.caution : undefined);
const take = (t: Table, state: ScenarioState, optionId: string): ScenarioState => send({ state, steps: [] }, { type: "Choose", optionId }, t.ctx).state;
// The planning phase ends: every seat passes its planning window and the stage's Forced effect reveals the top side quest and attacks Hrogar's Hill.
const planningEnds = (t: Table) => {
  let run = start(t.state);
  for (let pass = 0; pass < 12 && run.state.phase === "Planning" && run.state.window?.kind === "pass"; pass += 1) run = send(run, { type: "Pass" }, t.ctx);
  return run;
};
const hill = (state: ScenarioState) => state.cards[state.questStage ?? ""]!;
// The Hill attack left undefended, then the combat passes until the quest phase asks the first player which quest to make current.
const toQuestQuestion = (t: Table) => {
  let run = send(planningEnds(t), { type: "Undefended" } as never, t.ctx);
  for (let pass = 0; pass < 12 && run.state.window?.kind !== "choose"; pass += 1) run = send(run, { type: "Pass" }, t.ctx);
  return run;
};

describe("the first player's choice of the current quest (emce.side-quests-in-play)", () => {
  it("is asked at the beginning of the quest phase with the side quests in the staging area, solo with no lead and two-handed leading Player 1", () => {
    for (const [seats, lead] of [[1, "Make the side quest"], [2, "Player 1: make the side quest"]] as const) {
      const t = nightTable(world, { seats, phase: "Planning", sideQuests: [CODES.holdTheDoor, CODES.faceTheDragon], staging: [CODES.dagnir] });
      const run = toQuestQuestion(t);
      expect(run.state.phase).toBe("Quest");
      const sheet = sheetOf(t, run.state);
      expect(sheet.note).toBe(`${lead} in the staging area the current quest until the end of the phase, or keep Hrogar's Hill? Progress goes on the active location first, then on the current quest instead of Hrogar's Hill. Progress beyond its quest points is discarded.`);
      expect(sheet.note).not.toContain("chooses");
      expect(labels(sheet)).toEqual(["Keep Hrogar's Hill as the current quest", "Make Hold the Door the current quest (0 of 10 progress)"]);
    }
  });

  it("names how many side quests it chooses among, and a decline keeps Hrogar's Hill as the quest", () => {
    const t = nightTable(world, { seats: 2, phase: "Planning", staging: [CODES.dagnir, CODES.holdTheDoor, CODES.faceTheDragon] });
    let run = toQuestQuestion(t);
    expect(run.state.window?.kind).toBe("choose");
    const sheet = sheetOf(t, run.state);
    expect(sheet.note).toMatch(/^Player 1: make 1 of the 2 side quests in the staging area the current quest until the end of the phase, or keep Hrogar's Hill\?/);
    expect(labels(sheet)).toEqual(["Keep Hrogar's Hill as the current quest", "Make Hold the Door the current quest (0 of 10 progress)", "Make Face the Dragon the current quest (0 of 10 progress)"]);
    const kept = take(t, run.state, "main");
    expect(currentSideQuest(kept)).toBeNull();
    run = { state: take(t, run.state, idOf(run.state, CODES.faceTheDragon)), steps: [] };
    expect(currentSideQuest(run.state)).toBe(idOf(run.state, CODES.faceTheDragon));
  });

  it("a row shows the side quest's progress, and Draw Her Fire's says Dagnir then attacks the first player (19066:A:2)", () => {
    const t = nightTable(world, { seats: 1, phase: "Planning", sideQuests: [CODES.holdTheDoor], staging: [CODES.dagnir, CODES.drawHerFire] });
    const sheet = sheetOf(t, toQuestQuestion(t).state);
    expect(labels(sheet)).toContain("Make Draw Her Fire the current quest (0 of 5 progress; Dagnir then attacks the first player)");
    expect(labels(sheet)).toContain("Make Hold the Door the current quest (0 of 10 progress)");
  });

  it("the commit sheet names the side quest that is the current quest", () => {
    const t = nightTable(world, { seats: 1, phase: "Planning", sideQuests: [CODES.holdTheDoor], staging: [CODES.dagnir, CODES.faceTheDragon] });
    const asked = toQuestQuestion(t).state;
    const chosen = take(t, asked, idOf(asked, CODES.faceTheDragon));
    expect(currentSideQuest(chosen)).toBe(idOf(chosen, CODES.faceTheDragon));
    const sheet = windowSheet(chosen, t.ctx, legalIntents(chosen, t.ctx), names(chosen));
    expect(sheet.title).toBe("Commit to Face the Dragon (current quest until the end of the phase)");
  });

  it("is the first player's question: Player 2 is asked when the first player token has moved", () => {
    const base = nightTable(world, { seats: 2, phase: "Planning", staging: [CODES.dagnir, CODES.holdTheDoor] });
    const t = { ...base, state: { ...base.state, firstPlayer: 1, activeSeat: 1 } };
    const run = toQuestQuestion(t);
    expect(run.state.window).toMatchObject({ kind: "choose", seat: 1 });
    expect(sheetOf(t, run.state).note).toMatch(/^Player 2: make the side quest/);
  });
});

describe("the side quest deck's reveal and the attack on Hrogar's Hill (19083:B:1, emce.side-quests)", () => {
  it("the banner says the side quest comes from its own deck and that nothing cancels its When Revealed effects", () => {
    const t = nightTable(world, { phase: "Planning", sideQuests: [CODES.holdTheDoor], staging: [CODES.dagnir] });
    let run = start(t.state);
    for (let pass = 0; pass < 6 && run.state.window?.kind === "pass"; pass += 1) {
      const before = run.state;
      const result = expectOk(reduce(before, { type: "Pass" }, t.ctx));
      run = { state: result.state, steps: [...run.steps, ...result.steps] };
      if (result.steps.some((step) => step.kind === "reveal")) {
        const card = (id: string) => nameOf(result.state.cards[id]?.code ?? id);
        const plain = JSON.stringify(momentOf(before, result.state, result.steps, { card } as never));
        expect(plain).toContain("Revealed Hold the Door from the side quest deck: it is added to the staging area.");
        expect(plain).toContain("End of the planning phase");
        expect(plain).not.toContain("cannot be canceled");
        // A side quest with a When Revealed effect says nothing cancels it.
        expect(JSON.stringify(momentOf(before, result.state, result.steps, { card, revealed: () => "When Revealed: ..." } as never))).toContain("Its When Revealed effect cannot be canceled by player cards.");
        return;
      }
    }
    throw new Error("no side quest was revealed");
  });

  it("the defense sheet says the attack is on Hrogar's Hill, that no shadow card is dealt, and what a defender and leaving it undefended do; two-handed it leads Player 1", () => {
    for (const [seats, lead] of [[1, ""], [2, "Player 1: "]] as const) {
      const t = nightTable(world, { seats, phase: "Planning", sideQuests: [CODES.holdTheDoor], staging: [CODES.dagnir] });
      const run = planningEnds(t);
      expect(run.state.window).toMatchObject({ kind: "defense", seat: 0 });
      const sheet = sheetOf(t, run.state);
      expect(sheet.note).toBe(`${lead}No shadow card is dealt. A defender takes the attack minus its Defense; damage beyond its hit points goes to Hrogar's Hill. Leave it undefended and all 7 damage is dealt to Hrogar's Hill. Hrogar's Hill holds 0 of 50 damage.`);
      expect(sheet.kind === "pick" && sheet.alternative?.label).toBe("Leave undefended");
      expect(leaveCaution(sheet)).toBeUndefined();
    }
  });

  it("Leave undefended is armed when the damage would fill Hrogar's Hill, and says nothing alarming otherwise", () => {
    const t = nightTable(world, { phase: "Planning", sideQuests: [CODES.holdTheDoor], staging: [CODES.dagnir] });
    const full = { ...t, state: updateCard(t.state, t.state.questStage ?? "", { damage: 44 }) };
    const run = planningEnds(full);
    const sheet = sheetOf(full, run.state);
    expect(leaveCaution(sheet)).toBe("Tap again: Hrogar's Hill holds 50 damage and the game is lost");
    const left = send(run, { type: "Undefended" } as never, full.ctx);
    expect(left.state.lost).toBe(true);
    expect(hill(left.state).damage).toBe(51);
  });

  it("a defender whose hit points the damage exceeds shows what goes on Hrogar's Hill, and the row is armed when that fills the Hill", () => {
    const t = nightTable(world, { phase: "Planning", sideQuests: [CODES.holdTheDoor], staging: [CODES.dagnir] });
    const hurt = { ...t, state: updateCard(updateCard(t.state, t.hero, { damage: modifiedStat(t.state, t.state.cards[t.hero]!, "hitPoints", world.cards) - 1 }), t.state.questStage ?? "", { damage: 49 }) };
    const sheet = sheetOf(hurt, planningEnds(hurt).state);
    const row = sheet.options.find((option) => option.id === hurt.hero);
    expect(row?.label).toMatch(/ · \+\d+ to Hrogar's Hill/);
    expect(row && "caution" in row ? row.caution : undefined).toBe("Tap again: Hrogar's Hill holds 50 damage and the game is lost");
    // A defender that holds the damage has no such suffix.
    const fresh = sheetOf(t, planningEnds(t).state);
    expect(fresh.options.every((option) => !option.label.includes("to Hrogar's Hill"))).toBe(true);
  });

  it("The Dragon's Fury (19081:A:1) is a different attack: it has its shadow card, and only the damage left undefended goes to Hrogar's Hill", () => {
    for (const [seats, lead] of [[1, ""], [2, "Player 1: "]] as const) {
      const t = nightTable(world, { seats, staging: [CODES.dagnir, CODES.theDragonSFury], deck: ["f0", "f3"] });
      const state = opened(t, t.state, CODES.theDragonSFury, "whenRevealed", idOf(t.state, CODES.theDragonSFury), "whenRevealed");
      expect(state.window).toMatchObject({ kind: "defense", seat: 0 });
      const sheet = sheetOf(t, state);
      expect(sheet.note).toBe(`${lead}Choose a defender, or leave it undefended. Left undefended, its 7 damage (before its shadow card) is dealt to Hrogar's Hill, not to a character. Hrogar's Hill holds 0 of 50 damage.`);
      expect(sheet.note).not.toContain("No shadow card");
    }
  });

  it("with no character able to defend the sheet says so, and an attack already undefended keeps the engine's own words", () => {
    const t = nightTable(world, { phase: "Planning", sideQuests: [CODES.holdTheDoor], staging: [CODES.dagnir] });
    const exhausted = { ...t, state: updateCard(updateCard(t.state, t.hero, { exhausted: true }), t.hero2, { exhausted: true }) };
    const run = planningEnds(exhausted);
    expect(sheetOf(exhausted, run.state).note).toContain("No character can defend: all 7 damage is dealt to Hrogar's Hill.");
  });
});

describe("a defeated side quest's Response (emce.side-quests-in-play)", () => {
  it("is offered to the first player, who may use it or pass it; the sheet says the quest deck does not advance and that passing gives it up", () => {
    for (const [seats, lead] of [[1, ""], [2, "Player 1: "]] as const) {
      const t = nightTable(world, { seats, staging: [CODES.dagnir, { code: CODES.holdTheDoor, progress: 8 }], current: CODES.holdTheDoor, threat: [30, 30] });
      let run = send(start(t.state), { type: "Commit", cardIds: [t.hero, t.hero2] }, t.ctx);
      for (let pass = 0; pass < 4 && run.state.window?.kind !== "response"; pass += 1) run = send(run, { type: "Pass" }, t.ctx);
      const sheet = sheetOf(t, run.state);
      expect(sheet.kind).toBe("trigger");
      expect(sheet.note).toBe(`${lead}Hold the Door is defeated and goes to the victory display; Hrogar's Hill does not advance. Use its Response, or pass to give it up.`);
      expect(sheet.title).toBe("Hold the Door");
      expect(sheet.kind === "trigger" && sheet.pass).toBe("Pass");
      expect(sheet.kind === "trigger" && sheet.options.map((option) => option.timing)).toEqual(["Response"]);
      // Passing it leaves the threat as it was.
      const passed = send(run, { type: "Pass" }, t.ctx);
      expect(passed.state.seats[0]?.threat).toBe(30);
    }
  });

  it("Fortify the Defense asks each player in turn to draw or gain resources, naming the cards and the player", () => {
    const t = nightTable(world, { seats: 2, staging: [CODES.dagnir], victory: [CODES.fortifyTheDefense], deckOf: ["f0", "f0", "f0", "f0"] });
    const state = opened(t, t.state, CODES.fortifyTheDefense, "response", idOf(t.state, CODES.fortifyTheDefense));
    const sheet = sheetOf(t, state);
    expect(sheet.note).toBe("Player 1: Fortify the Defense is defeated. Draw 3 cards, or each hero you control gains 1 resource?");
    expect(labels(sheet)).toEqual(["Draw 3 cards", "Each hero you control gains 1 resource"]);
    const next = sheetOf(t, take(t, state, "draw"));
    expect(next.note).toMatch(/^Player 2: Fortify the Defense is defeated/);
  });
});

describe("The Dragon's Thrall (19075:A:1) and Orc of the Flame (19076:A:1)", () => {
  it("the Thrall's player chooses between 3 damage to the Hill and an immediate attack", () => {
    for (const [seats, lead] of [[1, ""], [2, "Player 1: "]] as const) {
      const t = nightTable(world, { seats, staging: [CODES.dagnir] });
      const thrall = spawn(t.state, CODES.theDragonSThrall, { zone: "engaged", seat: 0 });
      const state = opened(t, thrall.state, CODES.theDragonSThrall, "forced", thrall.id);
      const sheet = sheetOf(t, state);
      expect(sheet.note).toBe(`${lead}The Dragon's Thrall has engaged you. Deal 3 damage to Hrogar's Hill, or it makes an immediate attack against you (Attack 3)?`);
      expect(labels(sheet)).toEqual(["Deal 3 damage to Hrogar's Hill", "The Dragon's Thrall makes an immediate attack against you"]);
    }
  });

  it("Orc of the Flame lets the first player choose 2 damage to a hero or 3 damage to the Hill", () => {
    const t = nightTable(world, { seats: 2, staging: [CODES.dagnir, CODES.orcOfTheFlame] });
    const state = opened(t, t.state, CODES.orcOfTheFlame, "whenRevealed", idOf(t.state, CODES.orcOfTheFlame), "whenRevealed");
    const sheet = sheetOf(t, state);
    expect(sheet.note).toBe("Player 1, Orc of the Flame: deal 2 damage to a hero you control, or 3 damage to Hrogar's Hill?");
    expect(labels(sheet)).toEqual(["Deal 2 damage to a hero you control", "Deal 3 damage to Hrogar's Hill"]);
    expect(hill(take(t, state, "hill")).damage).toBe(3);
  });
});

describe("Beldis's Action and the boxes beside her (12188:A:1, emce.campaign-log)", () => {
  const withBeldis = (seats: 1 | 2, used?: readonly number[]) => {
    const t = nightTable(world, { seats, play: [CODES.beldis], staging: [CODES.dagnir] });
    const facts = used ? { prisoner: null, usedOnce: [], counters: {}, beldisUses: used } : undefined;
    const hurt = updateCard(t.state, t.hero, { damage: 5, resources: 2 });
    return { ...t, state: { ...hurt, ...(facts ? { campaignFacts: facts } : {}) } };
  };
  const rowOf = (t: Table) => triggerOptions(t.state, t.ctx, legalIntents(t.state, t.ctx), names(t.state)).find((option) => option.effectId === "12188:action:1");

  it("states the boxes the acting player has left, solo with no lead and two-handed leading their number", () => {
    expect(rowOf(withBeldis(1))?.text).toBe("4 of 4 boxes beside Beldis are left. Using her marks one in the campaign log if you win.");
    const pair = withBeldis(2);
    expect(rowOf(pair)?.text).toBe("Player 1: 4 of 4 boxes beside Beldis are left. Using her marks one in the campaign log if you win.");
    expect(rowOf(withBeldis(2, [3, 0]))?.text).toBe("Player 1: 1 of 4 boxes beside Beldis is left. Using her marks one in the campaign log if you win.");
  });

  it("marks the next box when used, heals 3 damage, and the row then counts one fewer; with all four marked the Action is not offered", () => {
    const t = withBeldis(1, [2]);
    const beldis = idOf(t.state, CODES.beldis);
    const used = send({ state: t.state, steps: [] }, { type: "Trigger", cardId: beldis, effectId: "12188:action:1", payments: [{ heroId: t.hero, amount: 1 }] }, t.ctx);
    const picked = used.state.window?.kind === "choose" ? take(t, used.state, used.state.window.options[0] ?? "") : used.state;
    expect(picked.campaignFacts?.beldisUses).toEqual([3]);
    expect(rowOf({ ...t, state: picked })?.text).toContain("1 of 4 boxes beside Beldis is left.");
    expect(rowOf(withBeldis(1, [4]))).toBeUndefined();
  });
});
