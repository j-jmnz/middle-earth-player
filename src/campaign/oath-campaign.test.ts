// Rules: rr.campaign-setup-checklist, rr.campaign-cards, rr.campaign-pool, rr.campaign-log, rr.winning-the-game, ltp.campaign-setup-checklist, tdom.mini-campaign
// (data/rules/entries.json). The Oath in a campaign: what Escape from Dol Guldur hands it in Mirkwood Paths, what a blank The Dark of Mirkwood save deals it,
// its campaign card (Setup, the Response that places a token each round, the Resolution that reads the tokens), what a win writes and what a loss leaves.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { expectOk } from "../rules/fixture.ts";
import { legalIntents } from "../rules/legal.ts";
import { runInstruction } from "../rules/interpret.ts";
import { settle } from "../rules/machine.ts";
import type { PrintedCard } from "../rules/printed.ts";
import { reduce, startScenario, type PlayerIntent, type ReduceContext } from "../rules/reduce.ts";
import { openResolution, resolutionResult } from "../rules/resolution.ts";
import type { ScenarioState } from "../rules/state.ts";
import { loadPrinted } from "../../scripts/test-catalog.ts";
import { ANDUIN_GOLDENS, anduinWorld, playGolden as playAnduin } from "../../scripts/anduin-game.ts";
import { DOL_GULDUR_GOLDENS, dolGuldurWorld, playGolden as playDolGuldur } from "../../scripts/dol-guldur-game.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";
import { OATH_GOLDENS, oathLoadout, oathWorld } from "../../scripts/oath-game.ts";
import { campaign, loadOathWorld, oathTable, type OathWorld } from "../../scripts/oath-scene.ts";
import { first, send, start } from "../../scripts/past-scene.ts";

import { checklist } from "./checklist.ts";
import { resolutionView, settledSentence } from "./resolution-view.ts";
import type { World } from "./world.ts";
import { applyResolution, emptyLog, type CampaignLog } from "./log.ts";
import { campaignPath } from "./path.ts";
import { newSave } from "./save.ts";
import { buildStart } from "./start.ts";

const oath = loadScenario("the-oath");
const mini = loadCampaign("the-dark-of-mirkwood");
// Every card the campaign deals: The Oath's, and the boons, Mendor and Mendor's Support the earlier scenarios earn or carry over.
let cards: Map<string, PrintedCard>;
let ctx: ReduceContext;
let scene: OathWorld;
let escapeLog: CampaignLog;

beforeAll(async () => {
  const world = await oathWorld("strong");
  scene = await loadOathWorld();
  // Passage Through Mirkwood is skipped: Journey Along the Anduin's win on a blank log, then Escape from Dol Guldur's on top of it.
  const brittle = await anduinWorld("brittle");
  const anduin = playAnduin(ANDUIN_GOLDENS.find((item) => item.name === "two-handed, brittle heroes, won with a Valor and a Scarred")!, brittle.ctx);
  const dol = await dolGuldurWorld("strong");
  const afterAnduin = applyResolution({ ...emptyLog(2), completed: ["passage-through-mirkwood"] }, anduin.state.scenarioId, anduin.state, new Map([...brittle.cards, ...dol.cards]));
  const escape = playDolGuldur(DOL_GULDUR_GOLDENS.find((item) => item.name === "two-handed, won")!, dol.ctx);
  escapeLog = applyResolution(afterAnduin, escape.state.scenarioId, escape.state, dol.cards);
  // The Caves of Nibin-Dûm, dealt below as the later scenario, hands each seat a "No Time to Waste!" and shuffles Shiny Distraction in.
  const caves = new Map(await loadPrinted(["41042", "41048", "41049"]));
  cards = new Map([...brittle.cards, ...dol.cards, ...world.cards, ...caves]);
  ctx = { effects: EFFECTS, cards };
  await oathWorld("strong");
}, 120_000);

const ADAPTATIONS = ["41044", "41045", "41046", "41047"];

