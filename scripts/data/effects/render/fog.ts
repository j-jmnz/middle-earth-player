// The pieces Fog on the Barrow-downs adds (the breaking family's SplitToOwnStage, ReturnToSharedStage and CancelRevealed, the condition allAtStage and the words of the stat flags the scenario adds): templates, flag words and the samples read-fields.test.ts checks them with.
import { str, type Ctx, type Obj } from "./kit.ts";

type Made = { text: string; read: readonly string[] };

export const FOG_TEMPLATES: Readonly<Record<string, (i: Obj) => Made>> = {
  SplitToOwnStage: (i) => ({
    text: `the acting player leaves the stage the players share for a stage and a staging area of his own: the quest deck's card with code ${str(i.code)} becomes his stage, side B up, and its When Revealed effects resolve for him; the others keep the shared stage and its staging area, this card with them; from then on each area resolves as if only its players were in the game, and a stage no player is at stays in play (nothing when the player is not at the shared stage or no copy is left)`,
    read: ["code"],
  }),
  ReturnToSharedStage: (i) => ({
    text: `the acting player's own stage goes back to the quest deck with no progress and he is at the stage with code ${str(i.code)} again: the enemies, locations and active location of his area join its staging area (engaged enemies stay engaged), and he joins the players there or takes the stage when none is; once every player shares one area the areas are the shared one again (nothing when he is not at another stage)`,
    read: ["code"],
  }),
  AdvanceToStage: (i) => ({
    text: `the acting player's stage leaves the quest (its attachments are released and it is set aside) and the quest deck's card with code ${str(i.code)} becomes the stage, side B up with no progress, its When Revealed effects resolving${i.again === true ? "; when the deck has no such card, a copy the quest left earlier and set aside comes back, with no tokens on it" : ""} (nothing when no such card is there)`,
    read: ["code", "again"],
  }),
  CancelRevealed: () => ({ text: "the effects of the location the event is about, just revealed, are canceled and it goes to the encounter discard pile instead of staying in the staging area; the reveal is over (no other card is revealed in its place)", read: [] }),
};

// The plain words a stat flag of the scenario adds after its name.
export const FOG_STAT_NOTES: Readonly<Record<string, string>> = {
  staysInPlay: " (the stage stays in play, with its staging area, when the player at it is eliminated: it is not discarded with his area)",
  noCardDraw: " (the player cannot draw cards from card effects; the opening hand and the resource phase's draw are not)",
  noCardResources: " (the hero cannot gain resources from card effects; the resources it collects in the resource phase are not one)",
};

export const FOG_CONDITIONS: Readonly<Record<string, (c: Obj, ctx: Ctx) => Made>> = {
  allAtStage: (c) => ({ text: c.is === true ? "every player in the game is at this stage, sharing its staging area" : "some player in the game is not at this stage (or no player is)", read: ["is"] }),
};

export const FOG_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  SplitToOwnStage: [{ verb: "SplitToOwnStage", code: "148004" }],
  ReturnToSharedStage: [{ verb: "ReturnToSharedStage", code: "148003" }],
  CancelRevealed: [{ verb: "CancelRevealed" }],
  AdvanceToStage: [{ verb: "AdvanceToStage", code: "142067" }, { verb: "AdvanceToStage", code: "50903", again: true }],
};

export const FOG_CONDITION_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  allAtStage: [{ kind: "allAtStage", is: true }, { kind: "allAtStage", is: false }],
};
