// Rules: emce.gundabad-quest-deck, emce.bypassing, emce.setup-mount-gundabad, emce.caves-deck-gundabad, rr.quest-advancement, rr.quest-cards-quest-deck, rr.discard-pile-and-victory-display, rr.search, rr.first-player, rr.setup (data/rules/entries.json); ledger lines 19134:A:1, 19134:B:1, 19135:A:1 to 19142:B:3.
// The quest deck of Mount Gundabad on the scenario's scene: the Setup, the stage 2s revealed side A and flipped at the beginning of the quest phase, a stage defeated or bypassed, what each stage 2B says, and the win.
import { beforeAll, describe, expect, it } from "vitest";

import { flagged, type ScenarioState } from "../../../rules/core/state.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { playReason } from "../../../rules/player/planning.ts";
import { phasePlaysBarred } from "../../../rules/families/wilderland/rounds.ts";
import { CODES, STAGE_TWOS, codesIn, finish, gundabad, gundabadTable, idOf, legalIntents, loadGundabadWorld, resolveRecords, send, start, type GundabadWorld } from "../../../../test/scenarios/mount-gundabad/scene.ts";

let world: GundabadWorld;
beforeAll(async () => {
  world = await loadGundabadWorld();
}, 120_000);

type Table = ReturnType<typeof gundabadTable>;
type Run = ReturnType<typeof start>;
const settled = (t: Table, state: ScenarioState = t.state): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, t.ctx, []);
const quest = (state: ScenarioState): string | undefined => state.cards[state.questStage ?? ""]?.code;
const face = (state: ScenarioState): string | undefined => state.cards[state.questStage ?? ""]?.face;
const deckCodes = (state: ScenarioState): (string | undefined)[] => state.questDeck.map((id) => state.cards[id]?.code);
const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
// The quest deck as a game of stage 1 holds it (every stage 2), and the deck behind a stage 2 that is current.
const ORDER = ["19137", "19142", "19139", "19140", "19138", "19141", "19135"] as const;
const DECK = ORDER.filter((code) => code !== "19135");
const behind = (code: (typeof ORDER)[number]) => ORDER.filter((other) => other !== code);
// The quest points each stage 2 prints (19142 prints none).
const POINTS = { "19135": 3, "19137": 3, "19138": 5, "19139": 7, "19140": 4, "19141": 6 } as const;

