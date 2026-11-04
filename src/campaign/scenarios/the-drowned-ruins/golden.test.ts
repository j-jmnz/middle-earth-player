// Rules: dcce.setup-the-drowned-ruins, dcce.campaign-setup-the-drowned-ruins, dcce.grotto-deck, dcce.campaign-mode, dcce.gaining-xp, dcce.scalable-upgradable, dcce.hard-expert, rr.winning-the-game, rr.victory,
// rr.explored, rr.active-location, ltp.campaign-setup-checklist (data/rules/entries.json).
import { expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/engine/reduce.ts";
import { RUINS_GOLDENS, UPGRADED_CODES, afterTemple, commandChoices, playGolden, ruinsWorld, type RuinsDecks, type RuinsGolden } from "../../../../test/scenarios/the-drowned-ruins/game.ts";
import { CODES, campaign, ruins } from "../../../../test/scenarios/the-drowned-ruins/scene.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

import { emptyLog } from "../../log.ts";
import { nextStep } from "../../path.ts";

// A permanent golden: whole games of The Drowned Ruins in Campaign Mode played by the auto-player (test/scenarios/the-drowned-ruins/game.ts), true solo and two-handed, through a win (in Normal and Easy, after the first six
// parts, with the Command copies taken and refused, with the Hard and the Expert Mode card, with Black Key on its Upgraded side) and through a loss (the threat, brittle heroes, Captain Sahír and Na'asiyah destroyed),
// on fixed seeds. It pins the path from data/ through the Campaign Setup Checklist and buildStart, the scenario's records, the Grotto deck (the Grotto side up in the staging area, the flip to the Underwater side, the
// Shrine to Morgoth set aside until stage 2) and the reducer, so a change that moves a game shows up as a diff here. Update the snapshot only when the change is meant.
const code = (state: ScenarioState, id: string): string => state.cards[id]?.code ?? "";
const GROTTO: readonly string[] = [CODES.underseaGrotto, CODES.cursedCaverns, CODES.waterLoggedHalls];
const SHRINE: readonly string[] = [CODES.shrineToMorgoth, "12095"];
// The Command and Círdan's Blessing copies the golden's players took ("skip" refuses a copy).
const chosenCards = (golden: RuinsGolden): string[] => (golden.choices ?? commandChoices(golden.seatCount)).filter((item) => item !== "skip");

goldenSuite<RuinsGolden, RuinsDecks>({
  title: "The Drowned Ruins",
  file: new URL("./golden.json", import.meta.url).pathname,
  campaign,
  scenario: ruins,
  goldens: RUINS_GOLDENS,
  world: ruinsWorld,
  play: playGolden,
  opening: {
    title: "starts with the Grotto deck prepared (the top 2 of its 8 locations in the staging area Grotto side up), Shrine to Morgoth set aside, Captain Sahír and Na'asiyah in play with Black Key on Sahír, and Revenant in the encounter deck",
    check(state, golden) {
      const inZone = (zone: string) => Object.values(state.cards).filter((card) => card.zone === zone).map((card) => card.code);
      // Eight Grotto locations are dealt: the top two (three with 3 or more players) join the staging area Grotto side up, and the rest wait in the Grotto deck.
      expect(inZone("staging").sort(), golden.name).toHaveLength(2);
      expect(inZone("staging").every((c) => GROTTO.includes(c)), golden.name).toBe(true);
      expect((state.uncharted?.deck ?? []).map((id) => code(state, id)).every((c) => GROTTO.includes(c)), golden.name).toBe(true);
      expect(state.uncharted?.deck, golden.name).toHaveLength(6);
      expect([...(state.uncharted?.deck ?? []).map((id) => code(state, id)), ...inZone("staging")].sort(), golden.name).toEqual([CODES.underseaGrotto, CODES.underseaGrotto, CODES.underseaGrotto, CODES.cursedCaverns, CODES.cursedCaverns, CODES.cursedCaverns, CODES.waterLoggedHalls, CODES.waterLoggedHalls].sort());
      // The Shrine to Morgoth is out of play until stage 2 (its Underwater side is a card of its own, shown only by a flip).
      expect(Object.values(state.cards).find((card) => card.code === CODES.shrineToMorgoth), golden.name).toMatchObject({ zone: "setAside" });
      // Captain Sahír under the first player, Na'asiyah under the last, Black Key (on its Upgraded side with the Upgraded golden) on Sahír.
      const sahir = Object.values(state.cards).find((card) => card.code === CODES.captainSahir);
      const naasiyah = Object.values(state.cards).find((card) => card.code === CODES.naAsiyah);
      expect([sahir?.zone, naasiyah?.zone], golden.name).toEqual(["play", "play"]);
      expect(sahir?.controller, golden.name).toBe(state.firstPlayer);
      expect(naasiyah?.controller, golden.name).toBe(golden.seatCount - 1);
      const key = Object.values(state.cards).find((card) => card.code === CODES.blackKey);
      expect(key, golden.name).toMatchObject({ zone: "play", host: sahir?.id, face: golden.upgraded ? "B" : "up" });
      expect(state.encounterDeck.map((id) => code(state, id)), golden.name).toContain(CODES.revenant);
      expect(state.encounterDeck.map((id) => code(state, id)).includes("11176"), golden.name).toBe(golden.after === true);
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe(CODES.stage1);
      expect(state.modeCard?.side, golden.name).toBe(golden.mode === "hard" ? "A" : golden.mode === "expert" ? "B" : undefined);
      expect(Object.values(state.cards).find((card) => card.code === CODES.campaignCard)?.zone, golden.name).toBe("campaign");
      // The Command copies and Círdan's Blessing the players took are in hand after the mulligan.
      const taken = golden.choices ?? commandChoices(golden.seatCount);
      expect(Object.values(state.cards).filter((card) => card.zone === "hand" && taken.includes(card.code)).map((card) => card.code).sort(), golden.name).toEqual(chosenCards(golden).sort());
    },
  },
  checks({ game }) {
    it("keeps Shrine to Morgoth set aside until stage 2: it is in play only after Sahír's Betrayal, and then it is the active location or in the victory display", () => {
      for (const golden of RUINS_GOLDENS) {
        const { state } = game(golden);
        const shrine = Object.values(state.cards).find((card) => SHRINE.includes(card.code));
        expect(shrine, golden.name).toBeDefined();
        const onStage2 = code(state, state.questStage ?? "") === CODES.stage2;
        expect(shrine?.zone === "setAside", golden.name).toBe(!onStage2);
        if (onStage2) expect(["activeLocation", "victory"], golden.name).toContain(shrine?.zone);
      }
    });

    it("adds Grotto locations Grotto side up and shows the Underwater side only on a flip: no Underwater location is dealt faceup, and every Underwater location in a won game's victory display was flipped", () => {
      for (const golden of RUINS_GOLDENS) {
        const { start, state } = game(golden);
        // The Grotto deck is dealt with every location on its Grotto side (the Underwater side is a card of its own, named as the `other` of the instance).
        expect((start.unchartedDeck ?? []).every((c) => GROTTO.includes(c)), golden.name).toBe(true);
        if (golden.outcome !== "won") continue;
        const underwater = state.victory.filter((id) => ruins.cards.some((card) => card.back === code(state, id)) && !SHRINE.includes(code(state, id)));
        expect(underwater.length, golden.name).toBeGreaterThanOrEqual(3);
        for (const id of underwater) expect(GROTTO.includes(state.cards[id]?.other ?? ""), `${golden.name} ${code(state, id)}`).toBe(true);
      }
    });
  },
  wins: "wins when Shrine to Morgoth is explored on stage 2 (after 3 Underwater locations were explored on stage 1), runs 11200's Resolution (the XP is awarded, the Command and Círdan's Blessing copies chosen join the pool) and unlocks the next part",
  before: (golden) => (golden.after ? afterTemple(golden.seatCount) : emptyLog(golden.seatCount)),
  won(state, golden) {
    expect(state.cards[state.questStage ?? ""]?.code).toBe(CODES.stage2);
    const underwater = state.victory.filter((id) => ruins.cards.some((card) => card.back === code(state, id)) && !SHRINE.includes(code(state, id)));
    expect(underwater.length).toBeGreaterThanOrEqual(3);
    expect(state.victory.some((id) => SHRINE.includes(code(state, id)))).toBe(true);
    const chosen = chosenCards(golden);
    expect(state.resolutionLog.earned.map((item) => item.code).sort()).toEqual(chosen.sort());
  },
  // What the campaign card's list awards, counted from the final state: 1 XP for each surviving player; 1 for each resource on the campaign card (at most 3); 1 if Na'asiyah has 5 or more resources; 1 if no enemies are in
  // play; 1 if 5 or more Underwater locations are in the victory display; 2 if Shrine to Morgoth (Grotto side) is in the victory display; 1 if each surviving player's threat is 40 or less; -1 if Ominous Fate is in the victory
  // display; the Hard card gains 1 and the Expert card 2.
  expectedXp(state, golden, world) {
    const victory = state.victory.map((id) => code(state, id));
    const survivors = state.seats.slice(0, state.seatCount).filter((seat) => !seat.eliminated);
    const campaignCard = Object.values(state.cards).find((card) => card.code === CODES.campaignCard);
    const naasiyah = Object.values(state.cards).find((card) => card.code === CODES.naAsiyah);
    const enemies = Object.values(state.cards).filter((card) => (card.zone === "staging" || card.zone === "engaged") && world.cards.get(card.code)?.type === "enemy");
    // 11200:B:7 counts every Underwater location in the victory display: a flipped Grotto location, Drowned Cave and the Shrine's Underwater side.
    const underwater = victory.filter((c) => world.cards.get(c)?.traits.includes("Underwater")).length;
    return (
      survivors.length +
      Math.min(3, campaignCard?.resources ?? 0) +
      ((naasiyah?.resources ?? 0) >= 5 ? 1 : 0) +
      (enemies.length === 0 ? 1 : 0) +
      (underwater >= 5 ? 1 : 0) +
      (victory.includes(CODES.shrineToMorgoth) ? 2 : 0) +
      (survivors.every((seat) => seat.threat <= 40) ? 1 : 0) -
      (victory.includes("11176") ? 1 : 0) +
      (golden.mode === "hard" ? 1 : golden.mode === "expert" ? 2 : 0)
    );
  },
  afterWin({ golden, log, path }) {
    // The copies chosen at Setup join the pool, with Ominous Fate from the earlier parts.
    expect(log.campaignPool.map((card) => card.code).sort()).toEqual([...(golden.after ? ["11176"] : []), ...chosenCards(golden)].sort());
    // A Storm on Cobas Haven is playable now: the path offers it as the current part.
    expect(path[7]?.id).toBe("a-storm-on-cobas-haven");
    expect(nextStep(path, null)).toMatchObject({ kind: "begin", node: { id: "a-storm-on-cobas-haven", status: "current" } });
    expect(UPGRADED_CODES).toEqual([CODES.blackKey]);
  },
});
