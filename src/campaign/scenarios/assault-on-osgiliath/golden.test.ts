// Rules: rr.setup, rr.winning-the-game, rr.explored, rr.travel, rr.active-location, rr.player-elimination, rr.threat-elimination-level, ats.setup-assault-on-osgiliath, ats.controlling-locations, ats.losing-control-of-locations, faq.two-active-locations, hon.siege, hon.battle, ltp.scoring (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { ASSAULT_GOLDENS, assaultWorld, controlledIds, HARADRIM_ELITE, playGolden, RETAKE, WEST_GATE, type AssaultDecks, type AssaultGolden } from "../../../../test/scenarios/assault-on-osgiliath/game.ts";
import { controlledCodes, momentsOf, questKeyword, shadowReturns, stepsByIntent, type Moment } from "../../../../test/scenarios/assault-on-osgiliath/moments.ts";
import type { ScenarioState } from "../../../../src/rules/core/state.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("against-the-shadow");
const assault = loadAnyScenario("assault-on-osgiliath");
const codeOf = (state: ScenarioState, id: string | null | undefined): string => state.cards[id ?? ""]?.code ?? "";
const idOf = (moments: readonly Moment[], kind: Moment["kind"], at: number): string => moments.find((moment) => moment.kind === kind && moment.at === at)?.id ?? "";
const golden = (name: string): AssaultGolden => ASSAULT_GOLDENS.find((entry) => entry.name === name) as AssaultGolden;
// The Osgiliath locations: the cards of the Assault on Osgiliath set that are locations (06096 to 06103).
const OSGILIATH: ReadonlySet<string> = new Set(["06096", "06097", "06098", "06099", "06100", "06101", "06102", "06103"]);
const osgiliathIn = (state: ScenarioState): string[] => [...state.staging, state.activeLocation ?? "", state.secondActiveLocation ?? ""].map((id) => codeOf(state, id)).filter((code) => OSGILIATH.has(code));
const list = (moments: readonly Moment[], kind: Moment["kind"]): string[] => moments.filter((moment) => moment.kind === kind).map((moment) => `${moment.at}:${moment.code}`);
const keptOf = (played: { kept: ScenarioState; trail?: ScenarioState[] }, at: number): ScenarioState => (at === 0 ? played.kept : (played.trail?.[at - 1] as ScenarioState));