// Passes (or declines) each window until `stop` holds or a choice opens.
function advanceTo(t: Table, run: Run, stop: (state: ScenarioState) => boolean): Run {
  let current = run;
  for (let guard = 0; guard < 80 && !stop(current.state) && current.state.window?.kind !== "choose"; guard += 1) {
    const pass = legalIntents(current.state, t.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage" || intent.type === "DeclineTravel");
    if (!pass) break;
    current = send(current, pass as never, t.ctx);
  }
  return current;
}
// The Response the window offers is used.
const useResponse = (t: Table, run: Run): Run => {
  const trigger = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Trigger");
  if (!trigger) throw new Error(`no Response offered: ${JSON.stringify(legalIntents(run.state, t.ctx))}`);
  return send(run, trigger as never, t.ctx);
};
const answerWith = (t: Table, run: Run, optionId: string): Run => send(run, { type: "Choose", optionId }, t.ctx);
// The end of the combat phase with the stage in play: the run stops where the first player is asked about the bypass.
const endOfCombat = (layout: Parameters<typeof gundabadTable>[1]): { t: Table; run: Run } => {
  const t = gundabadTable(world, { phase: "Combat", stage: "19135", ...layout });
  return { t, run: advanceTo(t, start(t.state), (state) => state.phase === "Refresh") };
};

describe("19134 The Side Door", () => {
  it("19134:A:1 Setup: the stage 2s are shuffled into the quest deck with side A up, and the seed moves", () => {
    const t = gundabadTable(world, { phase: "Planning", questDeck: STAGE_TWOS });
    const run = resolveRecords(t.state, t.ctx, CODES.stage1, "setup", t.state.questStage ?? "");
    expect(new Set(deckCodes(run.state))).toEqual(new Set(STAGE_TWOS));
    expect(deckCodes(run.state)).not.toEqual(STAGE_TWOS);
    expect(run.state.questDeck.every((id) => run.state.cards[id]?.face === "A")).toBe(true);
    expect(run.state.seedCursor).toBeGreaterThan(t.state.seedCursor);
  });

  it("19134:A:1 Setup: Wormsbane, Broken side up, is attached to a hero the first player chooses", () => {
    const t = gundabadTable(world, { seats: 2, phase: "Planning" });
    const run = resolveRecords(t.state, t.ctx, CODES.stage1, "setup", t.state.questStage ?? "", (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""));
    const wormsbane = where(run.state, CODES.wormsbane);
    expect(wormsbane).toHaveLength(1);
    const host = wormsbane[0]?.host ? run.state.cards[wormsbane[0].host] : undefined;
    expect(host?.zone).toBe("heroes");
    expect(wormsbane[0]?.code).toBe("19143");
  });

  it("19134:A:1 Setup: the Caves deck is shuffled and a location is added to the staging area for each player but the first", () => {
    for (const seats of [1, 2] as const) {
      const t = gundabadTable(world, { seats, phase: "Planning", caves: [CODES.lostArmory, CODES.ancientTreasury], deck: ["f0", CODES.minesOfGundabad, "f0", CODES.narrowStair, "f0"] });
      const run = resolveRecords(t.state, t.ctx, CODES.stage1, "setup", t.state.questStage ?? "");
      expect(codesIn(run.state, "staging"), `${seats} seats`).toHaveLength(seats - 1);
      expect(codesIn(run.state, "cavesDeck")).toHaveLength(2);
    }
  });

  it("19134 the scenario sets Dagnir in the staging area, The First Forge aside and deals the Caves cards to the Caves deck (the piles)", () => {
    const pileOf = (code: string) => gundabad.cards.find((card) => card.code === code)?.pile;
    expect(pileOf(CODES.dagnir)).toBe("staging");
    expect(pileOf(CODES.theFirstForge)).toBe("setAside");
    expect(pileOf(CODES.wormsbane)).toBe("attachedChosen");
    for (const code of [CODES.dagnirSHoard, CODES.throatOfTheMountain, CODES.lostArmory, CODES.ancientTreasury, CODES.frightfulDen, CODES.lightlessGrotto, CODES.crumblingCavern, CODES.undergroundLake]) expect(pileOf(code), code).toBe("cavesDeck");
  });

  it("19134:B:1 at the end of the planning phase the first player looks at the top 2 stages, puts 1 on the bottom, The Side Door goes to the victory display and the other stage is revealed and flipped", () => {
    for (const seats of [1, 2] as const) {
      const t = gundabadTable(world, { seats, phase: "Planning", questDeck: ORDER, engaged: [{ code: CODES.dagnir, seat: 0 }] });
      const pending = advanceTo(t, start({ ...t.state, firstPlayer: seats - 1 }), () => false);
      expect(pending.state.window?.kind, `${seats} seats`).toBe("choose");
      expect(pending.state.window).toMatchObject({ seat: seats - 1 });
      const options = pending.state.window?.kind === "choose" ? pending.state.window.options : [];
      expect(options.map((id) => pending.state.cards[id]?.code)).toEqual(["19137", "19142"]);
      const done = send(pending, { type: "Choose", optionId: options[0] ?? "" }, t.ctx);
      expect(quest(done.state)).toBe("19142");
      expect(face(done.state)).toBe("B");
      expect(deckCodes(done.state)).toEqual(["19139", "19140", "19138", "19141", "19135", "19137"]);
      expect(codesIn(done.state, "victory")).toEqual(["19134"]);
      // Dagnir was engaged: the stage's When Revealed returns her to the staging area.
      expect(where(done.state, CODES.dagnir)[0]?.zone).toBe("staging");
    }
  });

  it("19134:B:1 choosing the other stage puts that one on the bottom", () => {
    const t = gundabadTable(world, { phase: "Planning", questDeck: ORDER });
    const pending = send(start(t.state), { type: "Pass" }, t.ctx);
    const options = pending.state.window?.kind === "choose" ? pending.state.window.options : [];
    const done = send(pending, { type: "Choose", optionId: options[1] ?? "" }, t.ctx);
    expect(quest(done.state)).toBe("19137");
    expect(deckCodes(done.state)).toEqual(["19139", "19140", "19138", "19141", "19135", "19142"]);
  });
});

describe("the stage 2s, side A", () => {
  for (const code of STAGE_TWOS) {
    it(`${code}:A:1 When Revealed: Dagnir returns to the staging area`, () => {
      const t = gundabadTable(world, { stage: code, faceA: true, engaged: [{ code: CODES.dagnir, seat: 0 }] });
      const run = resolveRecords(t.state, t.ctx, code, "whenRevealed", t.state.questStage ?? "");
      expect(where(run.state, CODES.dagnir)[0]?.zone).toBe("staging");
    });
  }

  it("19135:A:1 with Dagnir already in the staging area she stays there", () => {
    const t = gundabadTable(world, { stage: "19135", faceA: true, staging: [CODES.dagnir] });
    expect(where(resolveRecords(t.state, t.ctx, "19135", "whenRevealed", t.state.questStage ?? "").state, CODES.dagnir)[0]?.zone).toBe("staging");
  });

  it("19135:A:2 a stage 2 is not flipped when it is revealed: a defeated stage hands the quest to the top of the deck, side A up", () => {
    const t = gundabadTable(world, { stage: "19135", progress: 3, questDeck: DECK, setAside: [CODES.theFirstForge], caves: [CODES.lostArmory] });
    const after = settled(t);
    expect(quest(after)).toBe("19137");
    expect(face(after)).toBe("A");
    expect(deckCodes(after)).toEqual(["19142", "19139", "19140", "19138", "19141"]);
    // The defeated stage lies in the victory display (rr.discard-pile-and-victory-display).
    expect(codesIn(after, "victory")).toEqual(["19134", "19135"]);
  });

  it("19135:A:2 Forced: at the beginning of the quest phase the current stage is flipped to side B", () => {
    const t = gundabadTable(world, { phase: "Planning", stage: "19137", faceA: true, questDeck: ["19142"] });
    expect(face(t.state)).toBe("A");
    const run = advanceTo(t, start(t.state), (state) => state.phase === "Quest");
    expect(face(run.state)).toBe("B");
  });

  it("19135:A:2 a stage revealed in the quest phase stays side A through the rest of that round", () => {
    const t = gundabadTable(world, { phase: "Quest", stage: "19135", progress: 3, questDeck: DECK, setAside: [CODES.theFirstForge] });
    const after = settled(t);
    expect(face(after)).toBe("A");
  });
});

describe("bypassing", () => {
  it("19135:B:3 at the end of the combat phase the first player may bypass the stage: it loses its progress, goes to the bottom with side A up and the next stage 2A is revealed (Dagnir returns to the staging area)", () => {
    const { t, run } = endOfCombat({ questDeck: DECK, progress: 2, staging: [CODES.dagnir] });
    expect(run.state.window).toMatchObject({ kind: "choose", options: ["bypass", "stay"] });
    const done = answerWith(t, run, "bypass");
    expect(quest(done.state)).toBe("19137");
    expect(face(done.state)).toBe("A");
    expect(deckCodes(done.state)).toEqual(["19142", "19139", "19140", "19138", "19141", "19135"]);
    expect(done.state.stageLeft).toMatchObject({ bypassed: true });
    const bypassed = where(done.state, "19135")[0];
    expect(bypassed?.progress).toBe(0);
    expect(bypassed?.face).toBe("A");
    expect(codesIn(done.state, "victory")).toEqual(["19134"]);
  });

  it("emce.bypassing a bypassed stage is not defeated: its Forced effect of 'when this stage is defeated' does not resolve", () => {
    const { t, run } = endOfCombat({ questDeck: DECK, setAside: [CODES.theFirstForge], caves: [CODES.lostArmory] });
    const done = answerWith(t, run, "bypass");
    expect(codesIn(done.state, "cavesDeck")).toEqual([CODES.lostArmory]);
    expect(where(done.state, CODES.theFirstForge)[0]?.zone).toBe("setAside");
  });

  it("emce.bypassing the players may stay on the stage instead", () => {
    const { t, run } = endOfCombat({ questDeck: DECK, progress: 2 });
    const done = answerWith(t, run, "stay");
    expect(quest(done.state)).toBe("19135");
    expect(where(done.state, "19135")[0]?.progress).toBe(2);
    expect(deckCodes(done.state)).toEqual(DECK);
  });

  it("emce.bypassing the first player answers for the group, whoever is acting", () => {
    const { run } = endOfCombat({ seats: 2, questDeck: DECK });
    expect(run.state.window).toMatchObject({ kind: "choose", seat: run.state.firstPlayer });
  });

  it("emce.bypassing with no other stage in the quest deck the choice is not offered", () => {
    const { run } = endOfCombat({ questDeck: [] });
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.stageLeft).toBeUndefined();
  });

  it("emce.bypassing every stage 2B offers the bypass at the end of the combat phase (not 19142, which may have to)", () => {
    for (const code of STAGE_TWOS.filter((stage) => stage !== "19142")) {
      const { run } = endOfCombat({ stage: code, questDeck: STAGE_TWOS.filter((other) => other !== code && other !== "19142") });
      expect(run.state.window, code).toMatchObject({ kind: "choose", options: ["bypass", "stay"] });
    }
  });

  it("19142:B:3 with 4 or fewer quest cards in the victory display the players must bypass the stage: no choice, it goes to the bottom of the quest deck", () => {
    const { t, run } = endOfCombat({ stage: "19142", questDeck: ["19137", "19138", "19140", "19141"] });
    const stage = idOf(t.state, "19142");
    expect(run.state.stageLeft).toMatchObject({ from: stage, bypassed: true });
    expect(run.state.cards[stage]?.zone).toBe("questDeck");
    expect(run.state.cards[stage]?.progress).toBe(0);
    expect(run.state.questDeck.at(-1)).toBe(stage);
  });

  it("19142:B:3 with 5 or more quest cards in the victory display the stage stays", () => {
    const { run } = endOfCombat({ stage: "19142", questDeck: ["19137"] });
    expect(quest(run.state)).toBe("19142");
  });
});

