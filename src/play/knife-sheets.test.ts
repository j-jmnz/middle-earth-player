import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../rules/fixture.ts";
import { legalIntents, reduce, startScenario, type ReduceContext, type ScenarioState } from "../rules/reduce.ts";
import { moveCard } from "../rules/zones.ts";
import { updateCard } from "../rules/state.ts";
import { KNIFE_GOLDENS, knifeIntent, knifeStart, knifeWorld, type KnifeGolden } from "../../scripts/knife-game.ts";
import { intentsOf } from "../../scripts/sheet-intents.ts";

import { actionsSheet, commitSheet } from "./bar-sheets.ts";
import { tableLayout } from "./layout.ts";
import { railFor } from "./rail.ts";
import { TABLE_ZONES, inspectTargets, zoneSelector, type ZoneId, type ZoneView } from "./selectors.ts";
import type { PickSheet, Sheet, SheetNames } from "./sheet-types.ts";
import { sheetFor } from "./sheets.ts";

// Rules: rr.first-player, rr.travel, rr.step-6-4-3, rr.quest-advancement (data/rules/entries.json). A Knife in the Dark on
// the phase 11 table with no new widget: in every window of whole games (the phase 12 goldens: wins with the big-number
// loadout, losses with the starter decks) every option a sheet offers is an intent the reducer accepts, a Choose between
// two instructions names each instruction in words (141026:B:2, 141051:A:2, 141053:A:1, 141054:A:2), a Pick says what the
// card is for, the win ends on Victory and the rail never names another step.
let ctx: ReduceContext;

beforeAll(async () => {
  ({ ctx } = await knifeWorld());
}, 60_000);

function namesFor(state: ScenarioState): SheetNames {
  return { card: (id) => ctx.cards.get(state.cards[id]?.code ?? "")?.name ?? id, line: () => null };
}

// The words a branch would show if it had none of its own: the option id, capitalized.
const bare = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

type Seen = { windows: Set<string>; branches: Map<string, Set<string>>; picks: Set<string> };

function playChecked(golden: KnifeGolden, seen: Seen): ScenarioState {
  let state = startScenario(knifeStart(golden.seatCount, golden.seed, golden.difficulty, golden.decks), ctx);
  const memory = new Set<string>();
  for (let turn = 0; turn < 6000 && !state.lost && !(state.stageCleared && state.window == null); turn += 1) {
    const legal = legalIntents(state, ctx);
    const names = namesFor(state);
    const sheet: Sheet | null = sheetFor(state, ctx, legal, names);
    expect(railFor(state).current).not.toBe("");
    if (sheet) {
      seen.windows.add(sheet.kind === "outcome" ? sheet.result : `${state.window?.kind}:${sheet.kind}`);
      if (state.window?.kind === "choose" && sheet.kind === "pick") checkChoose(state, sheet, seen);
      for (const intent of intentsOf(state, sheet)) expect(reduce(state, intent, ctx).ok, `${state.window?.kind} ${JSON.stringify(intent)}`).toBe(true);
    } else {
      expect(state.window?.kind).toBe("pass");
      if (state.mode === "questCommit" && legal.some((intent) => intent.type === "Commit")) {
        for (const intent of intentsOf(state, commitSheet(state, ctx, names, []))) expect(reduce(state, intent, ctx).ok).toBe(true);
      }
      for (const intent of intentsOf(state, actionsSheet(state, ctx, legal, names))) expect(reduce(state, intent, ctx).ok).toBe(true);
    }
    state = expectOk(reduce(state, knifeIntent(state, ctx, memory), ctx)).state;
  }
  return state;
}

function checkChoose(state: ScenarioState, sheet: PickSheet, seen: Seen): void {
  const window = state.window;
  if (window?.kind !== "choose") return;
  const frame = state.stack[state.stack.length - 1];
  const data = frame?.data.kind === "effect" ? frame.data : null;
  const source = state.cards[frame?.cardId ?? ""]?.code ?? "";
  if (data?.wait?.kind === "branch") {
    // Each branch is a sentence, never the record's option id; the primary is Confirm.
    expect(sheet.confirm).toBe("Confirm");
    const labels = seen.branches.get(source) ?? new Set<string>();
    for (const option of sheet.options) {
      expect(option.label).not.toBe(bare(option.id));
      labels.add(option.label);
    }
    seen.branches.set(source, labels);
  } else if (data?.wait?.kind === "target") {
    // A Pick names the cards (or players) to choose among and what the chosen one is for.
    seen.picks.add(`${source}:${sheet.verb}`);
    expect(sheet.note ?? "").toMatch(/^Choose /);
    for (const option of sheet.options) expect(option.label).not.toBe(option.id);
  }
  if (state.seatCount > 1) expect(sheet.note ?? "").toContain(`Player ${window.seat + 1} chooses.`);
}

