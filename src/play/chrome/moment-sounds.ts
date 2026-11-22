// Rules: rr.step-3-4 (data/rules/entries.json). The sounds of what an accepted intent did that no motion carries (docs/design-system-table.md, Sound): a deck or set shuffled in (`card.shuffle`), as the intent is accepted; and
// the result a banner reports, the quest's resolution, a test's outcome or a player's elimination (`ui.notice`), which plays when that banner shows (`reportsResult`, table-hooks.ts). Pure: it reads the steps the engine ran, so a test reads it.
import type { EngineStep } from "../../rules/core/intents.ts";
import type { SoundSlot } from "../../ui/sound/slots.ts";

/** The sounds of one accepted intent, as it is accepted: one of each slot, in the order the steps ran. */
export function momentSounds(steps: readonly EngineStep[]): SoundSlot[] {
  const heard: SoundSlot[] = [];
  for (const step of steps) {
    if ((step.kind === "shuffleSet" || step.kind === "resetEncounterDeck" || step.kind === "reshuffleDeck") && !heard.includes("card.shuffle")) heard.push("card.shuffle");
  }
  return heard;
}

/** Whether an intent's steps hold a result its banner reports (the quest, a test, an elimination): the banner plays the notice as it shows. */
export function reportsResult(steps: readonly EngineStep[]): boolean {
  return steps.some((step) => step.kind === "quest" || step.kind === "fortitudeTest" || step.kind === "escapeTest" || step.kind === "locateTest" || step.kind === "hideTest" || step.kind === "eliminate");
}