describe("19135 Exploring Gundabad (The Upper Levels)", () => {
  it("19135:B:1 Forced: after the characters are committed each player raises their threat by 1", () => {
    const t = gundabadTable(world, { seats: 2, stage: "19135", threat: [30, 33], questDeck: DECK });
    expect(t.state.seats.map((seat) => seat.threat)).toEqual([30, 33]);
    const committed = advanceStagingStep(t);
    expect(committed.state.seats.map((seat) => seat.threat)).toEqual([31, 34]);
  });

  it("19135:B:2 Forced: when this stage is defeated The First Forge is shuffled into the Caves deck", () => {
    const t = gundabadTable(world, { stage: "19135", progress: 3, questDeck: DECK, setAside: [CODES.theFirstForge], caves: [CODES.lostArmory, CODES.ancientTreasury] });
    const after = settled(t);
    expect(codesIn(after, "cavesDeck").sort()).toEqual([CODES.theFirstForge, CODES.lostArmory, CODES.ancientTreasury].sort());
    expect(codesIn(after, "setAside")).toEqual([]);
  });
});

// The staging step begins (the characters are committed): the quest phase from its start to the first card revealed.
function advanceStagingStep(t: Table, until: (state: ScenarioState) => boolean = (state) => state.mode === "staging" || state.mode === "resolution"): Run {
  const commit = legalIntents(t.state, t.ctx).find((intent) => intent.type === "Pass");
  let run = send(start(t.state), (commit ?? { type: "Pass" }) as never, t.ctx);
  for (let guard = 0; guard < 20 && !until(run.state) && run.state.window?.kind !== "choose"; guard += 1) {
    const pass = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass");
    if (!pass) break;
    run = send(run, pass as never, t.ctx);
  }
  return run;
}

