// Rules: dcce.setup-the-city-of-corsairs, dcce.campaign-setup-the-city-of-corsairs, dcce.campaign-mode, dcce.from-sea-to-land, dcce.indestructible, dcce.gaining-xp, dcce.scalable-upgradable, dcce.hard-expert, dcce.heading,
// dcce.sailing-tests, dcce.boarding, rr.winning-the-game, rr.victory, rr.destroy, rr.forced, rr.action, ltp.campaign-setup-checklist (data/rules/entries.json).
import { expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import type { PlayerIntent } from "../../../rules/core/intents.ts";
import type { StartScenario } from "../../../rules/setup/setup.ts";
import { CORSAIRS_GOLDENS, afterHaven, blessingChoices, playGolden, corsairsWorld, type CorsairsDecks, type CorsairsGolden } from "../../../../test/scenarios/the-city-of-corsairs/game.ts";
import { CODES, campaign, corsairs } from "../../../../test/scenarios/the-city-of-corsairs/scene.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

import { emptyLog } from "../../log.ts";
import { nextStep } from "../../path.ts";

// A permanent golden: whole games of The City of Corsairs in Campaign Mode played by the auto-player (test/scenarios/the-city-of-corsairs/game.ts), true solo and two-handed, through a win (in Normal and Easy, after the
// first eight parts with Ominous Fate in the victory display, with the Hard and the Expert Mode card, with Gavin returned and Calaerion, The Black Sword and The Shattered Monument on their Upgraded sides, with the Stormcaller
// sunk at stage 1, and with the last option of each choice) and through a loss (the threat, brittle heroes, the Dream-chaser destroyed, Captain Sahír left standing), on fixed seeds. It pins the path from data/ through the
// Campaign Setup Checklist and buildStart, the scenario's records, the swap to the second encounter deck at stage 2B, The Black Sword's Refresh Action, Captain Sahír made indestructible by the enemies' resources, and the reducer, so
// a change that moves a game shows up as a diff here. Update the snapshot only when the change is meant.
const code = (state: ScenarioState, id: string): string => state.cards[id]?.code ?? "";
const of = (state: ScenarioState, wanted: string) => Object.values(state.cards).filter((card) => card.code === wanted);
const MONUMENT = "110129";
const OMINOUS_FATE = "11176";
const WARSHIP = CODES.corsairWarship;
// The Círdan's Blessing the golden's players took ("skip" refuses it).
const chosenCards = (golden: CorsairsGolden): string[] => (golden.choices ?? blessingChoices()).filter((item) => item !== "skip");

// What a replay of a golden shows besides its final state: the moments the records act in, so the suite can say which of them the goldens reach.
type Seen = Set<string>;
function replay(game: { start: StartScenario; intents: readonly PlayerIntent[] }, ctx: ReduceContext): Seen {
  const seen: Seen = new Set();
  let state = startScenario(game.start, ctx);
  state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  const scan = (now: ScenarioState): void => {
    const stage = code(now, now.questStage ?? "");
    for (const card of Object.values(now.cards)) {
      if (card.code === CODES.theBlackSword && card.zone === "removed") seen.add("The Black Sword removed from the game");
      if (card.code === CODES.blackKey && card.zone === "removed") seen.add("Black Key removed from the game");
      if (card.code === CODES.captainSahir && card.zone === "engaged" && card.attachments.map((id) => code(now, id)).includes(CODES.theBlackSword)) seen.add("The Black Sword attached to Captain Sahír");
      if (card.code === CODES.captainSahir && card.zone === "engaged" && card.damage >= 8) seen.add("Captain Sahír with lethal damage, indestructible");
      if (card.code === CODES.stormcaller && card.zone === "victory") seen.add("the Stormcaller in the victory display");
      if (card.code === CODES.gavin && card.zone === "play") seen.add("Gavin returned, in play");
      if (card.code === "12161" && (card.zone === "staging" || card.zone === "engaged" || card.zone === "encounterDeck")) seen.add("the second encounter deck in use");
    }
    if (stage === CODES.stage4) seen.add("stage 4");
    if (stage === CODES.stage3) seen.add("stage 3");
    // CarryToSecondDeck (11215:B:1): the burden without the Ship trait is in the second deck as stage 3 begins, not set aside with the first.
    if (stage === CODES.stage3 && of(now, OMINOUS_FATE).some((card) => card.zone === "encounterDeck")) seen.add("Ominous Fate carried into the second encounter deck");
    // AttackOtherPlayers (11216:A:4): Captain Sahír, engaged with one player, attacks another.
    const attack = now.pendingAttack;
    if (attack && code(now, attack.enemyId) === CODES.captainSahir && now.cards[attack.enemyId]?.controller !== attack.seat) seen.add("Captain Sahír attacks the other player");
  };
  for (const intent of game.intents) {
    // Streets of Umbar (12160:A:1): the players decline to travel, or travel to a location of another title, with it in the staging area.
    const streets = of(state, CODES.streetsOfUmbar).some((card) => card.zone === "staging");
    if (streets && state.window?.kind === "travel" && !state.activeLocation && (intent.type === "DeclineTravel" || (intent.type === "Travel" && code(state, intent.locationId) !== CODES.streetsOfUmbar))) seen.add("the Streets of Umbar tax");
    state = expectOk(reduce(state, intent, ctx)).state;
    scan(state);
    if (intent.type === "Trigger") seen.add(`Trigger ${intent.effectId}`);
  }
  return seen;
}

goldenSuite<CorsairsGolden, CorsairsDecks>({
  title: "The City of Corsairs",
  file: new URL("./golden.json", import.meta.url).pathname,
  campaign,
  scenario: corsairs,
  goldens: CORSAIRS_GOLDENS,
  world: corsairsWorld,
  play: playGolden,
  opening: {
    title: "starts with the Stormcaller (Black Key attached) and Southern Belfalas in the staging area, the Dream-chaser and Calaerion in play, Gavin, Send for Help, The Black Sword and Captain Sahír set aside, Thunderstruck in the encounter deck and Crowley in the Corsair deck",
    check(state, golden) {
      const inZone = (zone: string) => Object.values(state.cards).filter((card) => card.zone === zone).map((card) => card.code);
      const staging = inZone("staging");
      expect(staging.sort(), golden.name).toEqual([CODES.stormcaller, CODES.southernBelfalas].sort());
      // Black Key (burden) is attached to the Stormcaller, which prints Cannot have attachments, by the Setup's own words (user ruling, 2026-11-05).
      const stormcaller = of(state, CODES.stormcaller)[0];
      expect(of(state, CODES.blackKey)[0], golden.name).toMatchObject({ zone: "play", host: stormcaller?.id, face: "up" });
      expect(of(state, CODES.dreamChaser)[0]?.zone === "play" || of(state, "110136")[0]?.zone === "play", golden.name).toBe(true);
      expect(of(state, CODES.calaerion)[0], golden.name).toMatchObject({ zone: "play", face: golden.upgraded ? "B" : "up" });
      // Gavin is in play only when the Campaign Log says "Gavin returned", and then on his Upgraded side.
      expect(of(state, CODES.gavin)[0], golden.name).toMatchObject(golden.upgraded ? { zone: "play", face: "B" } : { zone: "setAside" });
      expect(["11211", "11212", "11213", "11214"].map((c) => of(state, c)[0]?.zone), golden.name).toEqual(["setAside", "setAside", "setAside", "setAside"]);
      expect(of(state, CODES.theBlackSword)[0]?.zone, golden.name).toBe("setAside");
      expect(of(state, CODES.captainSahir)[0]?.zone, golden.name).toBe("setAside");
      expect(of(state, MONUMENT)[0]?.zone, golden.name).toBe("setAside");
      // The City of Corsairs set waits as the inactive second encounter deck.
      expect(of(state, CODES.cityOfCorsairs).map((card) => card.zone), golden.name).toEqual(golden.difficulty === "Easy" ? ["setAside"] : ["setAside", "setAside"]);
      expect(state.encounterDeck.map((id) => code(state, id)), golden.name).toContain(CODES.thunderstruck);
      expect(state.encounterDeck.map((id) => code(state, id)).includes(OMINOUS_FATE), golden.name).toBe(golden.after === true);
      expect(state.corsairDeck?.map((id) => code(state, id)), golden.name).toContain(CODES.crowley);
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe(CODES.stage1);
      expect(state.modeCard?.side, golden.name).toBe(golden.mode === "hard" ? "A" : golden.mode === "expert" ? "B" : undefined);
      // The campaign card stays beside the quest deck all game: its side B records work from the start.
      expect(of(state, CODES.campaignCard)[0]?.zone, golden.name).toBe("campaign");
      // The Círdan's Blessing the players took (a copy not in the Campaign Pool) is in hand after the mulligan.
      const hand = Object.values(state.cards).filter((card) => card.zone === "hand").map((card) => card.code);
      for (const blessing of chosenCards(golden)) expect(hand, golden.name).toContain(blessing);
    },
  },
  checks({ game, world }) {
    it("ends every won game with Captain Sahír in the victory display, on stage 4, which wins the game (12150:B:3)", () => {
      for (const golden of CORSAIRS_GOLDENS.filter((item) => item.outcome === "won")) {
        const { state } = game(golden);
        expect(state.victory.map((id) => code(state, id)), golden.name).toContain(CODES.captainSahir);
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe(CODES.stage4);
      }
    });

    it("never wins while The Black Sword is attached to Captain Sahír: the Sword is gone, with every resource moved off it, before he is destroyed (11216:A:3)", () => {
      for (const golden of CORSAIRS_GOLDENS.filter((item) => item.outcome === "won")) {
        const { state } = game(golden);
        const swords = of(state, CODES.theBlackSword);
        expect(swords.length, golden.name).toBe(1);
        expect(swords[0]?.zone, golden.name).toBe("removed");
      }
    });

    it("reaches the moments the records act in: the Black Key leaving with the Stormcaller, the swap to the second deck, The Black Sword's Refresh Action and its removal, Captain Sahír indestructible with lethal damage and then destroyed, the Stormcaller sunk, Gavin returned, Ominous Fate carried to the second deck, Captain Sahír's attack on the other player, the Streets of Umbar tax", () => {
      const reached = new Set<string>();
      for (const golden of CORSAIRS_GOLDENS) for (const item of replay(game(golden), world(golden).ctx)) reached.add(item);
      for (const wanted of [
        "Black Key removed from the game",
        "stage 3",
        "stage 4",
        "the second encounter deck in use",
        "The Black Sword attached to Captain Sahír",
        "Trigger 11215:action:1",
        "The Black Sword removed from the game",
        "Captain Sahír with lethal damage, indestructible",
        "the Stormcaller in the victory display",
        "Gavin returned, in play",
        "Ominous Fate carried into the second encounter deck",
        "Captain Sahír attacks the other player",
        "the Streets of Umbar tax",
      ]) expect(reached.has(wanted), wanted).toBe(true);
    }, 120_000);
  },
  wins: "wins on stage 4, Final Confrontation, when Captain Sahír is destroyed, runs 11215's Resolution (the XP is awarded) and ends the campaign",
  won(state, golden) {
    expect(state.cards[state.questStage ?? ""]?.code).toBe(CODES.stage4);
    expect(state.resolutionLog.earned.map((item) => item.code).sort()).toEqual([]);
    // The cards a golden upgraded were dealt on their Upgraded side, face B, and show it at the end (Gavin's side is read at the opening); in any other game none shows side B.
    for (const wanted of [CODES.calaerion, CODES.theBlackSword]) {
      const faces = of(state, wanted).map((card) => card.face);
      expect(faces.length, `${golden.name}: ${wanted}`).toBeGreaterThan(0);
      expect(faces.every((face) => (face === "B") === (golden.upgraded === true)), `${golden.name}: ${wanted} ${faces.join()}`).toBe(true);
    }
  },
  // What the campaign card's list awards, counted from the final state (11215:B:6 to B:9): 1 XP for each surviving player; 1 for each Corsair Warship, Shattered Monument, Crowley and Stormcaller in the victory display;
  // 2 if Thunderstruck is; -1 if Ominous Fate is; the Hard card gains 1 and the Expert card 2.
  expectedXp(state, golden) {
    const victory = state.victory.map((id) => code(state, id));
    const survivors = state.seats.slice(0, state.seatCount).filter((seat) => !seat.eliminated);
    return (
      survivors.length +
      victory.filter((c) => [WARSHIP, CODES.theShatteredMonument, MONUMENT, CODES.crowley, CODES.stormcaller].includes(c)).length +
      (victory.includes(CODES.thunderstruck) ? 2 : 0) -
      (victory.includes(OMINOUS_FATE) ? 1 : 0) +
      (golden.mode === "hard" ? 1 : golden.mode === "expert" ? 2 : 0)
    );
  },
  before: (golden) => (golden.after ? afterHaven(golden.seatCount) : emptyLog(golden.seatCount)),
  afterWin({ log, path, golden }) {
    // The last part of the campaign: winning it leaves no scenario unwon and the path finishes ("Dream-chaser won. The players win the campaign!"), as the Resolution says.
    if (golden.after) expect(log.completed).toEqual([...campaign.scenarios]);
    expect(path.every((node) => node.status === "completed")).toBe(true);
    expect(nextStep(path, null)).toEqual({ kind: "finished" });
    expect(log.campaignPool.map((card) => card.code).sort(), golden.name).toEqual(golden.after ? [OMINOUS_FATE, CODES.cirdanSBlessing].sort() : []);
  },
});
