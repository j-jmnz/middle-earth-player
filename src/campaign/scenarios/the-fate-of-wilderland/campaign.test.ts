// Rules: emce.campaign-pool-encounter, emce.treasure, emce.boon-allies, emce.campaign-log, ltp.campaign-setup-checklist, rr.campaign-setup-checklist, rr.setup (data/rules/entries.json); ledger lines 12195:A:2, 12195:B:1.
// The Fate of Wilderland in the Ered Mithrin campaign: it is the ninth and last part, its campaign card names the Setup the campaign deals, and a standalone game plays the scenario with none of it. The eight earlier parts' real Resolutions (the seven of Mount Gundabad's
// campaign test and Mount Gundabad's own golden win, applied one after the other to a blank log) are what reaches it: the allies in a player's pool or their lines, the burdens, Misplaced Trust or Urdug's Cunning, the copies of encounter cards the pool tallies, the
// Accolade and Song boons and the treasures discovered, all through the Campaign Setup Checklist. Winning this part ends the campaign; a loss writes nothing.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { WILDERLAND_GOLDENS, afterGundabad, logBeforeGolden, playGolden, prepareEarlier, rawEarlier, wilderlandPlan, wilderlandSetupChoices, wilderlandStart, wilderlandWorld } from "../../../../test/scenarios/the-fate-of-wilderland/game.ts";
import { CODES, campaign, wilderland } from "../../../../test/scenarios/the-fate-of-wilderland/scene.ts";
import { nextPartId, nextPartStatus } from "../../../../test/harness/next-part.ts";

import { campaignScenario } from "../../../catalog/scenario-data.ts";
import { fillerLoadout } from "../../../../test/harness/game-kit.ts";
import { checklist } from "../../checklist.ts";
import { buildStart } from "../../start.ts";
import { applyResolution, emptyLog } from "../../log.ts";
import { campaignPath, nextStep } from "../../path.ts";
import { newSave } from "../../save.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { NO_COPY_LIMITS, poolEncounterCopies, wilderlandFacts } from "../../wilderland.ts";
import { resolutionView, settledSentence, type ResolutionView } from "../../resolution-view.ts";
import type { World } from "../../world.ts";

