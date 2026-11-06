// Rules: rr.campaign-setup-checklist, ltp.campaign-setup-checklist, rr.setup, rr.mulligan, rr.search, emce.boon-allies, emce.treasure, emce.campaign-log, emce.deep, emce.discover, rr.victory (data/rules/entries.json); ledger lines 12195:A:2, 12195:A:3, 12195:B:1.
// The campaign card of The Fate of Wilderland (12195) dealt in a game: its Setup (the search for a boon or treasure card, Turayn's 3 non-unique enemies and Beldis's 3 treacheries), its side A rule (Deep and Discover are ignored) and its Resolution, which ends the campaign.
import { beforeAll, describe, expect, it } from "vitest";

import { checklist } from "../../checklist.ts";
import type { LoadoutSeat } from "../../loadout.ts";
import { resolutionView, settledSentence, type ResolutionView } from "../../resolution-view.ts";
import type { World } from "../../world.ts";
import { campaignScenario, sideInstructions } from "../../../catalog/scenario-data.ts";
import { applyResolution, emptyLog, poolCard, type CampaignLog } from "../../log.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { reduce, startScenario, type ReduceContext } from "../../../rules/engine/reduce.ts";
import { ignoresKeyword } from "../../../rules/families/wilderland/markers.ts";
import { openResolution, resolutionResult } from "../../../rules/setup/resolution.ts";
import { wilderlandLoadout, wilderlandPlan, wilderlandSetupChoices, wilderlandStart, wilderlandWorld } from "../../../../test/scenarios/the-fate-of-wilderland/game.ts";
import { CODES, campaign, wilderland } from "../../../../test/scenarios/the-fate-of-wilderland/scene.ts";
import { FILLER } from "../../../../test/harness/game-kit.ts";

import { campaignPath, nextStep } from "../../path.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

