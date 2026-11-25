// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, ats.setup-the-blood-of-gondor, ats.hidden-cards, ats.hidden-cards-turn-faceup, ats.ally-objectives, faq.blood-of-gondor-hidden-cards, hon.siege, hon.battle, ltp.scoring (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { ALCARON, AMBUSH, BLOOD_GOLDENS, bloodWorld, CAPTURED, CROSSROADS, FARAMIR, playGolden, type BloodDecks, type BloodGolden } from "../../../../test/scenarios/the-blood-of-gondor/game.ts";
import { beforeOf, codeOf, counts, momentsOf, stepsByIntent, type Kind, type Moment } from "../../../../test/scenarios/the-blood-of-gondor/moments.ts";
import type { ScenarioState } from "../../../../src/rules/core/state.ts";
import { legalIntents } from "../../../../src/rules/engine/reduce.ts";
import { hiddenIds } from "../../../../src/rules/families/pelargir/hidden.ts";
import { currentQuestHas } from "../../../../src/rules/families/quest/conditions.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("against-the-shadow");
const blood = loadAnyScenario("the-blood-of-gondor");
const golden = (name: string): BloodGolden => BLOOD_GOLDENS.find((entry) => entry.name === name) as BloodGolden;
/** The moments of one kind as `intent/seat` (a moment of the whole table has no seat). */
const list = (moments: readonly Moment[], kind: Kind): string[] => moments.filter((moment) => moment.kind === kind).map((moment) => (moment.seat >= 0 ? `${moment.at}/${moment.seat}` : `${moment.at}`));
const SOLO = "solo win";
const TWO = "two-handed win";

