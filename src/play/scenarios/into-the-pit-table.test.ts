// Rules: dwd.cave-torch-the-long-dark, rr.forced, rr.removed-from-game, rr.first-player (data/rules/entries.json); ledger lines 901001:A:2, 03064:A:1, 03065:B:1.
// What the table says of Into the Pit's pieces: the damage on the Nightmare setup card against the 5 that remove the Cave Torch from the game (a top-bar dial that warms toward the limit and warns at 4), the Torch drawn under its hero, and the owner named on each
// row of a pick that spans seats. The engine decided each number; nothing here changes one. No control types damage, resources, threat, progress or life.
import { describe, expect, it } from "vitest";

import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { settle } from "../../rules/engine/machine.ts";
import { pushCardEffects } from "../../rules/interpret/effect-frames.ts";
import { idOf, legalIntents, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { sheetFor } from "../choice/sheets.ts";
import type { PickSheet, SheetNames } from "../choice/sheet-types.ts";
import { dialProps } from "../readouts/dials.ts";
import { pitDials } from "../readouts/dwarrowdelf/pit.ts";
import { scenarioDials } from "../readouts/scenario-dials.ts";

const at = (layout: Layout = {}) => tableFromLayout("into-the-pit", { phase: "Quest", ...layout });
const withDamage = (damage: number, extra: Layout = {}) => at({ attached: [{ code: "03041", to: "dh1" }], nightmare: { code: "901001", damage }, ...extra });
const torch = (damage: number, extra: Layout = {}): ReturnType<typeof pitDials>[number] | undefined => pitDials(withDamage(damage, extra).state)[0];

describe("the Torch dial on the Nightmare setup card", () => {
  it("901001:A:2 shows the damage against 5, warms toward it and says what each exhaust and the limit do", () => {
    expect(torch(0)).toMatchObject({ value: 0, limit: 5, warms: true, label: "Torch", testID: "pit-torch", limitWords: "5 removes the Cave Torch" });
    expect(torch(0)?.note).toBe("0 of 5 damage on the setup card. Each exhaust of the Cave Torch adds 1. At 5, the Cave Torch is removed from the game.");
    expect(torch(2)?.warn).toBeUndefined();
    expect(torch(3)?.warn).toBeUndefined();
  });

  it("901001:A:2 warns one exhaust short of the limit, said at 4 damage", () => {
    expect(torch(4)?.warn).toEqual({ level: "near", words: "The next exhaust removes the Cave Torch from the game. Burning Low then cannot be canceled and Lightless Passage cannot be traveled to." });
    expect(torch(4)?.value).toBe(4);
  });

  it("901001:A:2 has no limit and says so once the Torch is out of play", () => {
    const t = at({ nightmare: { code: "901001", damage: 5 } });
    const dial = pitDials(t.state)[0];
    expect(dial).toMatchObject({ value: 5, label: "Torch" });
    expect(dial?.limit).toBeUndefined();
    expect(dial?.warms).toBeUndefined();
    expect(dial?.warn).toBeUndefined();
    expect(dial?.note).toBe("5 damage on the setup card. The Cave Torch is removed from the game, so its exhausts add no more.");
  });

  it("901001:A:2 reaches the top bar as a dial that counts toward its limit, and only on Nightmare", () => {
    const t = withDamage(3);
    const names = () => "Cave Torch";
    expect(scenarioDials(t.state, t.ctx, names).some((dial) => dial.id === "torch")).toBe(true);
    expect(dialProps(pitDials(t.state)[0]!)).toMatchObject({ limit: 5, elimination: true, label: "Torch", testID: "pit-torch" });
    const plain = at({ attached: [{ code: "03041", to: "dh1" }] });
    expect(pitDials(plain.state)).toEqual([]);
    expect(scenarioDials(plain.state, plain.ctx, names).some((dial) => dial.id === "torch")).toBe(false);
  });

  it("901001:A:2 reads the damage the engine holds on the setup card, not a count of its own", () => {
    const t = withDamage(1);
    const raised = updateCard(t.state, idOf(t.state, "901001"), { damage: 4 });
    expect(pitDials(raised)[0]?.value).toBe(4);
  });
});

describe("Cave Torch drawn under its host", () => {
  it("03064:A:1 lies attached to a hero of the first player's choice, so it is drawn under that hero wherever the hero lies", () => {
    const t = at({ seats: 2, attached: [{ code: "03041", to: "dh3" }] });
    const id = idOf(t.state, "03041");
    expect(t.state.cards[id]?.host).toBe(idOf(t.state, "dh3"));
    expect(t.state.cards[idOf(t.state, "dh3")]?.attachments).toContain(id);
  });
});

describe("a pick that spans seats names the owner on each row", () => {
  const names = (state: ScenarioState): SheetNames => ({ card: (id) => (state.cards[id]?.code === "03064" ? "Entering the Mines" : `Hero ${state.cards[id]?.code ?? id}`), line: () => null });

  it("03064:A:1 offers the first player the heroes of every player for the Cave Torch, each row naming whose it is", () => {
    const t = at({ seats: 2, stage: "03064", deck: ["f0"] });
    const source = idOf(t.state, "03064");
    const effects = t.ctx.effects.filter((effect) => effect.cardCode === "03064" && effect.timing === "setup");
    const pushed = pushCardEffects(t.state, "setup", source, 0, false, effects, t.ctx, []);
    const state = settle({ ...pushed, window: null, mode: "stopped" }, t.ctx, []);
    const sheet = sheetFor(state, t.ctx, legalIntents(state, t.ctx), names(state)) as PickSheet | null;
    expect((sheet?.options ?? []).map((option) => option.label)).toEqual(["Hero dh1 · Player 1's hero", "Hero dh2 · Player 1's hero", "Hero dh3 · Player 2's hero"]);
  });
});