let ctx: ReduceContext;
beforeAll(async () => {
  ctx = (await wilderlandWorld("strong")).ctx;
}, 120_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
// The cards the decks hold below: a treasure, a boon event, a boon attachment and the boon ally Turayn.
const AXE = "12197";
const HUNTSMAN = "12180";
const MASTER = "12176";
const TURAYN = "12166";
const deckWith = (...codes: string[]): string[] => [...codes, ...Array.from({ length: 30 - codes.length }, () => FILLER)];
const loadoutOf = (...decks: string[][]): LoadoutSeat[] => decks.map((deck, index) => ({ heroes: wilderlandLoadout(2)[index]?.heroes ?? ["q1", "q2", "q3"], deck }));
const logged = (...allyLines: ("turayn" | "melanwar" | "isolde" | "beldis")[]): CampaignLog => ({ ...emptyLog(1), allyLines });
// The scenario dealt and its Setup played to the first round: the mulligan is kept and each question is answered with its first option.
function opened(seats: 1 | 2, args: { seed?: number; log?: CampaignLog; choices?: readonly string[]; loadout?: LoadoutSeat[] } = {}): ScenarioState {
  const log = args.log ?? emptyLog(seats);
  let state = startScenario(wilderlandStart(seats, args.seed ?? 1, "Normal", { log, choices: args.choices ?? wilderlandSetupChoices(seats, log, "Normal", args.loadout), loadout: args.loadout }), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
const typeOf = (code: string) => ctx.cards.get(code)?.type;
const UNIQUE = (code: string) => ctx.cards.get(code)?.isUnique === true;
// The Campaign Setup Checklist asked with these answers: what it needs next, or that it is done.
function ask(seats: 1 | 2, log: CampaignLog, choices: readonly string[], loadout: LoadoutSeat[] = wilderlandLoadout(seats)) {
  const plan = checklist({ log, scenario: campaignScenario(wilderland), seats: loadout, effects: EFFECTS, cards: ctx.cards, difficulty: "Normal", choices });
  return { ok: plan.ok, needs: plan.ok ? undefined : plan.needs };
}

describe("12195:A Setup", () => {
  it("12195:A:2 each player may search their deck for a boon or treasure card and add it to their hand: every player is asked, and a treasure or a boon of any type is offered", () => {
    const loadout = loadoutOf(deckWith(AXE, HUNTSMAN, MASTER, TURAYN), deckWith(HUNTSMAN));
    const first = ask(2, emptyLog(2), [], loadout);
    expect(first.ok).toBe(false);
    expect(first.needs).toMatchObject({ seat: 0, options: expect.arrayContaining([AXE, HUNTSMAN, MASTER, TURAYN, "skip"]) });
    expect(first.needs?.options).not.toContain(FILLER);
    // The first player's choice does not end the offer: the second player is asked next.
    const second = ask(2, emptyLog(2), [AXE], loadout);
    expect(second.needs).toMatchObject({ seat: 1, options: [HUNTSMAN, "skip"] });
    expect(ask(2, emptyLog(2), [AXE, HUNTSMAN], loadout).ok).toBe(true);
  });

  it("12195:A:2 the card joins the hand after the mulligan, and the player who skips keeps it in the deck", () => {
    const loadout = loadoutOf(deckWith(AXE, HUNTSMAN), deckWith(MASTER));
    const state = opened(2, { choices: [HUNTSMAN, "skip"], loadout });
    expect(where(state, HUNTSMAN)[0]).toMatchObject({ zone: "hand" });
    expect(state.seats[0]?.hand).toContain(where(state, HUNTSMAN)[0]?.id);
    expect(where(state, AXE)[0]?.zone).toBe("deck");
    expect(where(state, MASTER)[0]?.zone).not.toBe("hand");
    const treasure = opened(1, { choices: [AXE], loadout: loadoutOf(deckWith(AXE)) });
    expect(where(treasure, AXE)[0]).toMatchObject({ zone: "hand" });
  });

  it("12195:A:2 a player whose deck holds no boon or treasure card is not asked, and neither is a table with none", () => {
    expect(wilderlandSetupChoices(1, emptyLog(1))).toEqual([]);
    const loadout = loadoutOf(deckWith(HUNTSMAN), deckWith());
    expect(ask(2, emptyLog(2), [HUNTSMAN], loadout).ok).toBe(true);
  });

  it("12195:A:2 a boon the Campaign Pool gives a player is in their deck by the Setup, so it can be searched for too", () => {
    const log: CampaignLog = { ...emptyLog(1), campaignPool: [poolCard(ctx.cards.get(HUNTSMAN)!, HUNTSMAN, null, 0)] };
    const plan = ask(1, log, []);
    expect(plan.needs).toMatchObject({ seat: 0, options: [HUNTSMAN, "skip"] });
    const state = opened(1, { log, choices: [HUNTSMAN] });
    expect(where(state, HUNTSMAN)).toHaveLength(1);
    expect(where(state, HUNTSMAN)[0]?.zone).toBe("hand");
  });

  it("12195:A:2 with Turayn's line the first player searches the encounter deck for 3 non-unique enemies and removes them from the game; the cards named are never unique", () => {
    for (const seats of [1, 2] as const) {
      const log = { ...logged("turayn"), ...(seats === 2 ? emptyLog(2) : {}), allyLines: ["turayn" as const] };
      const answers = wilderlandSetupChoices(seats, log);
      expect(answers, `${seats} seats`).toHaveLength(3);
      const plan = wilderlandPlan(seats, log, answers);
      expect(plan.removedFromEncounter, `${seats} seats`).toHaveLength(3);
      for (const code of plan.removedFromEncounter) {
        expect(typeOf(code), code).toBe("enemy");
        expect(UNIQUE(code), code).toBe(false);
      }
      // The cards are out of the game: that many fewer copies of each are dealt than in a game with the line unwritten (the stage's Setup moves cards from the deck to the discard pile, so the deck alone says nothing).
      const state = opened(seats, { log, choices: answers });
      const base = opened(seats, { log: { ...log, allyLines: [] }, choices: [] });
      for (const code of new Set(plan.removedFromEncounter)) expect(where(state, code).length, code).toBe(where(base, code).length - plan.removedFromEncounter.filter((removed) => removed === code).length);
      expect(Object.keys(state.cards).length).toBe(Object.keys(base.cards).length - 3);
    }
  });

  it("12195:A:2 with Beldis's line the first player removes 3 treacheries from the encounter deck", () => {
    const log = logged("beldis");
    const answers = wilderlandSetupChoices(1, log);
    expect(answers).toHaveLength(3);
    const plan = wilderlandPlan(1, log, answers);
    expect(plan.removedFromEncounter.map(typeOf)).toEqual(["treachery", "treachery", "treachery"]);
    const state = opened(1, { log, choices: answers });
    const base = opened(1, { log: logged(), choices: [] });
    const treacheries = (s: ScenarioState) => Object.values(s.cards).filter((card) => typeOf(card.code) === "treachery").length;
    expect(treacheries(state)).toBe(treacheries(base) - 3);
  });

  it("12195:A:2 both lines remove their cards, Turayn's enemies first, and the other lines (Melanwar's and Isolde's) remove nothing here", () => {
    const both = logged("turayn", "beldis");
    const answers = wilderlandSetupChoices(1, both);
    expect(answers).toHaveLength(6);
    expect(answers.slice(0, 3).every((code) => typeOf(code) === "enemy")).toBe(true);
    expect(answers.slice(3).every((code) => typeOf(code) === "treachery")).toBe(true);
    expect(wilderlandSetupChoices(1, logged("melanwar", "isolde"))).toEqual([]);
    expect(wilderlandPlan(1, logged("melanwar", "isolde")).removedFromEncounter).toEqual([]);
  });

  it("12195:A the scenario's own cards are dealt: the campaign card on the table, the objectives and Urdug in the staging area, nothing set aside, the quest at stage 1", () => {
    for (const seats of [1, 2] as const) {
      const state = opened(seats);
      expect(where(state, CODES.campaignCard), `${seats} seats`).toMatchObject([{ zone: "campaign" }]);
      for (const code of [CODES.theGoblinsAssault, CODES.theHeroesDefense, CODES.urdug]) expect(where(state, code), `${seats} seats ${code}`).toMatchObject([{ zone: "staging" }]);
      expect(state.cards[state.questStage ?? ""]?.code, `${seats} seats`).toBe(CODES.stage1);
      // The stage's Setup found one enemy for each player.
      const enemies = Object.values(state.cards).filter((card) => card.zone === "staging" && typeOf(card.code) === "enemy" && card.code !== CODES.urdug);
      expect(enemies, `${seats} seats`).toHaveLength(seats);
      expect(where(state, CODES.stage2)[0]?.zone, `${seats} seats`).toBe("questDeck");
    }
  });
});

describe("12195:A the rule of the card", () => {
  it("12195:A:3 the Deep and Discover keywords are ignored while the campaign card is on the table", () => {
    const state = opened(1);
    expect(ignoresKeyword(state, ctx, "deep")).toBe(true);
    expect(ignoresKeyword(state, ctx, "discover")).toBe(true);
  });
});

// The scenario won: the Resolution is open on the state.
const won = (state: ScenarioState): ScenarioState => openResolution({ ...state, stageCleared: true, window: null, stack: [] }, ctx);

describe("12195:B Resolution: The players win the campaign!", () => {
  it("12195:B:1 the card's Resolution is the one printed line, and it asks the players nothing", () => {
    const lines = sideInstructions(EFFECTS, CODES.campaignCard, "B", "resolution");
    expect(lines).toEqual([]);
    expect(EFFECTS.filter((effect) => effect.cardCode === CODES.campaignCard && effect.timing === "resolution").map((effect) => effect.lines)).toEqual([["12195:B:1"]]);
    const state = won(opened(1));
    expect(state.window?.kind).not.toBe("resolution");
  });

  it("12195:B:1 a win writes nothing to the pool and discovers nothing: the campaign is won", () => {
    for (const seats of [1, 2] as const) {
      const result = resolutionResult(won(opened(seats)));
      expect(result, `${seats} seats`).toBeDefined();
      expect(result?.treasures ?? [], `${seats} seats`).toEqual([]);
      expect(result?.encounterPool ?? {}, `${seats} seats`).toEqual({});
    }
  });

  it("12195:B:1 it is the last part of the campaign: winning it unlocks no scenario, and the path is finished", () => {
    expect(campaign.scenarios.at(-1)).toBe(wilderland.id);
    expect(campaign.scenarios.indexOf(wilderland.id)).toBe(8);
    const state = won(opened(1));
    const before = { ...emptyLog(1), completed: campaign.scenarios.slice(0, -1) };
    expect(nextStep(campaignPath(campaign, {}, before), null)).toMatchObject({ kind: "begin", node: { id: wilderland.id } });
    const after = applyResolution(before, wilderland.id, state, ctx.cards, NO_COPY_LIMITS);
    expect(after.completed).toEqual([...campaign.scenarios]);
    expect(nextStep(campaignPath(campaign, {}, after), null)).toEqual({ kind: "finished" });
  });

  it("12195:B:1 a loss writes nothing: the log is the one the game started from, and the part stays to be played", () => {
    const lost = { ...opened(1), lost: true };
    const before = { ...emptyLog(1), completed: campaign.scenarios.slice(0, -1) };
    expect(applyResolution(before, wilderland.id, lost, ctx.cards, NO_COPY_LIMITS)).toBe(before);
    expect(nextStep(campaignPath(campaign, {}, before), null)).toMatchObject({ kind: "begin", node: { id: wilderland.id } });
  });

  it("12195:B:1 the screen's last sentence says the win completes the campaign", () => {
    const state = won(opened(1));
    const worldOf = { cards: ctx.cards, copies: new Map() } as unknown as World;
    const settled = resolutionView(state, worldOf) as Extract<ResolutionView, { kind: "settled" }>;
    expect(settled.kind).toBe("settled");
    expect(settledSentence(settled, worldOf, null, campaign.name)).toBe(`Confirming records the win and completes ${campaign.name}.`);
  });
});
