// Rules: mec112.setup-shelobs-lair, rr.play-and-put-into-play (data/rules/entries.json); ledger lines 144040:A:2, 144071:B:2, 144071:B:3, 144072:B:2. What the table says of Shelob's Lair's pieces: Shelob's resources (+1 Threat each, and on stage 3B
// each cancels one instance of damage), the progress placed on stage 2B this round against its cap of 4, and each player's allies this round against the 1 they may bring into play. The engine decided each number; nothing here changes one.
import { describe, expect, it } from "vitest";

import { ruleCause } from "../../rules/core/cause.ts";
import { moveCard } from "../../rules/core/zones.ts";
import { noteEntries } from "../../rules/families/sea/entries.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { putOnStage } from "../../rules/quest/quest.ts";
import { idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { dialProps, type TableDial } from "../readouts/dials.ts";
import { lairDials } from "../readouts/lair.ts";
import { alliesWords, capWords, shelobWords } from "../words/scenarios/lair.ts";

const ID = "shelobs-lair";
const SHELOB = "144040";
const table = (layout: Layout = {}) => tableFromLayout(ID, layout);
const names = (made: ReturnType<typeof table>) => (code: string) => made.cards.get(code)?.name ?? code;
const dialsOf = (layout: Layout): readonly TableDial[] => {
  const made = table(layout);
  return lairDials(syncConstants(made.state, made.ctx), made.ctx, names(made));
};
const dial = (dials: readonly TableDial[], id: string) => dials.find((one) => one.id === id);

describe("Shelob's dial", () => {
  it("144040:A:2 shows the resources on Shelob and the Threat they give her, with no limit", () => {
    const shown = dial(dialsOf({ staging: [{ code: SHELOB, resources: 3 }] }), "shelob");
    expect(shown).toMatchObject({ label: "Shelob", value: 3, testID: "lair-shelob", name: "Resources on Shelob, +1 Threat each:" });
    expect(shown?.limit).toBeUndefined();
    expect(shown?.warms).toBeUndefined();
    expect(shown?.note).toBe(shelobWords(3, false));
    expect(dialProps(shown!)).toMatchObject({ elimination: false, testID: "lair-shelob" });
  });

  it("144072:B:2 says on stage 3B that the next damage to her is canceled for 1 resource, and that she takes damage as usual with none", () => {
    expect(dial(dialsOf({ stage: "144072", staging: [{ code: SHELOB, resources: 2 }] }), "shelob")?.note).toBe(shelobWords(2, true));
    expect(shelobWords(2, true)).toContain("canceled");
    expect(dial(dialsOf({ stage: "144072", staging: [{ code: SHELOB, resources: 0 }] }), "shelob")?.note).toBe(shelobWords(0, true));
    expect(shelobWords(0, true)).toContain("usual");
  });

  it("144040:A:2 is there while Shelob is in play, engaged as in the staging area, and not before she is added", () => {
    expect(dial(dialsOf({ engaged: [SHELOB] }), "shelob")).toBeDefined();
    expect(dial(dialsOf({ setAside: [SHELOB] }), "shelob")).toBeUndefined();
    expect(dial(dialsOf({}), "shelob")).toBeUndefined();
  });
});

describe("the progress cap dial", () => {
  it("144071:B:3 shows the progress placed on the stage this round against 4, and the active location going first", () => {
    const made = table({ stage: "144071" });
    const stage = idOf(made.state, "144071");
    const none = dial(lairDials(made.state, made.ctx, names(made)), "cap");
    expect(none).toMatchObject({ label: "Progress", value: 0, limit: 4, testID: "lair-cap", limitWords: capWords(0, 4) });
    expect(none?.warms).toBeUndefined();
    const placed = putOnStage(made.state, stage, 3, 16, made.ctx.cards, [], () => true, ruleCause("rr.step-3-4"), true);
    expect(dial(lairDials(placed, made.ctx, names(made)), "cap")).toMatchObject({ value: 3, limit: 4, limitWords: capWords(3, 4) });
    expect(capWords(4, 4)).toContain("no more can be placed");
  });

  it("144071:B:3 is there only while the Pass is the stage", () => {
    expect(dial(dialsOf({ stage: "144072" }), "cap")).toBeUndefined();
    expect(dial(dialsOf({}), "cap")).toBeUndefined();
  });
});

describe("the allies dials", () => {
  const layout: Layout = { seats: 2, stage: "144071", hand: ["ally", { code: "ally", seat: 0 }] };

  it("144071:B:2 shows each player's allies this round against the 1 they may bring into play, a dial for each seat", () => {
    const shown = dialsOf(layout).filter((one) => one.id.startsWith("allies-"));
    expect(shown.map((one) => [one.label, one.value, one.limit, one.testID])).toEqual([["P1 · Allies", 0, 1, "lair-allies-0"], ["P2 · Allies", 0, 1, "lair-allies-1"]]);
    expect(shown[0]?.limitWords).toBe(alliesWords(0, 1, "Player 1"));
    expect(alliesWords(1, 1, "Player 2")).toBe("Player 2 cannot play or put into play another ally this round");
  });

  it("144071:B:2 counts an ally a seat brought into play, and only that seat's", () => {
    const made = table(layout);
    const first = Object.keys(made.state.cards).find((id) => made.state.cards[id]?.code === "ally" && (made.state.cards[id]?.controller === 0 || made.state.cards[id]?.owner === 0)) ?? "";
    const entered = noteEntries(moveCard(noteEntries(syncConstants(made.state, made.ctx), made.ctx), first, { zone: "play", seat: 0 }), made.ctx);
    const shown = lairDials(entered, made.ctx, names(made)).filter((one) => one.id.startsWith("allies-"));
    expect(shown.map((one) => one.value)).toEqual([1, 0]);
    expect(shown[0]?.limitWords).toBe(alliesWords(1, 1, "Player 1"));
  });

  it("144071:B:2 says 'Allies' with no player's name in true solo, and is gone once the Pass is no longer the stage", () => {
    expect(dial(dialsOf({ stage: "144071" }), "allies-0")).toMatchObject({ label: "Allies", name: "Allies you have played or put into play this round:" });
    expect(dialsOf({ stage: "144072" }).some((one) => one.id.startsWith("allies-"))).toBe(false);
  });
});
