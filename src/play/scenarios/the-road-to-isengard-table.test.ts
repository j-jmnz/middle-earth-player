// Rules: mec112.wizardry, rr.player-elimination, rr.resources (data/rules/entries.json); ledger lines 143078:B:2, 143079:B:2, 143046:A:1, 143048:A:2, 143080:B:3, 143068:A:2. What the table says of The Road to Isengard's pieces: the dial for the resources
// on stage 1B, the damage on stage 2B, each Ent's resources, Saruman's hit points left and each seat's hand on stage 3B, and Saruman's Voice drawn under its hero. The engine decided each number; nothing here changes one.
import { describe, expect, it } from "vitest";

import { idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { updateCard } from "../../rules/core/state.ts";

import { isengardDials, type IsengardDial } from "../readouts/isengard.ts";
import { zoneSelector } from "../store/selectors.ts";
import { damageLimitWords, entLimitWords, gateWords, handWarning } from "../words/scenarios/isengard.ts";

const table = (layout: Layout = {}, scenario = "the-road-to-isengard") => tableFromLayout(scenario, layout);
const dialsOf = (layout: Layout) => {
  const made = table(layout);
  return isengardDials(syncConstants(made.state, made.ctx), made.ctx, (code) => made.cards.get(code)?.name ?? code);
};
const dial = (dials: readonly IsengardDial[], id: string) => dials.find((one) => one.id === id);

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
    expect(shown?.warn).toBeUndefined();
    expect(shown?.limitWords).toBe(damageLimitWords(3, 5, "The Voice of Saruman"));
    expect(damageLimitWords(3, 5, "stage 3")).toBe("2 more and the players advance to stage 3");
  });

  it("143046:A:1 shows each Ent of Fangorn's resources against the 3 that give a player control, for an Ent that holds one", () => {
    const dials = dialsOf({ stage: "143078", staging: [{ code: "143046", resources: 2 }, "143046", { code: "143046", resources: 1 }] });
    const ents = dials.filter((one) => one.id.startsWith("ent-"));
    expect(ents.map((one) => [one.value, one.limit, one.goal])).toEqual([[2, 3, true], [1, 3, true]]);
    expect(ents[0]?.limitWords).toBe(entLimitWords(2, 3));
    expect(entLimitWords(2, 3)).toBe("1 more and the player who adds it takes control of the Ent");
  });

  it("143048:A:2 shows Saruman's hit points left as the win gate, while the Staff is on him", () => {
    const layout: Layout = { stage: "143080", staging: [{ code: "143047", damage: 2 }], attached: [{ code: "143048", to: "143047" }], hand: ["filler", "filler"] };
    expect(dial(dialsOf(layout), "gate")).toMatchObject({ label: "Gate", value: 4, name: "Saruman's hit points left", note: "4 hit points left, so the players cannot win" });
    expect(dial(dialsOf({ ...layout, staging: [{ code: "143047", damage: 6 }] }), "gate")?.note).toBe("none left, so defeating the stage wins");
    expect(gateWords(1)).toBe("1 hit points left, so the players cannot win");
    expect(dial(dialsOf({ stage: "143080", staging: ["143047"] }), "gate")).toBeUndefined();
  });

  it("143080:B:3 shows each seat's cards in hand on stage 3B, warning at 1 and again at 0, and not on another stage", () => {
    const hands = (...counts: number[]) => dialsOf({ stage: "143080", seats: 2, hand: counts.flatMap((count, seat) => Array.from({ length: count }, () => ({ code: "filler", seat }))) }).filter((one) => one.id.startsWith("hand-"));
    const [first, second] = hands(3, 1);
    expect(first).toMatchObject({ label: "P1 hand", value: 3 });
    expect(first?.warn).toBeUndefined();
    expect(second).toMatchObject({ label: "P2 hand", value: 1, warn: { level: "near" } });
    expect(handWarning(0)).toEqual({ level: "critical", words: "no cards in hand, eliminated" });
    expect(handWarning(1)?.words).toMatch(/eliminates the player/);
    expect(handWarning(2)).toBeUndefined();
    expect(dialsOf({ stage: "143080", hand: ["filler", "filler"] }).find((one) => one.id === "hand-0")?.label).toBe("Hand");
    expect(dialsOf({ stage: "143079", hand: ["filler"] }).some((one) => one.id.startsWith("hand-"))).toBe(false);
  });

  it("143080:B:3 shows no dial in a scenario with none of these pieces", () => {
    const made = table({}, "helms-deep");
    expect(isengardDials(made.state, made.ctx, (code) => code)).toEqual([]);
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
