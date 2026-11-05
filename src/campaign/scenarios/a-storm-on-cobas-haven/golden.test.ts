// Rules: dcce.setup-a-storm-on-cobas-haven, dcce.campaign-setup-a-storm-on-cobas-haven, dcce.campaign-mode, dcce.gaining-xp, dcce.scalable-upgradable, dcce.hard-expert, dcce.heading, dcce.sailing-tests, dcce.boarding,
// dcce.ship-objectives, rr.winning-the-game, rr.victory, rr.guarded, ltp.campaign-setup-checklist (data/rules/entries.json).
import { expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import type { PlayerIntent } from "../../../rules/core/intents.ts";
import type { StartScenario } from "../../../rules/setup/setup.ts";
import { HAVEN_GOLDENS, UPGRADED_CODES, afterRuins, blessingChoices, playGolden, havenWorld, type HavenDecks, type HavenGolden } from "../../../../test/scenarios/a-storm-on-cobas-haven/game.ts";
import { CODES, campaign, haven } from "../../../../test/scenarios/a-storm-on-cobas-haven/scene.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

import { emptyLog } from "../../log.ts";

// A permanent golden: whole games of A Storm on Cobas Haven in Campaign Mode played by the auto-player (test/scenarios/a-storm-on-cobas-haven/game.ts), true solo and two-handed, through a win (in Normal and Easy, after the
// first seven parts, with the Hard and the Expert Mode card, with Black Key and Calaerion on their Upgraded sides, with Belfalas Islet holding the Raider Flagship, with the Actions of Gavin, the towers and Taking on Water used,
// with Send for Help's added phase, and with the Raider Flagship sunk in the victory display, which wins stage 3 whatever its quest points) and through a loss (the threat, brittle heroes, the Dream-chaser destroyed), on fixed
// seeds. It pins the path from data/ through the Campaign Setup Checklist and buildStart, the scenario's records, the Corsair deck and the fleet, the towers freed and controlled, and the reducer, so a change that moves a
// game shows up as a diff here. Update the snapshot only when the change is meant.
const code = (state: ScenarioState, id: string): string => state.cards[id]?.code ?? "";
const TOWERS: readonly string[] = [CODES.seaWardTower, CODES.towerOfTheGull, CODES.theBeacon, CODES.towerOfTheHeron];
const WARSHIP = "110102";
const of = (state: ScenarioState, wanted: string) => Object.values(state.cards).filter((card) => card.code === wanted);
// The Círdan's Blessing the golden's players took ("skip" refuses it).
const chosenCards = (golden: HavenGolden): string[] => (golden.choices ?? blessingChoices()).filter((item) => item !== "skip");

// What a replay of a golden shows besides its final state: the moments the records act in, so the suite can say which of them the goldens reach.
type Seen = Set<string>;
function replay(game: { start: StartScenario; intents: readonly PlayerIntent[] }, ctx: ReduceContext): Seen {
  const seen: Seen = new Set();
  let state = startScenario(game.start, ctx);
  state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  const scan = (now: ScenarioState): void => {
    for (const card of Object.values(now.cards)) {
      if (TOWERS.includes(card.code) && card.zone === "staging" && card.claimed) seen.add("a tower freed and controlled by the players");
      if (card.zone === "under") seen.add(`${card.code === CODES.raiderFlagship ? "the Raider Flagship" : "a Ship enemy"} held under Belfalas Islet`);
      if (card.code === CODES.takingOnWater && card.host) seen.add("Taking on Water attached to a ship");
      if (card.temporary) seen.add("a hero out of the collection, temporary");
      if (card.guard) seen.add("an objective guarded by a Ship enemy");
      if (card.code === CODES.raiderFlagship && card.zone === "victory") seen.add("the Raider Flagship in the victory display");
    }
    if ((now.extraPhases?.length ?? 0) > 0 || now.extraResume) seen.add("an added phase");
  };
  for (const intent of game.intents) {
    state = expectOk(reduce(state, intent, ctx)).state;
    scan(state);
    if (intent.type === "Trigger") seen.add(`Trigger ${intent.effectId}`);
    if (intent.type === "Travel") seen.add(`Travel ${code(state, intent.locationId)}`);
  }
  return seen;
}

goldenSuite<HavenGolden, HavenDecks>({
  title: "A Storm on Cobas Haven",
  file: new URL("./golden.json", import.meta.url).pathname,
  campaign,
  scenario: haven,
  goldens: HAVEN_GOLDENS,
  world: havenWorld,
  play: playGolden,
  opening: {
    title: "starts with the Raider Flagship (Black Key attached), a Scouting Ship and a Dol Amroth tower in the staging area, the Dream-chaser, Calaerion and Gavin in play, the Warships and Send for Help set aside facedown, and Thunderstruck in the encounter deck",
    check(state, golden) {
      const inZone = (zone: string) => Object.values(state.cards).filter((card) => card.zone === zone).map((card) => card.code);
      const staging = inZone("staging");
      expect(staging, golden.name).toContain(CODES.raiderFlagship);
      expect(staging, golden.name).toContain(CODES.scoutingShip);
      expect(staging.filter((c) => TOWERS.includes(c)), golden.name).toHaveLength(1);
      // The Warships (the Campaign Mode sides) and the four Send for Help cards wait facedown, out of play.
      expect(of(state, WARSHIP).map((card) => [card.zone, card.face]), golden.name).toEqual([["setAside", "down"], ["setAside", "down"]]);
      expect(["11211", "11212", "11213", "11214"].map((c) => of(state, c)[0]?.zone), golden.name).toEqual(["setAside", "setAside", "setAside", "setAside"]);
      expect(["11211", "11212", "11213", "11214"].map((c) => of(state, c)[0]?.face), golden.name).toEqual(["down", "down", "down", "down"]);
      // Black Key on the Flagship (on its Upgraded side with the Upgraded golden), the fleet's ship and Calaerion and Gavin in play.
      const flagship = of(state, CODES.raiderFlagship)[0];
      expect(of(state, CODES.blackKey)[0], golden.name).toMatchObject({ zone: "play", host: flagship?.id, face: golden.upgraded ? "B" : "up" });
      expect(of(state, "110136")[0]?.zone, golden.name).toBe("play");
      expect(of(state, CODES.calaerion)[0], golden.name).toMatchObject({ zone: "play", face: golden.upgraded ? "B" : "up" });
      expect(of(state, CODES.gavin)[0]?.zone, golden.name).toBe("play");
      expect(state.encounterDeck.map((id) => code(state, id)), golden.name).toContain(CODES.thunderstruck);
      expect(state.corsairDeck?.map((id) => code(state, id)), golden.name).toContain(CODES.crowley);
      expect(state.encounterDeck.map((id) => code(state, id)).includes("11176"), golden.name).toBe(golden.after === true);
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe(CODES.stage1);
      expect(state.modeCard?.side, golden.name).toBe(golden.mode === "hard" ? "A" : golden.mode === "expert" ? "B" : undefined);
      // The campaign card has only a Setup, a Resolution and XP lines, so it is not placed on the table (families/burden/campaign.ts).
      expect(of(state, CODES.campaignCard), golden.name).toEqual([]);
      // The Círdan's Blessing the players took is in hand after the mulligan.
      const taken = golden.choices ?? blessingChoices();
      expect(Object.values(state.cards).filter((card) => card.zone === "hand" && taken.includes(card.code)).map((card) => card.code).sort(), golden.name).toEqual(chosenCards(golden).sort());
    },
  },
  checks({ game, world }) {
    it("keeps every Dol Amroth Warship set aside until a tower or card takes it, and a Warship destroyed goes back set aside, out of play (12123:A:3)", () => {
      for (const golden of HAVEN_GOLDENS) {
        const { state } = game(golden);
        for (const card of of(state, WARSHIP)) expect(["setAside", "play", "removed"], golden.name).toContain(card.zone);
      }
    });

    it("sinks the Raider Flagship into the victory display in the games that hunt it at stage 3, which wins the game whatever the quest has reached (12122:B:4)", () => {
      const hunts = HAVEN_GOLDENS.filter((golden) => golden.policy?.hunt === "flagship" && golden.outcome === "won");
      expect(hunts.length).toBeGreaterThan(0);
      for (const golden of hunts) {
        const { state } = game(golden);
        expect(state.victory.map((id) => code(state, id)), golden.name).toContain(CODES.raiderFlagship);
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe(CODES.stage3);
        expect(state.cards[state.questStage ?? ""]?.progress, golden.name).toBeLessThan(30);
      }
    });

    it("reaches the moments the records act in: a tower freed and controlled, a guarded objective, Taking on Water, Belfalas Islet holding a Ship enemy, Gavin's Action, Send for Help (a hero out of the collection, an added phase) and the Flagship in the victory display", () => {
      const reached = new Set<string>();
      for (const golden of HAVEN_GOLDENS) for (const item of replay(game(golden), world(golden).ctx)) reached.add(item);
      for (const wanted of [
        "a tower freed and controlled by the players",
        "an objective guarded by a Ship enemy",
        "Taking on Water attached to a ship",
        "the Raider Flagship held under Belfalas Islet",
        "the Raider Flagship in the victory display",
        "an added phase",
        `Travel ${CODES.belfalasIslet}`,
        `Trigger ${CODES.gavin}:action:1`,
        `Trigger ${CODES.takingOnWater}:action:1`,
        `Trigger ${CODES.theBeacon}:action:1`,
      ]) expect(reached.has(wanted), wanted).toBe(true);
    }, 120_000);
  },
  wins: "wins on stage 3, Break Through the Fleet! (defeated, or with the Raider Flagship in the victory display), runs 11209's Resolution (the XP is awarded, the Círdan's Blessing chosen joins the pool) and unlocks The City of Corsairs",
  before: (golden) => (golden.after ? afterRuins(golden.seatCount) : emptyLog(golden.seatCount)),
  won(state, golden) {
    expect(state.cards[state.questStage ?? ""]?.code).toBe(CODES.stage3);
    expect(state.resolutionLog.earned.map((item) => item.code).sort()).toEqual(chosenCards(golden).sort());
  },
  // What the campaign card's list awards, counted from the final state (11209:B:2 to B:11): 1 XP for each surviving player; 1 if the game ended on-course (Sun); 1 if 2 Dol Amroth Warships are in play; 1 if the players
  // control 2 Corsair Skirmishers; 1 if they control 4 Dol Amroth objectives; 1 for each Corsair Warship, 1 if Crowley and 2 if Thunderstruck are in the victory display; 2 if Raider Flagship is; -1 if Ominous Fate is; the Hard
  // card gains 1 and the Expert card 2.
  expectedXp(state, golden, world) {
    const victory = state.victory.map((id) => code(state, id));
    const survivors = state.seats.slice(0, state.seatCount).filter((seat) => !seat.eliminated);
    const players = Object.values(state.cards).filter((card) => card.controller != null && ["play", "heroes"].includes(card.zone));
    const dolAmroth = Object.values(state.cards).filter((card) => world.cards.get(card.code)?.traits.includes("Dol Amroth") && (card.zone === "play" || (card.zone === "staging" && card.claimed === true)));
    return (
      survivors.length +
      (state.sea?.heading === "Sun" ? 1 : 0) +
      (of(state, WARSHIP).filter((card) => card.zone === "play").length >= 2 ? 1 : 0) +
      (players.filter((card) => card.code === "12125~ship").length >= 2 ? 1 : 0) +
      (dolAmroth.length >= 4 ? 1 : 0) +
      victory.filter((c) => c === CODES.corsairWarship).length +
      (victory.includes(CODES.crowley) ? 1 : 0) +
      (victory.includes(CODES.raiderFlagship) ? 2 : 0) +
      (victory.includes(CODES.thunderstruck) ? 2 : 0) -
      (victory.includes("11176") ? 1 : 0) +
      (golden.mode === "hard" ? 1 : golden.mode === "expert" ? 2 : 0)
    );
  },
  afterWin({ golden, log }) {
    // The Círdan's Blessing chosen at Setup joins the pool, with Ominous Fate from the earlier parts.
    expect(log.campaignPool.map((card) => card.code).sort()).toEqual([...(golden.after ? ["11176"] : []), ...chosenCards(golden)].sort());
    expect(UPGRADED_CODES).toEqual([CODES.blackKey, CODES.calaerion]);
  },
});
