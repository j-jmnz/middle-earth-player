// Rules: rm.out-of-play-deck, rm.time-x, rr.cannot, rr.engaged (data/rules/entries.json); ledger lines 07062:A:1, 07024:A:2, 07025:A:1, 07027:A:2, 07028:A:1, 07029:A:1, 07038:A:1, 07055:A:2, 07063:B:1, 07063:B:2, 07064:B:1, 07064:B:2.
// What the table says of To Catch an Orc's pieces: each seat's out-of-play deck as a count, Mugash held under his hero and the Guard that engages its player, the time dial of stages 2B and 3B, and the choices that can destroy the hero that holds Mugash. The engine decided each; nothing here changes one.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../rules/core/intents.ts";
import { updateCard, type GameEvent } from "../../rules/core/state.ts";
import { settle } from "../../rules/engine/machine.ts";
import { fireForced } from "../../rules/windows/triggers.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { idOf, resolveRecords, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import type { PickOption } from "../choice/sheet-types.ts";
import { sheetFor } from "../choice/sheets.ts";
import { slotNumbers } from "../cards/card-effects.ts";
import { dungeonDetail } from "../cards/dungeon-preview.ts";
import { scenarioDials } from "../readouts/scenario-dials.ts";
import { zoneSelector } from "../store/selectors.ts";

const ID = "to-catch-an-orc";
const MUGASH = "07024";
const GUARD = "07025";
const built = (layout: Layout = {}) => tableFromLayout(ID, { phase: "Quest", deckOf: ["filler", "filler", "filler"], ...layout });
type Made = ReturnType<typeof built>;
const nameOf = (made: Made) => (code: string) => made.cards.get(code)?.name ?? code;
const detail = (made: Made, code: string) => dungeonDetail(made.state, made.ctx, idOf(made.state, code), (id) => made.cards.get(made.state.cards[id]?.code ?? "")?.name ?? id);
const dials = (made: Made) => scenarioDials(made.state, made.ctx, nameOf(made));
const outDials = (made: Made) => dials(made).filter((dial) => dial.testID === "ring-maker-out-of-play");
const pile = (count: number) => Array.from({ length: count }, () => "filler");
const MUGASH_ON_HERO = { attached: [{ code: MUGASH, to: "dh1", encounter: true as const }] };

describe("the out-of-play deck of each seat", () => {
  it("07062:A:1 is a count, one deck solo and both decks two-handed with each player named, and never names a card", () => {
    const solo = built({ piles: { outOfPlay0: [...pile(12), MUGASH] } });
    expect(outDials(solo)).toHaveLength(1);
    expect(outDials(solo)[0]).toMatchObject({ label: "Out of play", value: 13, name: "Cards in your out-of-play deck:" });
    expect(outDials(solo)[0]?.note).toBe("Your out-of-play deck holds 13 cards, facedown. Mugash is in one of the decks until a reveal finds him.");
    const two = built({ seats: 2, piles: { outOfPlay0: [...pile(9), MUGASH], outOfPlay1: [...pile(11), GUARD] } });
    // Two-handed one dial holds both, so the top bar keeps its room; its panel names each player's deck.
    expect(outDials(two)).toHaveLength(1);
    expect(outDials(two)[0]).toMatchObject({ label: "Out of play", value: 22, name: "Cards in the out-of-play decks:" });
    expect(outDials(two)[0]?.lists).toEqual([{ heading: "Out-of-play decks", lines: ["Player 1: 10 cards", "Player 2: 12 cards"] }]);
    expect(outDials(two)[0]?.note).toBe("Player 1's out-of-play deck holds 10 cards and Player 2's out-of-play deck holds 12 cards, facedown. Mugash is in one of the decks until a reveal finds him.");
  });

  it("07062:A:1 warms while a deck is low and Mugash is not found, naming the player; no other game has the dial", () => {
    expect(outDials(built({ piles: { outOfPlay0: [...pile(5), MUGASH] } }))[0]?.warn).toBeUndefined();
    const low = outDials(built({ piles: { outOfPlay0: [...pile(4), MUGASH] } }))[0];
    expect(low?.warn).toMatchObject({ level: "near", words: "Your out-of-play deck is running low: 5 cards left, and Mugash is not found." });
    // A seat whose deck is empty warms the dial and says so; the other seat's cards still count.
    const two = built({ seats: 2, piles: { outOfPlay1: [MUGASH] } });
    const empty = { ...two, state: { ...two.state, piles: { ...two.state.piles, outOfPlay0: [] } } };
    expect(outDials(empty)[0]?.value).toBe(1);
    expect(outDials(empty)[0]?.warn?.words).toBe("Player 1's out-of-play deck is empty. No reveal from it finds anything.");
    const found = built({ staging: [MUGASH], piles: { outOfPlay0: pile(3) } });
    expect(outDials(found)[0]?.warn).toBeUndefined();
    expect(outDials(found)[0]?.note).toContain("Mugash is found.");
    const other = tableFromLayout("the-fords-of-isen", { phase: "Quest", deckOf: ["filler"] });
    expect(scenarioDials(other.state, other.ctx, (code) => code).filter((dial) => dial.testID?.includes("out-of-play"))).toHaveLength(0);
  });
});

