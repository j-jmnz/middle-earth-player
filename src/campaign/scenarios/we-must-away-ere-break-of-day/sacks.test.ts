// Rules: hob.sack-deck, hob.sack-x, hob.sack-x-example, rr.attachment-cards, rr.constant-ability, rr.in-play-and-out-of-play (data/rules/entries.json); docs/scenarios/the-hobbit/we-must-away-ere-break-of-day.md (We Must Away, Ere Break of Day, When Sacked targets).
import { describe, expect, it } from "vitest";

import { announce, answer, cardSpecs, flag, zone, type Row } from "../../../../test/harness/card-spec.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { moveCard, spawn } from "../../../rules/core/zones.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { attachTargetCodes, engagedHandTable, idOf, resolveRecords, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

// The seven Sack cards (131044 to 131050): the When Sacked attach of each (the character with the highest value, the first player choosing among those tied, none when no one is eligible) and what the attached character cannot do. The stand-in heroes dh1 and dh2 have
// 2 in every stat and 6 hit points, the stand-in ally 1 cost and 1 in every stat with 2 hit points, Bilbo Baggins (`sagaHero`) 1 in every stat, 3 hit points and the resources his pool holds.
const ID = "we-must-away-ere-break-of-day";
const BILBO = "131001";
// Bert engages the first player and his Forced effect draws the Sack card: the real path to a When Sacked effect (Sack 1).
const DRAWN = (code: string) => ({ engaged: ["131033"], piles: { sackDeck: [code] } }) as const;
const SACKED = announce("engaged", "131033", { seat: 0 });
const HELD = ["cannotReady", "cannotAttack", "cannotDefend", "cannotQuest", "cannotTriggerEffects"] as const;
const heldBy = (host: string, value = true) => HELD.map((name) => flag(host, name, value));

const ROWS: readonly Row[] = [
  // 131044 A Smelly Sack: the ally with the highest printed cost.
  { line: "131044:A:1", name: "When Sacked: it attaches to the ally with the highest printed cost, never to a hero", layout: { ...DRAWN("131044"), play: ["ally"], sagaHero: {} }, act: SACKED, expect: [zone("131044", "attached"), ...heldBy("ally"), ...heldBy("dh1", false)] },
  { line: "131044:A:2", name: "the attached character cannot ready, attack, defend, commit to quests or trigger effects", layout: { attached: [{ code: "131044", to: "ally" }], play: ["ally"] }, act: [], expect: heldBy("ally") },
  // 131045 A Strong Sack: the highest printed Attack, the first player choosing among those tied.
  { line: "131045:A:1", name: "When Sacked: it attaches to the character with the highest printed Attack, the first player choosing between the tied heroes", layout: { ...DRAWN("131045"), play: ["ally"], sagaHero: {} }, act: [SACKED, answer("dh2")], expect: [zone("131045", "attached"), ...heldBy("dh2"), ...heldBy("dh1", false), ...heldBy(BILBO, false), ...heldBy("ally", false)] },
  { line: "131045:A:2", name: "the attached character cannot ready, attack, defend, commit to quests or trigger effects", layout: { attached: [{ code: "131045", to: "dh1" }] }, act: [], expect: heldBy("dh1") },
  // 131046 A Tough Sack: the highest printed Defense.
  { line: "131046:A:1", name: "When Sacked: it attaches to the character with the highest printed Defense", layout: { ...DRAWN("131046"), play: ["ally"], sagaHero: {} }, act: [SACKED, answer("dh1")], expect: [zone("131046", "attached"), ...heldBy("dh1"), ...heldBy("dh2", false), ...heldBy(BILBO, false)] },
  { line: "131046:A:2", name: "the attached character cannot ready, attack, defend, commit to quests or trigger effects", layout: { attached: [{ code: "131046", to: "dh1" }] }, act: [], expect: heldBy("dh1") },
  // 131047 A Large Sack: the highest printed hit points.
  { line: "131047:A:1", name: "When Sacked: it attaches to the character with the highest printed hit points", layout: { ...DRAWN("131047"), play: ["ally"], sagaHero: {} }, act: [SACKED, answer("dh1")], expect: [zone("131047", "attached"), ...heldBy("dh1"), ...heldBy("dh2", false), ...heldBy(BILBO, false)] },
  { line: "131047:A:2", name: "the attached character cannot ready, attack, defend, commit to quests or trigger effects", layout: { attached: [{ code: "131047", to: "dh1" }] }, act: [], expect: heldBy("dh1") },
  // 131048 A Deep Sack: the highest printed Willpower.
  { line: "131048:A:1", name: "When Sacked: it attaches to the character with the highest printed Willpower", layout: { ...DRAWN("131048"), play: ["ally"], sagaHero: {} }, act: [SACKED, answer("dh2")], expect: [zone("131048", "attached"), ...heldBy("dh2"), ...heldBy("dh1", false), ...heldBy(BILBO, false)] },
  { line: "131048:A:2", name: "the attached character cannot ready, attack, defend, commit to quests or trigger effects", layout: { attached: [{ code: "131048", to: "dh1" }] }, act: [], expect: heldBy("dh1") },
  // 131049 A Foul Sack: the most attachments.
  { line: "131049:A:1", name: "When Sacked: it attaches to the character with the most attachments, no choice being left", layout: { ...DRAWN("131049"), attached: [{ code: "attachment", to: "dh2" }], play: ["ally"] }, act: SACKED, expect: [zone("131049", "attached"), ...heldBy("dh2"), ...heldBy("dh1", false)] },
  { line: "131049:A:2", name: "the attached character cannot ready, attack, defend, commit to quests or trigger effects", layout: { attached: [{ code: "131049", to: "dh1" }] }, act: [], expect: heldBy("dh1") },
  // 131050 A Worn Sack: the hero with the most resources.
  { line: "131050:A:1", name: "When Sacked: it attaches to the hero with the most resources, Bilbo's Baggins resources counting", layout: { ...DRAWN("131050"), heroResources: 1, sagaHero: { resources: 3 }, play: ["ally"] }, act: SACKED, expect: [zone("131050", "attached"), ...heldBy(BILBO), ...heldBy("dh1", false), ...heldBy("ally", false)] },
  { line: "131050:A:1", name: "a hero already holding a Sack is passed over for the next one with the most resources", layout: { ...DRAWN("131050"), heroResources: 1, sagaHero: { resources: 3 }, attached: [{ code: "131045", to: "131001" }] }, act: [SACKED, answer("dh1")], expect: [zone("131050", "attached"), ...heldBy("dh1")] },
  { line: "131050:A:2", name: "the attached character cannot ready, attack, defend, commit to quests or trigger effects", layout: { attached: [{ code: "131050", to: "dh1" }] }, act: [], expect: heldBy("dh1") },
];

cardSpecs(ID, ROWS);

// 131044:A:2 to 131050:A:2 "If this Sack card is removed, shuffle it into the sack deck." (hob.sack-x: "If a Sack card leaves play for any reason, shuffle it back into the sack deck."): the rule is the engine's (a card of the Sack deck's mark that leaves play goes back and the deck is
// shuffled), so one test serves the seven lines; the records of the lines are the flags the rows above hold.
describe("131044:A:2 131045:A:2 131046:A:2 131047:A:2 131048:A:2 131049:A:2 131050:A:2 a Sack card that is removed is shuffled into the Sack deck (hob.sack-x)", () => {
  for (const code of ["131044", "131045", "131046", "131047", "131048", "131049", "131050"]) {
    it(`${code}:A:2 goes back into the Sack deck when it is discarded from its host`, () => {
      // Drawn by Bert's Sack 1, so it carries the Sack deck's mark as in a real game (a card the layout attaches does not).
      const drawn = play(ID, { line: `${code}:A:1`, layout: { engaged: ["131033"], piles: { sackDeck: [code] }, play: ["ally"] }, act: code === "131044" ? SACKED : [SACKED, answer("dh1")], expect: [] }, EFFECTS, false).run.state;
      const sack = idOf(drawn, code);
      const host = code === "131044" ? "ally" : "dh1";
      expect(drawn.cards[idOf(drawn, host)]?.attachments).toContain(sack);
      const removed = moveCard(drawn, sack, { zone: "encounterDiscard" });
      expect(removed.cards[sack]?.zone).toBe("sackDeck");
      expect(removed.cards[idOf(removed, host)]?.attachments).not.toContain(sack);
    });
  }
});

// 131044:A:1 "If there are no eligible targets, shuffle the Sack card back into the sack deck." (hob.sack-x): with no ally in play A Smelly Sack stays in the Sack deck and no hero holds it.
describe("131044:A:1 with no ally in play the Sack card goes back into the Sack deck (hob.sack-x)", () => {
  it("131044:A:1 leaves the card in the Sack deck, held by nobody", () => {
    const done = play(ID, { line: "131044:A:1", layout: { engaged: ["131033"], piles: { sackDeck: ["131044"] } }, act: SACKED, expect: [] }, EFFECTS, false);
    expect(done.run.state.cards[idOf(done.run.state, "131044")]?.zone).toBe("sackDeck");
    expect(done.run.state.cards[idOf(done.run.state, "dh1")]?.attachments).toEqual([]);
  });
});

// 131033:A:1 "Players cannot play attachment cards on Troll enemies." Forest Snare (01069, "Attach to an enemy engaged with a player") may go on the engaged f0 and not on Bert or William; a card an effect attaches (an objective, an encounter card)
// is not the play of an attachment card (the Key and the Purse attach to a Troll in the claims tests).
lineSpec("131033:A:1", "Forest Snare cannot be played on an engaged Troll enemy but can on another enemy", (effects) => {
  const made = engagedHandTable(ID, "01069", "131033", effects);
  expect(attachTargetCodes(made, "01069")).toEqual(["f0"]);
});

// 131050:A:1 "When Sacked: Attach to hero with the most resources without a Sack attached." The line prints no "(excluding Gandalf)" (the six others do) and no span bars Gandalf from every Sack (hob.sack-x), so a hero titled Gandalf with the most resources takes it.
lineSpec("131050:A:1", "a hero titled Gandalf with the most resources takes A Worn Sack", (effects) => {
  const table = tableFromLayout(ID, { engaged: ["131033"], piles: { sackDeck: ["131050"] } }, { effects, extra: ["142002"] });
  const gandalf = spawn(table.state, "142002", { zone: "heroes", seat: 0 });
  const state = updateCard(gandalf.state, gandalf.id, { resources: 3 });
  const done = resolveRecords(state, table.ctx, "131033", "forced", idOf(state, "131033"));
  expect(done.state.cards[gandalf.id]?.attachments).toContain(idOf(done.state, "131050"));
});
