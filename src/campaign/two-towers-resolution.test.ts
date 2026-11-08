import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { recordInstructions } from "../catalog/scenario-data.ts";
import type { CampaignFacts } from "../rules/core/campaign-state.ts";
import type { PrintedCard } from "../rules/core/printed.ts";
import { legalIntents, reduce } from "../rules/engine/reduce.ts";
import { holds } from "../rules/interpret/conditions.ts";
import { openResolution, resolutionResult } from "../rules/setup/resolution.ts";
import type { ScenarioState } from "../rules/core/state.ts";
import { spawn } from "../rules/core/zones.ts";
import { holdCaptive } from "../rules/families/uruk/captive.ts";
import { loadPrinted } from "../../test/harness/catalog.ts";
import { loadWorld, table, type World as SceneWorld } from "../../test/scenarios/a-shadow-of-the-past/scene.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";

import { applyResolution as writeLog, emptyLog } from "./log.ts";
import { twoTowersFacts } from "./log-two-towers.ts";
import { choiceSentence, resolutionView, settledSentence } from "./resolution-view.ts";
import type { World } from "./world.ts";
import { NO_COPY_LIMITS } from "./wilderland.ts";

// Rules: mec112.campaign-mode-aragorn, rr.campaign-cards, rr.campaign-pool, rr.fellowship-of-heroes (data/rules/entries.json). The Resolution verbs of The Two Towers' six campaign cards, run against their real
// records on a small table: the pursuit gate, a choice between named options, Beyond All Hope and the heroes a player removes, the copies a player holds, the hands, the threat penalty and The Searching Eye,
// the copies chosen at Setup and the enemies under The Black Gate, and what the log writes from each. No scenario of the box is playable, so the table is the Fellowship's with the log's hero lists in its facts.
const HEROES = ["01001", "01011", "01012", "01013"];
const [ARAGORN, GLORFINDEL, BERAVOR, ELROND] = HEROES as [string, string, string, string];
const THEODRED = "01002";
const BOONS = ["143015", "143016", "143017", "143018"];
const HOPE = "143019";
const PALANTIR = "143020";
const COUNSELS = "143021";
const VOICE = "143068";
const BRACE = "144014";
const EYE = "144015";
const GATE = "144027";
const HARAD = "144040";
const CARDS = [...HEROES, THEODRED, "143022", ...BOONS, HOPE, PALANTIR, COUNSELS, VOICE, BRACE, EYE, GATE, HARAD, "141001", "141002", "141003"];

let scene: SceneWorld;
let cards: Map<string, PrintedCard>;
let world: World;

beforeAll(async () => {
  scene = await loadWorld();
  cards = new Map([...scene.cards, ...(await loadPrinted(CARDS))]);
  scene = { ...scene, cards };
  world = { campaign: loadCampaign("the-two-towers"), scenario: loadScenario("the-uruk-hai"), effects: EFFECTS, cards, sets: new Map() };
});

type Place = (state: ScenarioState) => ScenarioState;
const facts = (heroLog?: Omit<NonNullable<CampaignFacts["heroLog"]>, "captives">): CampaignFacts => ({ prisoner: null, usedOnce: [], counters: {}, ...(heroLog ? { heroLog: { ...heroLog, captives: [] } } : {}) });

function won(code: string, seats: 1 | 2 = 1, place: Place = (state) => state) {
  const { state, ctx } = table(scene, { seats });
  const resolving: ScenarioState = { ...place(state), phase: "Quest", window: null, stageCleared: true, resolution: recordInstructions(EFFECTS, code, "resolution") };
  return { state: openResolution(resolving, ctx), ctx };
}