describe("19137 Exploring Gundabad (The Lower Deeps)", () => {
  it("19137:B:1 the When Revealed effects of the first treachery revealed each round cannot be canceled, the second's can", () => {
    const t = gundabadTable(world, { stage: "19137", questDeck: behind("19137"), deck: ["treachery", "treachery", "f0"], phase: "Quest" });
    const revealed = advanceStagingStep(t, (state) => state.mode === "resolution");
    const cards = where(revealed.state, "treachery");
    expect(cards.length).toBeGreaterThanOrEqual(1);
    // Only the first treachery of the round is marked, and the mark ends with the round.
    expect(cards.filter((card) => flagged(revealed.state, card.id, "firstTreachery"))).toHaveLength(1);
    expect(flagged(revealed.state, "table", "treacheryRevealed")).toBe(true);
    const next = settle({ ...revealed.state, window: null, mode: "endRound", phase: "End of round" }, t.ctx, []);
    expect(cards.some((card) => flagged(next, card.id, "firstTreachery"))).toBe(false);
  });

  it("19137:B:2 Forced: when this stage is defeated the first player searches the Caves deck for a location, which becomes the active location, and the deck is shuffled", () => {
    const caves = [CODES.crumblingCavern, CODES.undergroundLake, CODES.frightfulDen];
    const t = gundabadTable(world, { seats: 2, stage: "19137", progress: POINTS["19137"], questDeck: behind("19137"), caves, active: CODES.minesOfGundabad });
    const pending = advanceTo(t, start(settle({ ...t.state, window: null }, t.ctx, [])), () => false);
    expect(pending.state.window).toMatchObject({ kind: "choose", seat: pending.state.firstPlayer });
    const options = pending.state.window?.kind === "choose" ? pending.state.window.options : [];
    expect(options.map((id) => pending.state.cards[id]?.code).sort()).toEqual([...caves].sort());
    const chosen = options.find((id) => pending.state.cards[id]?.code === CODES.undergroundLake) ?? "";
    const done = finish(send(pending, { type: "Choose", optionId: chosen }, t.ctx), t.ctx);
    expect(done.state.activeLocation).toBe(chosen);
    // The location that was active returns to the staging area; the other two Caves cards were shuffled.
    expect(where(done.state, CODES.minesOfGundabad)[0]?.zone).toBe("staging");
    expect(codesIn(done.state, "cavesDeck").sort()).toEqual([CODES.crumblingCavern, CODES.frightfulDen].sort());
    expect(done.state.seedCursor).toBeGreaterThan(t.state.seedCursor);
  });

  it("19137:B:2 with the Caves deck empty nothing happens", () => {
    const t = gundabadTable(world, { stage: "19137", progress: POINTS["19137"], questDeck: behind("19137"), active: CODES.minesOfGundabad });
    const after = settled(t);
    expect(after.activeLocation).toBe(idOf(after, CODES.minesOfGundabad));
    expect(after.window ?? null).toBeNull();
  });
});

