// Rules: rr.attachment-cards, rr.reveal, rr.search, rr.cannot (data/rules/entries.json); ledger lines 143015:A:2, 143019:A:3, 143065:A:2, 143066:A:2. The verbs and flags The Uruk-hai added to the shared vocabulary, on a table of its own cards.
import { beforeAll, describe, expect, it } from "vitest";

import type { EngineStep } from "../core/intents.ts";
import { attachBlocked } from "./restrictions.ts";
import { attachHeroHosts } from "../families/play/hooks.ts";
import { modifiedStat, placeDamage } from "../core/keywords.ts";
import { UNATTRIBUTED } from "../core/cause.ts";
import { settle } from "../engine/machine.ts";
import { captivesOf } from "../families/captives/values.ts";
import { printedOf } from "../core/printed.ts";
import { syncConstants } from "./constants.ts";
import type { ReduceContext } from "../engine/reduce.ts";
import { updateCard, type ScenarioState } from "../core/state.ts";
import { attachTo, spawn } from "../core/zones.ts";
import { probeTable } from "../../../scripts/card-smoke/encounter.ts";
import { encounterWorld, type EncounterWorld } from "../../../scripts/card-smoke/encounter-world.ts";
import { finish, idOf, resolveRecords, revealFromTop } from "../../../test/harness/scene-kit.ts";

let world: EncounterWorld;
let table: ScenarioState;
let ctx: ReduceContext;

beforeAll(async () => {
  world = await encounterWorld("the-uruk-hai");
  ctx = world.contexts.strong;
  table = probeTable(world);
});

describe("AttachSelf to a hero with a trait (143015:A:2)", () => {
  it("offers only the heroes that print the trait", () => {
    const hero = table.seats[0].heroes.map((id) => table.cards[id]).find((card) => card?.code === "q2");
    const cards = new Map(ctx.cards);
    cards.set("q2", { ...printedOf(ctx.cards, "q2"), traits: ["Warrior"] });
    expect(attachHeroHosts(table, { kind: "hero", control: "any", trait: "Warrior" }, 0, cards)).toEqual([hero?.id]);
    expect(attachHeroHosts(table, { kind: "hero", control: "any", trait: "Healer" }, 0, cards)).toEqual([]);
    expect(attachHeroHosts(table, { kind: "hero", control: "any" }, 0, cards)).toHaveLength(table.seats[0].heroes.length);
  });
});

describe("Beyond All Hope's flag cannotHaveTreachery (143019:A:3)", () => {
  it("bars a treachery card from the hero, and not another attachment", () => {
    const hero = table.seats[0].heroes[1] ?? "";
    const boon = spawn(table, "143019", { zone: "attached" });
    const synced = syncConstants(attachTo(boon.state, boon.id, hero), ctx);
    expect(printedOf(ctx.cards, "143030").type).toBe("treachery");
    expect(attachBlocked(synced, ctx, hero, "143030")).toBe(true);
    expect(attachBlocked(synced, ctx, hero, "143015")).toBe(false);
    expect(attachBlocked(synced, ctx, table.seats[0].heroes[2] ?? "", "143030")).toBe(false);
  });
});

describe("SearchReveal to an engaged enemy (143065:A:2)", () => {
  it("reveals an Uruk-hai enemy from the deck engaged with the revealing player, who then has its Threat added to the staging area's", () => {
    const steps: EngineStep[] = [];
    const revealed = revealFromTop(table, ctx, "143065", steps);
    const run = finish({ state: revealed.state, steps }, ctx);
    const found = run.state.seats[0].engaged.map((id) => run.state.cards[id]).filter((card) => card && printedOf(ctx.cards, card.code).traits.includes("Uruk-hai"));
    expect(found).toHaveLength(1);
    expect(run.state.cards[found[0]?.id ?? ""]?.zone).toBe("engaged");
    expect(run.state.modifiers.some((modifier) => modifier.stat === "engagedThreat" && modifier.instanceId === found[0]?.id)).toBe(true);
  });
});

describe("DiscardRandomFromHand with remember (143066:A:2)", () => {
  it("gives Snaga its discarded card's printed cost as Threat until the end of the round, and 0 with no card in hand", () => {
    const costly = new Map(ctx.cards);
    costly.set("filler", { ...printedOf(ctx.cards, "filler"), cost: 3 });
    const withCost: ReduceContext = { ...ctx, cards: costly };
    const snaga = spawn(table, "143066", { zone: "staging" });
    const run = resolveRecords(snaga.state, withCost, "143066", "whenRevealed", snaga.id);
    const threat = (state: ScenarioState): number => modifiedStat(state, state.cards[snaga.id]!, "threat", withCost.cards);
    expect(run.state.seats[0].hand).toHaveLength(table.seats[0].hand.length - 1);
    expect(threat(run.state)).toBe(threat(snaga.state) + 3);
    const empty = resolveRecords({ ...snaga.state, seats: [{ ...snaga.state.seats[0], hand: [] }, snaga.state.seats[1]] }, withCost, "143066", "whenRevealed", snaga.id);
    expect(threat(empty.state)).toBe(threat(snaga.state));
  });
});

describe("Grishnákh's Captive (143024:A:1)", () => {
  it("is attached to him as he enters play, and lies under To Isengard! again when he is defeated, whatever damage it took", () => {
    const steps: EngineStep[] = [];
    const revealed = revealFromTop(table, ctx, "143024", steps);
    const run = finish({ state: revealed.state, steps }, ctx);
    const [captive] = captivesOf(run.state);
    expect(captive?.host).toBe(revealed.id);
    const hurt = updateCard(run.state, captive?.id ?? "", { damage: 1 });
    const killed = placeDamage({ ...hurt, window: null }, revealed.id, 99, ctx.cards, [], "framework", UNATTRIBUTED);
    const settled = settle(killed, ctx, []);
    expect(settled.cards[revealed.id]?.zone).not.toBe("staging");
    expect(captivesOf(settled)[0]?.host).toBe(idOf(table, "143022"));
    expect(captivesOf(settled)[0]?.damage).toBe(1);
  });
});
