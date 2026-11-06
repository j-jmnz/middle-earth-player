// Rules: emce.setup-the-ghost-of-framsburg, emce.boon-allies, emce.treasure, emce.campaign-pool-encounter, emce.campaign-log, emce.deep, emce.discover, rr.campaign-setup-checklist, rr.setup, rr.first-player, rr.response, rr.action, rr.limits (data/rules/entries.json); ledger lines
// 12189:A:2, 12189:B:1 to 12189:B:6.
// The campaign card of The Ghost of Framsburg (12189) dealt in a game: its Setup (hero changes, the three cards shuffled in, the Isolde and Beldis removals), its Deep rule, the Response that attaches a treasure to Fram's Shade, the Action that shuffles the discard pile, and its Resolution.
import { beforeAll, describe, expect, it } from "vitest";

import { buildStart } from "../../start.ts";
import { campaignScenario } from "../../../catalog/scenario-data.ts";
import { checklist } from "../../checklist.ts";
import { choiceSentence, consequenceSentence, resolutionView, type ResolutionView } from "../../resolution-view.ts";
import { emptyLog, type CampaignLog } from "../../log.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { reduce, startScenario, type PlayerIntent, type ReduceContext } from "../../../rules/engine/reduce.ts";
import { ignoresKeyword } from "../../../rules/families/wilderland/markers.ts";
import { openResolution, resolutionResult } from "../../../rules/setup/resolution.ts";
import { framsburgLoadout, framsburgPlan, framsburgSetupChoices, framsburgStart, framsburgWorld } from "../../../../test/scenarios/the-ghost-of-framsburg/game.ts";
import { CODES, campaign, framsburg, legalIntents } from "../../../../test/scenarios/the-ghost-of-framsburg/scene.ts";
import type { World } from "../../world.ts";