describe("A Knife in the Dark on the table", () => {
  it("every option a sheet offers is accepted, in every window of whole games, and a win ends on Victory", () => {
    const seen: Seen = { windows: new Set(), branches: new Map(), picks: new Set() };
    for (const golden of KNIFE_GOLDENS.filter((item) => item.decks === "strong" || item.name === "two-handed, starter decks, lost")) {
      const end = playChecked(golden, seen);
      expect(end.lost, golden.name).toBe(golden.outcome === "lost");
      const outcome = sheetFor(end, ctx, legalIntents(end, ctx), namesFor(end));
      expect(outcome?.kind).toBe("outcome");
      if (outcome?.kind === "outcome") seen.windows.add(outcome.result);
      expect(railFor(end).current).toBe(golden.outcome === "won" ? "Victory" : "Defeat");
    }
    for (const key of ["mulligan:pick", "choose:pick", "travel:pick", "defense:pick", "won", "lost"]) expect(seen.windows, key).toContain(key);
    // Picks the games reach: an enemy under Weather Hills (141049:A:1), heroes removed from the quest (141054:A:2).
    expect(seen.picks).toContain("141049:Place");
    expect(seen.picks).toContain("141054:Remove");
    // Stage 2B's Forced either/or, in words (141026:B:2).
    const stage = [...(seen.branches.get("141026") ?? [])];
    expect(stage.some((label) => /^Remove \d+ progress from the quest$/.test(label))).toBe(true);
    expect(stage).toContain("Shuffle an out-of-play Ringwraith into the encounter deck");
  }, 240_000);
});

// A two-handed game parked in the staging step, for the sheets and zones built by hand below.
function opened(seatCount: 1 | 2): ScenarioState {
  let state = startScenario(knifeStart(seatCount, 1, "Normal", "starter"), ctx);
  for (let seat = 0; seat < seatCount; seat += 1) state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  return state;
}

const codeOf = (state: ScenarioState, code: string) => Object.values(state.cards).find((card) => card.code === code)?.id ?? "";

describe("shadow cards and the cards under Weather Hills", () => {
  const views = (state: ScenarioState): Record<ZoneId, ZoneView> =>
    Object.fromEntries(TABLE_ZONES.map((zone) => [zone, zoneSelector(zone, 0)(state)])) as Record<ZoneId, ZoneView>;

  it("an attacker carries each shadow card dealt to it, face down until its attack (141069:A:2)", () => {
    let state = opened(1);
    const wraith = codeOf(state, "141069");
    state = moveCard(state, wraith, { zone: "engaged", seat: 0 });
    const [first = "", second = ""] = state.encounterDeck;
    state = moveCard(moveCard(state, first, { zone: "shadow", enemyId: wraith }), second, { zone: "shadow", enemyId: wraith });
    state = updateCard(updateCard(state, first, { face: "down" }), second, { face: "down" });
    expect(state.cards[wraith]?.shadowId).toBe(first);
    expect(state.cards[wraith]?.extraShadowIds).toEqual([second]);
    const layout = tableLayout(390, 640, views(state));
    const shadows = layout.slots.filter((slot) => slot.kind === "shadow");
    expect(shadows.map((slot) => slot.id)).toEqual([first, second]);
    expect(shadows.every((slot) => slot.faceDown && slot.zone === "engaged")).toBe(true);
    // Face down, neither is a card the inspect list opens; turned up, both are.
    expect(inspectTargets(state, wraith)).toEqual([wraith]);
    const up = updateCard(updateCard(state, first, { face: "up" }), second, { face: "up" });
    expect(inspectTargets(up, wraith)).toEqual([wraith, first, second]);
  });

  it("a card under Weather Hills is out of play and draws nothing (141049:A:1)", () => {
    let state = opened(1);
    const hills = codeOf(state, "141049");
    const enemy = codeOf(state, "141052");
    state = moveCard(state, hills, { zone: "staging" });
    state = moveCard(state, enemy, { zone: "under", locationId: hills });
    const layout = tableLayout(390, 640, views(state));
    expect(layout.slots.some((slot) => slot.id === enemy)).toBe(false);
    expect(layout.slots.some((slot) => slot.id === hills)).toBe(true);
  });
});

