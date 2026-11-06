// Rules: emce.gundabad-quest-deck, emce.bypassing, emce.caves-deck-gundabad, emce.treasure, rr.first-player, rr.search, rr.response, rr.cancel, rr.damage (data/rules/entries.json); ledger lines 19124:A:1, 19134:A:1, 19134:B:1, 19135:B:3, 19137:B:1, 19137:B:2, 19140:B:1, 19140:B:2, 19141:B:1, 19142:B:2, 19122:A:3, 19123:A:2, 12194:A:2
// The choices and prompts of Mount Gundabad on the live sheet: each opens a real window (the engine's own frames, not a hand-made instruction), and the sheet says the number, the side of the table, the player, what declining does, and the cost before a choice that can lose the game.
// Two-handed a seat-by-seat sentence leads with the player and the sheet adds no "Player N chooses."; solo it has no lead; the first player's choice for the group leaves the sheet to say who chooses.
import { beforeAll, describe, expect, it } from "vitest";

import { legalIntents } from "../../rules/engine/legal.ts";
import { settle } from "../../rules/engine/machine.ts";
import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { spawn } from "../../rules/core/zones.ts";
import { pushCardEffects, pushEffectFrame } from "../../rules/interpret/effect-frames.ts";
import { playReason } from "../../rules/player/planning.ts";
import { CODES, STAGE_TWOS, finish, gundabadTable, idOf, loadGundabadWorld, send, start, type GundabadWorld, type Run } from "../../../test/scenarios/mount-gundabad/scene.ts";

import { momentOf } from "../store/outcome.ts";
import { sheetFor } from "./sheets.ts";

let world: GundabadWorld;
beforeAll(async () => {
  world = await loadGundabadWorld();
}, 120_000);

type Table = ReturnType<typeof gundabadTable>;
const nameOf = (code: string): string => world.cards.get(code)?.name ?? code;
const names = (state: ScenarioState) => ({ card: (id: string) => nameOf(state.cards[id]?.code ?? id), line: () => null });

// Every sheet the file opens, kept to check them all for the words rules once the tests have run.
const opened_: { note: string; kind: string; labels: string[] }[] = [];
const sheetOf = (t: Table, state: ScenarioState) => {
  const sheet = sheetFor(state, t.ctx, legalIntents(state, t.ctx), names(state));
  if (!sheet || (sheet.kind !== "pick" && sheet.kind !== "trigger")) throw new Error(`no pick or trigger sheet: ${JSON.stringify(state.window)}`);
  opened_.push({ note: sheet.note ?? "", kind: sheet.kind, labels: sheet.options.map((option) => option.label) });
  return sheet;
};
const labels = (sheet: ReturnType<typeof sheetOf>) => sheet.options.map((option) => option.label);
const cautions = (sheet: ReturnType<typeof sheetOf>) => sheet.options.map((option) => ("caution" in option ? option.caution : undefined));
const take = (t: Table, run: Run, optionId: string): Run => send(run, { type: "Choose", optionId }, t.ctx);
const offerOf = (state: ScenarioState, t: Table, cardId: string) => legalIntents(state, t.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === cardId);
const use = (t: Table, run: Run, cardId: string): Run => {
  const offer = offerOf(run.state, t, cardId);
  if (!offer) throw new Error("no Response to use");
  return send(run, offer as never, t.ctx);
};
const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// Passes each window until `stop` holds or a choice opens.
function advanceTo(t: Table, run: Run, stop: (state: ScenarioState) => boolean): Run {
  let current = run;
  for (let guard = 0; guard < 80 && !stop(current.state) && current.state.window?.kind !== "choose"; guard += 1) {
    const pass = legalIntents(current.state, t.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage" || intent.type === "DeclineTravel");
    if (!pass) break;
    current = send(current, pass as never, t.ctx);
  }
  return current;
}

// The location is explored the way the engine explores it: progress on the active location, and the table settles.
function explore(t: Table): Run {
  const steps: never[] = [];
  const pushed = pushEffectFrame(t.state, { frame: "ResolveEffect", sourceId: t.hero, actor: 0, peril: false, effectId: "test", instructions: [{ verb: "PlaceProgressOn", amount: 99, target: "activeLocation" }], cancel: null, blockCancel: null }, steps);
  return { state: settle({ ...pushed, window: null }, t.ctx, steps), steps: [] };
}

// A card's records of one timing, pushed as the engine pushes them and settled until its window opens.
function opened(t: Table, state: ScenarioState, code: string, timing: "setup" | "whenRevealed" | "forced", source: string): ScenarioState {
  const effects = t.ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === timing);
  const frame = timing === "setup" ? "setup" : timing === "whenRevealed" ? "whenRevealed" : "forced";
  const pushed = pushCardEffects(state, frame, source, state.firstPlayer, false, effects, t.ctx, []);
  return settle({ ...pushed, window: null, mode: "stopped" }, t.ctx, []);
}

