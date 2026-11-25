// Rules: rr.immune, mec109.immune-to-player-card-effects, hob.immune-to-player-card-effects, faq.legolas-immune-location (data/rules/entries.json).
// A player card effect that names its card without a pick (the active location, each location in the staging area, the attacking enemy, progress on the
// current quest) leaves a card immune to player card effects as it is.
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "./constants.ts";
import { settle } from "../engine/machine.ts";
import { legalIntents, reduce } from "../engine/reduce.ts";
import { withMode, type ScenarioState } from "../core/state.ts";
import { fund, payFor, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { buildTable, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";

const ELEANOR = "01008";
const BIFUR = "03002";
const GIMLI = "01004";
const GUIDE = "01044";
const TRACKER = "01045";
const ELDER = "04102";
const ANCESTRAL = "03012";
const FASTRED = "17081";
// Bucklebury Ferry, The Carrock and Revenant: "Immune to player card effects."
const FERRY = "141035";
const CARROCK = "02043";
const REVENANT = "11181";
const BAG_END = "141031";

let base: Awaited<ReturnType<typeof starterBase>>;

beforeAll(async () => {
  const starter = await starterBase();
  base = { ...starter, cards: new Map([...starter.cards, ...(await loadPrinted([ELEANOR, BIFUR, GIMLI, GUIDE, TRACKER, ELDER, ANCESTRAL, FASTRED, FERRY, CARROCK, REVENANT]))]) };
});

function table(scene: Scene): Table {
  const tab = buildTable(base, { ring: "none", start: "planning", ...scene });
  return { ...tab, state: syncConstants(fund(tab.state, 0, 6), tab.ctx) };
}

// Most of these cards' lines are in no printed ledger, so the steps are read without the harness's cause check.
function step(state: ScenarioState, intent: Parameters<typeof reduce>[1], tab: Table): ScenarioState {
  const result = reduce(state, intent, tab.ctx);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

function passUntil(state: ScenarioState, tab: Table, done: (state: ScenarioState) => boolean): ScenarioState {
  let next = state;
  for (let guard = 0; guard < 10 && !done(next) && legalIntents(next, tab.ctx).some((intent) => intent.type === "Pass"); guard += 1) next = step(next, { type: "Pass" }, tab);
  return next;
}

const offered = (state: ScenarioState, tab: Table): string[] => legalIntents(state, tab.ctx).flatMap((intent) => (intent.type === "Trigger" ? [intent.effectId] : []));

function commitAndTrigger(tab: Table, code: string, effectId: string): ScenarioState {
  const id = idsOf(tab, code);
  const committed = step(tab.state, { type: "Commit", cardIds: [id] }, tab);
  expect(offered(committed, tab)).toContain(effectId);
  return step(committed, { type: "Trigger", cardId: id, effectId }, tab);
}

describe("immune cards named without a pick", () => {
  it("Lórien Guide places no progress on an immune active location (01044:A:1)", () => {
    const tab = table({ start: "quest", heroes: [{ code: ELEANOR, seat: 0 }], allies: [{ code: GUIDE, seat: 0 }], active: FERRY });
    const state = commitAndTrigger(tab, GUIDE, "01044:response:1");
    expect(state.cards[idsOf(tab, FERRY)]?.progress).toBe(0);
  });

  it("Northern Tracker skips an immune location in the staging area and places progress on the others (01045:A:1)", () => {
    const tab = table({ start: "quest", heroes: [{ code: ELEANOR, seat: 0 }], allies: [{ code: TRACKER, seat: 0 }], staging: [FERRY, BAG_END] });
    const state = commitAndTrigger(tab, TRACKER, "01045:response:1");
    expect(state.cards[idsOf(tab, FERRY)]?.progress).toBe(0);
    expect(state.cards[idsOf(tab, BAG_END)]?.progress).toBe(1);
  });

  it("Longbeard Elder places no progress on the quest while the active location is immune (04102:A:1)", () => {
    const tab = table({ start: "quest", heroes: [{ code: ELEANOR, seat: 0 }], allies: [{ code: ELDER, seat: 0 }], active: FERRY, deck: [BAG_END, "f0"] });
    const looked = passUntil(commitAndTrigger(tab, ELDER, "04102:response:1"), tab, (state) => state.window?.kind !== "look");
    expect(looked.cards[idsOf(tab, FERRY)]?.progress).toBe(0);
    expect(looked.cards[looked.questStage ?? ""]?.progress).toBe(0);
  });

  it("Ancestral Knowledge places no progress on an immune active location (03012:A:1)", () => {
    const tab = table({ heroes: [{ code: BIFUR, seat: 0 }], hand: [{ code: ANCESTRAL, seat: 0 }], active: CARROCK });
    const card = idsOf(tab, ANCESTRAL);
    const played = step(tab.state, { type: "PlayCard", cardId: card, payments: payFor(tab.state, tab.ctx, card) }, tab);
    expect(played.cards[idsOf(tab, CARROCK)]?.progress).toBe(0);
  });

  it("Fastred does not return an immune enemy to the staging area (17081:A:1)", () => {
    const tab = table({ heroes: [{ code: GIMLI, seat: 0 }], allies: [{ code: FASTRED, seat: 0 }], engaged: [{ code: REVENANT, seat: 0 }] });
    let state = passUntil(settle({ ...withMode(tab.state, "combatStart"), window: null }, tab.ctx, []), tab, (current) => current.window?.kind !== "frameAction");
    state = step(state, { type: "DeclareDefender", defenderId: idsOf(tab, FASTRED) }, tab);
    state = passUntil(state, tab, (current) => offered(current, tab).includes("17081:response:1"));
    state = step(state, { type: "Trigger", cardId: idsOf(tab, FASTRED), effectId: "17081:response:1" }, tab);
    expect(state.cards[idsOf(tab, REVENANT)]?.zone).toBe("engaged");
  });

  it("Lórien Guide still places progress on an active location that is not immune (01044:A:1)", () => {
    const tab = table({ start: "quest", heroes: [{ code: ELEANOR, seat: 0 }], allies: [{ code: GUIDE, seat: 0 }], active: BAG_END });
    expect(commitAndTrigger(tab, GUIDE, "01044:response:1").cards[idsOf(tab, BAG_END)]?.progress).toBe(1);
  });
});