let ctx: ReduceContext;
let worldOf: World;
beforeAll(async () => {
  const made = await framsburgWorld("strong");
  ctx = made.ctx;
  worldOf = { cards: made.cards, copies: new Map() } as unknown as World;
}, 120_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const dealtScenario = campaignScenario(framsburg);
const BURDENS = [CODES.gundabadHunter, CODES.gundabadStalker];
const lines = (...allyLines: ("turayn" | "melanwar" | "isolde" | "beldis")[]): CampaignLog => ({ ...emptyLog(1), allyLines });
type Facts = Parameters<typeof framsburgStart>[3];
// The scenario dealt and its Setup played to the first round: the mulligan is kept and each question is answered with its first option.
function opened(seats: 1 | 2, seed = 1, args: { facts?: Facts; log?: CampaignLog; choices?: readonly string[] } = {}): ScenarioState {
  const log = args.log ?? emptyLog(seats);
  let state = startScenario(framsburgStart(seats, seed, "Normal", args.facts, log, undefined, args.choices), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

// The searchable cards of a Normal game, by type and uniqueness.
const encounterCodes = [...new Set(dealtScenario.cards.filter((card) => card.pile === "encounter").map((card) => card.code))];
const nonUnique = (type: string) => encounterCodes.filter((code) => ctx.cards.get(code)?.type === type && ctx.cards.get(code)?.isUnique !== true);
const inEncounterDeck = (state: ScenarioState, type: string) => Object.values(state.cards).filter((card) => ctx.cards.get(card.code)?.type === type && card.zone === "encounterDeck").length;

describe("12189:A Setup", () => {
  it("12189:A:2 Ashen Brazier, Gundabad Hunter and Gundabad Stalker are shuffled into the encounter deck", () => {
    for (const seats of [1, 2] as const) {
      const state = opened(seats);
      for (const code of [CODES.ashenBrazier, CODES.gundabadHunter, CODES.gundabadStalker]) expect(where(state, code), `${seats} seats ${code}`).toMatchObject([{ zone: "encounterDeck" }]);
    }
  });

  it("12189:A:2 the scenario's own cards are dealt: The Cursed Tomb set aside, the quest cards in the quest deck, Fram's Shade in the encounter deck", () => {
    const state = opened(1);
    expect(where(state, CODES.theCursedTomb)).toMatchObject([{ zone: "setAside" }]);
    expect(where(state, CODES.framSShade)).toMatchObject([{ zone: "encounterDeck" }]);
    // The stage 1 Setup has put a location in the staging area for the player.
    expect(state.staging.some((id) => ctx.cards.get(state.cards[id]?.code ?? "")?.type === "location")).toBe(true);
  });

  it("12189:A:2 a hero change costs no threat", () => {
    const loadout = framsburgLoadout(1);
    const other = [...ctx.cards.values()].find((card) => card.type === "hero" && !loadout[0]?.heroes.includes(card.code))?.code ?? "";
    const log = { ...emptyLog(1), heroesBySeat: [[other, ...(loadout[0]?.heroes.slice(1) ?? [])]] };
    const waived = checklist({ log, scenario: dealtScenario, seats: loadout, effects: EFFECTS, cards: ctx.cards });
    expect(waived.ok ? waived.threatModifier : -1).toBe(0);
    expect(waived.ok ? waived.steps[2]?.did.join(" ") : "").toContain("waives");
  });

  it("12189:A:2 with Isolde's line the first player removes 3 treacheries from the game", () => {
    const log = lines("isolde");
    const treacheries = [...new Set(encounterCodes.filter((code) => ctx.cards.get(code)?.type === "treachery"))];
    const asks = checklist({ log, scenario: dealtScenario, seats: framsburgLoadout(1), effects: EFFECTS, cards: ctx.cards });
    expect(!asks.ok && asks.needs?.options).toEqual(treacheries);
    const answers = framsburgSetupChoices(1, log);
    expect(answers).toHaveLength(3);
    expect(framsburgPlan(1, log, answers).removedFromEncounter).toEqual(answers);
    const state = opened(1, 1, { log, choices: answers });
    expect(inEncounterDeck(opened(1, 1), "treachery") - inEncounterDeck(state, "treachery")).toBe(3);
  });

  it("12189:A:2 with Beldis's line the first player removes 3 non-unique locations, and with both lines the treacheries come first", () => {
    const log = lines("beldis");
    const locations = nonUnique("location");
    const asks = checklist({ log, scenario: dealtScenario, seats: framsburgLoadout(1), effects: EFFECTS, cards: ctx.cards });
    expect(!asks.ok && asks.needs?.options).toEqual(locations);
    const answers = framsburgSetupChoices(1, log);
    expect(framsburgPlan(1, log, answers).removedFromEncounter).toEqual(answers);
    const state = opened(1, 1, { log, choices: answers });
    expect(inEncounterDeck(opened(1, 1), "location") - inEncounterDeck(state, "location")).toBe(3);
    const both = lines("isolde", "beldis");
    const bothAnswers = framsburgSetupChoices(1, both);
    expect(bothAnswers).toHaveLength(6);
    expect(bothAnswers.slice(0, 3).every((code) => ctx.cards.get(code)?.type === "treachery")).toBe(true);
    expect(bothAnswers.slice(3).every((code) => ctx.cards.get(code)?.type === "location" && ctx.cards.get(code)?.isUnique !== true)).toBe(true);
  });

  it("12189:A:2 without a line nothing is searched for, and Turayn's and Melanwar's lines remove nothing here", () => {
    expect(framsburgPlan(1, emptyLog(1)).removedFromEncounter).toEqual([]);
    expect(framsburgPlan(1, lines("turayn", "melanwar")).removedFromEncounter).toEqual([]);
  });

  it("12189:A:2 a standalone game has no campaign card: nothing is shuffled in, no Deep rule, nothing removed", () => {
    const start = buildStart({ campaign, scenario: framsburg, seatCount: 1, seed: 1, threatModifier: 0, seats: framsburgLoadout(1), effects: EFFECTS, mode: "standalone" });
    let state = startScenario(start, ctx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    for (const code of [CODES.ashenBrazier, CODES.gundabadHunter, CODES.gundabadStalker, CODES.campaignCard]) expect(where(state, code), code).toEqual([]);
    expect(ignoresKeyword(state, ctx, "deep")).toBe(false);
    // The three Loot objectives of the scenario are enough for The Cursed Tomb.
    expect([CODES.cryptKey, CODES.oldLantern, CODES.scathaSTeeth].every((code) => where(state, code).length === 1)).toBe(true);
  });

  it("12189:B:1 the Deep keyword is ignored while the campaign card is on the table", () => {
    const state = opened(1);
    expect(where(state, CODES.campaignCard)).toMatchObject([{ zone: "campaign" }]);
    expect(ignoresKeyword(state, ctx, "deep")).toBe(true);
    expect(ignoresKeyword(state, ctx, "discover")).toBe(false);
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
// The encounter deck and discard pile are exactly these cards (top first): every other card of either is out of the game.
function onlyEncounterCards(state: ScenarioState, piles: { deck: readonly string[]; discard: readonly string[] }): ScenarioState {
  let next = state;
  for (const id of [...state.encounterDeck, ...state.encounterDiscard]) if (!piles.deck.includes(id) && !piles.discard.includes(id)) next = moveCard(next, id, { zone: "removed" });
  for (const id of piles.discard) next = moveCard(next, id, { zone: "encounterDiscard" });
  return { ...next, encounterDeck: [...piles.deck], encounterDiscard: [...piles.discard] };
}
const codeOfOption = (state: ScenarioState, option: string): string => state.cards[option.slice(2)]?.code ?? option;

describe("12189:B Resolution", () => {
  it("12189:B:5 the first player chooses Gundabad Hunter or Gundabad Stalker for the pool", () => {
    for (const seats of [1, 2] as const) {
      const state = opened(seats);
      const first = won(state);
      expect(first.asked[0], `${seats} seats`).toMatchObject({ seat: state.firstPlayer, options: [CODES.gundabadHunter, CODES.gundabadStalker] });
      const hunter = resolutionResult(first.state);
      expect(hunter?.earned.filter((item) => (BURDENS as readonly string[]).includes(item.code)).map((item) => item.code)).toEqual([CODES.gundabadHunter]);
      const stalker = resolutionResult(won(state, (options) => options.find((option) => option === CODES.gundabadStalker) ?? options[0] ?? "").state);
      expect(stalker?.earned.map((item) => item.code)).toContain(CODES.gundabadStalker);
      expect(stalker?.earned.map((item) => item.code)).not.toContain(CODES.gundabadHunter);
    }
  });

  it("12189:B:6 the discard pile is shuffled in and cards are discarded until 2 Hazard cards are; the group chooses one of them for the pool", () => {
    const base = opened(1);
    const stalker = Object.values(base.cards).find((card) => card.code === CODES.cryptStalker)!.id;
    const spectre = Object.values(base.cards).find((card) => card.code === CODES.evilSpectre)!.id;
    const filler = Object.values(base.cards).find((card) => card.code === CODES.moonlitPassage)!.id;
    const third = Object.values(base.cards).filter((card) => card.code === CODES.evilSpectre)[1]!.id;
    // The discard pile holds the spectre, the deck the rest; the third Hazard card is not reached.
    const arranged = onlyEncounterCards(base, { deck: [stalker, filler, third], discard: [spectre] });
    const result = won(arranged, (options) => options.find((option) => codeOfOption(arranged, option) === CODES.evilSpectre) ?? options[0] ?? "");
    const hazardStep = result.asked.find((step) => step.options.every((option) => option.startsWith("e:") || option.startsWith("b:")));
    expect(hazardStep?.options.map((option) => codeOfOption(arranged, option)).sort()).toEqual([CODES.cryptStalker, CODES.evilSpectre].sort());
    expect(resolutionResult(result.state)?.encounterPool).toEqual({ [CODES.evilSpectre]: 1 });
    // Only as many cards were discarded as it took: the last card of the pile may stay in the deck.
    expect(result.state.encounterDeck.length + result.state.encounterDiscard.length).toBe(4);
  });

  it("12189:B:6 two copies of one card are one choice, and a lone Hazard card is added with no question", () => {
    const base = opened(1);
    const stalkers = Object.values(base.cards).filter((card) => card.code === CODES.cryptStalker).map((card) => card.id);
    expect(stalkers).toHaveLength(2);
    const result = won(onlyEncounterCards(base, { deck: stalkers, discard: [] }));
    expect(result.asked.filter((step) => step.options.some((option) => option.startsWith("e:")))).toEqual([]);
    expect(resolutionResult(result.state)?.encounterPool).toEqual({ [CODES.cryptStalker]: 1 });
  });

  it("12189:B:6 a burden among the Hazard cards joins the pool as a burden, an encounter card of the sets as an encounter card", () => {
    const base = opened(1);
    const hunter = where(base, CODES.gundabadHunter)[0]!.id;
    const spectre = Object.values(base.cards).find((card) => card.code === CODES.evilSpectre)!.id;
    const staged = onlyEncounterCards(base, { deck: [hunter, spectre], discard: [] });
    const options = won(staged).asked.find((step) => step.options.some((option) => option.startsWith("b:")))?.options ?? [];
    expect(options.map((option) => option.slice(0, 2)).sort()).toEqual(["b:", "e:"]);
    const burden = resolutionResult(won(staged, (all) => all.find((option) => option.startsWith("b:")) ?? all[0] ?? "").state);
    expect(burden?.earned.map((item) => item.code)).toContain(CODES.gundabadHunter);
    expect(burden?.encounterPool).toBeUndefined();
    const encounter = resolutionResult(won(staged, (all) => all.find((option) => option.startsWith("e:")) ?? all[0] ?? "").state);
    expect(encounter?.encounterPool).toEqual({ [CODES.evilSpectre]: 1 });
  });

  it("12189:B:6 the choice is told on the screen: the Hazard cards discarded, each with what choosing it writes", () => {
    const base = opened(1);
    const stalker = Object.values(base.cards).find((card) => card.code === CODES.cryptStalker)!.id;
    const spectre = Object.values(base.cards).find((card) => card.code === CODES.evilSpectre)!.id;
    const arranged = onlyEncounterCards(base, { deck: [stalker], discard: [spectre] });
    let next = openResolution({ ...arranged, stageCleared: true, window: null, stack: [] }, ctx);
    next = openResolution(expectOk(reduce(next, { type: "ChooseResolution", optionId: CODES.gundabadHunter } as PlayerIntent, ctx)).state, ctx);
    expect(next.window?.kind).toBe("resolution");
    const choosing = resolutionView(next, worldOf) as Extract<ResolutionView, { kind: "choosing" }>;
    expect(choosing.kind).toBe("choosing");
    expect(choosing.to).toBe("hazard");
    expect(choosing.eyebrow).toBe("Choose a Hazard card for the pool");
    expect(choosing.tiles.map((tile) => tile.code).sort()).toEqual([CODES.cryptStalker, CODES.evilSpectre].sort());
    expect(choiceSentence(choosing, choosing.tiles[0]!)).toContain("added to the campaign pool as an encounter card");
    expect(consequenceSentence(choosing, null, false)).toContain("Choose 1 of the 2 Hazard cards discarded");
  });

  it("12189:B:5 the first player's choice of Gundabad Hunter or Gundabad Stalker names both, says the other is not added and, two-handed, whose it is", () => {
    for (const seats of [1, 2] as const) {
      const state = opened(seats);
      const asking = openResolution({ ...state, stageCleared: true, window: null, stack: [] }, ctx);
      const view = resolutionView(asking, worldOf) as Extract<ResolutionView, { kind: "choosing" }>;
      expect(view.kind).toBe("choosing");
      expect(view.eyebrow).toBe("Choose a burden");
      expect(view.tiles.map((tile) => tile.name)).toEqual(["Gundabad Hunter", "Gundabad Stalker"]);
      expect(view.seatLabel, `${seats} seats`).toBe(seats === 1 ? null : "Player 1 (first player) chooses");
      expect(consequenceSentence(view, null, false)).toBe("Choose Gundabad Hunter or Gundabad Stalker for the campaign pool; the other is not added. It is written to the campaign log when you confirm.");
      expect(consequenceSentence(view, view.tiles[1]!, false)).toBe("Gundabad Stalker is added to the campaign pool as a burden; Gundabad Hunter is not.");
    }
  });

  it("12189:B:6 the Hazard choice names both cards, says the group decides and that the other is not added; two-handed it is the first player's", () => {
    for (const seats of [1, 2] as const) {
      const base = opened(seats);
      const stalker = Object.values(base.cards).find((card) => card.code === CODES.cryptStalker)!.id;
      const spectre = Object.values(base.cards).find((card) => card.code === CODES.evilSpectre)!.id;
      const arranged = onlyEncounterCards(base, { deck: [stalker], discard: [spectre] });
      let next = openResolution({ ...arranged, stageCleared: true, window: null, stack: [] }, ctx);
      next = openResolution(expectOk(reduce(next, { type: "ChooseResolution", optionId: CODES.gundabadHunter } as PlayerIntent, ctx)).state, ctx);
      const view = resolutionView(next, worldOf) as Extract<ResolutionView, { kind: "choosing" }>;
      expect(view.seatLabel, `${seats} seats`).toBe(seats === 1 ? null : "Player 1 (first player) chooses");
      // The shuffle of the discard pile orders the two (a seeded draw).
      expect(consequenceSentence(view, null, false)).toMatch(/^Choose 1 of the 2 Hazard cards discarded \((Evil Spectre or Crypt Stalker|Crypt Stalker or Evil Spectre)\); the group decides\. It joins the campaign pool when you confirm, and the other is not added\.$/);
    }
  });

  it("12189:B:6 a unique Hazard card is a Hazard card like any other: Fram's Shade in the encounter deck or discard pile counts toward the 2 and may be chosen, at most one copy joining the pool", () => {
    // The Resolution reads the trait and not uniqueness (emce.campaign-pool-encounter limits the copies to what one collection holds); in a win Fram's Shade is in the victory display, so it is never reached.
    const base = opened(1);
    const shade = where(base, CODES.framSShade)[0]!.id;
    const stalker = Object.values(base.cards).find((card) => card.code === CODES.cryptStalker)!.id;
    const arranged = onlyEncounterCards(base, { deck: [shade, stalker], discard: [] });
    const result = won(arranged, (options) => options.find((option) => codeOfOption(arranged, option) === CODES.framSShade) ?? options[0] ?? "");
    const hazardStep = result.asked.find((step) => step.options.every((option) => option.startsWith("e:") || option.startsWith("b:")));
    expect(hazardStep?.options.map((option) => codeOfOption(arranged, option)).sort()).toEqual([CODES.cryptStalker, CODES.framSShade].sort());
    expect(resolutionResult(result.state)?.encounterPool).toEqual({ [CODES.framSShade]: 1 });
    // A won game has Fram's Shade in the victory display, which the Resolution does not shuffle.
    const won2 = onlyEncounterCards(moveCard(base, shade, { zone: "victory" }), { deck: [stalker], discard: [] });
    expect(resolutionResult(won(won2).state)?.encounterPool).toEqual({ [CODES.cryptStalker]: 1 });
    expect(where(won(won2).state, CODES.framSShade)).toMatchObject([{ zone: "victory" }]);
  });

  it("12189:B:4 discovers the treasures the players control, and not one still guarded", () => {
    const state = opened(1);
    expect(resolutionResult(won(state).state)?.treasures).toBeUndefined();
  });
});
