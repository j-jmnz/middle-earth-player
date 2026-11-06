// Rules: emce.setup-the-ghost-of-framsburg, emce.discover, emce.loot, emce.treasure, emce.boon-allies, emce.campaign-pool-encounter, emce.campaign-log, rr.first-player, rr.winning-the-game, ltp.campaign-setup-checklist (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { FRAMSBURG_GOLDENS, framsburgChoices, framsburgPlan, logBeforeGolden, framsburgWorld, playGolden, type FramsburgDecks, type FramsburgGolden } from "../../../../test/scenarios/the-ghost-of-framsburg/game.ts";
import { CODES, campaign, framsburg } from "../../../../test/scenarios/the-ghost-of-framsburg/scene.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

// A permanent golden: whole games of The Ghost of Framsburg in Campaign Mode played by the auto-player (test/scenarios/the-ghost-of-framsburg/game.ts) on fixed seeds, true solo and two-handed, through a win (in Normal and Easy, from a blank log and after Journey Up the Anduin's, Lost in
// Mirkwood's, The King's Quest's, The Withered Heath's, Roam Across Rhovanion's and Fire in the Night's real Resolutions, with the allies and Misplaced Trust or Urdug's Cunning in the pool or Turayn's, Melanwar's, Isolde's and Beldis's lines written; the Loot objectives claimed, Crypt Key and Old
// Lantern used, a treasure attached to Fram's Shade and claimed or none, the Action that shuffles the encounter discard pile used or not, Gundabad Hunter or Gundabad Stalker for the pool, the Hazard card or a burden of the two discarded) and through each way to lose (heroes too small to quest, heroes
// too brittle to survive, the threat of every player at 50). It pins the path from data/ through the Campaign Setup Checklist and buildStart, the Discover and Loot records, the campaign card's Response, Action and Resolution and the reducer, so a change that moves a game shows up as a diff here.
// Update the snapshot only when the change is meant.
const wonGoldens = () => FRAMSBURG_GOLDENS.filter((golden) => golden.outcome === "won");
const LOOT: string[] = [CODES.cryptKey, CODES.oldLantern, CODES.scathaSTeeth, CODES.ashenBrazier];
const zoneOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.zone);
/** The Loot objectives the players control at the end: attached to one of their heroes. */
const controlled = (state: ScenarioState) => Object.values(state.cards).filter((card) => LOOT.includes(card.code) && card.host != null && state.cards[card.host]?.zone === "heroes").length;
const used = (intents: readonly { type: string }[], effectId: string) => intents.some((intent) => intent.type === "Trigger" && (intent as { effectId?: string }).effectId === effectId);

