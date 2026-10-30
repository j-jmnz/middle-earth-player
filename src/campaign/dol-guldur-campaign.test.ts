// Rules: rr.campaign-setup-checklist, rr.campaign-cards, rr.campaign-pool, rr.campaign-log, rr.winning-the-game, ltp.campaign-setup-checklist
// (data/rules/entries.json). Escape from Dol Guldur in a campaign: what Journey Along the Anduin hands it (its pool on the heroes and the prisoner it
// named), its campaign card, what a win writes (the Mendor carry-over) and unlocks (The Oath), and what a loss leaves.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { expectOk } from "../rules/fixture.ts";
import type { PrintedCard } from "../rules/printed.ts";
import { reduce, startScenario, type ReduceContext } from "../rules/reduce.ts";
import { prisonerHero } from "../rules/families/prisoner.ts";
import { textBlank } from "../rules/families/attachments-hold.ts";
import { ANDUIN_GOLDENS, anduinWorld, playGolden as playAnduin } from "../../scripts/anduin-game.ts";
import { DOL_GULDUR_GOLDENS, dolGuldurLoadout, dolGuldurStart, dolGuldurWorld, playGolden } from "../../scripts/dol-guldur-game.ts";
import { campaign, dolGuldur } from "../../scripts/dol-guldur-scene.ts";
import { loadScenario } from "../../scripts/data/load-scenarios.ts";
import { temporaryCatalog } from "../../scripts/temp-catalog.ts";
import { loadPrinted } from "../../scripts/test-catalog.ts";

import { carryOffers } from "./carry-over.ts";
import { checklist } from "./checklist.ts";
import { buildStart } from "./start.ts";
import { applyResolution, emptyLog, type CampaignLog } from "./log.ts";
import { newSave } from "./save.ts";
import { campaignPath } from "./path.ts";
import { resolutionView, settledSentence } from "./resolution-view.ts";
import { loadWorld } from "./world.ts";

let cards: Map<string, PrintedCard>;
let ctx: ReduceContext;
let anduinLog: CampaignLog;
let oathCards: Map<string, PrintedCard>;
const worlds = new Map<string, { cards: Map<string, PrintedCard>; ctx: ReduceContext }>();

beforeAll(async () => {
  for (const decks of ["brittle", "strong"] as const) worlds.set(decks, await dolGuldurWorld(decks));
  const world = worlds.get("strong")!;
  cards = world.cards;
  ctx = world.ctx;
  const brittle = await anduinWorld("brittle");
  const golden = ANDUIN_GOLDENS.find((item) => item.name === "two-handed, brittle heroes, won with a Valor and a Scarred")!;
  const game = playAnduin(golden, brittle.ctx);
  // Journey Along the Anduin's win on top of Passage Through Mirkwood's: the pool on its heroes, the prisoner named.
  anduinLog = applyResolution({ ...emptyLog(2), completed: ["passage-through-mirkwood"] }, game.state.scenarioId, game.state, new Map([...brittle.cards, ...cards]));
  await dolGuldurWorld("strong");
  oathCards = new Map(await loadPrinted(["41041", "41044", "41045"]));
}, 120_000);