// A permanent golden: whole standalone games of Assault on Osgiliath played by the auto-player (test/scenarios/assault-on-osgiliath/game.ts) on fixed seeds, through a win and through each way to lose. A cycle has no Campaign Mode, so a win
// settles at once with a score and nothing earned. The first solo win holds the scenario's moments (control taken after each explore, lost by an undefended attack, by a travel to the location and by West Gate's Action, two active locations
// with Ruined Tower and the share of progress, Siege and Battle), the other wins the Setup (a Haradrim Elite's attack, two players' choices, the Easy deal) and the two losses the ways to lose (every hero destroyed, with a Shadow that makes the
// controller return a location, and threat 50). Update the snapshot only when the change is meant.
describe("Assault on Osgiliath golden", () => {
  goldenSuite<AssaultGolden, AssaultDecks>({
    title: "Assault on Osgiliath",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: assault,
    standalone: true,
    goldens: ASSAULT_GOLDENS,
    world: assaultWorld,
    play: playGolden,
    opening: {
      title: "starts on Retake the City with each player's chosen enemy and the unique location West Gate in the staging area, no active location and no location controlled",
      check(state, entry) {
        expect(codeOf(state, state.questStage), entry.name).toBe(RETAKE);
        expect(state.questDeck, entry.name).toEqual([]);
        expect(state.activeLocation, entry.name).toBeNull();
        expect(state.secondActiveLocation, entry.name).toBeNull();
        expect(controlledIds(state), entry.name).toEqual([]);
        const staged = state.staging.map((id) => state.cards[id]).filter((card) => card != null);
        // Each player added 1 enemy and 1 unique location (the second player's is another one: the first player's is no longer offered).
        expect(staged.filter((card) => OSGILIATH.has(card.code)), entry.name).toHaveLength(entry.seatCount);
        expect(staged.filter((card) => card.code === WEST_GATE), entry.name).toHaveLength(1);
        expect(staged.filter((card) => !OSGILIATH.has(card.code) && !card.code.startsWith("q")), entry.name.length > 0 ? entry.name : "").not.toHaveLength(0);
      },
    },
    wins: "ends at the end of a round in which no Osgiliath location is in the staging area or active, settles at once with a score and earns nothing",
    won(state, entry) {
      // Stage 1B has no quest points, so the stage is never defeated by progress: the win is the Forced effect's.
      expect(codeOf(state, state.questStage), entry.name).toBe(RETAKE);
      expect(osgiliathIn(state), entry.name).toEqual([]);
      expect(state.activeLocation, entry.name).toBeNull();
      // Every Osgiliath location the game revealed is in the first player's play area or the discard pile (a location explored and not kept does not exist here): at least one is controlled.
      expect(controlledIds(state).length, entry.name).toBeGreaterThan(0);
    },
    lost(state, entry) {
      const seats = state.seats.slice(0, entry.seatCount);
      expect(seats.every((seat) => seat.eliminated), entry.name).toBe(true);
      if (entry.name.endsWith("threat 50")) expect(seats.every((seat) => seat.threat >= 50), entry.name).toBe(true);
      else expect(seats.every((seat) => seat.heroes.length === 0), entry.name).toBe(true);
    },
    checks({ game, world }) {
      it("takes control of each Osgiliath location the players explore: it lies in the first player's play area with no progress, ready, and the control stays when the token passes", () => {
        const played = game(golden("solo win"));
        const moments = momentsOf(played);
        // Nine locations taken, each at the intent that explored it: the codes and the intents are the game's (West Gate and The Old Bridge, taken again after they were returned, and East Quarter twice).
        expect(list(moments, "taken")).toEqual(["19:06099", "31:06101", "31:06096", "41:06101", "52:06100", "78:06097", "79:06103", "84:06099", "87:06096"]);
        for (const moment of moments.filter((item) => item.kind === "taken")) {
          const after = played.trail?.[moment.at] as ScenarioState;
          const id = controlledIds(after).find((cardId) => codeOf(after, cardId) === moment.code && keptOf(played, moment.at).cards[cardId]?.zone !== "play") ?? "";
          const label = `${moment.at}:${moment.code}`;
          expect(after.seats[0]?.play, label).toContain(id);
          expect(after.cards[id]?.progress ?? 0, label).toBe(0);
          expect(after.cards[id]?.exhausted ?? false, label).toBe(false);
        }
        // Two-handed: the first-player token passes after each round and the control stays with the player who took it.
        const two = game(golden("two-handed win"));
        const trail = two.trail ?? [];
        const first = trail.findIndex((state) => controlledIds(state).length > 0);
        expect(first).toBeGreaterThanOrEqual(0);
        const taker = (trail[first] as ScenarioState).firstPlayer;
        const passed = trail.findIndex((state, index) => index > first && state.firstPlayer !== taker);
        expect(passed).toBeGreaterThan(first);
        // The location taken before the token passed stays in the taker's area; a location taken after it is the new first player's (06091:B:2 says "the first player").
        const kept = controlledIds(trail[first] as ScenarioState);
        const later = trail[passed] as ScenarioState;
        for (const id of kept) expect(later.seats[taker]?.play, codeOf(later, id)).toContain(id);
        expect(controlledIds(later).length).toBeGreaterThanOrEqual(kept.length);
        const owners = (trail.at(-1) as ScenarioState).seats.map((seat, index) => (seat.play ?? []).filter((id) => OSGILIATH.has(codeOf(trail.at(-1) as ScenarioState, id))).length > 0 ? index : -1).filter((index) => index >= 0);
        expect(owners).toEqual([0, 1]);
      });

      it("loses control to an undefended attack, to a travel to the controlled location and to West Gate's Action, each once, and a lost location returns to the staging area with its progress gone", () => {
        const played = game(golden("solo win"));
        const moments = momentsOf(played);
        expect(list(moments, "lostUndefended")).toEqual(["22:06099"]);
        expect(list(moments, "lostTravel")).toEqual(["33:06101"]);
        expect(list(moments, "lostOther")).toEqual(["61:06096"]);
        expect(list(moments, "gate")).toEqual(["2:06096", "60:06096"]);
        // An undefended attack: The Old Bridge (06099) returns to the staging area, and the hero still takes the damage.
        const bridge = idOf(moments, "lostUndefended", 22);
        const before = keptOf(played, 22);
        const after = played.trail?.[22] as ScenarioState;
        expect(played.intents[22]?.type).toBe("Undefended");
        expect(before.seats[0]?.play).toContain(bridge);
        expect(after.staging).toContain(bridge);
        expect(controlledIds(after)).not.toContain(bridge);
        const damage = (state: ScenarioState) => state.seats[0]?.heroes.reduce((sum, id) => sum + (state.cards[id]?.damage ?? 0), 0) ?? 0;
        expect(damage(after)).toBeGreaterThan(damage(before));
        // A travel to a controlled location: East Quarter (06101) is the active location and no longer controlled; its Battle shows (Siege and Battle come from the active location).
        const quarter = idOf(moments, "lostTravel", 33);
        const travel = played.intents[33];
        expect(travel).toEqual({ type: "Travel", locationId: quarter });
        expect(controlledIds(keptOf(played, 33))).toContain(quarter);
        const arrived = played.trail?.[33] as ScenarioState;
        expect(arrived.activeLocation).toBe(quarter);
        expect(controlledIds(arrived)).not.toContain(quarter);
        expect(arrived.cards[quarter]?.progress ?? 0).toBe(0);
        expect(arrived.seats[0]?.play).not.toContain(quarter);
        expect(questKeyword(arrived)).toBe("battle");
        // West Gate's Action from the first player's play area: no active location, the Gate becomes the active location, and so leaves his area.
        const gate = idOf(moments, "lostOther", 61);
        const beforeGate = keptOf(played, 60);
        expect(played.intents[60]).toMatchObject({ type: "Trigger", effectId: "06096:action:1" });
        expect(beforeGate.seats[0]?.play).toContain(gate);
        expect(beforeGate.activeLocation).toBeNull();
        const afterGate = played.trail?.[61] as ScenarioState;
        expect(afterGate.activeLocation).toBe(gate);
        expect(controlledIds(afterGate)).not.toContain(gate);
        expect(afterGate.seats[0]?.play).not.toContain(gate);
      });

      it("gives the quest Siege from West Quarter and Battle from East Quarter while each is the active location, never both", () => {
        const played = game(golden("solo win"));
        const moments = momentsOf(played);
        expect(list(moments, "battle")).toEqual(["33:06101"]);
        expect(list(moments, "siege")).toEqual(["43:06100"]);
        const trail = played.trail ?? [];
        for (const state of trail) {
          const active = [codeOf(state, state.activeLocation), codeOf(state, state.secondActiveLocation)];
          expect(questKeyword(state)).toBe(active.includes("06100") ? "siege" : active.includes("06101") ? "battle" : "");
        }
        expect(trail.some((state) => questKeyword(state) === "battle")).toBe(true);
        expect(trail.some((state) => questKeyword(state) === "siege")).toBe(true);
      });

      it("has two active locations with Ruined Tower, and the first player divides the quest's progress between them", () => {
        const played = game(golden("solo win"));
        const moments = momentsOf(played);
        expect(list(moments, "twoActive")).toEqual(["68:06103"]);
        expect(list(moments, "split")).toEqual(["79:06103"]);
        const after = played.trail?.[68] as ScenarioState;
        const tower = idOf(moments, "twoActive", 68);
        expect(after.secondActiveLocation).toBe(tower);
        expect(after.activeLocation).not.toBeNull();
        expect(played.intents[68]?.type).toBe("Choose");
        // The window before the split offers each division; the answer puts the progress on the two locations.
        const asked = keptOf(played, 79);
        expect(asked.window?.kind).toBe("choose");
        expect(asked.window?.kind === "choose" ? asked.window.options.every((option) => option.startsWith("split:")) : false).toBe(true);
        expect(asked.secondActiveLocation).toBe(tower);
        const progress = (state: ScenarioState) => [state.activeLocation, state.secondActiveLocation].map((id) => state.cards[id ?? ""]?.progress ?? 0);
        const settled = played.trail?.[79] as ScenarioState;
        const placed = progress(asked).map((value, index) => value + (progress(settled)[index] ?? 0));
        expect(placed.length).toBe(2);
        // Ruined Tower is explored by the share or still in play; the locations the share explored are controlled.
        expect(controlledCodes(settled)).toContain("06103");
      });

      it("makes the destroyed character's controller return a location he controls when a Shadow of West Quarter, East Quarter or Pinned Down is dealt to the attack", () => {
        const played = game(golden("solo loss: every hero destroyed"));
        const { ctx } = world(golden("solo loss: every hero destroyed"));
        const returns = shadowReturns(played, ctx);
        expect(list(returns, "shadowReturn")).toEqual(["31:06100"]);
        const moments = momentsOf(played);
        expect(list(moments, "lostDestroyed")).toEqual(["31:06100"]);
        expect(list(moments, "lostUndefended")).toEqual([]);
        // At that intent the first player controlled West Quarter alone, a hero was destroyed by the attack, and West Quarter is back in the staging area.
        const before = keptOf(played, 31);
        const after = played.trail?.[31] as ScenarioState;
        expect(controlledCodes(before)).toEqual(["06100"]);
        expect(controlledCodes(after)).toEqual([]);
        expect(after.staging).toContain(idOf(returns, "shadowReturn", 31));
        const killed = stepsByIntent(played, ctx)[31]?.filter((step) => step.kind === "destroy" && before.cards[step.targetId]?.zone === "heroes") ?? [];
        expect(killed).toHaveLength(1);
      });

      it("has a Haradrim Elite chosen at Setup attack the first player at once, and no Setup attack when another enemy is chosen", () => {
        const { ctx } = world(golden("solo win, Haradrim Elite at Setup"));
        const attacksBeforeQuest = (name: string) => {
          const played = game(golden(name));
          const quest = played.steps.findIndex((step) => step.kind === "quest");
          return played.steps.slice(0, quest).filter((step) => step.kind === "attack" && step.side === "enemy").map((step) => codeOf(played.state, (step as { enemyId: string }).enemyId));
        };
        expect(attacksBeforeQuest("solo win, Haradrim Elite at Setup")).toEqual([HARADRIM_ELITE]);
        const played = game(golden("solo win, Haradrim Elite at Setup"));
        // The Setup's first choice is the enemy, the second the unique location; the attack is the Elite's Forced effect on entering the staging area, so it is answered by the first Setup intents.
        expect(played.intents.slice(0, 3).map((intent) => intent.type)).toEqual(["Choose", "DeclareDefender", "Choose"]);
        const elite = Object.values(played.kept.cards).filter((card) => card.code === HARADRIM_ELITE).map((card) => card.id);
        expect(elite).toContain((played.intents[0] as { optionId: string }).optionId);
        expect(played.intents[0]).toEqual({ type: "Choose", optionId: (played.intents[0] as { optionId: string }).optionId });
        const first = stepsByIntent(played, ctx)[1] ?? [];
        expect(first.filter((step) => step.kind === "strike" && step.undefended === false)).toHaveLength(1);
        expect(attacksBeforeQuest("solo win")).toEqual([]);
        expect(attacksBeforeQuest("two-handed win")).toEqual([]);
      });

      it("deals each player a Setup choice of 1 enemy and 1 unique location, the second player's location another one, and the Easy deal leaves out the Uruk Lieutenant and the Southron Commander", () => {
        const two = game(golden("two-handed win"));
        expect(two.intents.slice(0, 5).map((intent) => intent.type)).toEqual(["Keep", "Choose", "Choose", "Choose", "Choose"]);
        const places = two.intents.slice(0, 5).map((intent) => (intent as { optionId: string }).optionId).filter((option) => OSGILIATH.has(option));
        expect(places).toEqual([WEST_GATE, "06097"]);
        const dealt = (name: string, code: string) => Object.values(game(golden(name)).state.cards).filter((card) => card.code === code).length;
        expect([dealt("solo win", "06092"), dealt("solo win", "06095")]).toEqual([2, 2]);
        expect([dealt("Easy solo win", "06092"), dealt("Easy solo win", "06095")]).toEqual([0, 0]);
      });
    },
  });
});