let ctx: ReduceContext;
beforeAll(async () => {
  await prepareEarlier();
  ctx = (await wilderlandWorld("strong")).ctx;
}, 480_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// The game dealt and its Setup played: the mulligan is kept and each question is answered with its first option.
function opened(start: ReturnType<typeof wilderlandStart>): ScenarioState {
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

// Each test deals a game or two from the earlier parts' logs; under a loaded run they pass 5 s, so the file gives them a minute.
describe("The Fate of Wilderland in the ered-mithrin campaign", { timeout: 60_000 }, () => {
  it("is part 9 of the campaign, the last, and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(wilderland.id)).toBe(8);
    expect(campaign.scenarios.at(-1)).toBe(wilderland.id);
    expect(wilderland.campaignCard).toBe(CODES.campaignCard);
    expect(campaign.scenarios[7]).toBe("mount-gundabad");
    expect(nextPartId(campaign, wilderland.id)).toBeNull();
  });

  it("is playable, and the path offers it after the first eight parts and no part after it", () => {
    expect(PLAYABLE_SCENARIOS).toContain(wilderland.id);
    const fresh = campaignPath(campaign, {}, newSave("wilderland", campaign.id, 1).log);
    expect(fresh[8]).toMatchObject({ id: wilderland.id, status: expect.not.stringMatching(/completed/) });
    const path = campaignPath(campaign, {}, afterGundabad(2));
    expect(path).toHaveLength(9);
    expect(path.map((node) => node.status)).toEqual([...Array.from({ length: 8 }, () => "completed"), "current"]);
    expect(nextStep(path, null)).toMatchObject({ kind: "begin", node: { id: wilderland.id } });
    // Winning Mount Gundabad offered this part; this part's win offers none.
    expect(nextPartStatus(campaign, "mount-gundabad")).toBe("current");
    expect(nextPartStatus(campaign, wilderland.id)).toBeNull();
  });

  it("deals the Campaign Setup from a blank log: the campaign card on the table, the objectives and Urdug in the staging area, nothing removed", () => {
    const plan = wilderlandPlan(1);
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.removedFromEncounter).toEqual([]);
    for (const seats of [1, 2] as const) {
      const state = opened(wilderlandStart(seats, 1, "Normal"));
      expect(where(state, CODES.campaignCard)[0], `${seats} seats`).toMatchObject({ zone: "campaign" });
      for (const code of [CODES.theGoblinsAssault, CODES.theHeroesDefense, CODES.urdug]) expect(where(state, code)[0], `${seats} seats ${code}`).toMatchObject({ zone: "staging" });
    }
  });

  it("hands the earlier parts' Resolutions to the game: the allies, the burdens, Misplaced Trust or Urdug's Cunning, the encounter cards the pool tallies, the boons and the treasures, through the Campaign Setup Checklist", () => {
    for (const variant of ["pool", "cunning"] as const) {
      const log = rawEarlier(2, variant);
      expect(log.completed, variant).toEqual(campaign.scenarios.slice(0, 8));
      expect(poolEncounterCopies(log.encounterPool ?? {}).length + log.campaignPool.filter((card) => card.back === "encounter").length, variant).toBeGreaterThanOrEqual(1);
      // The checklist reads the same log as the game does.
      const facts = wilderlandFacts(log, campaign.id);
      expect(facts.treasures).toEqual(log.treasures);
      expect(facts.encounterPool ?? {}).toEqual(log.encounterPool ?? {});
      const given = afterGundabad(2, variant);
      const choices = wilderlandSetupChoices(2, given);
      const state = opened(wilderlandStart(2, 3, "Normal", undefined, given, undefined, choices));
      expect(state.campaignFacts?.treasures, variant).toEqual(given.treasures);
      expect(state.campaignFacts?.encounterPool ?? {}, variant).toEqual(given.encounterPool ?? {});
      // The pool's encounter cards are dealt with this scenario's own copies.
      const base = opened(wilderlandStart(2, 3, "Normal", undefined, emptyLog(2), undefined, []));
      for (const [code, copies] of Object.entries(given.encounterPool ?? {})) expect(where(state, code), `${variant} ${code}`).toHaveLength(where(base, code).length + copies);
      for (const card of given.campaignPool.filter((item) => item.back === "player")) expect(where(state, card.code).length, `${variant} ${card.code}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("hands the lines the earlier parts marked to the game: Turayn's and Beldis's lines remove their cards from the encounter deck", () => {
    for (const [seats, variant] of [[1, "beldis"], [2, "oath"], [1, "oathline"]] as const) {
      const log = afterGundabad(seats, variant);
      const lines = log.allyLines ?? [];
      expect(lines.length, `${seats} ${variant}`).toBeGreaterThanOrEqual(1);
      const answers = wilderlandSetupChoices(seats, log);
      const plan = wilderlandPlan(seats, log, answers);
      expect(plan.removedFromEncounter, `${seats} ${variant}`).toHaveLength((lines.includes("turayn") ? 3 : 0) + (lines.includes("beldis") ? 3 : 0));
      const state = opened(wilderlandStart(seats, 2, "Normal", undefined, log, undefined, answers));
      expect(state.campaignFacts?.treasures, `${seats} ${variant}`).toEqual(log.treasures);
    }
  });

  it("asks each player for a boon or treasure card their deck holds only when it holds one: the pool's boons are searchable, the filler decks have none", () => {
    expect(wilderlandSetupChoices(1, emptyLog(1))).toEqual([]);
    const log = afterGundabad(2, "pool");
    const poolBoons = log.campaignPool.filter((card) => card.back === "player" && ["boon", "treasure"].includes(ctx.cards.get(card.code)?.campaignKind ?? ""));
    expect(poolBoons.length).toBeGreaterThanOrEqual(1);
    expect(wilderlandSetupChoices(2, log).length).toBeGreaterThanOrEqual(1);
  });

  it("deals the original game in a standalone game: no campaign card, no pool", () => {
    const start = buildStart({ campaign, scenario: wilderland, seatCount: 1, seed: 1, threatModifier: 0, seats: wilderlandPlan(1).seats, effects: EFFECTS, mode: "standalone" });
    const state = opened(start);
    expect(where(state, CODES.campaignCard)).toEqual([]);
    expect(where(state, CODES.urdug)[0]).toMatchObject({ zone: "staging" });
    expect(state.cards[state.questStage ?? ""]?.code).toBe(CODES.stage1);
  });

  it("asks the Setup's questions in words: the boon or treasure search of each player, then Turayn's and Beldis's removals of the first player", () => {
    const searching = "Search your deck for a boon or treasure card to add to your hand, or skip. It joins your hand after the mulligan.";
    const need = (seats: 1 | 2, variant: "pool" | "beldis" | "oath" | "oathline", answers: string[]) => {
      const plan = checklist({ log: afterGundabad(seats, variant), scenario: campaignScenario(wilderland), seats: fillerLoadout(seats), effects: EFFECTS, cards: ctx.cards, difficulty: "Normal", choices: answers });
      return plan.ok ? null : plan.needs;
    };
    // Every player is asked: seat 1 first, then seat 2 (the screen above the note says whose turn it is).
    const first = need(2, "oath", []);
    expect(first).toMatchObject({ seat: 0, note: searching });
    const second = need(2, "oath", [first?.options[0] ?? ""]);
    expect(second).toMatchObject({ seat: 1, note: searching });
    expect(first?.options.at(-1)).toBe("skip");
    // The removals: the first player names each card, one at a time, the line quoted once.
    const turayn = need(2, "oath", [first?.options[0] ?? "", second?.options[0] ?? ""]);
    expect(turayn).toMatchObject({ seat: 0, note: "\u201cTurayn has taken an oath of vigilance\u201d: search the encounter deck for 3 non-unique enemies and remove them from the game. Card 1 of 3." });
    const beldis = need(1, "beldis", ["skip"]);
    expect(beldis).toMatchObject({ seat: 0, note: "\u201cBeldis\u2019s care has bolstered the heroes\u2019 spirits\u201d: search the encounter deck for 3 treacheries and remove them from the game. Card 1 of 3." });
    for (const note of [searching, turayn?.note ?? "", beldis?.note ?? ""]) {
      expect(note).not.toContain("::");
      expect(note.split(": ").length - 1).toBeLessThanOrEqual(1);
    }
  });

  // The Resolution of a game won after the eight earlier parts, and the screen's last sentence over it.
  const worldOf = () => ({ cards: ctx.cards, copies: new Map() }) as unknown as World;

  it("12195:B:1 a win after the eight earlier parts' real Resolutions ends the campaign: every part is completed, nothing is written to the log, no part is offered and the screen says the campaign is complete", () => {
    const wins = WILDERLAND_GOLDENS.filter((golden) => golden.outcome === "won" && golden.after);
    expect(wins.length).toBeGreaterThanOrEqual(3);
    for (const golden of wins) {
      const state = playGolden(golden, ctx).state;
      const before = logBeforeGolden(golden);
      const after = applyResolution(before, state.scenarioId, state, ctx.cards, NO_COPY_LIMITS);
      expect(after.completed, golden.name).toEqual([...campaign.scenarios]);
      // The Resolution asks nothing and writes nothing but the part: the treasures, the pool and the lines are the earlier parts'.
      expect(after.treasures, golden.name).toEqual(before.treasures);
      expect(after.campaignPool, golden.name).toEqual(before.campaignPool);
      expect(after.allyLines, golden.name).toEqual(before.allyLines);
      expect(after.encounterPool ?? {}, golden.name).toEqual(before.encounterPool ?? {});
      const path = campaignPath(campaign, {}, after);
      expect(path.every((node) => node.status === "completed"), golden.name).toBe(true);
      expect(nextStep(path, null), golden.name).toEqual({ kind: "finished" });
      // The screen over the Resolution: the win completes the campaign, as The City of Corsairs' completes Dream-chaser.
      const settled = resolutionView(state, worldOf()) as Extract<ResolutionView, { kind: "settled" }>;
      expect(settled.kind, golden.name).toBe("settled");
      expect(settledSentence(settled, worldOf(), null, campaign.name), golden.name).toBe(`Confirming records the win and completes ${campaign.name}.`);
    }
  });

  it("12195:B:1 a loss after the eight earlier parts writes nothing: the log is the one the game started from and the part is offered again", () => {
    const losses = WILDERLAND_GOLDENS.filter((golden) => golden.outcome === "lost" && golden.after);
    expect(losses.length).toBeGreaterThanOrEqual(3);
    for (const golden of losses) {
      const state = playGolden(golden, ctx).state;
      const before = { ...logBeforeGolden(golden), completed: campaign.scenarios.slice(0, 8) };
      expect(applyResolution(before, state.scenarioId, state, ctx.cards, NO_COPY_LIMITS), golden.name).toBe(before);
      expect(nextStep(campaignPath(campaign, {}, before), null), golden.name).toMatchObject({ kind: "begin", node: { id: wilderland.id } });
    }
  });
});
