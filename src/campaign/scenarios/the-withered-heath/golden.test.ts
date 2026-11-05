// Rules: emce.setup-the-withered-heath, emce.dragon-signs, emce.caves-deck, emce.deep, emce.guarded-x, emce.boon-allies, emce.treasure, emce.campaign-pool-encounter, rr.guarded, rr.victory, rr.winning-the-game, ltp.campaign-setup-checklist (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { startScenario } from "../../../rules/engine/reduce.ts";
import { HEATH_GOLDENS, heathPlan, heathSetupChoices, heathStart, heathChoices, logBeforeGolden, playGolden, heathWorld, type HeathDecks, type HeathGolden } from "../../../../test/scenarios/the-withered-heath/game.ts";
import { CODES, TREASURES, campaign, heath } from "../../../../test/scenarios/the-withered-heath/scene.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

// A permanent golden: whole games of The Withered Heath in Campaign Mode played by the auto-player (test/scenarios/the-withered-heath/game.ts) on fixed seeds, true solo and two-handed, through a win (in Normal and Easy, from a blank log and after Journey Up the
// Anduin's, Lost in Mirkwood's and The King's Quest's real Resolutions, the allies in the pool or Turayn's, Melanwar's and Isolde's lines written; the boon-ally search taken or skipped; each Accolade boon on its stage defeat, Dragon-slayer when Cold-Drake dies; the
// Dragon Signs found through Deep and Creature Den; Cold-Drake fought in the staging area at stages 2 and 4; each Song boon, or none; 3 and 4 Dragon Signs in the victory display, the treasure of three chosen in the second case) and through each way to lose (heroes too small to
// quest, heroes too brittle to survive, the threat at the last stage). It pins the path from data/ through the Campaign Setup Checklist and buildStart, the stage, Dragon Sign and Cold-Drake records, the Resolution's pool, log line and treasure effects and the reducer,
// so a change that moves a game shows up as a diff here. Update the snapshot only when the change is meant.
const SIGNS = (state: { cards: Record<string, { code: string; zone: string }> }): number => Object.values(state.cards).filter((card) => card.code === CODES.dragonSign && card.zone === "victory").length;
const ACCOLADES: readonly string[] = [CODES.masterOfTheHunt, CODES.unbroken, CODES.theSteadfast, CODES.dragonSlayer];
const SONGS: readonly string[] = [CODES.theCannyHuntsman, CODES.aTaleOfVictories, CODES.layOfCourage, CODES.rhymeOfTheSlayer];
const ALLIES: readonly string[] = [CODES.turayn, CODES.melanwar, CODES.isolde];
const treasures: readonly string[] = TREASURES;
const wonGoldens = () => HEATH_GOLDENS.filter((golden) => golden.outcome === "won");