// The end of the combat phase with the stage in play: the run stops where the first player is asked about the bypass.
const endOfCombat = (layout: Parameters<typeof gundabadTable>[1]): { t: Table; run: Run } => {
  const t = gundabadTable(world, { phase: "Combat", stage: "19135", ...layout });
  return { t, run: advanceTo(t, start(t.state), (state) => state.phase === "Refresh") };
};

const THREE = ["19137", "19139", "19140"] as const;

describe("the bypass at the end of the combat phase (emce.bypassing, 19135:B:3)", () => {
  it("says what the stage loses, where it goes, what comes next and what staying keeps; two-handed the sheet adds who chooses", () => {
    for (const [seats, suffix] of [[1, ""], [2, " Player 1 chooses."]] as const) {
      const { t, run } = endOfCombat({ seats, progress: 2, questDeck: THREE });
      const sheet = sheetOf(t, run.state);
      expect(sheet.note).toBe(`Exploring Gundabad: bypass this stage at the end of the combat phase? If the players do, it loses its 2 progress, it goes to the bottom of the quest deck and it is not defeated, so it does not go to the victory display. The next stage 2A is revealed and its When Revealed effect resolves (3 stages wait in the quest deck). If they stay, it keeps its 2 progress and the quest continues.${suffix}`);
      expect(labels(sheet)).toEqual(["Bypass the stage: lose 2 progress, go to the bottom of the quest deck", "Stay on the stage: keep 2 progress"]);
      expect(cautions(sheet)).toEqual([undefined, undefined]);
    }
  });

  it("says a stage with no progress has none to lose, and that one stage waiting is a single stage", () => {
    const { t, run } = endOfCombat({ progress: 0, questDeck: ["19137"] });
    const sheet = sheetOf(t, run.state);
    expect(sheet.note).toContain("If the players do, it has no progress to lose, it goes to the bottom of the quest deck");
    expect(sheet.note).toContain("(1 stage waits in the quest deck). If they stay, the quest continues.");
    expect(labels(sheet)).toEqual(["Bypass the stage: go to the bottom of the quest deck", "Stay on the stage"]);
  });

  it("bypassing tells the beat: the progress lost, the stage at the bottom and not in the victory display, the next stage arriving side A", () => {
    const { t, run } = endOfCombat({ progress: 2, questDeck: THREE });
    const bypassed = send(start(run.state), { type: "Choose", optionId: "bypass" }, t.ctx);
    const moment = momentOf(run.state, bypassed.state, bypassed.steps.flat(), names(bypassed.state));
    expect(moment?.title).toBe("Exploring Gundabad is bypassed");
    expect(moment?.lines.slice(0, 4).map((line) => line.text)).toEqual([
      "It loses its 2 progress and goes to the bottom of the quest deck: it is not defeated, so it is not added to the victory display.",
      "2 progress removed from Exploring Gundabad",
      "The quest advances to Exploring Gundabad",
      "It shows side A: only its side A text works until it is flipped at the beginning of the quest phase.",
    ]);
    expect(bypassed.state.questDeck.at(-1)).toBe(run.state.questStage);
  });

  it("the Great Worm with 4 or fewer quest cards in the victory display is bypassed with no choice, and the beat says so", () => {
    const t = gundabadTable(world, { phase: "Combat", stage: "19142", progress: 0, questDeck: ["19137", "19138", "19140", "19141"] });
    let run = start(t.state);
    let moment: ReturnType<typeof momentOf> = null;
    for (let guard = 0; guard < 40 && !moment; guard += 1) {
      const pass = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
      if (!pass) break;
      const next = send(start(run.state), pass as never, t.ctx);
      moment = momentOf(run.state, next.state, next.steps.flat(), names(next.state));
      if (moment && !moment.title.includes("bypassed")) moment = null;
      run = next;
    }
    expect(run.state.window?.kind).not.toBe("choose");
    expect(moment?.title).toBe("Exploring Gundabad is bypassed");
    expect(moment?.lines[0]?.text).toBe("It had no progress to lose and goes to the bottom of the quest deck: it is not defeated, so it is not added to the victory display.");
  });

  it("staying keeps the stage and its progress, and the quest goes on to the refresh phase", () => {
    const { t, run } = endOfCombat({ progress: 2, questDeck: THREE });
    const stayed = advanceTo(t, take(t, start(run.state), "stay"), (state) => state.phase === "Refresh");
    expect(stayed.state.cards[stayed.state.questStage ?? ""]?.progress).toBe(2);
    expect(stayed.state.questStage).toBe(run.state.questStage);
  });
});

