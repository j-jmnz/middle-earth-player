// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.destroy, rr.reveal, rr.engagement-check, ats.captain-enemies, ats.setup-the-morgul-vale, ats.setup-the-morgul-vale-to-the-tower, ltp.scoring (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { ALCARON, BODYGUARD, BRIDGE, BETRAYAL, CAPTAINS, MURZAG, NAZGUL, POWER, REARGUARD, RIDER, ROAD, TOWER, VALE_GOLDENS, valeWorld, playGolden, type ValeDecks, type ValeGolden } from "../../../../test/scenarios/the-morgul-vale/game.ts";
import { beforeOf, codeOf, effectOf, idOfCode, momentsOf, stepsByIntent, towerOf, type Kind, type Moment } from "../../../../test/scenarios/the-morgul-vale/moments.ts";
import type { ScenarioState } from "../../../../src/rules/core/state.ts";
import { stagingThreat, stagingThreatSources } from "../../../../src/rules/quest/quest.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("against-the-shadow");
const vale = loadAnyScenario("the-morgul-vale");
const golden = (name: string): ValeGolden => VALE_GOLDENS.find((entry) => entry.name === name) as ValeGolden;
/** A moment as `intent/seat[codes]` (a moment of the whole table has no seat). */
const show = (moment: Moment): string => `${moment.at}${moment.seat >= 0 ? `/${moment.seat}` : ""}[${moment.codes.join(",")}]`;
const list = (moments: readonly Moment[], kind: Kind): string[] => moments.filter((moment) => moment.kind === kind).map(show);
const SOLO = "solo win";
const TWO = "two-handed win";
const EASY = "Easy solo win";
const TOKENS = "solo loss: 10 tokens on To the Tower";
const BRITTLE = "solo loss: every hero destroyed";
const WEAK = "solo loss: threat 50";
const WINS = [SOLO, TWO, EASY];

