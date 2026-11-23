// Rules: rr.forced, rr.running-out-of-cards, rr.step-3-3, rr.quest-advancement, faq.last-encounter-card, rr.shadow-effects (data/rules/entries.json); docs/scenarios/the-hobbit.md (We Must Away, Ere Break of Day, Stage 2B).
import { expect } from "vitest";

import { cardSpecs, count, deckCount, endPhase, quest, zone, type Row } from "../../../../test/harness/card-spec.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { idOf, legalIntents, send, start as begin, tableFromLayout } from "../../../../test/harness/scene-kit.ts";
import type { PlayerIntent } from "../../../rules/core/intents.ts";

// 131024:B:1 "Forced: If there are no Troll enemies left in play, or if there are no cards left in the encounter deck, advance it to the next stage." The recorded reading (docs/scenarios/the-hobbit.md): an empty encounter deck advances the stage as soon as the deck has
// no card, before any reset of it (rr.running-out-of-cards resets an empty deck in the quest phase; here the Forced effect comes first, and the discard pile stays where it is). The Troll half is in spec.test.ts. William is the Troll that stays in play in the rows
// that need the other half false.
const B = { stage: "131024", side: "B" } as const;
const ADVANCED = [zone("131025", "questStage"), count("f3", "encounterDiscard", 1)];

const ROWS: readonly Row[] = [
  { line: "131024:B:1", name: "the stage advances when its own progress discards the last cards of the encounter deck, and the discard pile is not reset first", layout: { ...B, active: "131039", deck: ["f0", "f0", "f0"], discard: ["f3"], engaged: ["131032"], phase: "Quest" }, act: quest("success"), expect: [...ADVANCED, deckCount(0)] },
  { line: "131024:B:1", name: "the stage advances when the staging step reveals the last card, once that card is resolved and before the deck is reset", layout: { ...B, deck: ["f0"], discard: ["f3"], engaged: ["131032"], phase: "Quest" }, act: endPhase, expect: [...ADVANCED, deckCount(0)] },
];

cardSpecs("we-must-away-ere-break-of-day", ROWS);

// The deck is emptied in the combat phase by the shadow card dealt to an attacking enemy: the stage advances at once, before the defense window of the attack that dealt it (the Forced effect does not wait for the end of the phase).
lineSpec("131024:B:1", "the stage advances at once when a shadow card dealt in combat empties the deck", (effects) => {
  const table = tableFromLayout("we-must-away-ere-break-of-day", { ...B, phase: "Encounter", engaged: [{ code: "f3", seat: 0 }], deck: ["f0"], discard: ["f3"] }, { effects });
  let run = send(begin(table.state), { type: "DeclineEngage" }, table.ctx);
  for (let guard = 0; guard < 40 && run.state.window?.kind !== "defense" && run.state.cards[idOf(run.state, "131025")]?.zone !== "questStage"; guard += 1) {
    const next = legalIntents(run.state, table.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
    if (!next) break;
    run = send(run, next as PlayerIntent, table.ctx);
  }
  expect(run.state.cards[idOf(run.state, "131025")]?.zone).toBe("questStage");
  expect(run.state.encounterDeck).toHaveLength(0);
  expect(run.state.encounterDiscard.map((id) => run.state.cards[id]?.code)).toContain("f3");
});
