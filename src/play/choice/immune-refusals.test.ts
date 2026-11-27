// Rules: rr.immune, mec109.immune-to-player-card-effects (data/rules/entries.json); ledger line 17068:A:1. A player card's pick of a location leaves out Spider Burrow, which is immune to player card effects: the sheet lists it as unavailable
// with the keyword's words, and when it leaves one location the banner says why the progress went there.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../effects/index.ts";
import { legalIntents } from "../../rules/engine/legal.ts";
import { idOf, start, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { sendUnledgered } from "../../../test/harness/player-table.ts";

import { immuneProgressWords } from "../store/immune-note.ts";
import { sheetFor } from "./sheets.ts";

// Beneath the Sands: Spider Burrow (17068, immune), Cobwebbed Cavern (17071), Off Track (17079), a stand-in location; Ride to Ruin (02078) played with Snowbourn Scout (01016) and Éowyn (01007).
const [SID, BURROW, CAVERN, OFF, PLACE, RIDE_TO_RUIN, SCOUT, EOWYN] = ["beneath-the-sands", "17068", "17071", "17079", "place", "02078", "01016", "01007"] as const;

const played = (layout: Layout) => {
  const made = tableFromLayout(SID, { phase: "Quest", hand: [RIDE_TO_RUIN], play: [SCOUT], heroes: [{ code: EOWYN, resources: 2 }], ...layout }, { effects: EFFECTS, extra: [RIDE_TO_RUIN, SCOUT, EOWYN] });
  const before = start(made.state);
  const after = sendUnledgered(before, { type: "PlayCard", cardId: idOf(made.state, RIDE_TO_RUIN), payments: [{ heroId: idOf(made.state, EOWYN), amount: 1 }] }, made.ctx);
  return { made, before: made.state, after };
};

describe("a player card's pick leaves out an immune location and says so", () => {
  it("lists Spider Burrow beside the rows with the keyword's words (17068:A:1)", () => {
    const { made, after } = played({ staging: [OFF, BURROW, CAVERN, PLACE] });
    const names = { card: (id: string) => made.ctx.cards.get(after.state.cards[id]?.code ?? "")?.name ?? id, line: () => null };
    const sheet = sheetFor(after.state, made.ctx, legalIntents(after.state, made.ctx), names);
    if (sheet?.kind !== "pick") throw new Error(`no pick sheet: ${JSON.stringify(after.state.window)}`);
    expect(sheet.unavailable?.map((row) => `${row.label} · ${row.reason}`)).toEqual(["Spider Burrow · Immune to player card effects."]);
    expect(sheet.options.map((row) => row.label)).not.toContain("Spider Burrow");
  });

  it("lists none when no immune card is in play", () => {
    const { made, after } = played({ staging: [OFF, CAVERN, PLACE] });
    const names = { card: (id: string) => id, line: () => null };
    const sheet = sheetFor(after.state, made.ctx, legalIntents(after.state, made.ctx), names);
    if (sheet?.kind !== "pick") throw new Error("no pick sheet");
    expect(sheet.unavailable).toBeUndefined();
  });

  it("the banner names the immune location when the pick is left with one", () => {
    const { made, before, after } = played({ staging: [OFF, BURROW, CAVERN] });
    const step = after.steps.find((one) => one.kind === "progress");
    expect(step, JSON.stringify(after.steps.map((one) => one.kind))).toBeDefined();
    if (step?.kind !== "progress") return;
    const words = immuneProgressWords(made.ctx, before, step, (id) => made.ctx.cards.get(after.state.cards[id]?.code ?? "")?.name ?? id);
    expect(words).toBe("Spider Burrow is immune to player card effects: the progress goes on Cobwebbed Cavern.");
  });
});