describe("19138 Exploring Gundabad (Frenzied Warrens)", () => {
  it("19138:B:1 after the characters are committed the top 5 cards of the encounter deck are discarded and a random enemy among them joins the staging area", () => {
    const deck = ["f0", "treachery", "f3", "place", "f3", "f0", "f0"];
    const t = gundabadTable(world, { stage: "19138", questDeck: behind("19138"), deck });
    const run = advanceStagingStep(t, (state) => state.mode === "resolution");
    expect(run.state.encounterDiscard.length + codesIn(run.state, "staging").length).toBeGreaterThanOrEqual(5);
    const staged = codesIn(run.state, "staging").filter((code) => code === "f0" || code === "f3");
    expect(staged.length).toBeGreaterThanOrEqual(1);
    // One of the five discarded enemies (the third and fifth card were f3, the first f0), not the one beyond them.
    expect(run.state.encounterDeck.map((id) => run.state.cards[id]?.code).length).toBeLessThanOrEqual(2);
  });

  it("19138:B:1 with no enemy among the cards discarded nothing is added", () => {
    const t = gundabadTable(world, { stage: "19138", questDeck: behind("19138"), deck: ["treachery", "treachery", "place", "treachery", "treachery", "f0"] });
    const run = resolveRecords(t.state, t.ctx, "19138", "forced", t.state.questStage ?? "");
    expect(codesIn(run.state, "staging").filter((code) => code === "f0")).toEqual([]);
  });

  it("19138:B:2 Forced: when this stage is defeated each player reduces their threat by 5", () => {
    const t = gundabadTable(world, { seats: 2, stage: "19138", progress: POINTS["19138"], threat: [30, 40], questDeck: behind("19138") });
    expect(settled(t).seats.map((seat) => seat.threat)).toEqual([25, 35]);
  });
});