describe("The Withered Heath golden", () => {
  goldenSuite<HeathGolden, HeathDecks>({
    title: "The Withered Heath",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: heath,
    goldens: HEATH_GOLDENS,
    world: heathWorld,
    play: playGolden,
    before: (golden) => logBeforeGolden(golden),
    opening: {
      title: "starts with Cold-Drake and two Dragon Signs set aside, two Dragon Signs in the Caves deck, the four Accolade boons set aside, the campaign card on the table, a location for each player in the staging area, and a boon ally in the hand when the search took one",
      check(state, golden, world) {
        const zoneOf = (code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.zone);
        expect(state.questStage && state.cards[state.questStage]?.code, golden.name).toBe(CODES.stage1);
        expect(zoneOf(CODES.coldDrake), golden.name).toEqual(["setAside"]);
        expect(zoneOf(CODES.dragonSign).sort(), golden.name).toEqual(["cavesDeck", "cavesDeck", "setAside", "setAside"]);
        for (const code of ACCOLADES) expect(zoneOf(code), `${golden.name} ${code}`).toEqual(["setAside"]);
        expect(zoneOf(CODES.campaignCard), golden.name).toEqual(["campaign"]);
        // A location for each player (and The Threat to Wilderland when the pool holds it: it enters the staging area at its Setup).
        const staged = state.staging.map((id) => state.cards[id]?.code ?? "").filter((code) => code !== CODES.theThreatToWilderland);
        expect(staged, golden.name).toHaveLength(golden.seatCount);
        for (const code of staged) expect(world.cards.get(code)?.type, golden.name).toBe("location");
        // The Caves deck: the Lost Caves set (6), the two Dragon Signs stage 1 shuffled in, a pooled Abandoned Ruin; Melanwar's line took one of the scenario's own.
        const log = logBeforeGolden(golden);
        const pooledRuin = log.campaignPool.some((card) => card.code === CODES.abandonedRuin) ? 1 : 0;
        const melanwar = log.allyLines?.includes("melanwar") ? 1 : 0;
        expect(state.piles?.cavesDeck ?? [], golden.name).toHaveLength(6 + 2 + pooledRuin - melanwar);
        // The boon ally search (12175:A:2): the first player's hand holds the unique boon ally taken (it is not in their deck any more); with none taken the hand holds only what the opening hand drew.
        const pooled = log.campaignPool.map((card) => card.code).filter((code) => ALLIES.includes(code));
        const taken = pooled.length > 0 && golden.ally !== "skip" ? heathChoices(golden)[0] : undefined;
        if (taken) {
          expect(ALLIES, golden.name).toContain(taken);
          expect(state.seats[0]?.hand.map((id) => state.cards[id]?.code), golden.name).toContain(taken);
          expect(state.seats[0]?.deck.map((id) => state.cards[id]?.code), golden.name).not.toContain(taken);
        }
      },
    },
    wins: "wins on A Cornered Dragon with Cold-Drake defeated, runs 12175's Resolution and unlocks the next part",
    won(state, golden, world) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe(CODES.stage4);
      const drake = Object.values(state.cards).find((card) => card.code === CODES.coldDrake);
      expect(drake?.zone, golden.name).toBe("victory");
      const log = state.resolutionLog;
      const signs = SIGNS(state);
      expect([3, 4], golden.name).toContain(signs);
      const earned = log.earned.map((item) => item.code);
      // Accolade boons: one for each player at most, and only the stages the policy takes; each joins the pool on its hero.
      const accolades = earned.filter((code) => ACCOLADES.includes(code));
      const taken = (golden.policy?.accolades ?? [1, 2, 3, 4]).map((stage) => ACCOLADES[stage - 1]);
      for (const code of accolades) expect(taken, `${golden.name} ${code}`).toContain(code);
      expect(accolades.length, golden.name).toBeLessThanOrEqual(golden.seatCount);
      if (golden.seatCount === 1) expect(accolades, golden.name).toEqual([taken[0]]);
      for (const item of log.earned.filter((entry) => ACCOLADES.includes(entry.code))) expect(item.to, golden.name).toBe("hero");
      // Song boons: one for each player (the first, the last offered), or none.
      const songs = earned.filter((code) => SONGS.includes(code));
      const policy = golden.policy?.song ?? "first";
      expect(songs.slice().sort(), golden.name).toEqual(policy === "skip" ? [] : (policy === "last" ? SONGS.slice(-golden.seatCount) : SONGS.slice(0, golden.seatCount)).slice().sort());
      for (const item of log.earned.filter((entry) => SONGS.includes(entry.code))) expect(item.to, golden.name).toBe("pool");
      // 4 Dragon Signs in the victory display: the first player chose 1 of 3 random undiscovered treasures; with 3 there is no draw. A treasure the players controlled in play is discovered too.
      const held = Object.values(state.cards).filter((card) => treasures.includes(card.code) && card.zone === "play" && card.host != null).map((card) => card.code);
      const drawn = (log.treasures ?? []).filter((code) => !held.includes(code));
      expect(drawn, golden.name).toHaveLength(signs === 4 ? 1 : 0);
      expect(log.treasures ?? [], golden.name).toEqual([...held, ...drawn].sort((left, right) => (log.treasures ?? []).indexOf(left) - (log.treasures ?? []).indexOf(right)));
      void world;
    },
    checks({ game, world, opened }) {
      it("reaches every Accolade boon, every Song boon and none, 3 and 4 Dragon Signs, both treasure picks, Dragon-slayer, and both Easy and Normal, solo and two-handed", () => {
        const states = wonGoldens().map((golden) => game(golden).state);
        const earned = states.flatMap((state) => state.resolutionLog.earned.map((item) => item.code));
        for (const code of [...ACCOLADES, ...SONGS]) expect(earned, code).toContain(code);
        expect(states.filter((state) => SIGNS(state) === 4).length).toBeGreaterThanOrEqual(6);
        expect(states.filter((state) => SIGNS(state) === 3).length).toBeGreaterThanOrEqual(2);
        expect(states.filter((state) => !state.resolutionLog.earned.some((item) => SONGS.includes(item.code))).length).toBeGreaterThanOrEqual(2);
        expect(wonGoldens().filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(5);
        expect(wonGoldens().filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(3);
        expect(wonGoldens().filter((golden) => golden.difficulty === "Easy").length).toBeGreaterThanOrEqual(3);
        expect(wonGoldens().filter((golden) => golden.after).length).toBeGreaterThanOrEqual(5);
        expect(wonGoldens().filter((golden) => golden.variant != null && golden.variant !== "pool").length).toBeGreaterThanOrEqual(3);
        expect(HEATH_GOLDENS.filter((golden) => golden.outcome === "lost").length).toBeGreaterThanOrEqual(6);
        // The treasure of three: the first and the last of the three offered.
        const picks = wonGoldens().filter((golden, index) => SIGNS(states[index]!) === 4).map((golden) => golden.policy?.treasure ?? "first");
        expect(picks).toContain("first");
        expect(picks).toContain("last");
      });

      it("finds a Dragon Sign through Deep or Creature Den in every win, and fights Cold-Drake from the staging area at stage 2 and again at stage 4", () => {
        for (const golden of wonGoldens()) {
          const { state, steps } = game(golden);
          // 3 or 4 Dragon Signs reached the victory display: the 4 began set aside or in the Caves deck, so each came out through Deep or Creature Den (or the second shuffle of stage 3).
          expect(SIGNS(state), golden.name).toBeGreaterThanOrEqual(3);
          const drake = Object.values(state.cards).find((card) => card.code === CODES.coldDrake)!;
          const hits = steps.filter((step) => step.kind === "damage" && step.targetId === drake.id && step.amount > 0);
          expect(hits.length, golden.name).toBeGreaterThanOrEqual(2);
        }
      });

      it("removes 2 non-unique locations and 1 Caves location with Melanwar's line, and 3 non-unique enemies with Isolde's, the first player naming each", () => {
        for (const golden of HEATH_GOLDENS.filter((item) => item.after && item.variant && item.variant !== "pool")) {
          const log = logBeforeGolden(golden);
          expect(log.allyLines, golden.name).toContain("melanwar");
          const plan = heathPlan(golden.seatCount, log, heathChoices(golden), golden.difficulty);
          const isolde = log.allyLines?.includes("isolde") === true;
          const types = plan.removedFromEncounter.map((code) => world(golden).cards.get(code)?.type);
          expect(types.filter((type) => type === "location"), golden.name).toHaveLength(2);
          expect(types.filter((type) => type === "enemy"), golden.name).toHaveLength(isolde ? 3 : 0);
          // The Caves card comes from the scenario's own Lost Caves set, and is a location.
          expect(plan.removedFromCaves, golden.name).toHaveLength(1);
          expect(world(golden).cards.get(plan.removedFromCaves[0] ?? "")?.type, golden.name).toBe("location");
          // The same game dealt with the lines out of the log: the cards named are the whole difference.
          const bare = { ...log, allyLines: (log.allyLines ?? []).filter((line) => line !== "melanwar" && line !== "isolde") };
          const without = heathStart(golden.seatCount, golden.seed, golden.difficulty, undefined, bare, undefined, heathSetupChoices(golden.seatCount, bare, golden.difficulty, golden.ally));
          const count = (start: typeof without, type: string) => Object.values(startScenario(start, world(golden).ctx).cards).filter((card) => world(golden).cards.get(card.code)?.type === type && (card.zone === "encounterDeck" || card.zone === "staging" || card.zone === "cavesDeck")).length;
          const dealt = game(golden).start;
          expect(count(without, "location") - count(dealt, "location"), golden.name).toBe(3);
          expect(count(without, "enemy") - count(dealt, "enemy"), golden.name).toBe(isolde ? 3 : 0);
        }
      });

      it("keeps a pooled Abandoned Ruin out of the Melanwar line's Caves search and shuffles it into the Caves deck after", () => {
        const golden = HEATH_GOLDENS.find((item) => item.variant === "oath")!;
        const log = logBeforeGolden(golden);
        expect(log.campaignPool.map((card) => card.code), golden.name).toContain(CODES.abandonedRuin);
        const plan = heathPlan(golden.seatCount, log, heathChoices(golden), golden.difficulty);
        expect(plan.removedFromCaves, golden.name).not.toContain(CODES.abandonedRuin);
        const caves = (opened(golden).piles?.cavesDeck ?? []).map((id) => opened(golden).cards[id]?.code);
        expect(caves, golden.name).toContain(CODES.abandonedRuin);
      });

      it("offers Dragon-slayer once Cold-Drake dies, to a player with no Accolade boon, and the game is won at the end of that phase", () => {
        const golden = HEATH_GOLDENS.find((item) => item.policy?.accolades?.length === 1 && item.policy.accolades[0] === 4 && item.outcome === "won")!;
        const { state, steps } = game(golden);
        expect(state.resolutionLog.earned.map((item) => item.code), golden.name).toContain(CODES.dragonSlayer);
        const slayer = Object.values(state.cards).find((card) => card.code === CODES.dragonSlayer);
        expect(slayer?.host, golden.name).not.toBeNull();
        // The offer and the win come after the defeat: Cold-Drake's destruction is announced before the game is won.
        const destroyed = steps.findIndex((step) => step.kind === "destroy" && state.cards[step.targetId]?.code === CODES.coldDrake);
        expect(destroyed, golden.name).toBeGreaterThanOrEqual(0);
        expect(state.stageCleared, golden.name).toBe(true);
      });

      it("a game lost at the last stage keeps Cold-Drake alive", () => {
        for (const golden of HEATH_GOLDENS.filter((item) => item.name.includes("lost at the last stage"))) {
          const { state } = game(golden);
          expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe(CODES.stage4);
          expect(Object.values(state.cards).find((card) => card.code === CODES.coldDrake)?.zone, golden.name).not.toBe("victory");
        }
      });
    },
  });
});
