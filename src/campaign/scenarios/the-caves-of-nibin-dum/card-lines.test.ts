// Rules: rr.attachment-cards, rr.restricted, rr.setup, rr.ownership-and-control (data/rules/entries.json).
// Cave Torch's "Attach to a hero. Restricted." (41029:A:1, ledger data/printed/mirkwood-paths.json): the hosts it may go on are the heroes of every player, never an ally, and the Setup of stage 1A
// (41004:A:1), which attaches it to a hero the first player chooses, must apply the Restricted keyword (an expected failure: it does not). Each table is `tableFromLayout`; `lineSpec` runs the check again
// without the records of its line, where it must fail. The Cracked Pillar line 41006:B:2 is the quest.test.ts test titled with it.
import { describe, expect, it } from "vitest";

import { attachmentHostIds } from "../../../rules/player/attach.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { idOf, resolveRecords, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-caves-of-nibin-dum";
const TORCH = "41029";
const STAGE_1 = "41004";
// Two Restricted Tactics attachments of the core set: Blade of Gondolin and Horn of Gondor.
const BLADE = "01039";
const HORN = "01042";

describe("Cave Torch (41029:A:1)", () => {
  lineSpec("41029:A:1", "it may be attached to the hero of any player, and not to an ally", (effects) => {
    const made = tableFromLayout(SCENARIO, { seats: 2, play: ["ally"] }, { effects });
    const hosts = attachmentHostIds(made.state, 0, TORCH, made.ctx);
    expect(hosts).toEqual(expect.arrayContaining([made.hero, made.hero2, made.seat1Hero]));
    expect(hosts).not.toContain(idOf(made.state, "ally"));
  });

  // The keyword is the card's, not a record's: these two tests cannot be run without the records of the line.
  it("41029:A:1 carries the Restricted keyword printed on its scan", () => {
    expect(tableFromLayout(SCENARIO).ctx.cards.get(TORCH)?.keywords.restricted).toBe(true);
  });

  it("41029:A:1 attached by the Setup to a hero that holds 2 Restricted attachments, one of the three is discarded", () => {
    const made = tableFromLayout(SCENARIO, { stage: STAGE_1, side: "A", setAside: [TORCH], attached: [{ code: BLADE, to: "dh1" }, { code: HORN, to: "dh1" }], deck: ["f0", "f0"] }, { extra: [BLADE, HORN] });
    const run = resolveRecords(made.state, made.ctx, STAGE_1, "setup", made.state.questStage ?? undefined, (state) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === made.hero) ?? state.window.options[0] ?? "") : ""));
    expect(run.state.cards[idOf(run.state, TORCH)]?.host).toBe(made.hero);
    const restricted = Object.values(run.state.cards).filter((card) => card.host === made.hero && [TORCH, BLADE, HORN].includes(card.code));
    expect(restricted).toHaveLength(2);
  });
});
