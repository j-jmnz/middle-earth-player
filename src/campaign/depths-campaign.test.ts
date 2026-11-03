// Rules: dcce.campaign-mode, dcce.campaign-setup-the-thing-in-the-depths, dcce.setup-the-thing-in-the-depths, dcce.stormcaller-and-the-thing, dcce.stormcaller-elite, dcce.scalable-upgradable, dcce.gaining-xp,
// ltp.campaign-setup-checklist (data/rules/entries.json). The Thing in the Depths in the Dream-chaser campaign: it is the fifth part, its campaign card's Setup is dealt (the Black Keys, Come Together and Sea
// Serpent set aside, The Thing in the Depths on its Campaign Mode only side), the Black Key burden and boon follow Captain Sahír, Sea Serpent and Come Together join when he flips, the previous parts' pool, XP and marks
// reach it, and a standalone game uses the base sides with none of it.
import { beforeAll, describe, expect, it } from "vitest";

import { campaignScenario } from "../catalog/scenario-data.ts";
import { expectOk } from "../rules/core/test-fixture.ts";
import { modifiedStat } from "../rules/core/keywords.ts";
import type { PrintedCard } from "../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../rules/engine/reduce.ts";
import { settle } from "../rules/engine/machine.ts";
import { attachTo, spawn } from "../rules/core/zones.ts";
import { UPGRADED_CODES, afterFlight, depthsLoadout, depthsPlan, depthsStart, depthsWorld } from "../../scripts/depths-game.ts";
import { CODES, campaign, depths, depthsTable, finish, idOf, loadDepthsWorld, resolveRecords, send, start, type DepthsWorld } from "../../scripts/depths-scene.ts";

import { buildStart } from "./start.ts";
import { EFFECTS } from "../effects/index.ts";
import { campaignPath } from "./path.ts";
import { newSave } from "./save.ts";
import { PLAYABLE_SCENARIOS } from "./playable.ts";
import { levelOf, xpFacts } from "./xp.ts";

let cards: Map<string, PrintedCard>;
let ctx: ReduceContext;
let scene: DepthsWorld;

beforeAll(async () => {
  const world = await depthsWorld("strong");
  cards = world.cards;
  ctx = world.ctx;
  scene = await loadDepthsWorld();
}, 120_000);

