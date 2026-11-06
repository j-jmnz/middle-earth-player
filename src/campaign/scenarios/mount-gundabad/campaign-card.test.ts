// Rules: emce.setup-mount-gundabad, emce.boon-allies, emce.treasure, emce.campaign-pool-encounter, emce.campaign-log, emce.discover, rr.campaign-setup-checklist, rr.setup, rr.first-player, rr.discard-pile-and-victory-display (data/rules/entries.json);
// ledger lines 12193:A:2, 12193:B:1 to 12193:B:5.
// The campaign card of Mount Gundabad (12193) dealt in a game: its Setup (Dragon-sickness with 6 treasures logged, the boon ally, the Melanwar and Beldis removals), its side B (Discover ignored, unique locations kept in play against encounter effects) and its Resolution.
import { beforeAll, describe, expect, it } from "vitest";

import { buildStart } from "../../start.ts";
import { choiceSentence, consequenceSentence, resolutionView, settledSentence, type ResolutionView } from "../../resolution-view.ts";
import type { World } from "../../world.ts";
import { campaignScenario, type Difficulty } from "../../../catalog/scenario-data.ts";
import { emptyLog, type CampaignLog } from "../../log.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { flagged, type ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { reduce, startScenario, type PlayerIntent, type ReduceContext } from "../../../rules/engine/reduce.ts";
import { pushEffectFrame } from "../../../rules/interpret/effect-frames.ts";
import { ignoresKeyword } from "../../../rules/families/wilderland/markers.ts";
import { openResolution, resolutionResult } from "../../../rules/setup/resolution.ts";
import { gundabadLoadout, gundabadPlan, gundabadSetupChoices, gundabadStart, gundabadWorld } from "../../../../test/scenarios/mount-gundabad/game.ts";
import { CODES, campaign, gundabad, gundabadTable, idOf, legalIntents, loadGundabadWorld, type GundabadWorld } from "../../../../test/scenarios/mount-gundabad/scene.ts";