describe("The Ghost of Framsburg golden", () => {
  goldenSuite<FramsburgGolden, FramsburgDecks>({
    title: "The Ghost of Framsburg",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: framsburg,
    goldens: FRAMSBURG_GOLDENS,
    world: framsburgWorld,
    play: playGolden,
    before: (golden) => logBeforeGolden(golden),
    opening: {
      title: "starts with the campaign card on the table, The Cursed Tomb set aside, Ashen Brazier, Gundabad Hunter and Gundabad Stalker in the encounter deck, a location for each player in the staging area, and the cards Isolde's and Beldis's lines remove",
      check(state, golden, world) {
        expect(state.questStage && state.cards[state.questStage]?.code, golden.name).toBe(CODES.stage1);
        expect(zoneOf(state, CODES.campaignCard), golden.name).toEqual(["campaign"]);
        expect(zoneOf(state, CODES.theCursedTomb), golden.name).toEqual(["setAside"]);
        for (const code of [CODES.ashenBrazier, CODES.gundabadHunter, CODES.gundabadStalker]) expect(zoneOf(state, code), `${golden.name} ${code}`).toEqual(["encounterDeck"]);
        const locations = Object.values(state.cards).filter((card) => card.zone === "staging" && world.cards.get(card.code)?.type === "location");
        expect(locations.length, golden.name).toBeGreaterThanOrEqual(golden.seatCount);
        // 12189:A:2: 3 treacheries for Isolde's line, 3 non-unique locations for Beldis's, never a unique card.
        const log = logBeforeGolden(golden);
        const removed = framsburgPlan(golden.seatCount, log, framsburgChoices(golden), golden.difficulty).removedFromEncounter;
        const lines = log.allyLines ?? [];
        expect(removed, golden.name).toHaveLength((lines.includes("isolde") ? 3 : 0) + (lines.includes("beldis") ? 3 : 0));
        for (const code of removed) expect(world.cards.get(code)?.isUnique, golden.name).not.toBe(true);
      },
    },
    wins: "wins by defeating the last stage with Fram's Shade in the victory display, runs 12189's Resolution and unlocks the next part",
    won(state, golden, world) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe(CODES.stage3);
      // The Cursed Tomb could only be traveled to with 3 Loot objectives, and its Shade is in the victory display with it.
      expect(zoneOf(state, CODES.theCursedTomb), golden.name).toEqual(["victory"]);
      expect(zoneOf(state, CODES.framSShade), golden.name).toEqual(["victory"]);
      expect(controlled(state), golden.name).toBeGreaterThanOrEqual(3);
      const log = state.resolutionLog;
      // 12189:B:5: Gundabad Hunter or Gundabad Stalker joins the pool.
      const burden = golden.policy?.burden === "stalker" ? CODES.gundabadStalker : CODES.gundabadHunter;
      expect(log.earned.map((item) => item.code), golden.name).toContain(burden);
      expect(log.earned[0]?.seat, golden.name).toBe(state.firstPlayer);
      // 12189:B:6: one of the 2 Hazard cards discarded joins the pool, as one more copy of an encounter card or as a burden (a burden already earned this Resolution adds nothing).
      const copies = (pool: Readonly<Record<string, number>> | undefined) => Object.values(pool ?? {}).reduce((sum, count) => sum + count, 0);
      const added = copies(log.encounterPool) - copies(logBeforeGolden(golden).encounterPool);
      expect(added, golden.name).toBeLessThanOrEqual(1);
      if (added === 0) expect(log.earned.length, golden.name).toBeGreaterThanOrEqual(1);
      // 12189:B:4: a treasure the players control is discovered, and an undiscovered one only.
      if (log.treasures) expect(log.treasures, golden.name).toHaveLength(1);
      for (const code of LOOT) expect(world.cards.get(code)?.type, code).toBe("objective");
    },
    checks({ game, world }) {
      it("covers the wins and losses it names: seats, Easy, the earlier parts, every pool and line, the treasure for Fram's Shade and its absence, both burdens, both kinds of Hazard card", () => {
        expect(wonGoldens().filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(7);
        expect(wonGoldens().filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(6);
        expect(wonGoldens().filter((golden) => golden.difficulty === "Easy").length).toBeGreaterThanOrEqual(5);
        expect(wonGoldens().filter((golden) => golden.after).length).toBeGreaterThanOrEqual(6);
        for (const variant of ["pool", "cunning", "oath", "oathline", "beldis"] as const) expect(wonGoldens().some((golden) => golden.after && golden.variant === variant), variant).toBe(true);
        expect(FRAMSBURG_GOLDENS.filter((golden) => golden.outcome === "lost").length).toBeGreaterThanOrEqual(8);
        const logs = wonGoldens().map((golden) => game(golden).state.resolutionLog);
        expect(logs.some((log) => log.treasures?.length === 1)).toBe(true);
        expect(logs.some((log) => log.treasures == null)).toBe(true);
        expect(logs.some((log) => log.earned.some((item) => item.code === CODES.gundabadHunter))).toBe(true);
        expect(logs.some((log) => log.earned.some((item) => item.code === CODES.gundabadStalker))).toBe(true);
        expect(logs.some((log) => log.encounterPool != null)).toBe(true);
        expect(logs.some((log) => log.earned.length === 2)).toBe(true);
        // A burden of the Hazard cards, and a second player's pool.
        expect(wonGoldens().some((golden) => game(golden).state.resolutionLog.earned.some((item) => item.seat === 1))).toBe(true);
      });

      it("claims Loot objectives, uses Crypt Key, Old Lantern and the Response that attaches a treasure to Fram's Shade, and shuffles the encounter discard pile with the Action", () => {
        const intents = wonGoldens().flatMap((golden) => game(golden).intents);
        expect(used(intents, "19094:response:1")).toBe(true);
        expect(used(intents, "19095:action:1")).toBe(true);
        expect(used(intents, "12189:response:1")).toBe(true);
        expect(used(intents, "12189:action:1")).toBe(true);
        // The Action is used only when the policy says so.
        for (const golden of FRAMSBURG_GOLDENS.filter((item) => item.policy?.reshuffle !== true)) expect(used(game(golden).intents, "12189:action:1"), golden.name).toBe(false);
      });

      it("a treasure is discovered only in a game that used the Response attaching one to Fram's Shade, and it is a treasure card", () => {
        for (const golden of wonGoldens()) {
          const treasures = game(golden).state.resolutionLog.treasures ?? [];
          if (treasures.length > 0) expect(used(game(golden).intents, "12189:response:1"), golden.name).toBe(true);
          for (const code of treasures) expect(world(golden).cards.get(code)?.type, golden.name).toBe("treasure");
        }
      });

      it("loses on threat and with every hero destroyed", () => {
        const lost = FRAMSBURG_GOLDENS.filter((golden) => golden.outcome === "lost");
        expect(lost.some((golden) => golden.decks === "weak")).toBe(true);
        expect(lost.some((golden) => golden.decks === "brittle")).toBe(true);
        for (const golden of lost) expect(game(golden).state.stageCleared, golden.name).toBe(false);
      });
    },
  });
});