describe("19139 Exploring Gundabad (Dagnir's Wrath)", () => {
  it("19139:B:2 Forced: when this stage is defeated 5 damage are dealt to Dagnir, past her cap and not counted against it", () => {
    const t = gundabadTable(world, { stage: "19139", progress: POINTS["19139"], questDeck: behind("19139"), staging: [CODES.dagnir] });
    const after = settled(t);
    const dagnir = where(after, CODES.dagnir)[0];
    expect(dagnir?.damage).toBe(5);
    expect(after.roundDamage?.[dagnir?.id ?? ""]).toBeUndefined();
  });

  it("19139:B:1 after the characters are committed Dagnir attacks each player with 6 or more characters, and no other", () => {
    const six = gundabadTable(world, { stage: "19139", questDeck: behind("19139"), staging: [CODES.dagnir], play: ["ally", "ally", "ally", "ally"] });
    const attacked = advanceStagingStep(six, (state) => state.window?.kind === "defense" || state.mode === "resolution");
    expect(attacked.state.window?.kind).toBe("defense");
    expect(attacked.state.pendingAttack?.seat).toBe(0);
    const five = gundabadTable(world, { stage: "19139", questDeck: behind("19139"), staging: [CODES.dagnir], play: ["ally", "ally", "ally"] });
    const quiet = advanceStagingStep(five, (state) => state.window?.kind === "defense" || state.mode === "resolution");
    expect(quiet.state.window?.kind).not.toBe("defense");
  });
});

describe("19140 Exploring Gundabad (Foreboding Darkness)", () => {
  it("19140:B:1 each player cannot play more than 1 card each phase", () => {
    const playTwo = (faceA: boolean) => {
      const t = gundabadTable(world, { phase: "Planning", stage: "19140", faceA, questDeck: behind("19140"), hand: ["filler", "c0"] });
      const [one, two] = [idOf(t.state, "filler"), idOf(t.state, "c0")];
      const played = finish(send(start(t.state), { type: "PlayCard", cardId: one, payments: [] }, t.ctx), t.ctx);
      expect(played.state.played?.map((entry) => entry.id)).toEqual([one]);
      return playReason(played.state, { type: "PlayCard", cardId: two, payments: [] }, t.ctx);
    };
    expect(playTwo(false)).toBe("Exploring Gundabad (play limit): each player can play only 1 card per phase. You have played 1 this planning phase.");
    // Without the stage's side B nothing limits the plays.
    expect(playTwo(true)).toBeNull();
  });

  it("19140:B:1 each player has their own play: the second player can still play a card, and a card put into play is not a play", () => {
    const t = gundabadTable(world, { seats: 2, phase: "Planning", stage: "19140", questDeck: behind("19140"), hand: ["filler", "c0"] });
    const played = finish(send(start(t.state), { type: "PlayCard", cardId: idOf(t.state, "filler"), payments: [] }, t.ctx), t.ctx);
    const otherSeat = Object.values(played.state.cards).find((card) => card.code === "c0" && card.zone === "hand" && card.controller === 1);
    expect(otherSeat).toBeDefined();
    expect(phasePlaysBarred({ ...played.state, activeSeat: 1 }, otherSeat?.id ?? "", t.ctx, {})).toBe(false);
    expect(phasePlaysBarred({ ...played.state, activeSeat: 0 }, otherSeat?.id ?? "", t.ctx, {})).toBe(true);
    expect(phasePlaysBarred({ ...played.state, activeSeat: 0 }, otherSeat?.id ?? "", t.ctx, { putting: true })).toBe(false);
  });

  it("19140:B:2 Forced: when this stage is defeated the first player looks at the top 2 stages, puts 1 on the bottom and the quest advances to the top stage", () => {
    const t = gundabadTable(world, { stage: "19140", progress: POINTS["19140"], questDeck: behind("19140") });
    const pending = advanceTo(t, start(settle({ ...t.state, window: null }, t.ctx, [])), () => false);
    expect(pending.state.window?.kind).toBe("choose");
    const options = pending.state.window?.kind === "choose" ? pending.state.window.options : [];
    expect(options.map((id) => pending.state.cards[id]?.code)).toEqual(["19137", "19142"]);
    const done = send(pending, { type: "Choose", optionId: options[1] ?? "" }, t.ctx);
    expect(quest(done.state)).toBe("19137");
    expect(deckCodes(done.state).at(-1)).toBe("19142");
    expect(codesIn(done.state, "victory")).toContain("19140");
  });
});

