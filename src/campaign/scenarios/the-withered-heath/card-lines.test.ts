// Rules: rr.setup, ltp.permanent, rr.attachment-cards, rr.cannot, emce.deep, emce.caves-deck, rr.travel (data/rules/entries.json).
// Lines: 12176:A:2, 12177:A:2, 12178:A:2, 12179:A:2, 19013:A:1, 19019:A:1. The Withered Heath's Accolade boons and encounter cards whose lines no test named, each read from its printed line on a table built from
// data/ (test/harness/layout.ts, tableFromLayout): the rows run again without the records of their line (test/harness/card-spec.ts, cardSpecs), and the other test does so with withoutLine.
// The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; `attachment` is a player attachment with no text.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { attachBlocked } from "../../../rules/interpret/restrictions.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { answer, cardSpecs, resolve, stat, travel, withoutLine, zone, type Row } from "../../../../test/harness/card-spec.ts";
import { idOf, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const ID = "the-withered-heath";
const SNOW_TROLL = "19013";
const HIGH_FALLS = "19019";
const TREASURY = "18061"; // Ancient Treasury, a Caves location

// "Setup: Attach to a hero." The first player chooses the second hero, so the boon's own +X is read on that hero only.
const ROWS: readonly Row[] = [
  { line: "12176:A:2", name: "Setup: Master of the Hunt is attached to the hero chosen, who gets its +1 hit point", layout: {}, act: [resolve("12176", "setup"), answer("dh2")], expect: [zone("12176", "attached"), stat("dh2", "hitPoints", 7), stat("dh1", "hitPoints", 6)] },
  { line: "12177:A:2", name: "Setup: Unbroken is attached to the hero chosen, who gets its +1 Defense", layout: {}, act: [resolve("12177", "setup"), answer("dh2")], expect: [zone("12177", "attached"), stat("dh2", "defense", 3), stat("dh1", "defense", 2)] },
  { line: "12178:A:2", name: "Setup: The Steadfast is attached to the hero chosen, who gets its +1 Willpower", layout: {}, act: [resolve("12178", "setup"), answer("dh2")], expect: [zone("12178", "attached"), stat("dh2", "willpower", 3), stat("dh1", "willpower", 2)] },
  { line: "12179:A:2", name: "Setup: Dragon-slayer is attached to the hero chosen, who gets its +1 Attack", layout: {}, act: [resolve("12179", "setup"), answer("dh2")], expect: [zone("12179", "attached"), stat("dh2", "attack", 3), stat("dh1", "attack", 2)] },

  // "Deep." (emce.deep): after the players travel to High Falls it is discarded and the top card of the Caves deck becomes the active location. Its Travel cost (1 damage, for the 1 location in the staging area) is paid first.
  { line: "19019:A:1", name: "Deep: after the travel High Falls is discarded and the top Caves card replaces it as the active location", layout: { phase: "Travel", staging: [HIGH_FALLS], piles: { cavesDeck: [TREASURY] } }, act: [travel(HIGH_FALLS)], expect: [zone(TREASURY, "activeLocation"), zone(HIGH_FALLS, "encounterDiscard")] },
];

cardSpecs(ID, ROWS);

// "Cannot have player card attachments." A player attachment is barred from Snow-troll and not from another enemy.
describe("Snow-troll", () => {
  const blocked = (effects: readonly Effect[]) => {
    const t = tableFromLayout(ID, { engaged: [{ code: SNOW_TROLL, seat: 0 }, { code: "f3", seat: 0 }] }, { effects });
    return [attachBlocked(t.state, t.ctx, idOf(t.state, SNOW_TROLL), "attachment"), attachBlocked(t.state, t.ctx, idOf(t.state, "f3"), "attachment")];
  };
  it("19013:A:1 cannot have a player card attachment, and another enemy can", () => {
    expect(blocked(EFFECTS)).toEqual([true, false]);
    expect(blocked(withoutLine(EFFECTS, "19013:A:1"))).toEqual([false, false]);
  });
});
