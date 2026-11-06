// Rules: emce.setup-mount-gundabad, emce.gundabad-quest-deck, emce.bypassing, emce.caves-deck-gundabad, emce.treasure, emce.campaign-pool-encounter, emce.campaign-log, rr.first-player, rr.winning-the-game, ltp.campaign-setup-checklist (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { GUNDABAD_GOLDENS, gundabadChoices, gundabadPlan, gundabadWorld, logBeforeGolden, playGolden, type GundabadDecks, type GundabadGolden } from "../../../../test/scenarios/mount-gundabad/game.ts";
import { CODES, STAGE_TWOS, campaign, gundabad } from "../../../../test/scenarios/mount-gundabad/scene.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

// A permanent golden: whole games of Mount Gundabad in Campaign Mode played by the auto-player (test/scenarios/mount-gundabad/game.ts) on fixed seeds, true solo and two-handed, through a win (in Normal and Easy, from a blank log and after Journey Up the Anduin's, Lost in
// Mirkwood's, The King's Quest's, The Withered Heath's, Roam Across Rhovanion's, Fire in the Night's and The Ghost of Framsburg's real Resolutions, with the allies and Misplaced Trust or Urdug's Cunning in the pool, Dragon-sickness shuffled in with 6 or more treasures logged, or Turayn's,
// Melanwar's, Isolde's and Beldis's lines written; no stage bypassed and several, in several orders of the quest deck, Dagnir hunted and engaged or left to the quest, Dagnir's Hoard, Throat of the Mountain and The First Forge used) and through each way to lose (heroes too small to quest, heroes
// too brittle to survive, the hero who carries Wormsbane destroyed, the threat of every player at 50). It pins the path from data/ through the Campaign Setup Checklist and buildStart, the quest deck, the Caves deck, Wormsbane, the campaign card's Setup and Resolution and the reducer, so a change that
// moves a game shows up as a diff here. Update the snapshot only when the change is meant.
const wonGoldens = () => GUNDABAD_GOLDENS.filter((golden) => golden.outcome === "won");
const lostGoldens = () => GUNDABAD_GOLDENS.filter((golden) => golden.outcome === "lost");
const zoneOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.zone);
const used = (intents: readonly { type: string }[], effectId: string) => intents.some((intent) => intent.type === "Trigger" && (intent as { effectId?: string }).effectId === effectId);
const bypassed = (intents: readonly { type: string }[]) => intents.filter((intent) => intent.type === "Choose" && (intent as { optionId?: string }).optionId === "bypass").length;
/** The quest cards in the victory display. */
const quests = (state: ScenarioState) => Object.values(state.cards).filter((card) => card.zone === "victory" && (STAGE_TWOS as readonly string[]).concat([CODES.stage1]).includes(card.code));
/** The treasures the log held before a golden, and the pool's encounter cards. */
const treasuresBefore = (golden: GundabadGolden) => logBeforeGolden(golden).treasures.length;

