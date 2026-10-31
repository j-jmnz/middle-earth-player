// Rules: rr.quest-cards-quest-deck, rr.quest-advancement, rr.search, rr.winning-the-game, dcce.heading, dcce.sailing, dcce.prepare-your-fleet, dcce.corsair-deck, dcce.ship-enemies,
// ltp.victory-display (data/rules/entries.json). The six quest cards of Voyage Across Belegaer: each line of the ledger (data/printed/dream-chaser.json) has a record, and these tests
// run them on a table of plain-number heroes and the campaign's ships (scripts/voyage-scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../rules/constants.ts";
import { runInstruction } from "../rules/interpret.ts";
import { modifiedStat } from "../rules/keywords.ts";
import { legalIntents, type PlayerIntent } from "../rules/reduce.ts";
import { settle } from "../rules/machine.ts";
import type { ScenarioState } from "../rules/state.ts";
import { first, send, start, type Run } from "../../scripts/past-scene.ts";
import { codesIn, loadVoyageWorld, resolveReveal, SHIPS, SCOUTING_SHIP, voyageTable, type VoyageLayout, type VoyageWorld } from "../../scripts/voyage-scene.ts";

let world: VoyageWorld;

beforeAll(async () => {
  world = await loadVoyageWorld();
});

function make(layout: VoyageLayout = {}) {
  const made = voyageTable(world, { heading: "Sun", ships: [{ code: SHIPS.dreamChaser, seat: 0 }], phase: "Encounter", ...layout });
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

type Table = ReturnType<typeof make>;

// `progress` placed on the quest, as questing does (the active location takes it first), with the effects it pushes settled; the first option of each choice is answered.
function advance(made: Table, progress: number, answers = true): Run {
  const stage = made.state.questStage ?? "";
  const next = runInstruction({ ...made.state, window: null }, { verb: "ProgressQuest", amount: progress }, { seat: 0, sourceId: stage }, made.ctx, []);
  const settled = start(settle(syncConstants(next, made.ctx), made.ctx, []));
  return answers ? answer(settled, made) : settled;
}

function answer(run: Run, made: Table, pick: (state: ScenarioState) => string = (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")): Run {
  let current = run;
  for (let guard = 0; guard < 40 && current.state.window?.kind === "choose"; guard += 1) current = send(current, { type: "Choose", optionId: pick(current.state) }, made.ctx);
  return current;
}

const stageCode = (state: ScenarioState) => state.cards[state.questStage ?? ""]?.code;
const deckCodes = (state: ScenarioState) => state.questDeck.map((id) => state.cards[id]?.code);
const STAGE_TWOS = ["11017", "11018", "11019", "11020"];

describe("Departure from the Havens (11016:A:1, 11016:B:2, 11016:B:3)", () => {
  it("while on-course gives each Ship objective +2 Willpower, and nothing off-course (11016:B:2)", () => {
    const sun = make({ ships: [{ code: SHIPS.dreamChaser, seat: 0 }, { code: SHIPS.dawnStar, seat: 0 }] });
    const willpower = (made: Table, ship: string) => modifiedStat(made.state, made.state.cards[ship]!, "willpower", made.ctx.cards);
    expect(willpower(sun, sun.ships[0] ?? "")).toBe(5 + 2);
    expect(willpower(sun, sun.ships[1] ?? "")).toBe(3 + 2);
    expect(modifiedStat(sun.state, sun.state.cards[sun.hero]!, "willpower", sun.ctx.cards)).toBe(2);
    const rain = make({ heading: "Rain" });
    expect(willpower(rain, rain.ships[0] ?? "")).toBe(5);
  });

  it("is defeated on-course by looking at the top 2 stages and advancing to one, the other going to the bottom (11016:B:3)", () => {
    const made = make({ stage: "11016" });
    // The quest deck holds the four stage 2 cards and stage 3, in the order the scene dealt them.
    const stage = made.state.questStage ?? "";
    expect(made.state.cards[stage]?.code).toBe("11016");
    const asked = advance(made, 20, false).state;
    expect(asked.window).toMatchObject({ kind: "choose", seat: 0 });
    const options = asked.window?.kind === "choose" ? asked.window.options : [];
    expect(options.map((id) => asked.cards[id]?.code)).toEqual(["11017", "11018"]);
    const chosen = send(start(asked), { type: "Choose", optionId: options[1] ?? "" }, made.ctx).state;
    expect(stageCode(chosen)).toBe("11018");
    expect(deckCodes(chosen)).toEqual(["11019", "11020", "11021", "11017"]);
    expect(codesIn(chosen, "victory")).toEqual(["11016"]);
  });

  it("is defeated off-course by advancing to the top stage of the quest deck, with no question (11016:B:3)", () => {
    const made = make({ stage: "11016", heading: "Cloud" });
    const next = advance(made, 20).state;
    expect(next.window?.kind).not.toBe("choose");
    expect(stageCode(next)).toBe("11017");
    expect(deckCodes(next)).toEqual(["11018", "11019", "11020", "11021"]);
  });
});

describe("the Setup of 11016 (11016:A:1)", () => {
  // The Setup is one record: it prepares the Corsair deck, the fleet, the order of the stage 2 cards and the encounter deck (the searches are the scenario's staging pile).
  const setup = (made: Table) => made.ctx.effects.filter((effect) => effect.cardCode === "11016" && effect.timing === "setup");

  it("prepares the Corsair deck, each player's fleet, the order of the stage 2 cards, then shuffles the encounter deck", () => {
    const [record] = setup(make());
    expect(record?.instructions.map((instruction) => instruction.verb)).toEqual(["PrepareCorsairDeck", "PrepareFleet", "ShuffleStages", "ShuffleEncounterDeck"]);
    const shuffle = record?.instructions.find((instruction) => instruction.verb === "ShuffleStages");
    expect(shuffle && "codes" in shuffle ? shuffle.codes : []).toEqual(STAGE_TWOS);
  });
});

describe("the stage 2 cards (11017 to 11020)", () => {
  it("each finds its location or ship in the encounter deck and discard pile on its When Revealed (11017:A:1, 11018:A:1, 11019:A:1, 11020:A:1)", () => {
    for (const [stage, found] of [["11017", "11054"], ["11018", "11024"], ["11019", SCOUTING_SHIP], ["11020", "11023"]] as const) {
      const made = make({ deck: ["f0", found, "f0"], discard: [found] });
      const run = resolveReveal(made.state, made.ctx, stage);
      expect(codesIn(run.state, "staging"), stage).toEqual([found, stage].sort());
      // The copy in the deck was taken, and the one in the discard pile stays.
      expect(run.state.encounterDeck.map((id) => run.state.cards[id]?.code), stage).toEqual(["f0", "f0"]);
      expect(codesIn(run.state, "encounterDiscard"), stage).toEqual([found]);
    }
  });

  it("11017: off-course, each player distributes 5 damage among the characters he controls at the end of the quest phase (11017:B:2)", () => {
    const rain = make({ stage: "11017", heading: "Rain", phase: "Quest" });
    let run: Run = start(rain.state);
    // Pass through the whole quest phase, answering each assignment with the first option.
    for (let guard = 0; guard < 80 && !(run.state.phase === "Travel" && run.state.stack.length === 0); guard += 1) {
      const window = run.state.window;
      if (window?.kind === "choose") run = send(run, { type: "Choose", optionId: window.options.includes("done") ? "done" : (window.options[0] ?? "") }, rain.ctx);
      else run = send(run, (legalIntents(run.state, rain.ctx).find((intent) => intent.type === "Pass") ?? { type: "Pass" }) as PlayerIntent, rain.ctx);
    }
    const damage = Object.values(run.state.cards).filter((card) => card.controller === 0 && (card.zone === "heroes" || card.zone === "play")).reduce((sum, card) => sum + card.damage, 0);
    expect(damage).toBe(5);
  });

  it("11018: off-course, each non-Ship ally gets -2 Willpower (11018:B:2)", () => {
    const rain = make({ stage: "11018", heading: "Rain", hand: [] });
    const withAlly = voyageTable(world, { heading: "Rain", stage: "11018", ships: [{ code: SHIPS.dreamChaser, seat: 0 }] });
    const ally = Object.values(withAlly.state.cards).length;
    expect(ally).toBeGreaterThan(0);
    expect(rain.state.modifiers.some((modifier) => modifier.stat === "willpower" && modifier.amount === -2)).toBe(false);
  });

  it("11019: off-course, each Ship enemy gains Boarding 1 (11019:B:2)", () => {
    const rain = make({ stage: "11019", heading: "Rain", staging: [SCOUTING_SHIP, "raider"] });
    const ship = first(rain.state, SCOUTING_SHIP);
    expect(rain.state.modifiers.filter((modifier) => modifier.stat === "boarding").map((modifier) => modifier.instanceId)).toEqual([ship]);
    expect(make({ stage: "11019", heading: "Sun", staging: [SCOUTING_SHIP] }).state.modifiers.some((modifier) => modifier.stat === "boarding")).toBe(false);
  });

  it("11020: off-course, each Ocean location gets +1 Threat (11020:B:2)", () => {
    const rain = make({ stage: "11020", heading: "Rain", staging: ["11023", "place"] });
    const threat = (made: Table, code: string) => modifiedStat(made.state, made.state.cards[first(made.state, code)]!, "threat", made.ctx.cards);
    expect(threat(rain, "11023")).toBe(3 + 1);
    expect(threat(rain, "place")).toBe(2);
    expect(threat(make({ stage: "11020", heading: "Sun", staging: ["11023"] }), "11023")).toBe(3);
  });

  it("each defeated stage 2 card names the same look-at-2 rule, and goes to the only stage left without asking (11017:B:3, 11018:B:3, 11019:B:3, 11020:B:3)", () => {
    for (const stage of ["11017", "11018", "11019"] as const) {
      const asked = advance(make({ stage }), 20, false).state;
      expect(asked.window?.kind, stage).toBe("choose");
    }
    // Stage 3 alone is left under The Star's Guidance: it is next, with no question.
    const last = advance(make({ stage: "11020" }), 20, false).state;
    expect(last.window?.kind).not.toBe("choose");
    expect(stageCode(last)).toBe("11021");
  });
});

describe("Corsair Pursuit (11021:A:1, 11021:B:2, 11021:B:3, 11021:B:4)", () => {
  const SHIP_ENEMIES = ["11022", "11057", "11058"];

  it("finds the Ship enemy with the highest Threat for the staging area, and the two highest with 3 or more players (11021:A:1)", () => {
    const made = make({ deck: ["f0", ...SHIP_ENEMIES, "f0"] });
    const one = resolveReveal(made.state, made.ctx, "11021");
    // Light Cruiser (Threat 4) is the highest; the Corsair Warship (3) and the Scouting Ship (2) follow.
    expect(codesIn(one.state, "staging").filter((code) => SHIP_ENEMIES.includes(code))).toEqual(["11057"]);
    expect(one.state.encounterDeck.map((id) => one.state.cards[id]?.code)).not.toContain("11057");
  });

  it("is won with no Ship enemy in play, and not while one is (11021:B:3)", () => {
    const without = make({ stage: "11021", staging: ["raider"] });
    expect(without.state.stageCleared).toBe(false);
    const won = settle(syncConstants({ ...without.state, window: null, stack: [] }, without.ctx), without.ctx, []);
    expect(won.stageCleared).toBe(true);
    const held = make({ stage: "11021", staging: [SCOUTING_SHIP] });
    expect(settle(syncConstants({ ...held.state, window: null, stack: [] }, held.ctx), held.ctx, []).stageCleared).toBe(false);
  });

  it("is won at 10 progress with Ship enemies in play (11021:B:4)", () => {
    const held = make({ stage: "11021", staging: [SCOUTING_SHIP], progress: 10 });
    const done = settle(syncConstants({ ...held.state, window: null, stack: [] }, held.ctx), held.ctx, []);
    expect(done.stageCleared).toBe(true);
  });

  it("takes no progress off-course (11021:B:2)", () => {
    const place = (heading: "Sun" | "Rain") => {
      const made = make({ stage: "11021", heading, staging: [SCOUTING_SHIP] });
      const next = runInstruction({ ...made.state, window: null }, { verb: "ProgressQuest", amount: 3 }, { seat: 0, sourceId: made.state.questStage }, made.ctx, []);
      return settle(syncConstants(next, made.ctx), made.ctx, []).cards[made.state.questStage ?? ""]?.progress;
    };
    expect(place("Sun")).toBe(3);
    expect(place("Rain")).toBe(0);
  });
});