describe("19141 Exploring Gundabad (Imminent Pursuit)", () => {
  it("19141:B:1 after the characters are committed each player deals 2 damage to a questing character they control", () => {
    const t = gundabadTable(world, { seats: 2, stage: "19141", questDeck: behind("19141"), committed: 2 });
    const run = advanceStagingStep(t, (state) => state.mode === "resolution");
    expect(run.state.window?.kind).toBe("choose");
    const options = run.state.window?.kind === "choose" ? run.state.window.options : [];
    expect([...options].sort()).toEqual([t.hero, t.hero2].sort());
    const done = finish(send(run, { type: "Choose", optionId: t.hero2 }, t.ctx), t.ctx);
    expect(done.state.cards[t.hero2]?.damage).toBe(2);
    expect(done.state.cards[t.hero]?.damage).toBe(0);
    // The second player has no questing character: they deal nothing.
    expect(done.state.cards[t.seat1Hero ?? ""]?.damage).toBe(0);
  });

  it("19141:B:2 Forced: when this stage is defeated the first player discards a non-unique enemy from play (Dagnir is unique)", () => {
    const t = gundabadTable(world, { stage: "19141", progress: POINTS["19141"], questDeck: behind("19141"), staging: ["f0", CODES.dagnir, "f3"] });
    const pending = advanceTo(t, start(settle({ ...t.state, window: null }, t.ctx, [])), () => false);
    expect(pending.state.window?.kind).toBe("choose");
    const options = pending.state.window?.kind === "choose" ? pending.state.window.options : [];
    expect(options.map((id) => pending.state.cards[id]?.code).sort()).toEqual(["f0", "f3"]);
    const done = finish(send(pending, { type: "Choose", optionId: options[0] ?? "" }, t.ctx), t.ctx);
    expect(codesIn(done.state, "staging")).toHaveLength(2);
    expect(where(done.state, CODES.dagnir)[0]?.zone).toBe("staging");
  });
});