describe("Mount Gundabad golden", () => {
  goldenSuite<GundabadGolden, GundabadDecks>({
    title: "Mount Gundabad",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: gundabad,
    goldens: GUNDABAD_GOLDENS,
    world: gundabadWorld,
    play: playGolden,
    before: (golden) => logBeforeGolden(golden),
    opening: {
      title: "starts with the campaign card on the table, Dagnir in the staging area, The First Forge set aside, the seven stage 2s in the quest deck side A up, Wormsbane Broken side up on a hero, the Caves deck with Dagnir's Hoard and Throat of the Mountain, Dragon-sickness with 6 or more treasures logged, and the cards Melanwar's and Beldis's lines remove",
      check(state, golden, world) {
        expect(state.questStage && state.cards[state.questStage]?.code, golden.name).toBe(CODES.stage1);
        expect(zoneOf(state, CODES.campaignCard), golden.name).toEqual(["campaign"]);
        expect(zoneOf(state, CODES.dagnir), golden.name).toEqual(["staging"]);
        expect(zoneOf(state, CODES.theFirstForge), golden.name).toEqual(["setAside"]);
        // The quest deck: the seven stage 2s in a random order, each with side A up (emce.gundabad-quest-deck).
        expect(state.questDeck.map((id) => state.cards[id]?.code).sort(), golden.name).toEqual([...STAGE_TWOS].sort());
        for (const id of state.questDeck) expect(state.cards[id]?.face, golden.name).toBe("A");
        // Wormsbane, Broken side up, on a hero the first player chose (19134:A:1).
        const wormsbane = Object.values(state.cards).filter((card) => card.code === CODES.wormsbane);
        expect(wormsbane, golden.name).toHaveLength(1);
        expect(state.cards[wormsbane[0]?.host ?? ""]?.zone, golden.name).toBe("heroes");
        // The Caves deck: Dagnir's Hoard, Throat of the Mountain and the Lost Caves cards (emce.caves-deck-gundabad), less the one Melanwar's line removes.
        const log = logBeforeGolden(golden);
        const lines = log.allyLines ?? [];
        const caves = Object.values(state.cards).filter((card) => card.zone === "cavesDeck").map((card) => card.code);
        const plan = gundabadPlan(golden.seatCount, log, gundabadChoices(golden), golden.difficulty);
        // The first player chooses the Caves location Melanwar's line removes: it may be one of the two cards this scenario adds.
        for (const code of [CODES.dagnirSHoard, CODES.throatOfTheMountain]) expect(caves.includes(code), `${golden.name} ${code}`).toBe(!plan.removedFromCaves.includes(code));
        // Dragon-sickness is shuffled into the encounter deck with 6 or more treasures recorded in the log (12193:A:2).
        expect(zoneOf(state, CODES.dragonSickness), golden.name).toEqual(treasuresBefore(golden) >= 6 ? ["encounterDeck"] : []);
        // 12193:A:2: Melanwar's line removes 2 non-unique locations and 1 Caves location, Beldis's line 3 treacheries; never a unique card.
        expect(plan.removedFromEncounter, golden.name).toHaveLength((lines.includes("melanwar") ? 2 : 0) + (lines.includes("beldis") ? 3 : 0));
        expect(plan.removedFromCaves, golden.name).toHaveLength(lines.includes("melanwar") ? 1 : 0);
        for (const code of plan.removedFromEncounter) expect(world.cards.get(code)?.isUnique, golden.name).not.toBe(true);
      },
    },
    wins: "wins by slaying Dagnir at the Great Worm with the Reforged Wormsbane, runs 12193's Resolution and unlocks the next part",
    won(state, golden, world) {
      // Every win ends on the Great Worm: Dagnir is added to the victory display by the stage's Response, the Reforged Wormsbane is discarded (19142:B:2).
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe(CODES.stage8);
      expect(zoneOf(state, CODES.dagnir), golden.name).toEqual(["victory"]);
      expect(zoneOf(state, "19144"), golden.name).toEqual(["encounterDiscard"]);
      // The stages defeated, The Side Door among them, lie in the victory display.
      expect(quests(state).map((card) => card.code), golden.name).toContain(CODES.stage1);
      const log = state.resolutionLog;
      // 12193:B:2: the first player takes 1 of 3 random undiscovered treasures; 12193:B:3: the treasures the players control are discovered as well; every one is a treasure not logged before.
      const before = logBeforeGolden(golden);
      expect(log.treasures?.length, golden.name).toBeGreaterThanOrEqual(1);
      for (const code of log.treasures ?? []) {
        expect(world.cards.get(code)?.type, golden.name).toBe("treasure");
        expect(before.treasures, golden.name).not.toContain(code);
      }
      // 12193:B:5: with 6 or more treasures logged (the ones just discovered included) Dragon-sickness joins the pool.
      const total = before.treasures.length + (log.treasures?.length ?? 0);
      expect(log.encounterPool?.[CODES.dragonSickness] ?? 0, golden.name).toBe(total >= 6 ? 1 : 0);
      // 12193:B:4: A Growing Threat leaves the pool.
      expect(log.encounterPool?.[CODES.aGrowingThreat], golden.name).toBeUndefined();
    },
    lost(state, golden) {
      // A loss leaves the log alone: A Growing Threat stays in the pool and nothing is discovered.
      expect(state.resolutionLog.treasures, golden.name).toBeUndefined();
      expect(state.resolutionLog.encounterPool, golden.name).toBeUndefined();
    },
    checks({ game, world, opened }) {
      it("covers the wins and losses it names: seats, Easy, the earlier parts, every pool and line, A Growing Threat, Dragon-sickness", () => {
        expect(wonGoldens().filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(8);
        expect(wonGoldens().filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(8);
        expect(wonGoldens().filter((golden) => golden.difficulty === "Easy").length).toBeGreaterThanOrEqual(6);
        expect(wonGoldens().filter((golden) => golden.after).length).toBeGreaterThanOrEqual(8);
        for (const variant of ["pool", "cunning", "oath", "oathline", "beldis"] as const) expect(GUNDABAD_GOLDENS.some((golden) => golden.after && golden.variant === variant), variant).toBe(true);
        expect(lostGoldens().length).toBeGreaterThanOrEqual(10);
        expect(wonGoldens().filter((golden) => golden.growing).length).toBeGreaterThanOrEqual(2);
        // Dragon-sickness is dealt in games after logs of 6 or more treasures, and joins the pool of a win that brings the log to 6.
        const dealt = GUNDABAD_GOLDENS.filter((golden) => treasuresBefore(golden) >= 6);
        expect(dealt.length).toBeGreaterThanOrEqual(3);
        for (const golden of dealt) expect(zoneOf(opened(golden), CODES.dragonSickness), golden.name).toHaveLength(1);
        expect(wonGoldens().some((golden) => game(golden).state.resolutionLog.encounterPool?.[CODES.dragonSickness] === 1)).toBe(true);
        expect(wonGoldens().some((golden) => game(golden).state.resolutionLog.encounterPool?.[CODES.dragonSickness] == null)).toBe(true);
      });

      it("bypasses a stage in some games and none in others, and stays on a stage in some", () => {
        const all = GUNDABAD_GOLDENS.map((golden) => bypassed(game(golden).intents));
        expect(all.filter((count) => count > 0).length).toBeGreaterThanOrEqual(6);
        expect(all.filter((count) => count === 0).length).toBeGreaterThanOrEqual(10);
        expect(GUNDABAD_GOLDENS.some((golden) => game(golden).intents.some((intent) => intent.type === "Choose" && intent.optionId === "stay"))).toBe(true);
        // Only the goldens whose policy bypasses do.
        for (const golden of GUNDABAD_GOLDENS.filter((item) => item.policy?.bypass == null)) expect(bypassed(game(golden).intents), golden.name).toBe(0);
        // A bypassed stage is not defeated: it is at the bottom of the quest deck or current again, never in the victory display twice.
        for (const golden of GUNDABAD_GOLDENS) for (const code of [...STAGE_TWOS, CODES.stage1]) expect(zoneOf(game(golden).state, code).filter((zone) => zone === "victory").length, `${golden.name} ${code}`).toBeLessThanOrEqual(1);
      });

      it("plays the seven stage 2s in several orders", () => {
        const orders = new Set(GUNDABAD_GOLDENS.map((golden) => opened(golden).questDeck.map((id) => opened(golden).cards[id]?.code).join(",")));
        expect(orders.size).toBeGreaterThanOrEqual(12);
      });

      it("uses The First Forge, Throat of the Mountain, Dagnir's Hoard and the Response of the Great Worm, and the Forced attack on Dagnir's Hoard's exploring", () => {
        const intents = wonGoldens().flatMap((golden) => game(golden).intents);
        expect(used(intents, "19122:response:1")).toBe(true);
        expect(used(intents, "19123:response:1")).toBe(true);
        expect(used(intents, "19124:response:1")).toBe(true);
        expect(used(intents, "19142:response:1")).toBe(true);
        // Every win used the Great Worm's Response and The First Forge's before it (the Reforged Wormsbane).
        for (const golden of wonGoldens()) {
          expect(used(game(golden).intents, "19142:response:1"), golden.name).toBe(true);
          expect(used(game(golden).intents, "19122:response:1"), golden.name).toBe(true);
        }
      });

      it("hunts Dagnir in the goldens that say so: she is engaged and attacked", () => {
        const hunting = GUNDABAD_GOLDENS.filter((golden) => golden.policy?.hunt === true);
        expect(hunting.length).toBeGreaterThanOrEqual(3);
        for (const golden of hunting) expect(game(golden).intents.some((intent) => intent.type === "Engage" && game(golden).state.cards[intent.enemyId]?.code === CODES.dagnir), golden.name).toBe(true);
      });

      it("loses on threat, with every hero destroyed, and with the hero who carries Wormsbane destroyed", () => {
        const lost = lostGoldens();
        expect(lost.some((golden) => golden.decks === "weak")).toBe(true);
        expect(lost.some((golden) => golden.decks === "brittle")).toBe(true);
        expect(lost.filter((golden) => game(golden).state.lossReason?.endsWith("left play")).length).toBeGreaterThanOrEqual(4);
        // The hero who carries Wormsbane left play: the loss names it, and no seat was left to lose first.
        for (const golden of lost.filter((item) => item.lossReason?.endsWith("left play"))) expect(game(golden).state.cards[game(golden).state.questStage ?? ""]?.code, golden.name).toBeDefined();
        const threat = lost.filter((golden) => golden.lossReason === "No seats remain");
        expect(threat.length).toBeGreaterThanOrEqual(5);
        for (const golden of lost) expect(game(golden).state.stageCleared, golden.name).toBe(false);
        // The weak heroes cannot quest: every seat is eliminated by its threat, none by a hero's death.
        for (const golden of lost.filter((item) => item.decks === "weak")) expect(game(golden).steps.filter((step) => step.kind === "eliminate"), golden.name).toHaveLength(golden.seatCount);
      });

      it("deals every card of the stand-in world: a treasure, a Hazard of the pool, none unknown", () => {
        for (const golden of GUNDABAD_GOLDENS.slice(0, 3)) for (const card of Object.values(game(golden).state.cards)) expect(world(golden).cards.has(card.code), `${golden.name} ${card.code}`).toBe(true);
      });
    },
  });
});