describe("the words of a choice", () => {
  it("every branch of every Choose record is a sentence, never the record's option id", async () => {
    const { EFFECTS } = await import("../effects/index.ts");
    const { branchWords } = await import("./choice-words.ts");
    const state = opened(2);
    const names = { card: (id: string) => id, code: (code: string) => ctx.cards.get(code)?.name ?? code };
    const walk = (list: readonly import("../catalog/boundary.ts").Instruction[]): string[] =>
      list.flatMap((instruction) => {
        if (instruction.verb === "Choose") return instruction.options.map((option) => branchWords(instruction, option.id, state, names, null)).concat(instruction.options.flatMap((option) => walk(option.instructions)));
        return "instructions" in instruction && Array.isArray(instruction.instructions) ? walk(instruction.instructions) : [];
      });
    const sentences = EFFECTS.flatMap((effect) => walk(effect.instructions));
    expect(sentences.length).toBeGreaterThan(10);
    for (const sentence of sentences) expect(sentence, sentence).toMatch(/^[A-Z][a-z]* .+/);
    expect(sentences).toContain("Each player lowers threat by 2");
    expect(sentences).toContain("Remove 2 heroes you control from the quest");
    expect(sentences).toContain("Exhaust The One Ring");
    expect(sentences).toContain("Reveal an additional encounter card");
  });
});

describe("what a Pick is for", () => {
  it("names the use of the picked card from the record's next instruction", async () => {
    const { EFFECTS } = await import("../effects/index.ts");
    const { pickWords } = await import("./choice-words.ts");
    const names = { card: () => "Weather Hills", code: (code: string) => code };
    const words = (effectId: string) => {
      const instructions = EFFECTS.find((effect) => effect.id === effectId)?.instructions ?? [];
      const at = instructions.findIndex((instruction) => instruction.verb === "Pick");
      const pick = instructions[at];
      return pick ? pickWords(pick, instructions[at + 1], names, "hills") : null;
    };
    expect(words("141045:response:1")).toEqual({ verb: "Put into play", prompt: "Choose an ally to put into play from your hand." });
    expect(words("141071:shadow:1")).toEqual({ verb: "Discard", prompt: "Choose an attachment to discard." });
    expect(words("141049:response:1")).toEqual({ verb: "Place", prompt: "Choose an enemy to place facedown under Weather Hills." });
  });
});

describe("travel to Weathertop", () => {
  it("is refused while The One Ring is exhausted, and the sheet says why (141046:A:3, rr.travel)", async () => {
    const { loadPrinted } = await import("../../scripts/test-catalog.ts");
    const { first, loadWorld, table } = await import("../../scripts/past-scene.ts");
    const { withMode } = await import("../rules/state.ts");
    const { ledgerLine } = await import("./ledger.ts");
    const base = await loadWorld();
    const world = { ...base, cards: new Map([...base.cards, ...(await loadPrinted(["141046"]))]) };
    const travelSheet = (ring: "ready" | "exhausted") => {
      const { state, ctx: scene } = table(world, { staging: ["141046"], ring, engaged: [{ code: "f0", seat: 0 }] });
      const travel: ScenarioState = { ...withMode(state, "travel"), phase: "Travel", boundaryPhase: "Travel", window: { kind: "travel" } };
      const names: SheetNames = { card: (id) => scene.cards.get(travel.cards[id]?.code ?? "")?.name ?? id, line: ledgerLine };
      return { sheet: sheetFor(travel, scene, legalIntents(travel, scene), names), id: first(travel, "141046") };
    };
    const refused = travelSheet("exhausted");
    expect(refused.sheet?.kind).toBe("pick");
    if (refused.sheet?.kind !== "pick") return;
    expect(refused.sheet.options).toEqual([]);
    expect(refused.sheet.title).toBe("No location to travel to");
    expect(refused.sheet.unavailable).toEqual([
      { id: refused.id, label: "Weathertop", code: "141046", reason: "The players cannot pay that location's Travel cost. Travel: The first player must exhaust The One Ring to travel here." },
    ]);
    const open = travelSheet("ready");
    expect(open.sheet?.kind === "pick" ? open.sheet.options.map((option) => option.id) : []).toEqual([open.id]);
    expect(open.sheet?.kind === "pick" ? open.sheet.unavailable : null).toBeUndefined();
  });
});