describe("the flip at the beginning of the quest phase (emce.gundabad-quest-deck)", () => {
  it("tells the stage is flipped to side B when the quest phase begins, and that its side B text works from then on", () => {
    const t = gundabadTable(world, { phase: "Planning", stage: "19135", faceA: true, questDeck: ["19137"] });
    let run = start(t.state);
    for (let guard = 0; guard < 12 && run.state.phase !== "Quest"; guard += 1) run = send(run, { type: "Pass" }, t.ctx);
    const moment = momentOf(t.state, run.state, run.steps.flat(), names(run.state));
    expect(moment?.title).toBe("Exploring Gundabad is flipped");
    expect(moment?.lines.map((line) => line.text)).toEqual(["The quest card shows side B at the beginning of the quest phase: its side B text works from now on."]);
    expect(run.state.cards[run.state.questStage ?? ""]?.face).toBe("B");
  });

  it("says nothing of a flip when the stage already shows side B", () => {
    const t = gundabadTable(world, { phase: "Planning", stage: "19135", questDeck: ["19137"] });
    let run = start(t.state);
    for (let guard = 0; guard < 12 && run.state.phase !== "Quest"; guard += 1) run = send(run, { type: "Pass" }, t.ctx);
    expect(momentOf(t.state, run.state, run.steps.flat(), names(run.state))?.title ?? "").not.toContain("flipped");
  });
});

describe("the first treachery revealed each round (19137:B:1)", () => {
  it("is noted as it is revealed: its When Revealed effect cannot be canceled by player cards; the second treachery is not noted", () => {
    const t = gundabadTable(world, { phase: "Quest", stage: "19137", questDeck: ["19142", "19138"], deck: ["treachery", "treachery", "f0"] });
    const commit = send(start(t.state), { type: "Pass" }, t.ctx);
    const run = advanceTo(t, commit, (state) => state.mode === "resolution");
    const treacheries = where(run.state, "treachery");
    expect(treacheries.length).toBe(2);
    const moment = momentOf(t.state, run.state, run.steps.flat(), names(run.state));
    const told = (moment?.lines ?? []).map((line) => line.text).filter((text) => text.includes("cannot be canceled"));
    expect(told).toEqual(["treachery is the first treachery revealed this round: its When Revealed effect cannot be canceled by player cards."]);
  });

  it("is not noted with no stage that bars canceling it", () => {
    const t = gundabadTable(world, { phase: "Quest", stage: "19135", questDeck: ["19142", "19138"], deck: ["treachery", "f0"] });
    const run = advanceTo(t, send(start(t.state), { type: "Pass" }, t.ctx), (state) => state.mode === "resolution");
    expect((momentOf(t.state, run.state, run.steps.flat(), names(run.state))?.lines ?? []).some((line) => line.text.includes("cannot be canceled"))).toBe(false);
  });
});