const options = (state: ScenarioState, ctx: ReturnType<typeof table>["ctx"]): string[] => legalIntents(state, ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
const choose = (state: ScenarioState, ctx: ReturnType<typeof table>["ctx"], optionId: string): ScenarioState => reduce(state, { type: "ChooseResolution", optionId }, ctx).state;
const heroId = (state: ScenarioState, code: string): string => Object.values(state.cards).find((card) => card.code === code && card.zone === "heroes")?.id ?? "";

describe("143071 The Uruk-hai: the pursuit value gates the choice (mec112.pursuit)", () => {
  it("asks nothing and earns nothing with the pursuit value above 25 or no tracker", () => {
    expect(resolutionResult(won("143071", 1, (s) => ({ ...s, pursuit: 26 })).state)?.earned).toEqual([]);
    expect(resolutionResult(won("143071").state)?.earned).toEqual([]);
  });

  it("holds the `pursuit` condition only up to its maximum", () => {
    const { state, ctx } = table(scene, {});
    const scope = { actor: 0, sourceId: null, returned: 0 };
    expect(holds({ ...state, pursuit: 25 }, { kind: "pursuit", max: 25 }, scope, ctx)).toBe(true);
    expect(holds({ ...state, pursuit: 26 }, { kind: "pursuit", max: 25 }, scope, ctx)).toBe(false);
    expect(holds(state, { kind: "pursuit", max: 25 }, scope, ctx)).toBe(false);
  });
});

describe("143071 The Uruk-hai: the Skill boons (user ruling C1, 2026-11-08)", () => {
  // The table's own heroes are Hobbits, which no Skill boon fits; Théodred (a Warrior) is seat 0's and Beravor (a Ranger) seat 1's.
  const withHeroes: Place = (s) => {
    const first = spawn(s, THEODRED, { zone: "heroes", seat: 0 });
    const second = spawn(first.state, "01012", { zone: "heroes", seat: 1 });
    return { ...second.state, pursuit: 20, campaignFacts: facts({ heroes: [[ARAGORN], []], fallen: [[], []], fellowship: [] }) };
  };

  it("answers 'boons' itself when no hero has fallen, then each player takes a different Skill boon onto a hero with its trait", () => {
    const { state, ctx } = won("143071", 2, withHeroes);
    expect(state.resolutionLog.picks).toEqual([{ name: "uruk", seat: 0, option: "boons" }]);
    const theodred = heroId(state, THEODRED);
    // Théodred is a Noble Warrior: Intimidation and Leader of Men fit him, Hands of a Healer and Forewarned fit no hero of seat 0.
    expect(options(state, ctx)).toEqual([`${BOONS[0]}>${theodred}`, `${BOONS[3]}>${theodred}`]);
    const one = choose(state, ctx, `${BOONS[0]}>${theodred}`);
    // Seat 1 holds Beravor, a Ranger: Forewarned only.
    expect(options(one, ctx)).toEqual([`${BOONS[2]}>${heroId(one, "01012")}`]);
    const done = choose(one, ctx, `${BOONS[2]}>${heroId(one, "01012")}`);
    expect(resolutionResult(done)?.earned.map((item) => [item.code, item.to, item.seat, item.hero])).toEqual([
      [BOONS[0], "hero", 0, THEODRED],
      [BOONS[2], "hero", 1, "01012"],
    ]);
  });

  it("rescues each Captive first (143070:A:1): a seat whose only Warrior is its Captive is offered Intimidation on that hero", () => {
    const { state, ctx } = won("143071", 1, (s) => {
      const hero = spawn(s, THEODRED, { zone: "heroes", seat: 0 });
      const host = spawn(hero.state, "143022", { zone: "staging" });
      const held = holdCaptive(host.state, hero.id, host.id);
      expect(held.cards[hero.id]?.captive).toBe(true);
      return { ...held, pursuit: 20, campaignFacts: facts({ heroes: [[ARAGORN]], fallen: [[]], fellowship: [] }) };
    });
    const theodred = heroId(state, THEODRED);
    expect(theodred).not.toBe("");
    expect(state.cards[theodred]).toMatchObject({ zone: "heroes", controller: 0, face: "up" });
    expect(state.cards[theodred]?.captive).toBeUndefined();
    expect(state.seats[0].heroes).toContain(theodred);
    expect(options(state, ctx)).toEqual([`${BOONS[0]}>${theodred}`, `${BOONS[3]}>${theodred}`]);
  });

  it("offers a seat none of them when no hero it controls has a Skill's trait", () => {
    const { state, ctx } = won("143071", 1, (s) => ({ ...s, pursuit: 20, campaignFacts: facts({ heroes: [[ARAGORN]], fallen: [[]], fellowship: [] }) }));
    expect(options(state, ctx)).toEqual([]);
    expect(resolutionResult(state)?.earned).toEqual([]);
  });
});

describe("143071 The Uruk-hai: Beyond All Hope", () => {
  const listed = [GLORFINDEL, BERAVOR, ELROND];
  const start = (fellowship: readonly string[] = []) => won("143071", 1, (s) => ({ ...s, pursuit: 25, campaignFacts: facts({ heroes: [listed], fallen: [[ARAGORN]], fellowship }) }));

  it("offers the boons or Beyond All Hope while a hero is on the fallen list", () => {
    const { state, ctx } = start();
    expect(options(state, ctx)).toEqual(["boons", "hope"]);
  });

  it("brings the chosen fallen hero back for the player, earns the boon on him and has the player remove a hero over three", () => {
    const { state, ctx } = start();
    const asked = choose(state, ctx, "hope");
    expect(options(asked, ctx)).toEqual([`0:${ARAGORN}`]);
    const revived = choose(asked, ctx, `0:${ARAGORN}`);
    expect(revived.resolutionLog.revived).toEqual([{ seat: 0, hero: ARAGORN }]);
    expect(revived.resolutionLog.earned.map((item) => [item.code, item.to, item.hero])).toEqual([[HOPE, "hero", ARAGORN]]);
    // Four non-Fellowship heroes are listed now: the player removes one.
    expect(options(revived, ctx).sort()).toEqual([ARAGORN, BERAVOR, ELROND, GLORFINDEL].sort());
    const trimmed = choose(revived, ctx, ELROND);
    expect(trimmed.resolutionLog.removedHeroes).toEqual([{ seat: 0, hero: ELROND }]);
    expect(resolutionResult(trimmed)).not.toBeNull();
  });

  it("never counts or removes a Fellowship hero", () => {
    const { state, ctx } = won("143071", 1, (s) => ({ ...s, pursuit: 25, campaignFacts: facts({ heroes: [[...listed, "141001"]], fallen: [[ARAGORN]], fellowship: ["141001"] }) }));
    const revived = choose(choose(state, ctx, "hope"), ctx, `0:${ARAGORN}`);
    expect(options(revived, ctx)).not.toContain("141001");
  });

  it("writes the log: the hero leaves the fallen list and joins the heroes, the boon is attached, the removed hero is gone", () => {
    const { state, ctx } = start();
    const done = choose(choose(choose(state, ctx, "hope"), ctx, `0:${ARAGORN}`), ctx, ELROND);
    const log = writeLog({ ...emptyLog(1), heroesBySeat: [listed], fallenHeroesBySeat: [[ARAGORN]] }, done.scenarioId, done, cards, NO_COPY_LIMITS);
    expect(log.heroesBySeat).toEqual([[GLORFINDEL, BERAVOR, ARAGORN]]);
    expect(log.fallenHeroesBySeat).toEqual([[]]);
    expect(log.campaignPool.map((card) => [card.code, card.attachedTo])).toEqual([[HOPE, ARAGORN]]);
  });

  describe("a hero destroyed in this game", () => {
    // Theodred is on the log and in the discard pile: the player controls Glorfindel, Beravor and the revived Aragorn, three heroes.
    const destroyed = () => won("143071", 1, (s) => spawn({ ...s, pursuit: 25, campaignFacts: facts({ heroes: [["141001", GLORFINDEL, BERAVOR, THEODRED]], fallen: [[ARAGORN]], fellowship: ["141001"] }) }, THEODRED, { zone: "discard", seat: 0 }).state);

    it("is not counted by the trim, so no hero is asked to be removed", () => {
      const { state, ctx } = destroyed();
      const revived = choose(choose(state, ctx, "hope"), ctx, `0:${ARAGORN}`);
      expect(revived.resolutionLog.removedHeroes).toBeUndefined();
      expect(options(revived, ctx)).toEqual([]);
      expect(resolutionResult(revived)).not.toBeNull();
    });

    it("is recorded as fallen on the log, even when the player removed him", () => {
      const { state, ctx } = destroyed();
      const revived = choose(choose(state, ctx, "hope"), ctx, `0:${ARAGORN}`);
      const before = { ...emptyLog(1), heroesBySeat: [["141001", GLORFINDEL, BERAVOR, THEODRED]], fallenHeroesBySeat: [[ARAGORN]] };
      const kept = writeLog(before, revived.scenarioId, revived, cards, NO_COPY_LIMITS);
      expect(kept.fallenHeroesBySeat).toEqual([[THEODRED]]);
      const removed = { ...revived, resolutionLog: { ...revived.resolutionLog, removedHeroes: [{ seat: 0, hero: THEODRED }] } };
      const gone = writeLog(before, removed.scenarioId, removed, cards, NO_COPY_LIMITS);
      expect(gone.heroesBySeat[0]).not.toContain(THEODRED);
      expect(gone.fallenHeroesBySeat).toEqual([[THEODRED]]);
    });
  });

  it("is told on the resolution screen: the options, then the hero for the player, then the hero removed", () => {
    const { state } = start();
    const asking = resolutionView(state, world);
    expect(asking).toMatchObject({ kind: "choosing", to: "option" });
    expect(asking.kind === "choosing" && asking.tiles.map((tile) => tile.optionId)).toEqual(["boons", "hope"]);
    const { ctx } = start();
    const reviving = resolutionView(choose(state, ctx, "hope"), world);
    expect(reviving.kind === "choosing" && reviving.tiles.map((tile) => [tile.code, tile.label])).toEqual([[ARAGORN, "Aragorn"]]);
    const trimming = resolutionView(choose(choose(state, ctx, "hope"), ctx, `0:${ARAGORN}`), world);
    expect(trimming.kind === "choosing" && trimming.eyebrow).toBe("Remove a hero from the campaign log");
    const settled = resolutionView(choose(choose(choose(state, ctx, "hope"), ctx, `0:${ARAGORN}`), ctx, ELROND), world);
    expect(settled.kind === "settled" && settledSentence(settled, world, null)).toContain("is removed from the campaign log");
  });
});

describe("143077 Helm's Deep: the copies of Poisoned Counsels held", () => {
  it("earns the burden for each player with a copy in the hand, the deck or the discard pile, to be shuffled into their deck after the starting hand", () => {
    const place: Place = (s) => {
      const held = spawn(s, COUNSELS, { zone: "hand", seat: 0 });
      return spawn(held.state, COUNSELS, { zone: "discard", seat: 1 }).state;
    };
    const earned = resolutionResult(won("143077", 2, place).state)?.earned ?? [];
    expect(earned.map((item) => [item.code, item.seat, item.afterHand])).toEqual([[COUNSELS, 0, true], [COUNSELS, 1, true]]);
    expect(resolutionResult(won("143077", 2, (s) => spawn(s, COUNSELS, { zone: "deck", seat: 1 }).state).state)?.earned.map((item) => item.seat)).toEqual([1]);
    expect(resolutionResult(won("143077", 2).state)?.earned).toEqual([]);
  });
});

describe("143081 The Road to Isengard: the hands", () => {
  const hand = (size: number): Place => (s) => {
    let next = s;
    for (let at = 0; at < size; at += 1) next = spawn(next, "141001", { zone: "hand", seat: 0 }).state;
    return next;
  };
  it("earns Saruman's Voice when a hand holds 3 or fewer and the Palantír for the first player when one holds 3 or more", () => {
    expect(resolutionResult(won("143081", 1, hand(3)).state)?.earned.map((item) => [item.code, item.seat])).toEqual([[VOICE, null], [PALANTIR, 0]]);
    expect(resolutionResult(won("143081", 1, hand(2)).state)?.earned.map((item) => item.code)).toEqual([VOICE]);
    expect(resolutionResult(won("143081", 1, hand(5)).state)?.earned.map((item) => item.code)).toEqual([PALANTIR]);
  });

  it("earns the Palantír for the first player and Saruman's Voice when the hands differ", () => {
    const { state } = won("143081", 2, (s) => {
      const bigger = hand(4)(s);
      return bigger;
    });
    expect(resolutionResult(state)?.earned.map((item) => item.code)).toEqual([VOICE, PALANTIR]);
  });
});

describe("144067 The Passage of the Marshes: the penalty or The Searching Eye", () => {
  it("asks each player in turn, then records the +2 penalty or the earned copy for each seat and writes both to the log", () => {
    const { state, ctx } = won("144067", 2);
    expect(options(state, ctx)).toEqual(["penalty", "searchingEye"]);
    const second = choose(state, ctx, "penalty");
    expect(second.window).toMatchObject({ kind: "resolution", seat: 1 });
    const done = choose(second, ctx, "searchingEye");
    const result = resolutionResult(done);
    expect(result?.threatPenalties).toEqual([{ seat: 0, amount: 2 }]);
    expect(result?.earned.map((item) => [item.code, item.seat, item.afterHand])).toEqual([[EYE, 1, true]]);
    const log = writeLog(emptyLog(2), done.scenarioId, done, cards, NO_COPY_LIMITS);
    expect(log.threatPenaltyBySeat).toEqual([2, 0]);
    expect(log.marshesChoice).toEqual(["penalty", "searchingEye"]);
    expect(log.campaignPool.map((card) => [card.code, card.seat])).toEqual([[EYE, 1]]);
  });

  it("adds a penalty to the one the log already holds and leaves a log with no choice as it was", () => {
    const { state, ctx } = won("144067", 1);
    const log = writeLog({ ...emptyLog(1), threatPenaltyBySeat: [2] }, state.scenarioId, choose(state, ctx, "penalty"), cards, NO_COPY_LIMITS);
    expect(log.threatPenaltyBySeat).toEqual([4]);
    const plain = won("143077", 1);
    const kept = writeLog(emptyLog(1), plain.state.scenarioId, plain.state, cards, NO_COPY_LIMITS);
    expect(kept.threatPenaltyBySeat).toEqual([]);
    expect(kept.marshesChoice).toEqual([]);
  });

  it("is worded on the resolution screen", () => {
    const { state, ctx } = won("144067", 1);
    const view = resolutionView(state, world);
    expect(view.kind === "choosing" && view.tiles.map((tile) => tile.label)).toEqual(["Take a permanent +2 starting threat penalty", "Earn 1 copy of The Searching Eye"]);
    if (view.kind === "choosing") expect(choiceSentence(view, view.tiles[0] ?? view.tiles[0]!)).toContain("+2");
    expect(resolutionView(choose(state, ctx, "penalty"), world).kind).toBe("settled");
  });
});

describe("the words of a true solo or two-handed choice", () => {
  const tellers = (state: ScenarioState) => {
    const view = resolutionView(state, world);
    if (view.kind !== "choosing") throw new Error("not choosing");
    return view;
  };

  it("says 'You' in true solo and names the seat two-handed, with the Searching Eye's card on its tile", () => {
    const solo = tellers(won("144067", 1).state);
    expect(solo.tiles.map((tile) => [tile.code, tile.says])).toEqual([
      [null, "You take a permanent +2 starting threat penalty, recorded in the campaign log."],
      [EYE, "You earn 1 copy of The Searching Eye, recorded in the campaign log."],
    ]);
    const two = tellers(won("144067", 2).state);
    expect(two.seatLabel).toBe("Player 1 (first player) chooses");
    expect(two.tiles.map((tile) => tile.says)).toEqual(["Player 1 takes a permanent +2 starting threat penalty, recorded in the campaign log.", "Player 1 earns 1 copy of The Searching Eye, recorded in the campaign log."]);
  });

  it("asks a first-player choice as 'Choose one option' in true solo and 'The players choose' two-handed", () => {
    const place: Place = (s) => ({ ...s, pursuit: 25, campaignFacts: facts({ heroes: [[GLORFINDEL], []], fallen: [[ARAGORN], []], fellowship: [] }) });
    const solo = tellers(won("143071", 1, place).state);
    expect(solo).toMatchObject({ eyebrow: "You choose", prompt: expect.stringMatching(/^Choose one option\./) });
    const two = tellers(won("143071", 2, place).state);
    expect(two).toMatchObject({ eyebrow: "The players choose", prompt: "The players choose one option; the first player confirms.", seatLabel: "Player 1 (first player) chooses" });
  });

  it("drops the player who takes control of the fallen hero in true solo", () => {
    const place: Place = (s) => ({ ...s, pursuit: 25, campaignFacts: facts({ heroes: [[GLORFINDEL], []], fallen: [[ARAGORN], []], fellowship: [] }) });
    const { state, ctx } = won("143071", 1, place);
    const solo = tellers(choose(state, ctx, "hope"));
    expect(solo.prompt).not.toContain("the player who takes control");
    expect(solo.prompt).toMatch(/^Choose a fallen hero\. /);
    const second = won("143071", 2, place);
    expect(tellers(choose(second.state, second.ctx, "hope")).prompt).toContain("and the player who takes control of it");
  });

  it("records The Black Gate's enemies in the campaign log, as 'count × name'", () => {
    const place: Place = (s) => {
      const gate = spawn(s, GATE, { zone: "staging" });
      return spawn(gate.state, HARAD, { zone: "under", locationId: gate.id }).state;
    };
    const view = resolutionView(won("144069", 1, place).state, world);
    expect(view.kind === "settled" && view.notes?.join(" ")).toMatch(/Under The Black Gate: 1 \u00d7 .+, recorded in the campaign log\./);
  });
});

describe("144069 Journey to the Cross-roads: the copies chosen and The Black Gate", () => {
  it("earns a copy for each seat that chose one at Setup and records the enemies under The Black Gate by code and quantity", () => {
    const place: Place = (s) => {
      const gate = spawn(s, GATE, { zone: "staging" });
      const under = (code: string) => (state: ScenarioState): ScenarioState => spawn(state, code, { zone: "under", locationId: gate.id }).state;
      return { ...under(HARAD)(under(HARAD)(gate.state)), chosenAtSetup: [{ code: BRACE, seat: 1 }] };
    };
    const done = won("144069", 2, place).state;
    const result = resolutionResult(done);
    expect(result?.earned.map((item) => [item.code, item.seat])).toEqual([[BRACE, 1]]);
    expect(result?.underneath).toEqual({ [HARAD]: 2 });
    const log = writeLog(emptyLog(2), done.scenarioId, done, cards, NO_COPY_LIMITS);
    expect(log.blackGate).toEqual({ [HARAD]: 2 });
  });
});

describe("144073 Shelob's Lair: A Heavy Burden", () => {
  it("is earned for the pool", () => {
    expect(resolutionResult(won("144073").state)?.earned.map((item) => item.code)).toEqual(["144052"]);
  });
});

describe("the log's hero lists as the game reads them", () => {
  it("are handed to a Two Towers game only, with the Fellowship heroes told apart and the captives named", () => {
    const saved = { ...emptyLog(1), heroesBySeat: [["141001", GLORFINDEL]], fallenHeroesBySeat: [[ARAGORN]], captives: [{ seat: 0, hero: GLORFINDEL }] };
    expect(twoTowersFacts(saved, "fellowship-of-the-ring", cards)).toEqual({});
    expect(twoTowersFacts(saved, "the-two-towers", cards)).toEqual({ heroLog: { heroes: [["141001", GLORFINDEL]], fallen: [[ARAGORN]], fellowship: ["141001"], captives: [{ seat: 0, hero: GLORFINDEL }] } });
  });
});
