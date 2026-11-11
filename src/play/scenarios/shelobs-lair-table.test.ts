// Rules: mec112.setup-shelobs-lair, rr.play-and-put-into-play (data/rules/entries.json); ledger lines 144040:A:2, 144071:B:2, 144071:B:3, 144072:B:2. What the table says of Shelob's Lair's pieces: Shelob's resources (+1 Threat each, and on stage 3B
// each cancels one instance of damage), Gollum's hit points on stage 3B, the progress placed on stage 2B this round against its cap of 4 and what the quest readout says of it, and each player's allies this round on its seat dial. The engine decided each number; nothing here changes one.
import { describe, expect, it } from "vitest";

import { ruleCause } from "../../rules/core/cause.ts";
import { moveCard } from "../../rules/core/zones.ts";
import { noteEntries } from "../../rules/families/sea/entries.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { putOnStage } from "../../rules/quest/quest.ts";
import { idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { readoutFor } from "../readouts/readout.ts";
import { dialProps, type TableDial } from "../readouts/dials.ts";
import { lairDials, lairHands, lairProgressWords } from "../readouts/lair.ts";
import { marshesDials } from "../readouts/marshes.ts";
import { ALLIES_AT_LIMIT_WORDS, CAP_REACHED_WORDS, capWords, GOLLUM_LAIR_WORDS, shelobWords } from "../words/scenarios/lair.ts";

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
    expect(shown?.note).toBe(shelobWords(3, false, false));
    expect(dialProps(shown!)).toMatchObject({ elimination: false, testID: "lair-shelob" });
  });

  it("144040:A:2 drops the Threat from her words once she is engaged, and keeps her quest-phase Forced on stage 3B", () => {
    const engaged = dial(dialsOf({ engaged: [{ code: SHELOB, resources: 2 }] }), "shelob");
    expect(engaged?.note).toBe(shelobWords(2, false, true));
    expect(engaged?.note).not.toContain("+2 Threat");
    expect(engaged?.name).toBe("Resources on Shelob:");
    expect(shelobWords(1, true, false)).toContain("Each beginning of the quest phase");
  });

  it("144072:B:2 says on stage 3B that the next damage to her is canceled for 1 resource, and that she takes damage as usual with none", () => {
    expect(dial(dialsOf({ stage: "144072", staging: [{ code: SHELOB, resources: 2 }] }), "shelob")?.note).toBe(shelobWords(2, true, false));
    expect(shelobWords(2, true, false)).toContain("canceled");
    expect(dial(dialsOf({ stage: "144072", staging: [{ code: SHELOB, resources: 0 }] }), "shelob")?.note).toBe(shelobWords(0, true, false));
    expect(shelobWords(0, true, false)).toContain("usual");
  });

  it("144040:A:2 is there while Shelob is in play, engaged as in the staging area, and not before she is added", () => {
    expect(dial(dialsOf({ engaged: [SHELOB] }), "shelob")).toBeDefined();
    expect(dial(dialsOf({ setAside: [SHELOB] }), "shelob")).toBeUndefined();
    expect(dial(dialsOf({}), "shelob")).toBeUndefined();
  });
});

describe("Gollum's dial on stage 3B", () => {
  const layout: Layout = { stage: "144072", engaged: ["144075"] };

  it("144072:B:1 says a defeated Gollum goes to the victory display, and The Passage of the Marshes' dial does not draw him there", () => {
    const made = table(layout);
    const game = syncConstants(made.state, made.ctx);
    expect(dial(lairDials(game, made.ctx, names(made)), "gollum")).toMatchObject({ label: "Gollum \u00b7 HP", testID: "lair-gollum", goal: true, limitWords: GOLLUM_LAIR_WORDS });
    expect(GOLLUM_LAIR_WORDS).toContain("victory display");
    expect(GOLLUM_LAIR_WORDS).not.toContain("flips to Sméagol");
    expect(marshesDials(game, made.ctx, names(made)).some((one) => one.id === "gollum")).toBe(false);
  });

  it("144072:B:1 leaves Gollum's dial to The Passage of the Marshes on any other stage", () => {
    const made = table({ stage: "144071", engaged: ["144075"] });
    const game = syncConstants(made.state, made.ctx);
    expect(dial(lairDials(game, made.ctx, names(made)), "gollum")).toBeUndefined();
    expect(marshesDials(game, made.ctx, names(made)).some((one) => one.id === "gollum")).toBe(true);
  });
});