describe("Escape from Dol Guldur in a campaign", () => {
  it("is the third part of Mirkwood Paths, and The Oath follows it", () => {
    expect(campaign.scenarios.slice(2, 4)).toEqual(["escape-from-dol-guldur", "the-oath"]);
    expect(dolGuldur.campaignCard).toBe("01131");
    expect(dolGuldur.campaignPlaced).toEqual(["01132", "01134", "01135"]);
  });

  it("receives Journey Along the Anduin's pool on its heroes and its prisoner through the Campaign Setup Checklist (01130:B:1)", () => {
    expect(anduinLog.campaignPool.length).toBeGreaterThan(0);
    expect(anduinLog.prisoner).not.toBeNull();
    const plan = checklist({ log: anduinLog, scenario: dolGuldur, seats: dolGuldurLoadout(2), effects: EFFECTS, cards, choices: ["01134>q1"] });
    if (!plan.ok) throw new Error(plan.errors.join("; "));
    // The Valor and Scarred the hero carries are attached to it again, with Appointed by Fate on the hero the first player chose.
    const onHeroes = plan.seats.flatMap((seat) => (seat.attachments ?? []).map((item) => `${item.code}@${item.host}`)).sort();
    expect(onHeroes).toEqual([...anduinLog.campaignPool.map((card) => `${card.code}@${card.attachedTo}`), "01134@q1"].sort());
    // The prisoner reaches the engine as a fact: that hero is the prisoner of the game.
    const start = dolGuldurStart(2, 1, "Normal", { prisoner: anduinLog.prisoner, usedOnce: [], counters: {} }, anduinLog);
    expect(start.facts?.prisoner).toBe(anduinLog.prisoner);
    let state = startScenario(start, ctx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    for (let guard = 0; guard < 6 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
    const prisoner = state.cards[prisonerHero(state) ?? ""];
    expect(prisoner?.code).toBe(anduinLog.prisoner);
    // Each card attached to that hero went facedown with it, blank, until it is rescued.
    for (const id of prisoner?.attachments ?? []) {
      expect(state.cards[id]?.face, state.cards[id]?.code).toBe("down");
      expect(textBlank(state, id)).toBe(true);
    }
    // The others kept theirs, faceup.
    const others = Object.values(state.cards).filter((card) => (card.code === "01133" || card.code === "01138" || card.code === "01134") && card.host != null && card.host !== prisoner?.id);
    for (const card of others) expect(card.face).toBe("up");
  });

  it("deals it with Mendor put into play by the campaign card's Setup, not the pool, and no Valor or Scarred set aside", () => {
    const plan = checklist({ log: anduinLog, scenario: dolGuldur, seats: dolGuldurLoadout(2), effects: EFFECTS, cards, choices: ["01134>q1"] });
    if (!plan.ok) throw new Error(plan.errors.join("; "));
    const start = dolGuldurStart(2, 3, "Normal", undefined, anduinLog);
    expect(start.definition.setup.map((instruction) => ("code" in instruction ? `${instruction.verb}:${instruction.code}` : instruction.verb))).toEqual(
      expect.arrayContaining(["PutObjectiveAllyIntoPlay:01135", "SetAside:01102", "AddToStaging:01108", "AddToStaging:01109", "AddToStaging:01110", "ShuffleEncounterDeck"]),
    );
    expect(start.definition.setup.filter((instruction) => instruction.verb === "PutObjectiveAllyIntoPlay")).toHaveLength(1);
    expect(plan.poolIntoPlay).toEqual([]);
  });
});

describe("what a win writes (01131:B:2)", () => {
  const won = DOL_GULDUR_GOLDENS.filter((golden) => golden.outcome === "won");

  it("keeps Mendor, and a Mendor's Support for each player, for the next campaign when Mendor is still in play, and unlocks The Oath", () => {
    const golden = won.find((item) => item.name === "two-handed, won")!;
    const game = playGolden(golden, ctx);
    const log = applyResolution({ ...anduinLog, campaignPool: [] }, game.state.scenarioId, game.state, cards);
    expect(log.completed).toEqual(["passage-through-mirkwood", "journey-along-the-anduin", "escape-from-dol-guldur"].filter((id) => log.completed.includes(id)));
    expect(log.completed.at(-1)).toBe("escape-from-dol-guldur");
    expect(log.carryOver.map((card) => `${card.code}:${card.perPlayer === true}`).sort()).toEqual(["01132:true", "01135:false"]);
    // The campaign pool is this campaign's: nothing carried over is in it.
    expect(log.campaignPool.map((card) => card.code)).not.toContain("01135");
    expect(campaignPath(campaign, {}, log).map((node) => node.status).slice(2, 4)).toEqual(["completed", "current"]);
  });

  it("keeps nothing when Mendor left play", () => {
    for (const name of ["true solo, Mendor lost, won", "two-handed, brittle heroes, Mendor lost, won"]) {
      const golden = won.find((item) => item.name === name)!;
      const world = worlds.get(golden.decks)!;
      const game = playGolden(golden, world.ctx);
      expect(Object.values(game.state.cards).find((card) => card.code === "01135")?.zone, name).toBe("removed");
      const log = applyResolution(emptyLog(golden.seatCount), game.state.scenarioId, game.state, world.cards);
      expect(log.carryOver, name).toEqual([]);
      expect(log.completed, name).toEqual(["escape-from-dol-guldur"]);
    }
  });

  it("is taken in by a new save once the campaign is finished: Mendor goes into play at the start of each scenario and each player's Mendor's Support is shuffled into their deck", () => {
    const golden = won.find((item) => item.name === "two-handed, won")!;
    const game = playGolden(golden, ctx);
    const log = applyResolution(emptyLog(2), game.state.scenarioId, game.state, cards);
    const finished = { ...log, completed: [...campaign.scenarios] };
    const save = (id: string, log: CampaignLog) => ({ id, campaignId: "mirkwood-paths", seatCount: 2 as const, score: 0, log });
    const offers = carryOffers([save("old", finished) as never], (campaignId) => (campaignId === "mirkwood-paths" ? campaign.scenarios : null));
    expect(offers).toHaveLength(1);
    expect(offers[0]?.cards.map((card) => card.code).sort()).toEqual(["01132", "01135"]);
    const fresh = newSave("next", "mirkwood-paths", 2, finished.carryOver);
    expect(fresh.log.carryIn.map((card) => card.code).sort()).toEqual(["01132", "01132", "01135"]);
    const plan = checklist({ log: fresh.log, scenario: loadScenario("passage-through-mirkwood"), seats: dolGuldurLoadout(2), effects: EFFECTS, cards });
    if (!plan.ok) throw new Error(plan.errors.join("; "));
    expect(plan.poolIntoPlay).toEqual(["01135"]);
    expect(plan.poolEncounterCards).toEqual([]);
    // Passage Through Mirkwood's campaign card names Mendor too: the engine puts him into play once.
    const passage = buildStart({ campaign, scenario: loadScenario("passage-through-mirkwood"), seatCount: 2, seed: 1, threatModifier: plan.threatModifier, seats: plan.seats, effects: EFFECTS, poolEncounterCards: plan.poolEncounterCards, poolIntoPlay: plan.poolIntoPlay });
    expect(passage.definition.setup.filter((instruction) => instruction.verb === "PutObjectiveAllyIntoPlay")).toHaveLength(1);
    for (const seat of [0, 1]) expect(plan.seats[seat]?.deck.filter((code) => code === "01132"), `seat ${seat}`).toHaveLength(1);
    // The pool's Mendor is put into play by his own record (01135:campaignSetup:1) in a scenario whose campaign card does not name him.
    // The Oath's campaign card asks each seat for an Adaptation (41050:A:2): the answers and the cards they name are inputs of this check, not what it asserts.
    const later = checklist({ log: fresh.log, scenario: loadScenario("the-oath"), seats: dolGuldurLoadout(2), effects: EFFECTS, cards: new Map([...cards, ...oathCards]), choices: ["41044>q1", "41045>q4"] });
    if (!later.ok) throw new Error(later.errors.join("; "));
    expect(later.poolIntoPlay).toEqual(["01135"]);
    expect(later.poolEncounterCards).toEqual([]);
  });

  it("tells the player what confirming writes: the carry-over sentence names Mendor and a Mendor's Support for each player", () => {
    const golden = won.find((item) => item.name === "two-handed, won")!;
    const game = playGolden(golden, ctx);
    const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
    const base = loadWorld(catalog, campaign, dolGuldur, EFFECTS, ["01132", "01135", "01134"]);
    const named = { ...base, cards: new Map([...base.cards, ...cards]) };
    const view = resolutionView(game.state, named);
    expect(view.kind).toBe("settled");
    if (view.kind !== "settled") return;
    expect(view.carried).toEqual([{ code: "01135", eachPlayer: false }, { code: "01132", eachPlayer: true }]);
    expect(settledSentence(view, named, "The Oath")).toBe("Confirming records the win and unlocks The Oath. Mendor and a Mendor's Support for each player are kept for your next campaign.");
    // Mendor lost: nothing is kept, and the sentence says nothing of it.
    const lost = playGolden(won.find((item) => item.name === "true solo, Mendor lost, won")!, ctx);
    const bare = resolutionView(lost.state, named);
    if (bare.kind !== "settled") throw new Error("not settled");
    expect(bare.carried).toBeUndefined();
    expect(settledSentence(bare, named, "The Oath")).toBe("Confirming records the win and unlocks The Oath.");
  });
});