// A permanent golden: whole standalone games of The Morgul Vale played by the auto-player (test/scenarios/the-morgul-vale/game.ts) on fixed seeds, through three wins and each way to lose. A cycle has no Campaign Mode, so a win settles at once
// with a score and nothing earned. The solo win holds the scenario's moments (the three Captains destroyed in turn, each stage advancing as its Captain is destroyed, progress that advances no stage, tokens on To the Tower, a Bodyguard taking a
// Captain's damage, Murzag's reveal with an enemy that engages and attacks in the same phase, The Power of Mordor counting To the Tower and Murzag without moving them, the Nazgûl's damage cut to 1, The White Bridge with X tokens, Morgul Road's
// Response); the two-handed win adds Lord Alcaron's additional attack and the Bodyguard's switch of an attack to the other player; the Easy win the Easy deal and the Morgul Vale's shadow line; the losses are ten tokens on To the Tower (a
// token from each kind of source), every hero destroyed and threat 50. Update the snapshot only when the change is meant.
describe("The Morgul Vale golden", () => {
  goldenSuite<ValeGolden, ValeDecks>({
    title: "The Morgul Vale",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: vale,
    standalone: true,
    goldens: VALE_GOLDENS,
    world: valeWorld,
    play: playGolden,
    opening: {
      title: "starts on The Rearguard with To the Tower, Murzag and one Morgul Vale in the staging area, Lord Alcaron, the Nazgûl and The White Bridge set aside, and no token on To the Tower",
      check(state, entry) {
        expect(codeOf(state, state.questStage), entry.name).toBe(REARGUARD);
        expect(state.questDeck.map((id) => codeOf(state, id)), entry.name).toEqual([BETRAYAL, RIDER]);
        expect(state.staging.map((id) => codeOf(state, id)).sort(), entry.name).toEqual([TOWER, MURZAG, "06155"].sort());
        for (const code of [ALCARON, NAZGUL, BRIDGE]) expect(Object.values(state.cards).find((card) => card.code === code)?.zone, `${entry.name} ${code}`).toBe("setAside");
        expect(towerOf(state), entry.name).toBe(0);
      },
    },
    wins: "ends when the players destroy the Nazgûl of Minas Morgul, settles at once with a score and earns nothing",
    won(state, entry) {
      expect(codeOf(state, state.questStage), entry.name).toBe(RIDER);
      expect(Object.values(state.cards).find((card) => card.code === NAZGUL)?.zone, entry.name).toBe("encounterDiscard");
      expect(towerOf(state), entry.name).toBeLessThan(10);
    },
    lost(state, entry) {
      const seats = state.seats.slice(0, entry.seatCount);
      if (entry.name === TOKENS) {
        expect(towerOf(state), entry.name).toBe(10);
        expect(seats.every((seat) => !seat.eliminated), entry.name).toBe(true);
      } else if (entry.name === WEAK) {
        expect(seats.every((seat) => seat.eliminated && seat.threat >= 50), entry.name).toBe(true);
      } else {
        expect(seats.every((seat) => seat.eliminated && seat.heroes.length === 0), entry.name).toBe(true);
      }
    },
    checks({ game, world }) {
      const at = (name: string) => {
        const played = game(golden(name));
        const { ctx } = world(golden(name));
        return { played, ctx, moments: momentsOf(played, ctx), steps: stepsByIntent(played, ctx), after: (index: number) => played.trail?.[index] as ScenarioState, before: (index: number) => beforeOf(played, index) };
      };

      it("destroys each Captain in turn, the stage advancing in the intent that destroys him, and the Nazgûl's destruction wins at once", () => {
        const expected: Record<string, string[]> = { [SOLO]: ["19[06151]", "31[06152]", "146[06153]"], [TWO]: ["39[06151]", "66[06152]", "260[06153]"], [EASY]: ["8[06151]", "32[06152]", "167[06153]"] };
        for (const name of WINS) {
          const { moments, after, before, played } = at(name);
          expect(list(moments, "captain"), name).toEqual(expected[name]);
          const [first, second, third] = moments.filter((moment) => moment.kind === "captain");
          // The Captain is destroyed (damage at his hit points) and goes to the encounter discard pile, not removed.
          for (const moment of [first, second, third] as Moment[]) {
            expect(after(moment.at).cards[moment.ids?.[0] ?? ""]?.zone, `${name} ${moment.codes[0]}`).toBe("encounterDiscard");
            expect(after(moment.at).cards[moment.ids?.[0] ?? ""]?.damage, `${name} ${moment.codes[0]}`).toBeGreaterThan(0);
          }
          // Stage 1 to 2 at Murzag's destruction, stage 2 to 3 at Lord Alcaron's; the next Captain is added to the staging area by the new stage in the same intent.
          expect(list(moments, "advance"), name).toEqual([`${first?.at}[${REARGUARD},${BETRAYAL}]`, `${second?.at}[${BETRAYAL},${RIDER}]`]);
          expect(after(first?.at ?? 0).staging.map((id) => codeOf(after(first?.at ?? 0), id))).toContain(ALCARON);
          expect(before(first?.at ?? 0).staging.map((id) => codeOf(before(first?.at ?? 0), id))).not.toContain(ALCARON);
          const stagedAfterSecond = after(second?.at ?? 0).staging.map((id) => codeOf(after(second?.at ?? 0), id));
          expect(stagedAfterSecond).toEqual(expect.arrayContaining([NAZGUL, BRIDGE]));
          // The Nazgûl's destruction wins in the same intent: no earlier state is won.
          expect(list(moments, "won"), name).toEqual([`${third?.at}[${RIDER}]`]);
          expect(played.trail?.slice(0, third?.at).some((state) => state.stageCleared), name).toBe(false);
          expect(played.intents.length - 1, name).toBe(third?.at);
        }
        // A game lost before the Nazgûl comes destroys the Captains that came in turn and never the later ones.
        expect(list(at(TOKENS).moments, "captain")).toEqual(["31[06151]", "48[06152]"]);
        expect(list(at(BRITTLE).moments, "captain")).toEqual(["9[06151]"]);
        expect(list(at(WEAK).moments, "captain")).toEqual([]);
      });

      it("never lets a Captain of the current stage leave play except destroyed: no discard, shuffle, return to the deck or removal reaches him", () => {
        for (const entry of VALE_GOLDENS) {
          const { played, steps, moments } = at(entry.name);
          const trail = played.trail ?? [];
          const stageOf = new Map([[MURZAG, REARGUARD], [ALCARON, BETRAYAL], [NAZGUL, RIDER]]);
          trail.forEach((state, index) => {
            const before = beforeOf(played, index);
            const destroyed = new Set(steps[index]?.flatMap((step) => (step.kind === "destroy" ? [step.targetId] : [])));
            for (const card of Object.values(before.cards)) {
              if (!CAPTAINS.includes(card.code) || codeOf(before, before.questStage) !== stageOf.get(card.code) || !["staging", "engaged", "play"].includes(card.zone)) continue;
              // Stage of the Captain current before the intent and the Captain in play: after it he is still in play, or destroyed.
              const now = state.cards[card.id]?.zone;
              expect(["staging", "engaged", "play"].includes(now ?? "") || destroyed.has(card.id), `${entry.name} intent ${index} ${card.code} ${now}`).toBe(true);
            }
          });
          expect(moments.length, entry.name).toBeGreaterThan(0);
        }
      });

      it("places no stage progress that advances a stage: the stages print no quest points, the progress stays on the stage and only the Captain's destruction advances", () => {
        for (const name of [SOLO, TWO, EASY, TOKENS, BRITTLE]) {
          const { moments, after, before, ctx } = at(name);
          const placed = moments.filter((moment) => moment.kind === "stageProgress");
          expect(placed.length, name).toBeGreaterThan(0);
          for (const moment of placed) {
            // The stage is the same before and after the intent, holds the progress, and has no quest points.
            expect(codeOf(after(moment.at), after(moment.at).questStage), `${name} ${moment.at}`).toBe(moment.codes[0]);
            expect(codeOf(before(moment.at), before(moment.at).questStage), `${name} ${moment.at}`).toBe(moment.codes[0]);
            expect(after(moment.at).cards[after(moment.at).questStage ?? ""]?.progress ?? 0, `${name} ${moment.at}`).toBeGreaterThanOrEqual(Number(moment.codes[1]));
            expect(ctx.cards.get(moment.codes[0] ?? "")?.questPoints ?? null, moment.codes[0]).toBeNull();
          }
        }
        expect(list(at(SOLO).moments, "stageProgress")).toEqual(["3[06144,12]", "14[06144,3]", "24[06145,5]", "36[06146,5]", "51[06146,3]", "65[06146,8]", "81[06146,12]", "96[06146,14]", "112[06146,17]", "131[06146,17]"]);
        // Progress of 12 on stage 1 in the first round (intent 3) and the stage is still The Rearguard with Murzag in play.
        expect(codeOf(at(SOLO).after(3), at(SOLO).after(3).questStage)).toBe(REARGUARD);
      });

      it("places a progress token on To the Tower from each kind of source, and only one of the cards that name it each time", () => {
        const expected: Record<string, string[]> = {
          [SOLO]: ["14:06159:whenRevealed:1:1", "28:06152:forced:1:1", "59:06150:shadow:1:1", "106:06150:shadow:1:1", "119:06150:shadow:1:1", "138:06150:shadow:1:1", "144:06152:forced:1:1"],
          [TWO]: ["52:06159:whenRevealed:1:1", "58:06152:forced:1:1", "59:06152:forced:1:1", "60:06152:forced:1:1", "61:06150:shadow:1:1", "169:06150:shadow:1:1", "218:06159:whenRevealed:1:1", "254:06150:shadow:1:1"],
          [EASY]: ["15:06152:forced:1:1", "28:06152:forced:1:1", "29:06152:forced:1:1", "31:06150:shadow:1:1", "65:06150:forced:1:1", "76:06159:whenRevealed:1:1", "95:06150:shadow:1:1"],
          [TOKENS]: ["13:06158:whenRevealed:1:1", "37:06157:whenRevealed:1:3", "46:06149:shadow:1:1", "46:06152:forced:1:1", "47:06150:shadow:1:1", "95:06157:whenRevealed:1:3"],
        };
        for (const name of [SOLO, TWO, EASY, TOKENS]) {
          const { moments, after, before, played } = at(name);
          const tokens = moments.filter((moment) => moment.kind === "token");
          expect(tokens.map((moment) => `${moment.at}:${moment.codes.join(":")}`), name).toEqual(expected[name]);
          // Every intent's change on the card is the tokens placed in it less the tokens removed (Morgul Road).
          for (let index = 0; index < (played.trail?.length ?? 0); index += 1) {
            const placed = tokens.filter((moment) => moment.at === index).reduce((total, moment) => total + Number(moment.codes[1]), 0);
            const removed = moments.filter((moment) => moment.kind === "removed" && moment.at === index).reduce((total, moment) => total + Number(moment.codes[0]), 0);
            expect(towerOf(after(index)) - towerOf(before(index)), `${name} intent ${index}`).toBe(placed - removed);
          }
          // To the Tower stays in the staging area for the whole game.
          for (const state of played.trail ?? []) expect(state.cards[idOfCode(state, TOWER) ?? ""]?.zone, name).toBe("staging");
        }
        // The kinds of source across the games: a Forced effect (Lord Alcaron, the Morgul Tracker), a When Revealed (Terror Drives Them, Impenetrable Fog, Sleepless Malice), a Shadow line (the Morgul Tracker, the Morgul Sorcerer).
        const kinds = new Set([SOLO, TWO, EASY, TOKENS].flatMap((name) => at(name).moments.filter((moment) => moment.kind === "token").map((moment) => moment.codes[0]?.split(":")[1])));
        expect([...kinds].sort()).toEqual(["forced", "shadow", "whenRevealed"]);
      });

      it("loses the game at exactly ten tokens on To the Tower, in the intent that places the tenth", () => {
        const { moments, after, before, played } = at(TOKENS);
        expect(list(moments, "lost")).toEqual(["95[10]"]);
        // Three tokens from Impenetrable Fog on seven: the card holds ten, no more, and no earlier state holds ten.
        expect(towerOf(before(95))).toBe(7);
        expect(towerOf(after(95))).toBe(10);
        expect(played.trail?.slice(0, 95).some((state) => towerOf(state) >= 10 || state.lost)).toBe(false);
        expect(after(95).lossReason).toBe("10 progress tokens lie on To the Tower");
        expect(played.intents.length - 1).toBe(95);
      });

      it("takes the damage meant for a shielded Captain with a Morgul Bodyguard in play, and leaves the Captain unhurt", () => {
        const expected: Record<string, string[]> = { [SOLO]: ["76[06153,8]"], [TWO]: ["88[06153,8]"], [EASY]: ["17[06152,9]", "43[06153,8]", "56[06153,8]", "114[06153,8]", "131[06153,8]"], [TOKENS]: ["19[06151,10]", "89[06153,8]"], [WEAK]: ["45[06151,0]"] };
        for (const name of [SOLO, TWO, EASY, TOKENS, WEAK]) {
          const { moments, after, before } = at(name);
          expect(list(moments, "shield"), name).toEqual(expected[name]);
          for (const moment of moments.filter((item) => item.kind === "shield")) {
            const [captain, guard] = moment.ids ?? [];
            // A Bodyguard was in play before the strike, the Captain's damage is the same after, and the Bodyguard took it (or was destroyed by it).
            expect(["staging", "engaged"], `${name} ${moment.at}`).toContain(before(moment.at).cards[guard ?? ""]?.zone);
            expect(codeOf(before(moment.at), guard), name).toBe(BODYGUARD);
            expect(after(moment.at).cards[captain ?? ""]?.damage, `${name} ${moment.at} ${moment.codes[0]}`).toBe(before(moment.at).cards[captain ?? ""]?.damage);
            const guardAfter = after(moment.at).cards[guard ?? ""];
            expect((guardAfter?.damage ?? 0) > (before(moment.at).cards[guard ?? ""]?.damage ?? 0) || guardAfter?.zone === "encounterDiscard" || Number(moment.codes[1]) === 0, `${name} ${moment.at}`).toBe(true);
          }
        }
      });

      it("switches the attack of an enemy to the other player when a Morgul Bodyguard is dealt as its shadow card, in a two-handed game only", () => {
        const { moments, after, before, steps } = at(TWO);
        expect(list(moments, "switch")).toEqual(["59/1[06152]", "108/1[05049]", "200/1[05058]", "201/0[05058]", "223/1[06153]", "224/0[06153]"]);
        for (const moment of moments.filter((item) => item.kind === "switch")) {
          const enemy = moment.ids?.[0] ?? "";
          const from = 1 - moment.seat;
          // The enemy was engaged with the defending player, and engages the other: it leaves the first player's engaged enemies and joins the second's.
          expect(before(moment.at).seats[from]?.engaged, `${moment.at}`).toContain(enemy);
          expect(after(moment.at).seats[moment.seat]?.engaged, `${moment.at}`).toContain(enemy);
          expect(after(moment.at).seats[from]?.engaged, `${moment.at}`).not.toContain(enemy);
          // The attack that was in progress ends with no damage to its defender: no strike of this enemy on the first player in the intent.
          expect(steps[moment.at]?.some((step) => step.kind === "strike" && step.side === "enemy" && step.enemyId === enemy && after(moment.at).cards[step.targetId]?.controller === from), `${moment.at}`).toBe(false);
        }
        // With one player the Bodyguard's shadow line does nothing: the solo games switch nothing although the Bodyguards come up as shadow cards.
        for (const name of [SOLO, EASY, TOKENS, BRITTLE, WEAK]) expect(list(at(name).moments, "switch"), name).toEqual([]);
      });

      it("reveals the top card of the encounter deck when Murzag attacks: an enemy engages the defender and attacks in the same phase with no shadow card, a location goes to the staging area", () => {
        const expected: Record<string, [string[], string[]]> = {
          [SOLO]: [["6/0[05050,engaged]", "18/0[06154,kept]"], ["6/0[05050]"]],
          [TWO]: [["14/0[06149,engaged]", "36/1[05057,engaged]"], ["14/0[06149]", "36/1[05057]"]],
          [EASY]: [["6/0[06150,engaged]", "145/0[05057,engaged]", "163/0[06155,kept]"], ["6/0[06150]", "145/0[05057]"]],
        };
        for (const name of [SOLO, TWO, EASY]) {
          const { moments, after, before, steps, ctx } = at(name);
          expect(list(moments, "murzag"), name).toEqual(expected[name]?.[0]);
          expect(list(moments, "revealAttack"), name).toEqual(expected[name]?.[1]);
          for (const moment of moments.filter((item) => item.kind === "murzag")) {
            const card = moment.ids?.[0] ?? "";
            const type = ctx.cards.get(moment.codes[0] ?? "")?.type;
            if (moment.codes[1] === "engaged") {
              // The enemy engages the defending player in the same intent as Murzag's attack ends ...
              expect(type, `${name} ${moment.at}`).toBe("enemy");
              expect(after(moment.at).seats[moment.seat]?.engaged, `${name} ${moment.at}`).toContain(card);
              expect(before(moment.at).cards[card]?.zone, `${name} ${moment.at}`).toBe("encounterDeck");
              // ... and attacks in the same round and phase, with no shadow card dealt to it.
              const flat = steps.flatMap((list, index) => list.map((step) => ({ step, index })));
              const first = flat.findIndex((item) => item.index >= moment.at && item.step.kind === "attack" && item.step.side === "enemy" && item.step.enemyId === card);
              expect(first, `${name} ${moment.at}`).toBeGreaterThanOrEqual(0);
              const attack = flat[first]?.index ?? 0;
              expect(after(attack).round, `${name} ${moment.at}`).toBe(after(moment.at).round);
              expect(after(attack).phase, `${name} ${moment.at}`).toBe("Combat");
              const struck = flat.findIndex((item, at) => at > first && item.step.kind === "strike" && item.step.side === "enemy" && item.step.enemyId === card);
              expect(struck, `${name} ${moment.at}`).toBeGreaterThan(first);
              expect(flat.slice(first, struck).filter((item) => item.step.kind === "push" && item.step.frame === "shadow"), `${name} ${moment.at}`).toEqual([]);
            } else {
              // A location or objective goes to the staging area, a treachery is discarded after its When Revealed.
              expect(after(moment.at).cards[card]?.zone, `${name} ${moment.at}`).toBe(type === "treachery" ? "encounterDiscard" : "staging");
            }
          }
        }
      });

      it("makes an additional attack when Lord Alcaron is dealt a shadow card with no shadow effect, with a shadow card of its own, and a token on To the Tower for each attack he begins", () => {
        const expected: Record<string, string[]> = { [TWO]: ["59/1[]"], [EASY]: ["29/0[]"], [BRITTLE]: ["43/0[]"] };
        for (const name of [TWO, EASY, BRITTLE]) {
          const { moments, steps, ctx, after } = at(name);
          expect(list(moments, "alcaron"), name).toEqual(expected[name]);
          const moment = moments.find((item) => item.kind === "alcaron") as Moment;
          const enemy = moment.ids?.[0] ?? "";
          // The attack before it dealt a blank card (no record of a shadow line), and the second attack deals another card.
          const pushed: { code: string; at: number }[] = [];
          steps.forEach((list, index) => list.forEach((step) => { if (index <= moment.at && step.kind === "push" && step.frame === "shadow") pushed.push({ code: codeOf(after(index), step.cardId), at: index }); }));
          const attacks: number[] = [];
          steps.forEach((list, index) => list.forEach((step) => { if (index <= moment.at && step.kind === "attack" && step.side === "enemy" && step.enemyId === enemy) attacks.push(index); }));
          expect(attacks.length, name).toBeGreaterThanOrEqual(2);
          const blank = (code: string) => !ctx.effects.some((effect) => effect.cardCode === code && effect.timing === "shadow");
          const dealtFirst = pushed.filter((item) => item.at >= (attacks.at(-2) ?? 0) && item.at <= moment.at);
          expect(dealtFirst.some((item) => blank(item.code)), `${name} a blank shadow card was dealt`).toBe(true);
        }
        // Each attack Alcaron begins puts one token on To the Tower: the tokens of his Forced line come one for each of his attacks.
        const two = at(TWO);
        expect(two.moments.filter((moment) => moment.kind === "token" && moment.codes[0] === "06152:forced:1").map((moment) => moment.at)).toEqual([58, 59, 60]);
      });

      it("cuts every damage dealt to the Nazgûl of Minas Morgul to 1, whatever the attack", () => {
        for (const name of [SOLO, TWO, EASY, TOKENS]) {
          const { moments } = at(name);
          const cuts = moments.filter((moment) => moment.kind === "cap");
          expect(cuts.length, name).toBeGreaterThan(0);
          for (const moment of cuts) {
            // An attack of 8 more than the Nazgûl's Defense deals 1 damage, not 8.
            expect(Number(moment.codes[0]), `${name} ${moment.at}`).toBeGreaterThan(1);
            expect(moment.codes[1], `${name} ${moment.at}`).toBe("1");
          }
        }
        expect(list(at(SOLO).moments, "cap")).toEqual(["60[8,1]", "90[8,1]", "107[8,1]", "125[8,1]", "146[8,1]"]);
        // Five attacks of 1 destroy a Nazgûl with 5 hit points (the destruction at the last).
        expect(at(SOLO).after(146).cards[at(SOLO).moments.find((moment) => moment.kind === "captain" && moment.codes[0] === NAZGUL)?.ids?.[0] ?? ""]?.damage).toBeGreaterThanOrEqual(5);
      });

      it("counts To the Tower and the Captain in the staging area for The Power of Mordor without moving them", () => {
        const expected: Record<string, string[]> = { [SOLO]: ["13[06151]"], [TWO]: ["30[06151]"] };
        for (const name of [SOLO, TWO]) {
          const { moments, after, before, steps } = at(name);
          expect(list(moments, "power"), name).toEqual(expected[name]);
          const moment = moments.find((item) => item.kind === "power") as Moment;
          const staged = before(moment.at).staging.map((id) => codeOf(before(moment.at), id));
          // Both lie in the staging area when it is revealed, and both lie there after: the cards that can move are shuffled into the encounter deck.
          expect(staged, name).toEqual(expect.arrayContaining([TOWER, MURZAG, ...moment.codes]));
          const murzag = idOfCode(before(moment.at), MURZAG) ?? "";
          const tower = idOfCode(before(moment.at), TOWER) ?? "";
          expect(after(moment.at).cards[murzag]?.zone, name).toBe(before(moment.at).cards[murzag]?.zone);
          expect(after(moment.at).cards[tower]?.zone, name).toBe("staging");
          expect(towerOf(after(moment.at)), name).toBe(towerOf(before(moment.at)));
          expect(steps[moment.at]?.some((step) => step.kind === "push" && step.frame === "whenRevealed" && codeOf(after(moment.at), step.cardId) === POWER), name).toBe(true);
        }
      });

      it("gives The White Bridge a Threat and quest points of the tokens on To the Tower: X in the staging area's total, and nothing when there is no token", () => {
        const expected: Record<string, string[]> = {
          [SOLO]: ["36[2,staging]", "51[2,staging]", "65[2,staging]", "81[1,active]"],
          [EASY]: ["37[3,staging]", "48[3,active]"],
          [TOKENS]: ["53[7,staging]", "65[7,staging]", "80[7,staging]"],
        };
        for (const name of [SOLO, EASY, TOKENS]) {
          const { moments, after, ctx, steps } = at(name);
          expect(list(moments, "bridge"), name).toEqual(expected[name]);
          for (const moment of moments.filter((item) => item.kind === "bridge" && item.codes[1] === "staging")) {
            const state = after(moment.at);
            const bridge = idOfCode(state, BRIDGE) ?? "";
            // The Bridge adds the tokens on To the Tower to the staging area's Threat: its own part is X, and the quest step counts the sum.
            const part = stagingThreatSources(state, ctx.cards).sources.find((source) => source.id === bridge);
            expect(part?.threat, `${name} ${moment.at}`).toBe(towerOf(state));
            const quest = steps[moment.at]?.find((step) => step.kind === "quest");
            expect(quest?.kind === "quest" ? quest.threat : -1, `${name} ${moment.at}`).toBe(stagingThreat(state, ctx.cards));
          }
        }
      });

      it("asks each player's choice of the Sorcerer, Impenetrable Fog, Sleepless Malice and Morgul Road and does what the option says", () => {
        const expected: Record<string, string[]> = {
          [SOLO]: ["14/0[06157,reveal]", "51/0[06158,discard]", "53/0[06154,remove]", "67/0[06154,remove]", "131/0[06157,reveal]"],
          [TWO]: ["53/0[06157,reveal]", "103/0[06154,remove]", "128/1[06154,remove]", "156/0[06154,remove]"],
          [EASY]: ["23/0[06158,discard]", "25/0[06154,remove]", "63/0[06154,remove]", "77/0[06158,discard]", "124/0[06149,undefended]"],
          [TOKENS]: ["13/0[06158,token]", "37/0[06157,tokens]", "39/0[06154,damage]", "46/0[06149,place]", "95/0[06157,tokens]"],
        };
        const effectFor: Record<string, string> = { "06149:place": "06149:shadow:1", "06157:tokens": "06157:whenRevealed:1", "06158:token": "06158:whenRevealed:1" };
        for (const name of [SOLO, TWO, EASY, TOKENS]) {
          const { moments, steps, after, before } = at(name);
          expect(list(moments, "choice"), name).toEqual(expected[name]);
          for (const moment of moments.filter((item) => item.kind === "choice")) {
            const key = `${moment.codes[0]}:${moment.codes[1]}`;
            const placed = (steps[moment.at] ?? []).filter((step) => step.kind === "progress" && step.amount > 0 && effectOf(step) === effectFor[key]);
            if (effectFor[key]) expect(placed.length, `${name} ${moment.at} ${key}`).toBe(1);
            // The options that put no token (the attack undefended, a card revealed, cards discarded) place none from that card's effect.
            if (["06149:undefended", "06157:reveal", "06158:discard"].includes(key)) expect((steps[moment.at] ?? []).filter((step) => step.kind === "progress" && step.amount > 0 && effectOf(step).startsWith(moment.codes[0] ?? "")), `${name} ${moment.at} ${key}`).toEqual([]);
            if (key === "06154:remove") expect(towerOf(after(moment.at)) - towerOf(before(moment.at)), `${name} ${moment.at}`).toBeLessThan(0);
            if (key === "06154:damage") expect(steps[moment.at + 1]?.some((step) => step.kind === "damage" && step.amount === 1 && effectOf(step).startsWith(ROAD)), `${name} ${moment.at}`).toBe(true);
          }
        }
      });
    },
  });
});