describe("19142 Exploring Gundabad (The Great Worm)", () => {
  it("19142 prints no quest points: progress does not defeat it", () => {
    const t = gundabadTable(world, { stage: "19142", progress: 40, questDeck: behind("19142") });
    expect(quest(settled(t))).toBe("19142");
  });

  it("19142:B:1 Dagnir gets -5 engagement cost for each character the first player controls", () => {
    const t = gundabadTable(world, { seats: 2, stage: "19142", questDeck: behind("19142"), staging: [CODES.dagnir] });
    const dagnir = idOf(t.state, CODES.dagnir);
    // Three characters of the first player in play: the first player's two heroes and... the second player's hero is not counted.
    const cost = (state: ScenarioState) => state.cards[dagnir] && engagementOf(state, t, dagnir);
    expect(cost(t.state)).toBe(50 - 10);
    const more = gundabadTable(world, { seats: 2, stage: "19142", questDeck: behind("19142"), staging: [CODES.dagnir], play: ["ally", "ally"] });
    expect(engagementOf(more.state, more, idOf(more.state, CODES.dagnir))).toBe(50 - 20);
  });

  const attackDagnir = (layout: Parameters<typeof gundabadTable>[1], attackers: (t: Table) => string[]) => {
    const t = gundabadTable(world, { phase: "PlayerAttacks", stage: "19142", questDeck: [], ...layout });
    const enemyId = idOf(t.state, CODES.dagnir);
    const run = send(start(t.state), { type: "DeclareAttackers", enemyId, attackerIds: attackers(t) } as never, t.ctx);
    return { t, run, enemyId };
  };

  it("19142:B:2 Response: after a player resolves an attack against Dagnir with no hit points remaining on her, that player may discard a Reforged Wormsbane to add her to the victory display, and the players win", () => {
    const { t, run, enemyId } = attackDagnir({ staging: [{ code: CODES.dagnir, damage: 19 }], attached: [{ code: "19144" }] }, (made) => [made.hero]);
    expect(run.state.cards[enemyId]?.damage).toBeGreaterThanOrEqual(20);
    expect(run.state.window).toMatchObject({ kind: "response", seat: 0 });
    const won = finish(answerWith(t, useResponse(t, run), "do"), t.ctx);
    expect(won.state.cards[enemyId]?.zone).toBe("victory");
    expect(where(won.state, "19144")[0]?.zone).toBe("encounterDiscard");
    expect(won.state.stageCleared).toBe(true);
  });

  it("19142:B:2 the player may decline: nothing is discarded and the game goes on", () => {
    const { t, run, enemyId } = attackDagnir({ staging: [{ code: CODES.dagnir, damage: 19 }], attached: [{ code: "19144" }] }, (made) => [made.hero]);
    const declined = finish(answerWith(t, useResponse(t, run), "decline"), t.ctx);
    expect(declined.state.cards[enemyId]?.zone).toBe("staging");
    expect(declined.state.stageCleared).toBeFalsy();
    expect(where(declined.state, "19144")[0]?.zone).toBe("play");
  });

  it("19142:B:2 no Response while Dagnir has hit points remaining", () => {
    const { run } = attackDagnir({ staging: [{ code: CODES.dagnir, damage: 5 }], attached: [{ code: "19144" }] }, (made) => [made.hero]);
    expect(run.state.window?.kind).not.toBe("response");
  });

  it("19142:B:2 the player needs a Reforged Wormsbane (the Broken side is not enough)", () => {
    const { t, run, enemyId } = attackDagnir({ staging: [{ code: CODES.dagnir, damage: 19 }], attached: [{ code: "19143" }] }, (made) => [made.hero]);
    const used = run.state.window?.kind === "response" ? useResponse(t, run) : run;
    const options = used.state.window?.kind === "choose" ? used.state.window.options : [];
    expect(options).not.toContain("do");
    expect(run.state.cards[enemyId]?.zone).toBe("staging");
    expect(t.state.stageCleared).toBeFalsy();
  });
});

function engagementOf(state: ScenarioState, t: { ctx: Table["ctx"] }, id: string): number | null {
  const card = state.cards[id];
  const printed = card ? t.ctx.cards.get(card.code) : undefined;
  if (!card || !printed || printed.engagementCost == null) return null;
  return modifiedStat(state, card, "engagementCost", t.ctx.cards);
}

describe("completing a stage", () => {
  it("emce.gundabad-quest-deck there is no stage 3: a stage defeated with the quest deck empty wins the game", () => {
    const t = gundabadTable(world, { stage: "19135", progress: POINTS["19135"], questDeck: [] });
    expect(settled(t).stageCleared).toBe(true);
  });

  it("emce.bypassing a stage defeated hands the quest to the next stage 2A and goes to the victory display with its Victory", () => {
    for (const code of STAGE_TWOS.filter((stage) => stage !== "19142")) {
      const key = code as keyof typeof POINTS;
      const t = gundabadTable(world, { stage: code, progress: POINTS[key], questDeck: [...behind(code).filter((other) => other !== "19142"), "19142"] });
      // Stage 2B of Foreboding Darkness asks the first player about the stages first; the others answer nothing.
      const after = finish(start(settled(t)), t.ctx).state;
      expect(codesIn(after, "victory"), code).toContain(code);
      expect(face(after), code).toBe("A");
      expect(quest(after), code).not.toBe(code);
    }
  });

});