describe("Throat of the Mountain (19124:A:1)", () => {
  const throat = (seats: 1 | 2): { t: Table; run: Run } => {
    const t = gundabadTable(world, { seats, phase: "Quest", active: CODES.throatOfTheMountain, stage: "19135", progress: 2, questDeck: ["19137", "19142", "19139"] });
    return { t, run: explore(t) };
  };

  it("the Response says what the search does to the stage now current, and what passing leaves; two-handed it leads Player 1", () => {
    for (const [seats, lead] of [[1, ""], [2, "Player 1: "]] as const) {
      const { t, run } = throat(seats);
      const sheet = sheetOf(t, run.state);
      expect(sheet.kind).toBe("trigger");
      expect(sheet.note).toBe(`${lead}Throat of the Mountain was explored. Search the quest deck (3 stages) for a quest card and make it the current main quest, flipped over at once; the stage now current (it loses its 2 progress) goes back into the quest deck and the quest deck is shuffled. Pass and the quest stays as it is.`);
    }
  });

  it("then asks the first player which stage, flipped at once, naming the loss and the shuffle; the sheet adds who chooses", () => {
    for (const [seats, suffix] of [[1, ""], [2, " Player 1 chooses."]] as const) {
      const { t, run } = throat(seats);
      const asked = use(t, run, idOf(t.state, CODES.throatOfTheMountain));
      const sheet = sheetOf(t, asked.state);
      expect(sheet.note).toBe(`Throat of the Mountain: search the quest deck for a quest card and make it the current main quest, flipped over at once. The stage now current goes back into the quest deck; it loses its 2 progress, and the quest deck is shuffled.${suffix}`);
      expect(sheet.options).toHaveLength(3);
      const chosen = take(t, start(asked.state), asked.state.window?.kind === "choose" ? (asked.state.window.options[0] ?? "") : "");
      const done = finish(chosen, t.ctx);
      expect(done.state.cards[done.state.questStage ?? ""]?.face).toBe("B");
      // The beat: the stage that was current is not defeated and goes back into the shuffled deck, the new one is flipped over at once.
      const moment = momentOf(asked.state, chosen.state, chosen.steps.flat(), names(chosen.state));
      expect(moment?.title).toBe("Exploring Gundabad becomes the current quest");
      expect(moment?.lines[0]?.text).toBe("It loses its 2 progress and the stage that was current goes back into the quest deck, which is shuffled: it is not defeated, so it is not added to the victory display. The new stage is flipped over at once.");
    }
  });
});

