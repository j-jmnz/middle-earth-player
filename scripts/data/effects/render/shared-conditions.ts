// Condition kinds several scenarios share: the Heading card, the quest deck, out-of-play copies, resource pools and an explored card whose Forced effect is still pending. Each reads where the engine holds it (src/rules/interpret/conditions.ts and the family it names).
import { str, type Obj } from "./kit.ts";

type Made = { text: string; read: readonly string[] };

const HEADING: Readonly<Record<string, string>> = {
  onCourse: "the Heading card shows Sun (on-course)",
  offCourse: "the Heading card shows Cloud, Rain or Storm (off-course)",
  worst: "the Heading card shows Storm (the worst setting)",
};

export const SHARED_CONDITIONS: Readonly<Record<string, (c: Obj) => Made>> = {
  heading: (c) => ({ text: `${HEADING[str(c.is)] ?? str(c.is)} (false while the game has no Heading card)`, read: ["is"] }),
  questDeck: (c) => ({ text: `the quest deck holds ${typeof c.min === "number" ? `at least ${c.min} stages` : "at least 1 stage"}`, read: ["min"] }),
  outOfPlay: (c) => ({ text: `a copy of the card with code ${str(c.code)} is out of play where an effect can take it from: set aside, in the encounter discard pile, in the victory display or under a card (not one removed from the game)`, read: ["code"] }),
  resources: (c) => ({
    text: `${c.group === true ? "the living players' heroes" : "the actor's heroes"} that can pay for ${typeof c.sphere === "string" ? `a ${c.sphere} card (with that icon or one they were given)` : "a card of any sphere"} hold at least ${str(c.min)} resource(s) in all`,
    read: ["min", "sphere", "group"],
  }),
  exploredPending: (c) => ({ text: `a copy of the card with code ${str(c.code)} was explored and the Forced effect that hears it has not finished (its explored event waits in the queue, or the record ${str(c.effect)} is running)`, read: ["code", "effect"] }),
};

export const SHARED_CONDITION_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  heading: [{ kind: "heading", is: "onCourse" }, { kind: "heading", is: "offCourse" }, { kind: "heading", is: "worst" }],
  questDeck: [{ kind: "questDeck" }, { kind: "questDeck", min: 2 }],
  outOfPlay: [{ kind: "outOfPlay", code: "141069" }],
  resources: [{ kind: "resources", min: 2 }, { kind: "resources", min: 1, sphere: "fellowship", group: true }],
  exploredPending: [{ kind: "exploredPending", code: "51310", effect: "51301:forced:1" }],
};