const codes = (state: ScenarioState, ids: readonly string[]): string[] => ids.map((id) => state.cards[id]?.code ?? "");
const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// The scenario dealt and its Setup played to the first round: every question answered with the first option.
function opened(start: ReturnType<typeof depthsStart>): ScenarioState {
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

describe("The Thing in the Depths in the Dream-chaser campaign", () => {
  it("is the fifth part of a save, playable, and the campaign card names the cards it places and the reprint it deals", () => {
    const save = newSave("depths", campaign.id, 1);
    const unlocked = { ...save.log, completed: ["voyage-across-belegaer", "the-fate-of-numenor", "raid-on-the-grey-havens", "flight-of-the-stormcaller"] };
    expect(campaignPath(campaign, {}, unlocked).map((node) => [node.id, node.status]).slice(3, 6)).toEqual([["flight-of-the-stormcaller", "completed"], ["the-thing-in-the-depths", "current"], ["temple-of-the-deceived", "locked"]]);
    expect(PLAYABLE_SCENARIOS).toContain("the-thing-in-the-depths");
    expect(depths.campaignCard).toBe("11194");
    expect([...depths.campaignPlaced].sort()).toEqual(["11183", "11192", "11195", "11196"].sort());
    expect(depths.reprints).toEqual({ "12049": "110063" });
    expect(campaignScenario(depths).cards.filter((card) => card.pile === "setAside").map((card) => card.code)).toContain("110063");
  });

  it("deals the Campaign Setup: both Black Keys, Come Together and Sea Serpent set aside, and The Thing in the Depths flipped to its Campaign Mode only side once the quest card's Setup has set it aside", () => {
    const start = depthsStart(2, 1, "Normal");
    expect(start.definition.setup.flatMap((instruction) => (instruction.verb === "SetAside" ? [instruction.code] : [])).slice(0, 4)).toEqual(["11183", "11192", "11195", "11196"]);
    expect(start.definition.afterSetup?.map((instruction) => instruction.verb)).toEqual(["FlipSetAside"]);
    expect(start.definition.part).toBe(5);
    expect(start.questDeck).toEqual(["12039", "12040", "12041"]);
    const state = opened(start);
    expect(state.setAside.map((id) => state.cards[id]?.code)).toEqual(expect.arrayContaining(["11076", "11078", "11183", "11192", "11195", "11196", "110063"]));
    expect(where(state, CODES.thing)[0]).toMatchObject({ zone: "setAside", face: "B" });
    expect(where(state, CODES.thingOriginal)).toEqual([]);
    expect(Object.values(state.cards).find((card) => card.code === CODES.campaignCard)?.zone).toBe("campaign");
    // The Thing in the Depths set waits set aside, out of play; the encounter deck is The Stormcaller and Corsair Raiders only.
    const waiting = state.setAside.map((id) => cards.get(state.cards[id]?.code ?? "")?.encounterSet);
    expect(waiting.filter((set) => set === "The Thing in the Depths")).toHaveLength(1 + 1 + 17 + 1);
    const deck = new Set(state.encounterDeck.map((id) => cards.get(state.cards[id]?.code ?? "")?.encounterSet));
    expect([...deck].sort()).toEqual(["Corsair Raiders", "The Stormcaller"]);
    expect(state.staging.map((id) => state.cards[id]?.code).sort()).toEqual([CODES.helm, CODES.umbar].sort());
  });

  it("attaches Black Key (burden) to Captain Sahír when he enters play (11194:A:2)", () => {
    const made = depthsTable(scene, { campaign: true, staging: [CODES.helm], setAside: [CODES.sahir, CODES.naasiyah, CODES.blackKey, CODES.blackKeyBurden, CODES.comeTogether, CODES.seaSerpent, CODES.thing] });
    // Helm becomes the active location: Sahír joins the staging area and engages the first player; the Forced effect of the campaign card attaches the burden.
    const entered = settle(resolveRecords(made.state, made.ctx, CODES.helm, "forced", idOf(made.state, CODES.helm)).state, made.ctx, []);
    const sahir = where(entered, CODES.sahir)[0];
    expect(sahir?.zone).toBe("engaged");
    expect(codes(entered, sahir?.attachments ?? [])).toEqual([CODES.blackKeyBurden]);
    expect(modifiedStat(entered, sahir!, "attack", made.ctx.cards)).toBe(6 + 1);
    expect(where(entered, CODES.naasiyah)[0]?.attachments).toEqual([]);
  });

  it("on his flip removes the burden from the game, attaches Black Key (boon), adds Sea Serpent to the staging area on its Menacing side and Come Together to a hand the first player names, its X plus 1 this game (11194:A:3)", () => {
    for (const seats of [1, 2] as const) {
      const made = depthsTable(scene, { seats, campaign: true, stage: "12040", setAside: [CODES.blackKey, CODES.comeTogether, CODES.seaSerpent, CODES.thing], engaged: [{ code: CODES.sahir, seat: 0, resources: 3 }, { code: CODES.naasiyah, seat: seats - 1 }] });
      const sahir = idOf(made.state, CODES.sahir);
      const burden = spawn(made.state, CODES.blackKeyBurden, { zone: "play", seat: 0 });
      const prepared = attachTo(burden.state, burden.id, sahir);
      const run = resolveRecords(prepared, made.ctx, "12040", "whenRevealed", idOf(made.state, "12040"));
      // The burden leaves the game, the boon is attached to him, Sea Serpent is in the staging area (its Menacing side), and the first player named the player.
      const after = run.state.window?.kind === "choose" ? finish(run, made.ctx) : run;
      expect(where(after.state, CODES.blackKeyBurden)[0]?.zone).toBe("removed");
      expect(codes(after.state, after.state.cards[sahir]?.attachments ?? [])).toEqual([CODES.blackKey]);
      expect(where(after.state, CODES.sahirAlly)[0]?.id).toBe(sahir);
      expect(where(after.state, CODES.seaSerpent)[0]).toMatchObject({ zone: "staging" });
      expect(where(after.state, CODES.seaSerpent)[0]?.face).not.toBe("B");
      const hand = after.state.seats.slice(0, seats).flatMap((seat, index) => seat.hand.filter((id) => after.state.cards[id]?.code === CODES.comeTogether).map(() => index));
      expect(hand, `${seats} players`).toHaveLength(1);
      expect(after.state.chosenAtSetup).toEqual([{ code: CODES.comeTogether, seat: hand[0] }]);
    }
  });

  it("never flips Captain Sahír when Helm is explored from the staging area before he enters play: the flip finds nothing, and Sea Serpent and Come Together do not join (11194:A:3, open in docs/brief.md)", () => {
    // Northern Tracker commits, and its Response places 1 progress on Helm of the Stormcaller (1 quest point) in the staging area: Helm is explored without becoming the active location, so Sahír and Na'asiyah never enter play.
    const made = depthsTable(scene, { campaign: true, stage: "12039", progress: 1, staging: [CODES.helm], play: [CODES.northernTracker], setAside: [CODES.sahir, CODES.naasiyah, CODES.blackKey, CODES.blackKeyBurden, CODES.comeTogether, CODES.seaSerpent, CODES.thing] });
    const tracker = idOf(made.state, CODES.northernTracker);
    let run = send(start(made.state), { type: "Commit", cardIds: [made.hero, tracker] }, made.ctx);
    run = finish(send(run, { type: "Trigger", cardId: tracker, effectId: "01045:response:1" }, made.ctx), made.ctx);
    expect(where(run.state, CODES.helm)[0]?.zone).toBe("victory");
    // Stage 1 has room once Helm is in the victory display: the quest fills it (1 progress and 3 Willpower for its 4 quest points), and stage 2's When Revealed flips what it can and advances to stage 3.
    for (let guard = 0; guard < 12 && run.state.cards[run.state.questStage ?? ""]?.code !== "12041" && run.state.window != null; guard += 1) run = finish(send(run, { type: "Pass" }, made.ctx), made.ctx);
    expect(run.state.cards[run.state.questStage ?? ""]?.code).toBe("12041");
    // Neither Elite card ever entered play, so nothing flipped: they stay out of play, the Black Keys stay set aside, nothing joined the staging area or a hand.
    for (const code of [CODES.sahir, CODES.naasiyah, CODES.blackKey, CODES.blackKeyBurden, CODES.comeTogether, CODES.seaSerpent]) expect(where(run.state, code)[0]?.zone, code).toBe("setAside");
    expect(where(run.state, CODES.sahirAlly)).toEqual([]);
    expect(where(run.state, CODES.naasiyahAlly)).toEqual([]);
    expect(where(run.state, CODES.thing)[0]?.zone).toBe("staging");
    expect(run.state.chosenAtSetup ?? []).toEqual([]);
  });

  it("hands the previous parts to this one: the pool (Ominous Fate) is shuffled into the encounter deck, and the log's marks reach the game as a scalable card's level and the Upgraded sides", () => {
    const log = afterFlight(1);
    const plan = depthsPlan(1, log);
    expect(plan.poolEncounterCards).toEqual([CODES.ominousFate]);
    expect(levelOf(log, "11184")).toBe(3);
    const facts = { prisoner: null, usedOnce: [], counters: {}, upgraded: UPGRADED_CODES, levels: { [CODES.comeTogether]: 2 } };
    const start = depthsStart(1, 1, "Normal", facts, log);
    expect(start.encounterDeck).toContain(CODES.ominousFate);
    const state = opened(start);
    expect(state.campaignFacts?.upgraded).toEqual(UPGRADED_CODES);
    expect(state.campaignFacts?.levels).toEqual({ [CODES.comeTogether]: 2 });
    expect(xpFacts({ marks: { [CODES.comeTogether]: 2 } }).levels).toEqual({ [CODES.comeTogether]: 2 });
    // Black Key is dealt on its Upgraded side when the log says so (the cards set aside wait facedown; the one attached to Captain Sahír shows it, below).
    expect(where(state, CODES.blackKey)[0]?.zone).toBe("setAside");
  });

  it("deals the original card in a standalone game, with no campaign card, no Campaign Setup and The Thing in the Depths on its base side", () => {
    const base = depthsStart(1, 1, "Normal");
    const start = buildStart({ campaign, scenario: depths, seatCount: 1, seed: 1, threatModifier: 0, seats: base.seats, effects: EFFECTS, mode: "standalone" });
    expect(start.definition.campaignCard).toBeUndefined();
    expect(start.definition.resolution).toEqual([]);
    expect(start.definition.afterSetup).toBeUndefined();
    const state = opened(start);
    expect(where(state, CODES.thing)).toEqual([]);
    expect(where(state, CODES.thingOriginal)[0]).toMatchObject({ zone: "setAside" });
    expect(where(state, CODES.thingOriginal)[0]?.face).not.toBe("B");
    expect(state.setAside.map((id) => state.cards[id]?.code)).not.toEqual(expect.arrayContaining([CODES.blackKey, CODES.comeTogether, CODES.seaSerpent]));
    expect(Object.values(state.cards).some((card) => card.zone === "campaign")).toBe(false);
    expect(modifiedStat(state, where(state, CODES.thingOriginal)[0]!, "hitPoints", cards)).toBe(8);
    expect(depthsLoadout(1)).toHaveLength(1);
  });
});