describe("Mugash held under his hero", () => {
  it("07024:A:2 the hero's preview says it cannot ready and that the players lose if it leaves play", () => {
    const made = built({ ...MUGASH_ON_HERO });
    expect(detail(made, MUGASH)).toBe("Mugash is held by dh1. dh1 cannot ready. If dh1 leaves play, the players lose the game.");
    expect(detail(made, "dh1")).toBe("dh1 holds Mugash. It cannot ready. If it leaves play, the players lose the game.");
  });

  it("07024:A:2 the hero wears the held pill with Mugash's name; a free Mugash and another hero have none", () => {
    const made = built({ ...MUGASH_ON_HERO });
    expect(slotNumbers(made.state, made.ctx, idOf(made.state, "dh1")).under).toMatchObject({ text: "1 held", speech: "Mugash held underneath" });
    expect(slotNumbers(made.state, made.ctx, idOf(made.state, "dh2")).under).toBeNull();
    const staged = built({ staging: [MUGASH] });
    expect(detail(staged, MUGASH)).toBeNull();
  });

  it("07024:A:2 is drawn under the hero in the play area and the pill shows when the hero is also committed or exhausted", () => {
    const made = built({ ...MUGASH_ON_HERO, committed: ["dh1"] });
    const heroes = zoneSelector("play", 0)(made.state).entries;
    expect(heroes.find((entry) => entry.card.code === "dh1")?.attached.map((card) => card.code)).toEqual([MUGASH]);
    const exhausted = updateCard(made.state, idOf(made.state, "dh1"), { exhausted: true });
    expect(slotNumbers(exhausted, made.ctx, idOf(exhausted, "dh1")).under?.text).toBe("1 held");
  });
});

describe("Mugash's Guard", () => {
  it("07025:A:1 says whom it engages once Mugash is attached, naming the player two-handed", () => {
    expect(detail(built({ staging: [GUARD] }), GUARD)).toBe("While a player controls a hero with Mugash attached, this Guard engages that player, whatever its engagement cost.");
    const solo = built({ staging: [GUARD], ...MUGASH_ON_HERO });
    expect(detail(solo, GUARD)).toBe("Mugash is attached to a hero you control. This Guard engages you, whatever its engagement cost.");
    const two = built({ seats: 2, staging: [GUARD], ...MUGASH_ON_HERO });
    expect(detail(two, GUARD)).toBe("Mugash is attached to a hero Player 1 controls. This Guard engages Player 1, whatever its engagement cost.");
  });
});

describe("the time dial of stages 2B and 3B", () => {
  const timeDial = (stage: string, left: number) => {
    const made = built({ stage });
    const state = updateCard(made.state, idOf(made.state, stage), { resources: left });
    return scenarioDials(state, made.ctx, nameOf(made)).find((dial) => dial.testID?.startsWith("ring-maker-time:"));
  };

  it("07063:B:1 and 07064:B:1 read the counters against Time 2 and Time 3; they warm near and are never critical", () => {
    expect(timeDial("07063", 2)).toMatchObject({ label: "Time", value: 2, limit: 2, limitWords: "Time 2: it starts with 2 time counters" });
    expect(timeDial("07064", 3)).toMatchObject({ value: 3, limit: 3 });
    expect(timeDial("07064", 3)?.warn).toBeUndefined();
    for (const stage of ["07063", "07064"]) expect(timeDial(stage, 1)?.warn?.level).toBe("near");
  });

  it("07063:B:2 and 07064:B:2 name what the last counter does", () => {
    expect(timeDial("07063", 1)?.warn?.words).toBe("The next refresh phase takes the last time counter. With the last gone, the encounter discard pile joins the deck, 2 encounter cards are revealed for each player, and 2 time counters return.");
    expect(timeDial("07064", 1)?.note).toContain("Mugash returns to the staging area");
    expect(timeDial("07064", 1)?.note).toContain("3 time counters return");
  });
});

// Every sheet a record's windows open, in order: the rows each offers and the caution on each, and the sentence over it. `pick` names the option taken at each Choose, by its sheet's number.
type Row = { id: string; label: string; caution?: string };
function sheetsOf(made: Made, code: string, timing: "whenRevealed" | "forced", pick: (n: number, ids: readonly string[]) => string) {
  const sheets: { prompt: string; rows: Row[] }[] = [];
  const lookup = { card: (id: string) => made.cards.get(made.state.cards[id]?.code ?? "")?.name ?? id, line: () => null };
  resolveRecords(made.state, made.ctx, code, timing, undefined, (at) => {
    const sheet = sheetFor(at, made.ctx, legalIntents(at, made.ctx), { card: (id) => made.cards.get(at.cards[id]?.code ?? "")?.name ?? id, line: lookup.line });
    const rows: Row[] = sheet && "options" in sheet ? (sheet.options as readonly PickOption[]).map((option) => ({ id: option.id, label: option.label, ...(option.caution ? { caution: option.caution } : {}) })) : [];
    sheets.push({ prompt: sheet && "prompt" in sheet ? String(sheet.prompt) : "", rows });
    return pick(sheets.length - 1, rows.map((row) => row.id));
  });
  return sheets;
}

