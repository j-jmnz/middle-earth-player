// Rules: rr.combat-phase, rr.quest-advancement, rr.campaign-cards, rr.campaign-pool (data/rules/entries.json); ledger lines 41005:B:2, 41028:A:1, 41051:B:1. What the table and the Resolution say for The
// Caves of Nibin-Dûm: the quest points of Surprise Attack as the engine reads them, the Pillar among the cards the players may attack, and the Ranger Sense the win earns and carries over.
// The engine decides all of it; nothing here changes a card.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { legalIntents } from "../rules/legal.ts";
import type { ScenarioState } from "../rules/state.ts";
import { syncConstants } from "../rules/constants.ts";
import { loadWorld } from "../campaign/world.ts";
import { resolutionView, settledSentence } from "../campaign/resolution-view.ts";
import { CAVES_GOLDENS, cavesWorld, playGolden } from "../../scripts/nibin-dum-game.ts";
import { campaign, cavesTable, caves, loadCavesWorld, type CavesWorld } from "../../scripts/nibin-dum-scene.ts";
import { first, send, start, type Run } from "../../scripts/past-scene.ts";
import { temporaryCatalog } from "../../scripts/temp-catalog.ts";

import { questTitle } from "./table-preview.ts";
import { playerAttackSheet } from "./combat-sheets.ts";
import type { SheetNames } from "./sheet-types.ts";

let world: CavesWorld;

beforeAll(async () => {
  world = await loadCavesWorld();
});

const namesOf = (state: ScenarioState): SheetNames => ({ card: (id) => world.cards.get(state.cards[id]?.code ?? id)?.name ?? id, line: () => null });

describe("the quest card's title (41005:B:2)", () => {
  it("reads the quest points the engine reads, 4 for each enemy in play", () => {
    const none = cavesTable(world, { stage: "41005" });
    const id = none.state.questStage ?? "";
    expect(questTitle(none.state, none.ctx, id, "Surprise Attack", () => null)).toEqual({ title: "Surprise Attack · 0 / 0" });
    const made = cavesTable(world, { stage: "41005", progress: 3, staging: ["41030", "41031"] });
    const state = syncConstants(made.state, made.ctx);
    expect(questTitle(state, made.ctx, state.questStage ?? "", "Surprise Attack", () => null)).toEqual({ title: "Surprise Attack · 3 / 8" });
  });
});

// Passes the combat phase's windows (an engaged enemy's attack is left undefended) until the player attack window opens.
function toPlayerAttack(from: Run, ctx: ReturnType<typeof cavesTable>["ctx"]): Run {
  let run = from;
  for (let guard = 0; guard < 30 && run.state.window?.kind !== "playerAttack"; guard += 1) {
    const intents = legalIntents(run.state, ctx);
    const next = run.state.window?.kind === "defense" ? { type: "Undefended" as const, heroId: run.state.seats[0].heroes[0] } : intents.find((intent) => intent.type === "Pass");
    if (!next) break;
    run = send(run, next, ctx);
  }
  return run;
}

describe("the players' attack sheet (41028:A:1)", () => {
  it("lists Cracked Pillar with its Threat as its Defense and says it can be attacked", () => {
    const made = cavesTable(world, { staging: ["41028"], engaged: [{ code: "grunt", seat: 0 }], phase: "Combat" });
    let run: Run = start(syncConstants(made.state, made.ctx));
    run = toPlayerAttack(run, made.ctx);
    const legal = legalIntents(run.state, made.ctx);
    const sheet = playerAttackSheet(run.state, made.ctx, legal, namesOf(run.state));
    if (sheet.kind !== "pick") throw new Error("not a pick sheet");
    const pillar = first(run.state, "41028");
    expect(sheet.options.map((option) => option.id)).toContain(pillar);
    expect(sheet.note).toBe("Choose the enemy or location, then the characters that attack it.");
    expect(sheet.options.find((option) => option.id === pillar)?.stats).toEqual([{ icon: "defense", value: 2, word: expect.any(String) }]);
    // With only enemies to attack the sentence is the usual one.
    const plain = cavesTable(world, { engaged: [{ code: "grunt", seat: 0 }], phase: "Combat" });
    let ordinary: Run = start(syncConstants(plain.state, plain.ctx));
    ordinary = toPlayerAttack(ordinary, plain.ctx);
    const usual = playerAttackSheet(ordinary.state, plain.ctx, legalIntents(ordinary.state, plain.ctx), namesOf(ordinary.state));
    if (usual.kind !== "pick") throw new Error("not a pick sheet");
    expect(usual.note).toBe("Choose the enemy, then the characters that attack it.");
  });
});

describe("the Resolution sentence (41051:B:1)", () => {
  it("names the Ranger Sense each player earns, kept for the next campaign too, and says the win completes the campaign", async () => {
    const golden = CAVES_GOLDENS.find((item) => item.name === "two-handed, won")!;
    const { cards, ctx } = await cavesWorld("strong");
    const game = playGolden(golden, ctx);
    const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
    const base = loadWorld(catalog, campaign, caves, EFFECTS, ["41048", "41049", "41042"]);
    const named = { ...base, cards: new Map([...base.cards, ...cards]) };
    const view = resolutionView(game.state, named);
    expect(view.kind).toBe("settled");
    if (view.kind !== "settled") return;
    expect(view.carried).toEqual([{ code: "41049", eachPlayer: true }]);
    expect(settledSentence(view, named, null, true)).toBe("Confirming records 2 copies of Ranger Sense in the campaign and completes the campaign. A Ranger Sense for each player is kept for your next campaign.");
    // Threat 40 or more: nothing is earned or kept.
    const tense = await cavesWorld("tense");
    const high = playGolden(CAVES_GOLDENS.find((item) => item.name === "two-handed, threat 40 or higher at the end, won")!, tense.ctx);
    const bare = resolutionView(high.state, { ...named, cards: new Map([...named.cards, ...tense.cards]) });
    if (bare.kind !== "settled") throw new Error("not settled");
    expect(bare.carried).toBeUndefined();
    expect(settledSentence(bare, named, null, true)).toBe("Confirming records the win and completes the campaign.");
    expect(settledSentence(bare, named, null)).toBe("Confirming records the win.");
  });
});