describe("the progress cap dial", () => {
  it("144071:B:3 shows the progress placed on the stage this round against 4, and the active location going first", () => {
    const made = table({ stage: "144071" });
    const stage = idOf(made.state, "144071");
    const none = dial(lairDials(made.state, made.ctx, names(made)), "cap");
    expect(none).toMatchObject({ label: "This round", value: 0, limit: 4, testID: "lair-cap", limitWords: capWords(0, 4) });
    expect(none?.warms).toBeUndefined();
    expect(none?.warn).toBeUndefined();
    const placed = putOnStage(made.state, stage, 3, 16, made.ctx.cards, [], () => true, ruleCause("rr.step-3-4"), true);
    expect(dial(lairDials(placed, made.ctx, names(made)), "cap")).toMatchObject({ value: 3, limit: 4, limitWords: capWords(3, 4) });
  });

  it("144071:B:3 warns once the cap is reached, so a full ring does not read as a goal met", () => {
    const made = table({ stage: "144071" });
    const stage = idOf(made.state, "144071");
    const full = putOnStage(made.state, stage, 4, 16, made.ctx.cards, [], () => true, ruleCause("rr.step-3-4"), true);
    const reached = dial(lairDials(full, made.ctx, names(made)), "cap");
    expect(reached).toMatchObject({ value: 4, limit: 4, warn: { level: "near", words: CAP_REACHED_WORDS } });
    expect(reached?.goal).toBeUndefined();
    expect(capWords(4, 4)).not.toContain("more can be placed");
  });

  it("144071:B:3 is there only while the Pass is the stage", () => {
    expect(dial(dialsOf({ stage: "144072" }), "cap")).toBeUndefined();
    expect(dial(dialsOf({}), "cap")).toBeUndefined();
  });
});

describe("the allies mark on each seat's dial", () => {
  const layout: Layout = { seats: 2, stage: "144071", hand: ["ally", { code: "ally", seat: 0 }] };
  const marksOf = (made: ReturnType<typeof table>, state = made.state) => lairHands(state, made.ctx);

  it("144071:B:2 labels each seat's dial with its allies this round, and there is no dial of its own", () => {
    const made = table(layout);
    const game = syncConstants(made.state, made.ctx);
    expect(marksOf(made, game).map((mark) => [mark.seat, mark.label, mark.warn])).toEqual([[0, "P1 \u00b7 0 allies", undefined], [1, "P2 \u00b7 0 allies", undefined]]);
    expect(lairDials(game, made.ctx, names(made)).some((one) => one.id.startsWith("allies-"))).toBe(false);
  });

  it("144071:B:2 counts an ally a seat brought into play, and warns at the limit for that seat only", () => {
    const made = table(layout);
    const first = Object.keys(made.state.cards).find((id) => made.state.cards[id]?.code === "ally" && (made.state.cards[id]?.controller === 0 || made.state.cards[id]?.owner === 0)) ?? "";
    const entered = noteEntries(moveCard(noteEntries(syncConstants(made.state, made.ctx), made.ctx), first, { zone: "play", seat: 0 }), made.ctx);
    expect(marksOf(made, entered)).toEqual([{ seat: 0, label: "P1 \u00b7 1 ally", warn: { level: "near", words: ALLIES_AT_LIMIT_WORDS } }, { seat: 1, label: "P2 \u00b7 0 allies" }]);
    expect(ALLIES_AT_LIMIT_WORDS).toContain("cannot play or put into play another ally this round");
  });

  it("144071:B:2 says no player's name in true solo, and is gone once the Pass is no longer the stage", () => {
    const solo = table({ stage: "144071" });
    expect(marksOf(solo, syncConstants(solo.state, solo.ctx)).map((mark) => mark.label)).toEqual(["0 allies"]);
    const later = table({ stage: "144072" });
    expect(marksOf(later, syncConstants(later.state, later.ctx))).toEqual([]);
  });
});

describe("what the quest readout says of the progress held back", () => {
  it("144071:B:3 states the split between the active location and the stage, and what the cap loses", () => {
    const made = table({ stage: "144071", active: "144046" });
    const game = syncConstants(made.state, made.ctx);
    expect(lairProgressWords(game, made.ctx, 6)).toBe("6 progress: the active location takes 4, the stage 2 more this round");
    expect(lairProgressWords(game, made.ctx, 12)).toBe("12 progress: the active location takes 4, the stage 4 more this round (4 lost)");
  });

  it("144071:B:3 is the quest readout's result line once the commit would place progress", () => {
    const made = table({ stage: "144071", active: "144046", committed: ["dh1", "dh2"] });
    const result = readoutFor({ ...syncConstants(made.state, made.ctx), mode: "resolution" }, made.ctx, null, null, () => "")?.result;
    expect(result).toMatch(/^4 progress: the active location takes 4 if nothing changes/);
  });

  it("144071:B:3 says no progress can be placed once the cap is full, and says nothing on another stage", () => {
    const made = table({ stage: "144071" });
    const stage = idOf(made.state, "144071");
    const full = putOnStage(made.state, stage, 4, 16, made.ctx.cards, [], () => true, ruleCause("rr.step-3-4"), true);
    expect(lairProgressWords(full, made.ctx, 3)).toBe("No progress can be placed on the stage this round");
    const other = table({ stage: "144072" });
    expect(lairProgressWords(other.state, other.ctx, 3)).toBeNull();
  });

  it("144070:B:1 says no progress can be placed while the active location is Underground, on stage 1", () => {
    const underground = table({ stage: "144070", active: "144046" });
    expect(lairProgressWords(syncConstants(underground.state, underground.ctx), underground.ctx, 3)).toBe("No progress can be placed: Underground locations take none");
    const vale = table({ stage: "144070", active: "144043" });
    expect(lairProgressWords(syncConstants(vale.state, vale.ctx), vale.ctx, 3)).toBeNull();
  });
});