describe("Dagnir's Hoard (19123:A:2)", () => {
  const explored = (): { t: Table; run: Run } => {
    const t = gundabadTable(world, { seats: 2, phase: "Quest", active: CODES.dagnirSHoard, deckOf: ["item", "f0", "f0"] });
    let run = explore(t);
    for (let guard = 0; guard < 60 && !(run.state.window?.kind === "response" && offerOf(run.state, t, idOf(t.state, CODES.dagnirSHoard))); guard += 1) {
      if (run.state.window?.kind === "defense") run = send(run, { type: "Undefended", heroId: run.state.seats[run.state.activeSeat]?.heroes[0] ?? "" } as never, t.ctx);
      else if (run.state.window?.kind === "choose") run = take(t, run, run.state.window.options[0] ?? "");
      else {
        const next = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass");
        if (!next) break;
        run = send(run, next as never, t.ctx);
      }
    }
    return { t, run };
  };

  it("the Response says each player may search for an Item attachment and what passing does", () => {
    const { t, run } = explored();
    const sheet = sheetOf(t, run.state);
    expect(sheet.note).toBe("Player 1: Dagnir's Hoard was explored. Each player may search their deck for an Item attachment, add it to their hand and shuffle their deck. Pass and nobody searches.");
  });

  it("then asks each player in turn, Player 1 and Player 2, led by the player with no \"chooses\" after it; declining leaves the hand and deck as they are, and shuffles nothing", () => {
    const { t, run } = explored();
    const first = sheetOf(t, use(t, run, idOf(t.state, CODES.dagnirSHoard)).state);
    expect(first.note).toBe("Player 1, Dagnir's Hoard: search your deck for an Item attachment and add it to your hand? Your deck is shuffled after the search.");
    expect(first.note).not.toContain("chooses");
    expect(labels(first)).toEqual(["Search for an Item attachment and add it to your hand", "Do not search: your hand and deck stay as they are"]);
    const declined = take(t, use(t, run, idOf(t.state, CODES.dagnirSHoard)), "decline");
    const second = sheetOf(t, declined.state);
    expect(second.note).toBe("Player 2, Dagnir's Hoard: search your deck for an Item attachment and add it to your hand? Your deck is shuffled after the search.");
    // Player 1 declined: the deck is as it was; the search is the shuffle.
    const before = run.state.seats[0]?.deck ?? [];
    expect(declined.state.seats[0]?.deck).toEqual(before);
    const searched = take(t, declined, "do");
    expect(searched.state.seats[1]?.hand.map((id) => searched.state.cards[id]?.code)).toContain("item");
  });
});

describe("The First Forge and Wormsbane (19122:A:3, 19134:A:1)", () => {
  const forge = (seats: 1 | 2): { t: Table; run: Run } => {
    const t = gundabadTable(world, { seats, phase: "Quest", active: CODES.theFirstForge, attached: [{ code: CODES.wormsbane }], stage: "19137", questDeck: ["19142", "19138", "19139", "19140", "19141"] });
    return { t, run: explore(t) };
  };

  it("the Response says Wormsbane's Attack, that the hero's leaving play loses the game, and that passing keeps it Broken for good; two-handed it leads Player 1", () => {
    for (const [seats, lead] of [[1, ""], [2, "Player 1: "]] as const) {
      const { t, run } = forge(seats);
      const sheet = sheetOf(t, run.state);
      expect(sheet.note).toBe(`${lead}The First Forge was explored. Flip Wormsbane to its Reforged side and attach it to any hero the first player chooses. That hero gets +3 Attack (1 more than the 2 quest cards in the victory display), and if it leaves play the players lose the game. Pass and Wormsbane stays Broken side up on its hero, since The First Forge is gone.`);
    }
  });

  it("then asks the first player for the hero, naming the cost; the sheet adds who chooses, and it can choose a hero of another player", () => {
    for (const [seats, suffix, heroes] of [[1, "", 2], [2, " Player 1 chooses.", 3]] as const) {
      const { t, run } = forge(seats);
      const sheet = sheetOf(t, use(t, run, idOf(t.state, CODES.theFirstForge)).state);
      expect(sheet.note).toBe(`The First Forge: choose a hero of any player to carry Wormsbane, flipped to its Reforged side. If that hero leaves play, the players lose the game.${suffix}`);
      expect(sheet.options).toHaveLength(heroes);
    }
  });

  it("the Setup asks the first player which hero carries Wormsbane, Broken side up, and the cost", () => {
    for (const [seats, suffix] of [[1, ""], [2, " Player 1 chooses."]] as const) {
      const t = gundabadTable(world, { seats, phase: "Planning", questDeck: STAGE_TWOS });
      const sheet = sheetOf(t, opened(t, t.state, CODES.stage1, "setup", t.state.questStage ?? ""));
      expect(sheet.note).toBe(`The Side Door: choose the hero who carries Wormsbane, Broken side up. If that hero leaves play, the players lose the game.${suffix}`);
    }
  });
});