// A permanent golden: whole standalone games of The Blood of Gondor played by the auto-player (test/scenarios/the-blood-of-gondor/game.ts) on fixed seeds, through a win and through each way to lose. A cycle has no Campaign Mode, so a win
// settles at once with a score and nothing earned. The solo win holds the scenario's moments (a hidden card taken in the quest phase, by the combat choice, by a Travel cost and by a Shadow line, the combat choice's turn with an enemy that engages and
// attacks in the same phase, Faramir's and Lord Alcaron's Actions, Captured! with the allies held under it, the turn at 5 hidden cards, The Cross-roads giving stage 2 Siege, Conflict at the Crossroads); the two-handed win adds the
// first-player token passing with the control of the allies; the Easy win the Easy deal; the losses are Faramir leaving play, Lord Alcaron leaving play, every hero destroyed and threat 50. Update the snapshot only when the change is meant.
describe("The Blood of Gondor golden", () => {
  goldenSuite<BloodGolden, BloodDecks>({
    title: "The Blood of Gondor",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: blood,
    standalone: true,
    goldens: BLOOD_GOLDENS,
    world: bloodWorld,
    play: playGolden,
    opening: {
      title: "starts on The Ambush with The Cross-roads and the Black Númenorean in the staging area, Faramir and Lord Alcaron in the first player's play area and one revealed card for each player",
      check(state, entry) {
        expect(codeOf(state, state.questStage), entry.name).toBe(AMBUSH);
        expect(state.questDeck.map((id) => codeOf(state, id)), entry.name).toEqual([CAPTURED]);
        const staged = state.staging.map((id) => codeOf(state, id));
        expect(staged, entry.name).toContain(CROSSROADS);
        expect(staged, entry.name).toContain("06119");
        for (const code of [FARAMIR, ALCARON]) {
          const card = Object.values(state.cards).find((item) => item.code === code);
          expect([card?.zone, card?.controller], `${entry.name} ${code}`).toEqual(["play", state.firstPlayer]);
        }
        expect(state.activeLocation, entry.name).toBeNull();
      },
    },
    wins: "ends when the players defeat Captured! (15 quest points), settles at once with a score and earns nothing",
    won(state, entry) {
      expect(codeOf(state, state.questStage), entry.name).toBe(CAPTURED);
      // The allies were held under the stage to the end.
      for (const code of [FARAMIR, ALCARON]) expect(Object.values(state.cards).find((card) => card.code === code)?.zone, `${entry.name} ${code}`).toBe("captive");
    },
    lost(state, entry) {
      const seats = state.seats.slice(0, entry.seatCount);
      const zone = (code: string) => Object.values(state.cards).find((card) => card.code === code)?.zone;
      if (entry.name.endsWith("Faramir leaves play")) {
        expect(zone(FARAMIR), entry.name).not.toBe("play");
        expect(zone(ALCARON), entry.name).toBe("play");
        expect(seats[0]?.eliminated, entry.name).toBe(false);
      } else if (entry.name.endsWith("Lord Alcaron leaves play")) {
        // Seat 0, controlling both allies, reached threat 50: it is eliminated and the cards it controlled leave play.
        expect(seats[0]?.eliminated, entry.name).toBe(true);
        expect(zone(ALCARON), entry.name).toBe("encounterDiscard");
      } else if (entry.name.endsWith("threat 50")) {
        expect(seats.every((seat) => seat.eliminated && seat.threat >= 50), entry.name).toBe(true);
      } else {
        expect(seats.every((seat) => seat.eliminated && seat.heroes.length === 0), entry.name).toBe(true);
      }
    },
    checks({ game, world }) {
      it("takes a hidden card in each way: at the beginning of the quest phase, by the combat choice, by a Travel cost, by a Shadow line and when an enemy engages", () => {
        const moments = momentsOf(game(golden(SOLO)), world(golden(SOLO)).ctx);
        expect(list(moments, "takeQuest")).toEqual(["1/0", "13/0", "28/0", "39/0", "57/0", "74/0", "95/0", "116/0", "142/0", "165/0", "195/0", "226/0", "252/0", "277/0"]);
        expect(list(moments, "takeChoice")).toEqual(["8/0", "35/0", "62/0", "100/0", "147/0", "200/0"]);
        expect(list(moments, "takeTravel")).toEqual(["31/0", "198/0", "229/0"]);
        expect(list(moments, "takeShadow")).toEqual(["22/0", "66/0", "104/0", "136/0", "175/0", "181/0", "268/0"]);
        expect(list(moments, "takeEngaged")).toEqual(["79/0", "122/0", "170/0"]);
        const played = game(golden(SOLO));
        // Each take is one card more in the seat's hidden list: it was no hidden card before and lies facedown after.
        const takes = moments.filter((moment) => moment.kind.startsWith("take") && moment.kind !== "takeRevealed");
        for (const moment of takes) {
          const was = hiddenIds(beforeOf(played, moment.at), moment.seat);
          const now = hiddenIds(played.trail?.[moment.at] as ScenarioState, moment.seat);
          expect(moment.ids?.every((id) => now.includes(id) && !was.includes(id)), `${moment.kind} ${moment.at}`).toBe(true);
          expect(moment.ids, `${moment.kind} ${moment.at}`).toHaveLength(1);
        }
        // The intents of the choice are the ones that took by choice, of the Travel window the ones that took by cost.
        for (const moment of moments.filter((item) => item.kind === "takeChoice")) expect(played.intents[moment.at]).toEqual({ type: "Choose", optionId: "take" });
        for (const moment of moments.filter((item) => item.kind === "takeTravel")) expect(played.intents[moment.at]?.type).toBe("Travel");
      });

      it("turns the hidden cards by the combat choice: each enemy engages the player and attacks in the same phase, a location or a treachery is discarded", () => {
        const played = game(golden(SOLO));
        const { ctx } = world(golden(SOLO));
        const moments = momentsOf(played, ctx);
        expect(list(moments, "turnChoice")).toEqual(["20/0", "79/0", "122/0", "171/0"]);
        for (const moment of moments.filter((item) => item.kind === "turnChoice")) expect(played.intents[moment.at]).toEqual({ type: "Choose", optionId: "turn" });
        // Intent 79: Mordor Looms (treachery) twice, Evil Crow and Brutal Uruk. The enemies engage the player, whatever their engagement cost, and attack before the phase ends.
        const turn = moments.find((item) => item.kind === "turnChoice" && item.at === 79) as Moment;
        const before = beforeOf(played, 79);
        const after = played.trail?.[79] as ScenarioState;
        expect(turn.codes).toEqual(["06130", "06122", "06121", "06130"]);
        const engaged = (turn.ids ?? []).filter((id) => after.seats[0]?.engaged.includes(id));
        expect(engaged.map((id) => codeOf(after, id))).toEqual(["06122", "06121"]);
        const discarded = (turn.ids ?? []).filter((id) => after.cards[id]?.zone === "encounterDiscard");
        expect(discarded.map((id) => codeOf(after, id))).toEqual(["06130", "06130"]);
        expect(before.phase).toBe("Combat");
        const steps = stepsByIntent(played, ctx);
        const attackers = new Set<string>();
        for (let at = 79; at < played.intents.length; at += 1) {
          const state = played.trail?.[at] as ScenarioState;
          if (state.round !== after.round) break;
          for (const step of steps[at] ?? []) if (step.kind === "strike" && step.side === "enemy") attackers.add(step.enemyId);
        }
        for (const id of engaged) expect(attackers.has(id), codeOf(after, id)).toBe(true);
        // Intent 20: a location (Northern Road) and a treachery (Lying in Wait): both discarded, nothing engaged.
        const quiet = moments.find((item) => item.kind === "turnChoice" && item.at === 20) as Moment;
        const later = played.trail?.[20] as ScenarioState;
        expect(quiet.codes).toEqual(["06129", "06126"]);
        expect((quiet.ids ?? []).every((id) => later.cards[id]?.zone === "encounterDiscard")).toBe(true);
      });

      it("turns the hidden cards of a seat that holds 5 on stage 2 at once, one instruction at a time, the cards taken by the turn staying facedown", () => {
        const solo = game(golden(SOLO));
        const { ctx } = world(golden(SOLO));
        const moments = momentsOf(solo, ctx);
        expect(list(moments, "turnFive")).toEqual(["279/0"]);
        const before = beforeOf(solo, 279);
        const after = solo.trail?.[279] as ScenarioState;
        // The seat held 4 hidden cards, took the fifth at the beginning of the quest phase and holds none; the stage is Captured!.
        expect(counts(before)[0]).toBe(4);
        expect(counts(after)[0]).toBe(0);
        expect(codeOf(after, after.questStage)).toBe(CAPTURED);
        const two = momentsOf(game(golden(TWO)), world(golden(TWO)).ctx);
        expect(list(two, "turnFive")).toEqual(["172/0", "172/1"]);
      });

      it("places Faramir and Lord Alcaron under Captured! (still in play, controlled by nobody), turns every hidden card, and gives stage 2 Siege while The Cross-roads is in the staging area", () => {
        const played = game(golden(SOLO));
        const { ctx } = world(golden(SOLO));
        const moments = momentsOf(played, ctx);
        expect(list(moments, "captured")).toEqual(["228"]);
        expect(list(moments, "turnCaptured")).toEqual(["228/0"]);
        expect(list(moments, "crossroads")).toEqual(["228"]);
        const before = beforeOf(played, 228);
        const after = played.trail?.[228] as ScenarioState;
        expect(codeOf(before, before.questStage)).toBe(AMBUSH);
        const stage = after.questStage ?? "";
        for (const code of [FARAMIR, ALCARON]) {
          const card = Object.values(after.cards).find((item) => item.code === code);
          expect(card?.zone, code).toBe("captive");
          expect(card?.host, code).toBe(stage);
          expect(card?.controller ?? null, code).toBeNull();
        }
        expect(counts(after)[0]).toBe(0);
        // The allies stay held to the end and no Action of theirs is used after.
        for (const state of (played.trail ?? []).slice(228)) for (const code of [FARAMIR, ALCARON]) expect(Object.values(state.cards).find((item) => item.code === code)?.zone).toBe("captive");
        expect([...list(moments, "faramir"), ...list(moments, "alcaron")].every((entry) => Number(entry.split("/")[0]) < 228)).toBe(true);
        // The Cross-roads is in the staging area on stage 2: Siege (characters quest with Defense), no Battle although Captured! prints it.
        const crossroads = Object.values(after.cards).find((card) => card.code === CROSSROADS);
        expect(crossroads?.zone).toBe("staging");
        expect(currentQuestHas(after, "siege", ctx.cards)).toBe(true);
        expect(currentQuestHas(after, "battle", ctx.cards)).toBe(false);
        // The Cross-roads gives whatever quest card is current Siege, stage 1 too (it has been in the staging area since the Setup).
        expect(currentQuestHas(before, "siege", ctx.cards)).toBe(true);
      });

      it("uses Faramir's Action to turn a hidden card of a player's, 3 damage on an enemy before it engages, and Lord Alcaron's Action to return an engaged enemy to the staging area", () => {
        const played = game(golden(SOLO));
        const { ctx } = world(golden(SOLO));
        const moments = momentsOf(played, ctx);
        expect(list(moments, "turnFaramir")).toEqual(["10/0", "23/0", "36/0", "63/0", "80/0", "101/0", "123/0", "148/0", "176/0", "201/0"]);
        expect(list(moments, "faramir")).toEqual(list(moments, "turnFaramir"));
        expect(list(moments, "alcaron")).toEqual(["6/0", "18/0", "33/0", "42/0", "54/0", "71/0", "92/0", "113/0", "139/0", "162/0", "192/0", "223/0"]);
        // Faramir's turn at 63 and 80 reveals an enemy (Orc Ambusher, Orc Arsonist): 3 damage first, then it engages, if it still lives.
        for (const at of [23, 63, 80, 176]) {
          const moment = moments.find((item) => item.kind === "turnFaramir" && item.at === at) as Moment;
          const id = moment.ids?.[0] ?? "";
          const state = played.trail?.[at] as ScenarioState;
          expect(ctx.cards.get(moment.codes[0] ?? "")?.type, `${at}`).toBe("enemy");
          expect(played.intents[at], `${at}`).toMatchObject({ type: expect.stringMatching(/^(Trigger|Choose)$/) });
          expect(state.cards[id]?.damage ?? 0, `${at}`).toBeGreaterThanOrEqual(3);
        }
        // Alcaron's Action: an enemy engaged with the seat before is in the staging area after, and Alcaron is exhausted.
        for (const moment of moments.filter((item) => item.kind === "alcaron")) {
          const before = beforeOf(played, moment.at);
          const after = played.trail?.[moment.at] as ScenarioState;
          expect(played.intents[moment.at], `${moment.at}`).toMatchObject({ type: "Trigger", effectId: "06133:action:1" });
          const gone = (before.seats[0]?.engaged ?? []).filter((id) => !after.seats[0]?.engaged.includes(id));
          for (const id of gone) expect(after.staging, `${moment.at}`).toContain(id);
          expect(Object.values(after.cards).find((card) => card.code === ALCARON)?.exhausted, `${moment.at}`).toBe(true);
        }
      });

      it("passes the control of Faramir and Lord Alcaron with the first-player token, each Action is used by the player who controls them, and Captured! ends the passing", () => {
        const played = game(golden(TWO));
        const { ctx } = world(golden(TWO));
        const moments = momentsOf(played, ctx);
        expect(list(moments, "control")).toEqual(["28/1", "60/0", "94/1", "132/0", "166/1", "206/0"]);
        const captured = Number(list(moments, "captured")[0]);
        expect(captured).toBe(108);
        for (const moment of moments.filter((item) => item.kind === "control")) {
          const held = moment.at < captured ? `${FARAMIR}:${moment.seat}:play,${ALCARON}:${moment.seat}:play` : `${FARAMIR}:-:captive,${ALCARON}:-:captive`;
          expect(moment.codes[0]?.replace(/\b06133:/, `${ALCARON}:`), `${moment.at}`).toBe(held);
        }
        // Each use is the controller's: the seat that acted is the one that controlled the card before the intent.
        for (const moment of moments.filter((item) => item.kind === "faramir" || item.kind === "alcaron")) {
          const code = moment.kind === "faramir" ? FARAMIR : ALCARON;
          const controller = Object.values(beforeOf(played, moment.at).cards).find((card) => card.code === code)?.controller;
          expect(controller, `${moment.kind} ${moment.at}`).toBe(moment.seat);
        }
        expect(list(moments, "faramir")).toEqual(["20/0", "48/1", "80/0"]);
        expect(list(moments, "alcaron")).toEqual(["14/0", "31/1", "63/0", "97/1"]);
        // The other seat is never offered either Action while it does not control the card.
        const trail = played.trail ?? [];
        for (let at = 0; at < Math.min(trail.length, captured); at += 1) {
          const state = beforeOf(played, at);
          if (state.window?.kind === "choose") continue;
          const offered = legalIntents(state, ctx).filter((intent) => intent.type === "Trigger" && [`${FARAMIR}:action:1`, `${ALCARON}:action:1`].includes(intent.effectId));
          for (const intent of offered) {
            const code = intent.type === "Trigger" && intent.effectId.startsWith(FARAMIR) ? FARAMIR : ALCARON;
            expect(Object.values(state.cards).find((card) => card.code === code)?.controller, `${at}`).toBe(state.activeSeat);
          }
        }
      });

      it("reveals Conflict at the Crossroads, which adds the engaged Orcs' Threat to the staging area until the end of the phase", () => {
        const solo = momentsOf(game(golden(SOLO)), world(golden(SOLO)).ctx);
        expect(list(solo, "conflict")).toEqual(["59"]);
        const two = momentsOf(game(golden(TWO)), world(golden(TWO)).ctx);
        expect(list(two, "conflict")).toEqual(["0", "42", "176"]);
      });

      it("discards a random hidden card of the first player when Dark Woods is explored and turns the hidden cards of a destroyed character's controller (Brutal Uruk)", () => {
        const solo = momentsOf(game(golden(SOLO)), world(golden(SOLO)).ctx);
        expect(list(solo, "discardWoods")).toEqual(["30/0"]);
        expect(list(solo, "turnUruk")).toEqual(["221/0"]);
        const played = game(golden(SOLO));
        const after = played.trail?.[30] as ScenarioState;
        const moment = solo.find((item) => item.kind === "discardWoods") as Moment;
        expect(moment.codes).toHaveLength(1);
        // The discarded card is unresolved: it lies in the encounter discard pile, not in the staging area.
        expect(after.cards[moment.ids?.[0] ?? ""]?.zone).toBe("encounterDiscard");
      });

      it("never names a facedown hidden card in a step before it is turned, in any game", () => {
        for (const entry of BLOOD_GOLDENS) {
          const played = game(entry);
          const steps = stepsByIntent(played, world(entry).ctx);
          steps.forEach((list, at) => {
            // A card revealed in the intent was seen until the reset that shuffles the discard pile back into the deck: when the deck runs out in the staging step, a card just revealed (Lying in Wait) is shuffled back and the next seat's Mordor Looms may take it. From that reset on, a step that names the card without a new reveal gives away a card that lies facedown.
            const seen = new Set<string>();
            const hidden = hiddenIds(played.trail?.[at] as ScenarioState);
            list.forEach((step, index) => {
              if (step.kind === "resetEncounterDeck") seen.clear();
              if (step.kind === "reveal" || (step.kind === "push" && step.frame === "whenRevealed")) seen.add((step as { cardId: string }).cardId);
              const text = JSON.stringify(step);
              for (const id of hidden) if (!seen.has(id)) expect(text.includes(`"${id}"`), `${entry.name} intent ${at} step ${index}`).toBe(false);
            });
          });
        }
      });
    },
  });
});