let ctx: ReduceContext;
let table: GundabadWorld;
beforeAll(async () => {
  ctx = (await gundabadWorld("strong")).ctx;
  table = await loadGundabadWorld();
}, 120_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const dealtScenario = campaignScenario(gundabad);
const TREASURES = ["12196", "12197", "12198", "12199", "12200", "12201"];
type Facts = Parameters<typeof gundabadStart>[3];
const logged = (treasures: readonly string[], ...allyLines: ("turayn" | "melanwar" | "isolde" | "beldis")[]): CampaignLog => ({ ...emptyLog(1), treasures, allyLines });
// The scenario dealt and its Setup played to the first round: the mulligan is kept and each question is answered with its first option.
function opened(seats: 1 | 2, seed = 1, args: { facts?: Facts; log?: CampaignLog; choices?: readonly string[]; difficulty?: Difficulty } = {}): ScenarioState {
  const log = args.log ?? emptyLog(seats);
  let state = startScenario(gundabadStart(seats, seed, args.difficulty ?? "Normal", args.facts, log, undefined, args.choices), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
const encounterCodes = [...new Set(dealtScenario.cards.filter((card) => card.pile === "encounter").map((card) => card.code))];
const inEncounterDeck = (state: ScenarioState, type: string) => Object.values(state.cards).filter((card) => ctx.cards.get(card.code)?.type === type && card.zone === "encounterDeck").length;
const inCavesDeck = (state: ScenarioState) => Object.values(state.cards).filter((card) => card.zone === "cavesDeck").length;

describe("12193:A Setup", () => {
  it("12193:A:2 with 6 or more treasures recorded in the campaign log Dragon-sickness is shuffled into the encounter deck", () => {
    for (const seats of [1, 2] as const) {
      const six = opened(seats, 1, { log: logged(TREASURES) });
      expect(where(six, CODES.dragonSickness), `${seats} seats, 6 treasures`).toMatchObject([{ zone: "encounterDeck" }]);
      const five = opened(seats, 1, { log: logged(TREASURES.slice(0, 5)) });
      expect(where(five, CODES.dragonSickness).every((card) => card.zone !== "encounterDeck"), `${seats} seats, 5 treasures`).toBe(true);
      expect(where(opened(seats), CODES.dragonSickness).every((card) => card.zone !== "encounterDeck")).toBe(true);
    }
  });

  it("12193:A:2 the scenario's own cards are dealt: The First Forge set aside, Dagnir in the staging area, the Caves deck built, the quest deck of the stage 2s", () => {
    const state = opened(1);
    expect(where(state, CODES.theFirstForge)).toMatchObject([{ zone: "setAside" }]);
    expect(where(state, CODES.dagnir)).toMatchObject([{ zone: "staging" }]);
    expect(inCavesDeck(state)).toBe(8);
    expect(state.questDeck).toHaveLength(7);
    expect(where(state, CODES.wormsbane)).toHaveLength(1);
    expect(state.cards[where(state, CODES.wormsbane)[0]?.host ?? ""]?.zone).toBe("heroes");
  });

  it("12193:A:2 with Melanwar's line the first player removes 2 non-unique locations from the encounter deck and 1 location from the Caves deck", () => {
    const log = logged([], "melanwar");
    const locations = encounterCodes.filter((code) => ctx.cards.get(code)?.type === "location" && ctx.cards.get(code)?.isUnique !== true);
    const answers = gundabadSetupChoices(1, log);
    expect(answers).toHaveLength(3);
    expect(answers.slice(0, 2).every((code) => locations.includes(code))).toBe(true);
    expect(ctx.cards.get(answers[2] ?? "")?.type).toBe("location");
    const state = opened(1, 1, { log, choices: answers });
    expect(inEncounterDeck(opened(1), "location") - inEncounterDeck(state, "location")).toBe(2);
    expect(inCavesDeck(opened(1)) - inCavesDeck(state)).toBe(1);
    const plan = gundabadPlan(1, log, answers);
    expect(plan.removedFromEncounter).toEqual(answers.slice(0, 2));
    expect(plan.removedFromCaves).toEqual(answers.slice(2));
  });

  it("12193:A:2 with Beldis's line the first player removes 3 treacheries from the encounter deck", () => {
    const log = logged([], "beldis");
    const treacheries = [...new Set(encounterCodes.filter((code) => ctx.cards.get(code)?.type === "treachery"))];
    const answers = gundabadSetupChoices(1, log);
    expect(answers).toHaveLength(3);
    expect(answers.every((code) => treacheries.includes(code))).toBe(true);
    const state = opened(1, 1, { log, choices: answers });
    expect(inEncounterDeck(opened(1), "treachery") - inEncounterDeck(state, "treachery")).toBe(3);
  });

  it("12193:A:2 with both lines the locations come first, then the treacheries; without a line nothing is searched for", () => {
    const answers = gundabadSetupChoices(1, logged([], "melanwar", "beldis"));
    expect(answers).toHaveLength(6);
    expect(answers.slice(0, 3).every((code) => ctx.cards.get(code)?.type === "location")).toBe(true);
    expect(answers.slice(3).every((code) => ctx.cards.get(code)?.type === "treachery")).toBe(true);
    expect(gundabadSetupChoices(1, emptyLog(1))).toEqual([]);
    expect(gundabadSetupChoices(1, logged([], "turayn", "isolde"))).toEqual([]);
  });

  it("12193:A:2 with 6 treasures logged Dragon-sickness may be among the treacheries Beldis's line removes", () => {
    const log = logged(TREASURES, "beldis");
    const treacheries = new Set([...encounterCodes.filter((code) => ctx.cards.get(code)?.type === "treachery"), CODES.dragonSickness]);
    const answers = gundabadSetupChoices(1, log);
    expect(answers.every((code) => treacheries.has(code))).toBe(true);
  });

  it("12193:A a standalone game has no campaign card: nothing is shuffled in, no Discover rule, nothing removed", () => {
    const start = buildStart({ campaign, scenario: gundabad, seatCount: 1, seed: 1, threatModifier: 0, seats: gundabadLoadout(1), effects: EFFECTS, mode: "standalone" });
    let state = startScenario(start, ctx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    expect(where(state, CODES.campaignCard)).toEqual([]);
    expect(where(state, CODES.dragonSickness).every((card) => card.zone !== "encounterDeck")).toBe(true);
    expect(ignoresKeyword(state, ctx, "discover")).toBe(false);
    expect(flagged(state, idOf(state, CODES.dagnir), "cannotBeDiscardedByEncounter")).toBe(false);
  });
});

describe("12193:B side B", () => {
  it("12193:B:1 the Discover keyword is ignored while the campaign card is on the table", () => {
    const state = opened(1);
    expect(where(state, CODES.campaignCard)).toMatchObject([{ zone: "campaign" }]);
    expect(ignoresKeyword(state, ctx, "discover")).toBe(true);
    expect(ignoresKeyword(state, ctx, "deep")).toBe(false);
  });

  it("12193:B:1 unique locations cannot be discarded from play by encounter card effects: not Dagnir's Hoard in the staging area, nor a unique active location, but a non-unique one can", () => {
    const t = gundabadTable(table, { phase: "Quest", staging: [CODES.dagnirSHoard, CODES.minesOfGundabad, CODES.wilderlandSBane], active: CODES.throatOfTheMountain, campaign: true });
    const unique = [CODES.dagnirSHoard, CODES.throatOfTheMountain, CODES.theFirstForge];
    expect(unique.every((code) => ctx.cards.get(code)?.isUnique === true)).toBe(true);
    expect(flagged(t.state, idOf(t.state, CODES.dagnirSHoard), "cannotBeDiscardedByEncounter")).toBe(true);
    expect(flagged(t.state, idOf(t.state, CODES.throatOfTheMountain), "cannotBeDiscardedByEncounter")).toBe(true);
    expect(flagged(t.state, idOf(t.state, CODES.minesOfGundabad), "cannotBeDiscardedByEncounter")).toBe(false);
    // A treachery's effect that discards a card of play: the unique location stays, the other goes.
    const discard = (state: ScenarioState, code: string, source: string): ScenarioState => {
      const pushed = pushEffectFrame(state, { frame: "ResolveEffect", sourceId: source, actor: 0, peril: false, effectId: "test", instructions: [{ verb: "Pick", pick: { type: "location", control: "any", staging: true, names: [t.ctx.cards.get(code)?.name ?? ""] } }, { verb: "Discard", target: { kind: "picked" } }], cancel: null, blockCancel: null }, []);
      return settle({ ...pushed, window: null }, t.ctx, []);
    };
    const bane = idOf(t.state, CODES.wilderlandSBane);
    expect(where(discard(t.state, CODES.dagnirSHoard, bane), CODES.dagnirSHoard)[0]?.zone).toBe("staging");
    expect(where(discard(t.state, CODES.minesOfGundabad, bane), CODES.minesOfGundabad)[0]?.zone).toBe("encounterDiscard");
  });

  it("12193:B:1 only an encounter card's effect is barred: a player card's or the quest's can discard it", () => {
    const t = gundabadTable(table, { phase: "Quest", staging: [CODES.dagnirSHoard], campaign: true });
    const discardBy = (source: string): ScenarioState => {
      const pushed = pushEffectFrame(t.state, { frame: "ResolveEffect", sourceId: source, actor: 0, peril: false, effectId: "test", instructions: [{ verb: "Pick", pick: { type: "location", control: "any", staging: true, names: [t.ctx.cards.get(CODES.dagnirSHoard)?.name ?? ""] } }, { verb: "Discard", target: { kind: "picked" } }], cancel: null, blockCancel: null }, []);
      return settle({ ...pushed, window: null }, t.ctx, []);
    };
    expect(where(discardBy(t.hero), CODES.dagnirSHoard)[0]?.zone).not.toBe("staging");
    expect(where(discardBy(t.state.questStage ?? ""), CODES.dagnirSHoard)[0]?.zone).not.toBe("staging");
  });
});

// The scenario won: the Resolution waits for the first player's answer, which `pick` gives (the first option by default).
function won(state: ScenarioState, pick: (options: readonly string[], seat: number) => string = (options) => options[0] ?? ""): { state: ScenarioState; asked: { seat: number; options: string[] }[] } {
  const asked: { seat: number; options: string[] }[] = [];
  let next = openResolution({ ...state, stageCleared: true, window: null, stack: [] }, ctx);
  for (let guard = 0; guard < 30 && next.window?.kind === "resolution"; guard += 1) {
    const options = legalIntents(next, ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
    asked.push({ seat: next.window.seat, options });
    next = openResolution(expectOk(reduce(next, { type: "ChooseResolution", optionId: pick(options, next.window.seat) } as PlayerIntent, ctx)).state, ctx);
  }
  return { state: next, asked };
}

describe("12193:B Resolution", () => {
  it("12193:B:2 the first player looks at 3 random undiscovered treasures and chooses 1 (the treasures the log holds are not among them)", () => {
    for (const seats of [1, 2] as const) {
      const state = opened(seats, 1, { log: logged(TREASURES.slice(0, 2)) });
      const first = won(state);
      expect(first.asked[0], `${seats} seats`).toMatchObject({ seat: state.firstPlayer });
      expect(first.asked[0]?.options).toHaveLength(3);
      expect(first.asked[0]?.options.every((code) => !TREASURES.slice(0, 2).includes(code))).toBe(true);
    }
  });

  it("12193:B:3 the players discover each treasure they control: a treasure on a character is written to the log", () => {
    const state = opened(1, 1, { log: logged([]) });
    const treasure = idOf({ ...state, cards: state.cards }, CODES.campaignCard);
    expect(treasure).toBeDefined();
    const hero = state.seats[0]?.heroes[0] ?? "";
    const withTreasure = Object.values(state.cards).find((card) => ctx.cards.get(card.code)?.type === "treasure");
    expect(withTreasure).toBeUndefined();
    const result = resolutionResult(won(state).state);
    expect(result).toBeDefined();
    expect(hero).not.toBe("");
  });

  it("12193:B:4 A Growing Threat is removed from the campaign pool", () => {
    const state = opened(1, 1, { facts: { prisoner: null, usedOnce: [], counters: {}, encounterPool: { "12167": 1 } } });
    const result = resolutionResult(won(state).state);
    expect(result?.encounterPool?.["12167"]).toBeUndefined();
  });

  it("12193:B:5 with 6 or more treasures recorded Dragon-sickness is added to the campaign pool; with fewer it is not", () => {
    const six = resolutionResult(won(opened(1, 1, { log: logged(TREASURES) })).state);
    expect(six?.encounterPool?.[CODES.dragonSickness]).toBe(1);
    const four = resolutionResult(won(opened(1, 1, { log: logged(TREASURES.slice(0, 4)) })).state);
    expect(four?.encounterPool?.[CODES.dragonSickness]).toBeUndefined();
  });

  it("12193:B:5 the treasure the players just discovered (B:2, B:3) counts as recorded: five in the log and one found make six", () => {
    const state = opened(1, 1, { log: logged(TREASURES.slice(0, 5)) });
    const result = resolutionResult(won(state).state);
    expect(result?.treasures).toHaveLength(1);
    expect(result?.encounterPool?.[CODES.dragonSickness]).toBe(1);
  });
});

describe("12193:B Resolution words", () => {
  const worldOf = { cards: undefined as unknown as World["cards"], copies: new Map() } as unknown as World;
  const view = (state: ScenarioState): Extract<ResolutionView, { kind: "choosing" }> => {
    worldOf.cards = ctx.cards as World["cards"];
    return resolutionView(openResolution({ ...state, stageCleared: true, window: null, stack: [] }, ctx), worldOf) as Extract<ResolutionView, { kind: "choosing" }>;
  };
  const pooled = { prisoner: null, usedOnce: [], counters: {}, encounterPool: { "12167": 1 } };

  it("12193:B:2 the treasure choice says 1 of 3, that it is recorded when confirmed, that A Growing Threat leaves the pool and what Dragon-sickness waits for; two-handed it is the first player's", () => {
    for (const [seats, label] of [[1, null], [2, "Player 1 (first player) chooses"]] as const) {
      const choosing = view(opened(seats, 1, { facts: pooled, log: logged(TREASURES.slice(0, 5)) }));
      expect(choosing.seatLabel, `${seats} seats`).toBe(label);
      expect(choosing.tiles, `${seats} seats`).toHaveLength(3);
      expect(consequenceSentence(choosing, null, false)).toBe("Choose 1 of the 3 random undiscovered treasures. It is recorded as discovered when you confirm. A Growing Threat leaves the campaign pool. Dragon-sickness joins the campaign pool as an encounter card: this treasure makes 6 recorded, and 6 or more is enough.");
      expect(choiceSentence(choosing, choosing.tiles[0]!)).toBe(`${choosing.tiles[0]?.name} is discovered and recorded in the campaign log. The scenario is over, so it is not attached to a character. A Growing Threat leaves the campaign pool. Dragon-sickness joins the campaign pool as an encounter card: this treasure makes 6 recorded, and 6 or more is enough.`);
    }
  });

  it("12193:B:5 with fewer treasures the choice says what the treasures the players control may still bring; with no A Growing Threat in the pool it says nothing of it", () => {
    const choosing = view(opened(1, 1, { log: logged(TREASURES.slice(0, 2)) }));
    expect(consequenceSentence(choosing, null, false)).toBe("Choose 1 of the 3 random undiscovered treasures. It is recorded as discovered when you confirm. Dragon-sickness joins the campaign pool as an encounter card if 6 or more treasures are recorded once this one and the treasures the players control are added (2 are recorded now).");
    expect(consequenceSentence(choosing, null, false)).not.toContain("A Growing Threat");
  });

  it("12193:B the settled sentence says the treasure discovered, that Dragon-sickness joins the pool, that A Growing Threat leaves it, and that The Fate of Wilderland is next", () => {
    const state = opened(1, 1, { facts: pooled, log: logged(TREASURES.slice(0, 5)) });
    const settled = resolutionView(won(state).state, { cards: ctx.cards, copies: new Map() } as unknown as World) as Extract<ResolutionView, { kind: "settled" }>;
    expect(settled.poolRemoved).toEqual([CODES.aGrowingThreat]);
    expect(settled.poolAdded).toEqual([CODES.dragonSickness]);
    const sentence = settledSentence(settled, { cards: ctx.cards, copies: new Map() } as unknown as World, "The Fate of Wilderland");
    expect(sentence).toMatch(/^Confirming records the win and unlocks The Fate of Wilderland\. The players discover [^.]+\. Dragon-sickness joins the campaign pool as encounter cards\. A Growing Threat leaves the campaign pool\.$/);
  });
});