describe("choices that can destroy the hero that holds Mugash", () => {
  // The hero dh1 holds Mugash with 1 hit point left (health 6, 5 damage), exhausted as Mugash left it.
  const holder = (layout: Layout, damage: number) => {
    const made = built({ ...MUGASH_ON_HERO, stage: "07063", timeCounters: 2, ...layout });
    return { ...made, state: updateCard(made.state, idOf(made.state, "dh1"), { damage, exhausted: true }) };
  };
  const damageRow = (made: Made) => sheetsOf(made, "07055", "whenRevealed", () => "damage")[0]?.rows.find((row) => row.id === "damage");

  it("07055:A:2 Take Cover!'s damage row warns when the hero that holds Mugash has 1 hit point left, and not before", () => {
    expect(damageRow(holder({}, 5))?.caution).toBe("Tap again: the damage destroys the hero that holds Mugash and the players lose the game");
    expect(damageRow(holder({}, 4))?.caution).toBeUndefined();
    expect(damageRow(holder({}, 5))?.label).toBe("Deal 1 damage to each exhausted character");
  });

  it("07038:A:1 Orc Skirmisher's pick arms the second tap on the hero that holds Mugash when 3 damage destroys it, on that row only", () => {
    const at = (damage: number) => sheetsOf(holder({}, damage), "07038", "forced", (n, ids) => (n === 0 ? "damage" : (ids[0] ?? "")));
    const rows = (damage: number) => at(damage).at(-1)?.rows ?? [];
    expect(at(3)[0]?.rows.map((row) => row.label)).toEqual(["Deal 3 damage to a character you control", "Remove 1 time counter from the current quest (2 left, 1 after)"]);
    expect(rows(3).find((row) => row.label === "dh1")?.caution).toBe("Tap again: dh1 holds Mugash, the damage destroys it and the players lose the game");
    expect(rows(3).filter((row) => row.caution != null)).toHaveLength(1);
    expect(rows(2).some((row) => row.caution != null)).toBe(false);
  });

  it("07063:B:2 the time rows of stage 2B count the counters and name what the last one does when the player can take it", () => {
    const made = holder({ timeCounters: 1 }, 0);
    const time = sheetsOf(made, "07055", "whenRevealed", () => "time")[0]?.rows.find((row) => row.id === "time");
    expect(time?.label).toBe("Remove 1 time counter from the current quest (1 left, 0 after)");
    expect(time?.caution).toBe("Tap again: the last time counter comes off, the encounter discard pile joins the deck, 2 encounter cards are revealed for each player, and 2 time counters return.");
  });
});

describe("the search of the out-of-play deck", () => {
  // Methedras leaves play as an explored location: the first sheet the player sees over the cards revealed.
  const search = (layout: Layout) => {
    const made = built({ active: "07027", ...layout });
    const code = layout.active != null ? String(layout.active) : "07027";
    const steps: EngineStep[] = [];
    const event = { trigger: "leftPlay", seat: 0, cardId: idOf(made.state, code), explored: true } as GameEvent;
    const state = settle(fireForced({ ...made.state, window: null }, event, made.ctx, steps), made.ctx, steps);
    return { made, state };
  };

  const sheetOf = (found: { made: Made; state: ReturnType<typeof settle> }) => sheetFor(found.state, found.made.ctx, legalIntents(found.state, found.made.ctx), { card: (id) => found.made.cards.get(found.state.cards[id]?.code ?? "")?.name ?? id, line: () => null });

  it("07027:A:2 the sheet says what a search of the player's own deck does, and lists the revealed cards that are no enemy", () => {
    const sheet = sheetOf(search({ piles: { outOfPlay0: ["f0", "ally", "filler", "event"] } }));
    expect(sheet).toMatchObject({ kind: "pick", verb: "Take", note: "You revealed the top 3 cards of your out-of-play deck. Enemies join the staging area. Choose 1 other card for your hand. The rest are discarded." });
    expect((sheet as { options: readonly PickOption[] }).options.map((option) => option.label)).toEqual(["ally", "filler"]);
  });

  it("07028:A:1 Orc Cave's search says 5 and, two-handed, names the first player who answers", () => {
    const found = search({ seats: 2, active: "07028", piles: { outOfPlay0: ["ally", "filler", "event", "filler", "f0", "filler"], outOfPlay1: ["ally"] } });
    const sheet = sheetOf(found);
    expect(sheet).toMatchObject({ kind: "pick", verb: "Take" });
    expect(String((sheet as { note?: string }).note)).toMatch(/^Player 1: You revealed the top 5 cards of your out-of-play deck\./);
  });
});