describe("The Oath in Mirkwood Paths and The Dark of Mirkwood", () => {
  it("is the fourth part of Mirkwood Paths and the first of The Dark of Mirkwood, which share its scenario file", () => {
    expect(campaign.scenarios.slice(3)).toEqual(["the-oath", "the-caves-of-nibin-dum"]);
    expect(mini.scenarios).toEqual(["the-oath", "the-caves-of-nibin-dum"]);
    expect(oath.campaignCard).toBe("41050");
    expect([...oath.campaignPlaced].sort()).toEqual(["41041", "41043", "41044", "41045", "41046", "41047"]);
  });

  it("receives Escape from Dol Guldur's pool through the Campaign Setup Checklist in Mirkwood Paths: the boons on their heroes, the earned cards in the decks", () => {
    expect(escapeLog.completed.at(-1)).toBe("escape-from-dol-guldur");
    expect(escapeLog.campaignPool.length).toBeGreaterThan(0);
    const plan = checklist({ log: escapeLog, scenario: oath, seats: oathLoadout(2), effects: EFFECTS, cards, choices: ["41044>q1", "41045>q4"] });
    if (!plan.ok) throw new Error(plan.errors.join("; "));
    // Valor and Scarred go back on the heroes that carry them (step 5), and each seat's Adaptation goes on its first hero (the campaign card's Setup).
    const onHeroes = plan.seats.flatMap((seat) => (seat.attachments ?? []).map((item) => `${item.code}@${item.host}`)).sort();
    expect(onHeroes).toEqual([...escapeLog.campaignPool.filter((card) => card.attachedTo != null).map((card) => `${card.code}@${card.attachedTo}`), "41044@q1", "41045@q4"].sort());
    // Mendor's Support, earned in Passage Through Mirkwood, is shuffled into its owner's deck (step 7).
    for (const card of escapeLog.campaignPool.filter((entry) => entry.back === "player" && entry.attachedTo == null && entry.seat != null)) {
      expect(plan.seats[card.seat ?? 0]?.deck, card.code).toContain(card.code);
    }
    // The game deals and starts: the Oath's own setup runs on top of the pool.
    const dealt = buildStart({ campaign, scenario: oath, seatCount: 2, seed: 1, threatModifier: plan.threatModifier, seats: plan.seats, effects: EFFECTS, poolEncounterCards: plan.poolEncounterCards, poolIntoPlay: plan.poolIntoPlay });
    let state = startScenario(dealt, ctx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    expect(state.cards[state.questStage ?? ""]?.code).toBe("41001");
    expect(Object.values(state.cards).filter((card) => card.code === "41041").map((card) => card.zone)).toEqual(["encounterDeck"]);
  });

  it("deals it on a blank log in The Dark of Mirkwood: no pool, no prisoner, nothing used, and each seat still chooses an Adaptation", () => {
    const save = newSave("mini", "the-dark-of-mirkwood", 2);
    expect(save.log).toEqual(emptyLog(2));
    const plan = checklist({ log: save.log, scenario: oath, seats: oathLoadout(2), effects: EFFECTS, cards, choices: ["41046>q1", "41047>q4"] });
    if (!plan.ok) throw new Error(plan.errors.join("; "));
    expect(plan.poolIntoPlay).toEqual([]);
    expect(plan.poolEncounterCards).toEqual([]);
    expect(plan.seats.map((seat) => (seat.attachments ?? []).map((item) => item.code))).toEqual([["41046"], ["41047"]]);
    // The game starts the same scenario: Stalking Goblin is in the encounter deck once.
    const dealt = buildStart({ campaign: mini, scenario: oath, seatCount: 2, seed: 1, threatModifier: plan.threatModifier, seats: plan.seats, effects: EFFECTS, poolEncounterCards: plan.poolEncounterCards, poolIntoPlay: plan.poolIntoPlay });
    expect(dealt.encounterDeck.filter((code) => code === "41041")).toHaveLength(1);
  });

  it("takes Mendor and a Mendor's Support for each player in from a finished Mirkwood Paths save, and puts Mendor into play in The Oath", () => {
    const carried = [
      { code: "01135", back: "player" as const, burdenSet: null, attachedTo: null, seat: null },
      { code: "01132", back: "player" as const, burdenSet: null, attachedTo: null, seat: null, perPlayer: true },
    ];
    const save = newSave("next", "the-dark-of-mirkwood", 2, carried, "old");
    const plan = checklist({ log: save.log, scenario: oath, seats: oathLoadout(2), effects: EFFECTS, cards, choices: ["41044>q1", "41045>q4"] });
    if (!plan.ok) throw new Error(plan.errors.join("; "));
    expect(plan.poolIntoPlay).toEqual(["01135"]);
    for (const seat of [0, 1]) expect(plan.seats[seat]?.deck.filter((code) => code === "01132"), `seat ${seat}`).toHaveLength(1);
    const dealt = buildStart({ campaign: mini, scenario: oath, seatCount: 2, seed: 1, threatModifier: plan.threatModifier, seats: plan.seats, effects: EFFECTS, poolEncounterCards: plan.poolEncounterCards, poolIntoPlay: plan.poolIntoPlay });
    expect(dealt.definition.setup.filter((instruction) => instruction.verb === "PutObjectiveAllyIntoPlay")).toHaveLength(1);
  });
});

describe("The Oath's Setup at the Campaign Setup Checklist (41050:A:2)", () => {
  const log = emptyLog(2);

  it("asks each seat for an Adaptation, in seat order, and attaches it to a hero of that seat", () => {
    const none = checklist({ log, scenario: oath, seats: oathLoadout(2), effects: EFFECTS, cards });
    expect(none).toMatchObject({ ok: false, needs: { seat: 0 } });
    if (none.ok || none.needs == null) return;
    expect([...none.needs.options].sort()).toEqual(ADAPTATIONS.flatMap((code) => ["q1", "q2", "q3"].map((hero) => `${code}>${hero}`)).sort());
    const one = checklist({ log, scenario: oath, seats: oathLoadout(2), effects: EFFECTS, cards, choices: ["41047>q2"] });
    expect(one).toMatchObject({ ok: false, needs: { seat: 1 } });
    if (one.ok || one.needs == null) return;
    // The second seat chooses among its own heroes and the Adaptations left.
    expect([...one.needs.options].sort()).toEqual(["41044", "41045", "41046"].flatMap((code) => ["q4", "q5", "q6"].map((hero) => `${code}>${hero}`)).sort());
    const both = checklist({ log, scenario: oath, seats: oathLoadout(2), effects: EFFECTS, cards, choices: ["41047>q2", "41044>q6"] });
    if (!both.ok) throw new Error(both.errors.join("; "));
    expect(both.seats[0]?.attachments).toEqual([{ host: "q2", code: "41047" }]);
    expect(both.seats[1]?.attachments).toEqual([{ host: "q6", code: "41044" }]);
  });

  it("refuses an Adaptation another seat took, and a hero the seat does not control", () => {
    const taken = checklist({ log, scenario: oath, seats: oathLoadout(2), effects: EFFECTS, cards, choices: ["41044>q1", "41044>q4"] });
    expect(taken.ok).toBe(false);
    const stolen = checklist({ log, scenario: oath, seats: oathLoadout(2), effects: EFFECTS, cards, choices: ["41044>q4"] });
    expect(stolen.ok).toBe(false);
  });

  it("adds each Adaptation and Stalking Goblin to the Campaign Pool, and shuffles Stalking Goblin into the encounter deck once, not twice", () => {
    const plan = checklist({ log, scenario: oath, seats: oathLoadout(2), effects: EFFECTS, cards, choices: ["41044>q1", "41045>q4"] });
    if (!plan.ok) throw new Error(plan.errors.join("; "));
    expect(plan.log.campaignPool.map((card) => card.code).sort()).toEqual(["41041", "41044", "41045"]);
    expect(plan.log.campaignPool.find((card) => card.code === "41041")?.back).toBe("encounter");
    expect(plan.log.campaignPool.find((card) => card.code === "41044")).toMatchObject({ back: "player", seat: 0, attachedTo: null });
    // This game has them already: steps 7 and 8 shuffle nothing in, and step 6 does not claim the Setup search finds the boons.
    expect(plan.poolEncounterCards).toEqual([]);
    expect(plan.seats.every((seat) => seat.deck.every((code) => code === "filler"))).toBe(true);
    const step6 = plan.steps.find((step) => step.n === 6)?.did.join(" ") ?? "";
    expect(step6).not.toContain("Setup search");
    const dealt = buildStart({ campaign, scenario: oath, seatCount: 2, seed: 1, threatModifier: plan.threatModifier, seats: plan.seats, effects: EFFECTS, poolEncounterCards: plan.poolEncounterCards, poolIntoPlay: plan.poolIntoPlay });
    expect(dealt.encounterDeck.filter((code) => code === "41041")).toHaveLength(1);
  });

  it("is dealt again by a later scenario: the Adaptation joins its seat's deck, Stalking Goblin the encounter deck, and the Setup search attaches the boon", () => {
    const plan = checklist({ log, scenario: oath, seats: oathLoadout(2), effects: EFFECTS, cards, choices: ["41044>q1", "41045>q4"] });
    if (!plan.ok) throw new Error(plan.errors.join("; "));
    const next = checklist({ log: plan.log, scenario: loadScenario("the-caves-of-nibin-dum"), seats: oathLoadout(2), effects: EFFECTS, cards });
    if (!next.ok) throw new Error(next.errors.join("; "));
    expect(next.seats[0]?.deck).toContain("41044");
    expect(next.seats[1]?.deck).toContain("41045");
    expect(next.poolEncounterCards).toEqual(["41041"]);
    expect(EFFECTS.find((effect) => effect.id === "41044:setup:1")?.instructions).toEqual([{ verb: "AttachSelf", to: { kind: "hero" } }]);
  });
});

// The Oath's Response and Resolution, on the engine's table with the campaign card in play.
describe("The Oath, the campaign card (41050:A:3, 41050:B:1)", () => {
  function table(seats: 1 | 2 = 1) {
    const made = oathTable(scene, { seats, campaign: true, phase: "Refresh" });
    return { ...made, state: settle({ ...made.state, window: null }, made.ctx, []) };
  }

  // Plays passes until the next round begins, taking the Response (`take`) or passing it.
  function endRound(made: ReturnType<typeof table>, state: ScenarioState, take: boolean): ScenarioState {
    let run = start(state);
    for (let guard = 0; guard < 14; guard += 1) {
      const intents = legalIntents(run.state, made.ctx);
      const token = take ? intents.find((intent) => intent.type === "Trigger" && run.state.cards[intent.cardId]?.code === "41050") : undefined;
      const next = token ?? intents.find((intent) => intent.type === "Pass") ?? intents[0];
      if (!next) break;
      run = send(run, next as PlayerIntent, made.ctx);
      if (run.state.phase === "Resource") break;
    }
    return run.state;
  }

  const tokens = (state: ScenarioState) => state.cards[first(state, "41050")]?.resources;

  it("places 1 resource token on the card when the first player answers the Response at the end of the round, and none when he passes", () => {
    const made = table();
    expect(tokens(made.state)).toBe(0);
    const taken = endRound(made, made.state, true);
    expect(tokens(taken)).toBe(1);
    expect(tokens(endRound(made, made.state, false))).toBe(0);
    // Each use adds one more to those already there, and the tokens are the card's own: no hero's pool changes.
    const more = runInstruction(runInstruction(taken, { verb: "PlaceToken", amount: 1 }, { seat: 0, sourceId: first(taken, "41050") }, made.ctx, []), { verb: "PlaceToken" }, { seat: 0, sourceId: first(taken, "41050") }, made.ctx, []);
    expect(tokens(more)).toBe(3);
    expect(more.cards[made.hero]?.resources).toBe(taken.cards[made.hero]?.resources);
  });

  it("is offered to the first player at the end of each round of a two-handed game, once", () => {
    const made = table(2);
    const offers = (state: ScenarioState) => legalIntents(state, made.ctx).filter((intent) => intent.type === "Trigger" && state.cards[intent.cardId]?.code === "41050");
    let run = start(made.state);
    let seen = 0;
    for (let guard = 0; guard < 14 && run.state.phase !== "Resource"; guard += 1) {
      seen += offers(run.state).length;
      const intents = legalIntents(run.state, made.ctx);
      const next = intents.find((intent) => intent.type === "Pass") ?? intents[0];
      if (!next) break;
      run = send(run, next as PlayerIntent, made.ctx);
    }
    expect(seen).toBe(1);
  });

  // The game is won with `n` tokens on the campaign card: its Resolution runs.
  function resolved(n: number) {
    const made = oathTable(scene, { campaign: true, phase: "Quest" });
    const campaignCard = first(made.state, "41050");
    const won: ScenarioState = { ...made.state, cards: { ...made.state.cards, [campaignCard]: { ...made.state.cards[campaignCard]!, resources: n } }, stageCleared: true, window: null, stack: [] };
    const done = openResolution(won, made.ctx);
    return { result: resolutionResult(done), state: done };
  }

  it("earns Guilty Conscience with 6 or more tokens, and records no counter (41050:B:1 prints none)", () => {
    for (const [n, earned] of [[0, false], [5, false], [6, true], [9, true]] as const) {
      const { result } = resolved(n);
      expect(result?.counters, `${n} tokens`).toBeUndefined();
      expect(result?.earned.map((item) => item.code), `${n} tokens`).toEqual(earned ? ["41043"] : []);
    }
  });

  it("says in its Resolution sentence which Adaptations it records as used this campaign, and the burden the tokens earn (41044:A:3, 41050:B:1)", () => {
    const { state } = resolved(7);
    const used = { ...state, campaignFacts: { prisoner: null, usedOnce: ["41044", "41044"], counters: {} } };
    const world = { cards: scene.cards } as unknown as World;
    const view = resolutionView(used, world);
    if (view.kind !== "settled") throw new Error(`expected a settled Resolution, got ${view.kind}`);
    expect(view.used).toEqual(["41044"]);
    expect(settledSentence(view, world, "The Caves of Nibin-Dûm")).toBe("Confirming records the burden Guilty Conscience in the campaign and unlocks The Caves of Nibin-Dûm. The Fervor of Lore is recorded as used this campaign.");
    // Two used Adaptations are joined with an "and" before the last.
    const both = resolutionView({ ...state, campaignFacts: { prisoner: null, usedOnce: ["41044", "41045"], counters: {} } }, world);
    if (both.kind !== "settled") throw new Error(`expected a settled Resolution, got ${both.kind}`);
    const [first, second] = ["41044", "41045"].map((code) => scene.cards.get(code)?.name);
    expect(settledSentence(both, world, "The Caves of Nibin-Dûm")).toContain(` ${first} and ${second} are recorded as used this campaign.`);
    const unused = resolutionView(state, world);
    expect(unused.kind === "settled" ? settledSentence(unused, world, "The Caves of Nibin-Dûm") : "").toBe("Confirming records the burden Guilty Conscience in the campaign and unlocks The Caves of Nibin-Dûm.");
  });

  it("writes Guilty Conscience to the Campaign Log, and a burden goes to the pool backed by the encounter deck", () => {
    const { state } = resolved(7);
    const log = applyResolution(emptyLog(1), "the-oath", state, scene.cards);
    expect(log.counters).toEqual({});
    expect(log.campaignPool.map((card) => card.code)).toEqual(["41043"]);
    expect(log.campaignPool[0]?.back).toBe("encounter");
    expect(log.completed).toEqual(["the-oath"]);
  });
});

describe("what a win writes and what a loss leaves", () => {
  it("unlocks The Caves of Nibin-Dûm in Mirkwood Paths and in The Dark of Mirkwood", () => {
    const won = OATH_GOLDENS.find((item) => item.name === "two-handed, won")!;
    expect(won.outcome).toBe("won");
    // A won game's log is checked in golden-oath.test.ts; here the two paths for a finished Escape from Dol Guldur and for a blank log.
    const log = (base: CampaignLog) => ({ ...base, completed: [...base.completed, "the-oath"] });
    expect(campaignPath(campaign, {}, log(escapeLog)).map((node) => node.status)).toEqual(["completed", "completed", "completed", "completed", "current"]);
    expect(campaignPath(mini, {}, log(emptyLog(2))).map((node) => node.status)).toEqual(["completed", "current"]);
  });
});