describe("the Response that adds Dagnir to the victory display (19142:B:2)", () => {
  it("names what it does and what passing leaves, then asks the attacker whether to discard the Reforged Wormsbane, with a row for each answer; two-handed it leads Player 1", () => {
    for (const [seats, lead, suffix] of [[1, "", ""], [2, "Player 1: ", ""]] as const) {
      const t = gundabadTable(world, { seats, phase: "PlayerAttacks", stage: "19142", questDeck: [], staging: [{ code: CODES.dagnir, damage: 19 }], attached: [{ code: "19144" }], victory: ["19134", "19135", "19137", "19138", "19139"] });
      const run = send(start(t.state), { type: "DeclareAttackers", enemyId: idOf(t.state, CODES.dagnir), attackerIds: [t.hero] } as never, t.ctx);
      const response = sheetOf(t, run.state);
      expect(response.note).toBe(`${lead}Dagnir has no hit points remaining. You may discard your Reforged Wormsbane to add her to the victory display, and the players win the game. Pass and she stays in play.${suffix}`);
      const asked = use(t, run, idOf(t.state, "19142"));
      const sheet = sheetOf(t, asked.state);
      expect(sheet.note).toBe(`${seats === 1 ? "" : "Player 1, "}Exploring Gundabad: discard your Reforged Wormsbane to add Dagnir to the victory display? The players win the game.`);
      expect(labels(sheet)).toEqual(["Discard Wormsbane: Dagnir is added to the victory display and the players win the game", "Do not discard it: Wormsbane stays attached and Dagnir stays in play"]);
      expect(sheet.note).not.toContain("chooses");
    }
  });
});

