// Rules: mec112.wizardry, rr.player-elimination, rr.resources (data/rules/entries.json); ledger lines 143078:B:2, 143079:B:2, 143046:A:1, 143048:A:2, 143080:B:3, 143068:A:2. What the table says of The Road to Isengard's pieces: the dial for the resources
// on stage 1B, the damage on stage 2B, each Ent's resources, Saruman's hit points left and each seat's hand on stage 3B, and Saruman's Voice drawn under its hero. The engine decided each number; nothing here changes one.
import { describe, expect, it } from "vitest";

import { idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { updateCard } from "../../rules/core/state.ts";

import { isengardDials, isengardHands } from "../readouts/isengard.ts";
import type { TableDial } from "../readouts/dials.ts";
import { zoneSelector } from "../store/selectors.ts";
import type { Instruction } from "../../catalog/boundary.ts";
import { asksChoose, asksOption, type AsksTable } from "../words/asks.ts";
import { ASKS } from "../words/asks/the-road-to-isengard.ts";
import { advanceLimitWords } from "../words/scenarios/fortress.ts";
import { entLimitWords, gateWords, handLabel, handWarning } from "../words/scenarios/isengard.ts";

const table = (layout: Layout = {}, scenario = "the-road-to-isengard") => tableFromLayout(scenario, layout);
const dialsOf = (layout: Layout) => {
  const made = table(layout);
  return isengardDials(syncConstants(made.state, made.ctx), made.ctx, (code) => made.cards.get(code)?.name ?? code);
};
const dial = (dials: readonly TableDial[], id: string) => dials.find((one) => one.id === id);

describe("the dials of The Road to Isengard", () => {
  it("143078:B:2 shows the resources on stage 1B as the encounter cards revealed on advancing", () => {
    const made = table({ stage: "143078" });
    const loaded = updateCard(made.state, idOf(made.state, "143078"), { resources: 3 });
    const dials = isengardDials(loaded, made.ctx, (code) => made.cards.get(code)?.name ?? code);
    expect(dial(dials, "reveals")).toMatchObject({ label: "Reveals", value: 3, name: "Resource tokens on Rouse the Ents" });
    expect(dial(dials, "reveals")?.note).toMatch(/revealed on advancing/);
    expect(dial(dials, "reveals")?.limit).toBeUndefined();
    expect(dialsOf({ stage: "143079" }).some((one) => one.id === "reveals")).toBe(false);
  });

  it("143079:B:2 shows the damage on stage 2B against the 5 that advance the players, in the goal tone and never warning", () => {
    const made = table({ stage: "143079" });
    const hurt = updateCard(made.state, idOf(made.state, "143079"), { damage: 3 });
    const shown = dial(isengardDials(hurt, made.ctx, (code) => made.cards.get(code)?.name ?? code), "damage");
    expect(shown).toMatchObject({ label: "Damage", value: 3, limit: 5, goal: true });
    expect(shown?.limitWords).toBe(advanceLimitWords(3, 5, "The Voice of Saruman"));
    expect(advanceLimitWords(3, 5, "stage 3")).toBe("2 more and the players advance to stage 3");
  });

  it("143046:A:1 shows one dial for the Ents: the one closest to control against the 3 that give a player control, and every Ent's count in its words", () => {
    const dials = dialsOf({ stage: "143078", staging: [{ code: "143046", resources: 2 }, "143046", { code: "143046", resources: 1 }, "143046"] });
    const ents = dials.filter((one) => one.id.startsWith("ent"));
    expect(ents.map((one) => [one.id, one.label, one.value, one.limit, one.goal])).toEqual([["ents", "Ents", 2, 3, true]]);
    expect(ents[0]?.limitWords).toBe(entLimitWords([2, 1, 0, 0], 3));
    expect(entLimitWords([2, 1, 0, 0], 3)).toBe("4 Ents in the staging area hold 2, 1, 0 and 0; 1 more on the nearest and the player who adds it takes control of that Ent");
    expect(entLimitWords([1], 3)).toBe("1 Ent in the staging area holds 1; 2 more on the nearest and the player who adds it takes control of that Ent");
    expect(dialsOf({ stage: "143078", staging: ["143046", "143046"] }).some((one) => one.id === "ents")).toBe(false);
  });

  it("143048:A:2 shows Saruman's hit points left on the disc and the damage filling the ring toward his hit points, while the Staff is on him", () => {
    const layout: Layout = { stage: "143080", staging: [{ code: "143047", damage: 2 }], attached: [{ code: "143048", to: "143047" }], hand: ["filler", "filler"] };
    expect(dial(dialsOf(layout), "gate")).toMatchObject({ label: "Gate \u00b7 HP", value: 4, limit: 6, filled: 2, goal: true, name: "Saruman's hit points left", limitWords: "the players cannot win while any are left" });
    expect(dial(dialsOf({ ...layout, staging: [{ code: "143047", damage: 6 }] }), "gate")).toMatchObject({ value: 0, filled: 6, limitWords: "the gate is open, so defeating the stage wins" });
    expect(gateWords(1)).toBe(gateWords(4));
    expect(dial(dialsOf({ stage: "143080", staging: ["143047"] }), "gate")).toBeUndefined();
  });

  it("143048:A:2 reads Saruman's hit points as the engine does: a card that raises them moves the dial and its limit", () => {
    const made = table({ stage: "143080", staging: [{ code: "143047", damage: 2 }], attached: [{ code: "143048", to: "143047" }], hand: ["filler", "filler"] });
    const saruman = idOf(made.state, "143047");
    const raised: typeof made.state = { ...made.state, modifiers: [...made.state.modifiers, { instanceId: saruman, sourceId: saruman, stat: "hitPoints", amount: 2, until: "whileSourceInPlay" }] };
    expect(dial(isengardDials(raised, made.ctx, (code) => made.cards.get(code)?.name ?? code), "gate")).toMatchObject({ value: 6, limit: 8, filled: 2 });
  });

  it("143080:B:3 puts each seat's cards in hand on its threat dial's label on stage 3B, warning at 1 and again at 0, and not on another stage", () => {
    const hands = (...counts: number[]) => {
      const made = table({ stage: "143080", seats: 2, hand: counts.flatMap((count, seat) => Array.from({ length: count }, () => ({ code: "filler", seat }))) });
      return isengardHands(syncConstants(made.state, made.ctx));
    };
    const [first, second] = hands(3, 1);
    expect(first).toEqual({ seat: 0, label: "P1 \u00b7 3 cards" });
    expect(second).toEqual({ seat: 1, label: "P2 \u00b7 last card", warn: { level: "near", words: "playing or discarding it eliminates this player" } });
    expect(handLabel(0, 1)).toBe("P2 \u00b7 out");
    expect(handWarning(0)).toEqual({ level: "critical", words: "this player is eliminated" });
    expect(handWarning(2)).toBeUndefined();
    const solo = table({ stage: "143080", hand: ["filler", "filler"] });
    expect(isengardHands(syncConstants(solo.state, solo.ctx))).toEqual([{ seat: 0, label: "2 cards" }]);
    const other = table({ stage: "143079", hand: ["filler"] });
    expect(isengardHands(syncConstants(other.state, other.ctx))).toEqual([]);
  });

  it("143080:B:3 shows no dial in a scenario with none of these pieces", () => {
    const made = table({}, "helms-deep");
    expect(isengardDials(made.state, made.ctx, (code) => code)).toEqual([]);
    expect(isengardHands(made.state)).toEqual([]);
  });
});

describe("Saruman's Voice on the table", () => {
  it("143068:A:2 is drawn under its hero, as an attachment is, in the play zone", () => {
    const made = table({ stage: "143079", attached: [{ code: "143068", to: "dh1" }] });
    const heroes = zoneSelector("play", 0)(made.state);
    const host = heroes.entries.find((entry) => entry.card.id === made.hero);
    expect(host?.attached.map((card) => card.code)).toEqual(["143068"]);
  });
});

describe("the discards of The Road to Isengard on stage 3B", () => {
  // The Isengard Orc's and the Wolf's discard options say they eliminate the player whose last card it is, on stage 3B only (143080:B:3).
  const asked = (stage: string, hand: number) => {
    const made = table({ stage, hand: Array.from({ length: hand }, () => "filler") });
    const names = { card: (key: string) => made.cards.get(key)?.name ?? key, code: (code: string) => made.cards.get(code)?.name ?? code };
    const orc = made.ctx.effects.find((effect) => effect.id === "143051:whenRevealed:1")!;
    const wolf = made.ctx.effects.find((effect) => effect.id === "143052:forced:1")!;
    const facts = (effect: typeof orc, source: string) => ({ game: made.state, ctx: made.ctx, names, instruction: effect.instructions[0] as Instruction, source, effectId: effect.id });
    const words: AsksTable = ASKS;
    return {
      orc: { note: asksChoose(facts(orc, "143051"), words)?.note, discard: asksOption(facts(orc, "143051"), "discard", words)?.label },
      wolf: { note: asksChoose(facts(wolf, "143052"), words)?.note, discard: asksOption(facts(wolf, "143052"), "discard", words)?.label },
    };
  };

  it("143080:B:3 says a discard of the last card eliminates the player", () => {
    const last = asked("143080", 1);
    expect(last.orc.discard).toBe("Discard your last card: you are eliminated");
    expect(last.wolf.discard).toBe("Discard your last card: you are eliminated");
    expect(last.orc.note).toMatch(/last card: you are eliminated/);
    expect(last.wolf.note).toMatch(/last card: you are eliminated/);
  });

  it("143051:A:2 keeps the ordinary words with 2 cards in hand, and on another stage", () => {
    expect(asked("143080", 2).orc.discard).toBe("Discard 1 card at random from your hand");
    expect(asked("143080", 2).wolf.discard).toBe("Discard 1 card of your choice from your hand");
    expect(asked("143079", 1).orc.discard).toBe("Discard 1 card at random from your hand");
  });
});