describe("a stage's damage to a questing character, with Wormsbane's host among them (19141:B:1)", () => {
  const pursuit = (seats: 1 | 2, damage: number): { t: Table; run: Run } => {
    const t = gundabadTable(world, { seats, phase: "Quest", stage: "19141", committed: 2, attached: [{ code: CODES.wormsbane }], questDeck: [] });
    const state = updateCard(t.state, t.hero, { damage });
    let run = send(start(state), { type: "Pass" }, t.ctx);
    for (let guard = 0; guard < 20 && run.state.mode !== "resolution" && run.state.window?.kind !== "choose"; guard += 1) {
      const pass = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass");
      if (!pass) break;
      run = send(run, pass as never, t.ctx);
    }
    return { t, run };
  };

  it("leads Player N two-handed with no \"chooses\", and has no lead solo; a hero that survives has no caution", () => {
    for (const [seats, lead] of [[1, ""], [2, "Player 1: "]] as const) {
      const { t, run } = pursuit(seats, 0);
      const sheet = sheetOf(t, run.state);
      expect(sheet.note).toBe(`${lead}${lead ? "choose" : "Choose"} a questing character you control to deal 2 damage to.`);
      expect(sheet.note).not.toContain("chooses");
      expect(cautions(sheet)).toEqual([undefined, undefined]);
    }
  });

  it("arms \"Tap again\" on the hero who carries Wormsbane when the damage destroys him, which loses the game, and on no other row", () => {
    const { t, run } = pursuit(1, 5);
    const sheet = sheetOf(t, run.state);
    expect(labels(sheet)).toEqual(["dh1 · 2 damage · destroyed", "dh2 · 2 damage"]);
    expect(cautions(sheet)).toEqual(["Tap again: dh1 falls and the game is lost", undefined]);
  });

  it("a hero who does not carry Wormsbane and would be destroyed is told so without losing the game", () => {
    const t = gundabadTable(world, { phase: "Quest", stage: "19141", committed: 2, questDeck: [] });
    const state = updateCard(t.state, t.hero2, { damage: 5 });
    let run = send(start(state), { type: "Pass" }, t.ctx);
    for (let guard = 0; guard < 20 && run.state.mode !== "resolution" && run.state.window?.kind !== "choose"; guard += 1) run = send(run, legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass") as never, t.ctx);
    expect(cautions(sheetOf(t, run.state))).toEqual([undefined, "Tap again: dh2 is destroyed"]);
  });
});

describe("the cards a stage looks at or searches (19134:B:1, 19137:B:2)", () => {
  it("the first player's look at the top 2 stages names the choice and what becomes of the other", () => {
    const t = gundabadTable(world, { seats: 2, phase: "Planning", questDeck: ["19137", "19142", "19139"] });
    const sheet = sheetOf(t, advanceTo(t, start(t.state), () => false).state);
    expect(sheet.note).toBe("Look at the top 2 stages of the quest deck and choose 1 to place on the bottom. The other becomes the current quest. Player 1 chooses.");
    expect(sheet.options).toHaveLength(2);
  });

  it("the Caves search names the location the players choose and what becomes of the one active now", () => {
    const t = gundabadTable(world, { phase: "Quest", stage: "19137", progress: 3, questDeck: ["19142", "19139"], caves: [CODES.lostArmory, CODES.ancientTreasury] });
    const sheet = sheetOf(t, advanceTo(t, start(settle({ ...t.state, window: null }, t.ctx, [])), () => false).state);
    expect(sheet.note).toBe("Exploring Gundabad: search the Caves deck for a location and make it the active location (the location active now returns to the staging area). The Caves deck is then shuffled.");
    expect(labels(sheet)).toEqual(["Lost Armory", "Ancient Treasury"]);
  });
});

describe("Dragon-sickness (12194:A:2)", () => {
  it("asks the first player which character, naming the treasures gathered and the threat it raises each time the character exhausts", () => {
    for (const [seats, suffix] of [[1, ""], [2, " Player 1 chooses."]] as const) {
      const t = gundabadTable(world, { seats, phase: "Quest", attached: [{ code: "12196" }, { code: "12197", to: "hero2" }] });
      const sickness = spawn(t.state, "12194", { zone: "staging" });
      const sheet = sheetOf(t, opened(t, sickness.state, "12194", "whenRevealed", sickness.id));
      expect(sheet.note).toBe(`Dragon-sickness: choose a character with 1 or more treasures attached. Dragon-sickness attaches to it, then every unguarded treasure in play is attached to that character. Each time that character exhausts, its controller raises their threat by 1 for each treasure attached to it.${suffix}`);
      expect(labels(sheet)).toEqual(["dh1", "dh2"]);
    }
  });
});

describe("the limit on the cards a player plays in a phase (19140:B:1)", () => {
  it("refuses the second card with the card that limits, the number, the player and the phase", () => {
    for (const [seats, who] of [[1, "you have"], [2, "Player 1 has"]] as const) {
      const t = gundabadTable(world, { seats, phase: "Planning", stage: "19140", questDeck: [], hand: ["filler", "c0"] });
      const [one, two] = [idOf(t.state, "filler"), idOf(t.state, "c0")];
      const played = finish(send(start(t.state), { type: "PlayCard", cardId: one, payments: [] }, t.ctx), t.ctx);
      expect(playReason(played.state, { type: "PlayCard", cardId: two, payments: [] }, t.ctx)).toBe(`Exploring Gundabad: each player plays at most 1 card each phase, and ${who} played 1 this planning phase.`);
    }
  });
});

describe("the words rules over every sheet above", () => {
  it("has no doubled colon after the lead, and no row label repeated in its note", () => {
    expect(opened_.length).toBeGreaterThan(20);
    for (const sheet of opened_) {
      expect(sheet.note, sheet.note).not.toContain("::");
      // "Player 1: Card: ..." has two leads; the lead is "Player 1, Card: ..." or "Player 1: ..." alone.
      expect(sheet.note, sheet.note).not.toMatch(/^Player \d+: [^.]*?: /);
      if (sheet.kind === "pick") for (const label of sheet.labels) expect(sheet.note, `${sheet.note} / ${label}`).not.toContain(label);
    }
  });
});
