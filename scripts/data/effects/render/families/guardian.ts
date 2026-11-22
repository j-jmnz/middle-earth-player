// The guardian family's pieces (src/catalog/families/guardian.ts, Return to Mirkwood) and the small verbs and conditions the Nightmare deck needs beside it: templates for them, and the samples read-fields.test.ts checks them with.
import { str, type Ctx, type Obj } from "../kit.ts";

type Made = { text: string; read: readonly string[] };

const WHO: Readonly<Record<string, string>> = { actor: "the acting player", firstPlayer: "the first player", guardian: "the player guarding Gollum" };

export const GUARDIAN_TEMPLATES: Readonly<Record<string, (i: Obj, ctx: Ctx) => Made>> = {
  GuardGollum: (i) => ({ text: `the card with code ${str(i.code)}, in the encounter deck or set aside, enters play in front of the player last picked (the first player when none is), ready: that player guards Gollum`, read: ["code"] }),
  ChangeGuardian: () => ({ text: "the player last picked becomes the player guarding Gollum: Gollum, with what is attached to him, goes to that player (nothing when a card says the guard cannot change, or that player already guards him)", read: [] }),
  RemoveDiscardFromGame: () => ({ text: "every card in the acting player's discard pile is removed from the game", read: [] }),
  DealShadowFromDiscard: (i) => ({ text: `the topmost ${typeof i.trait === "string" ? `${i.trait} ` : ""}card with a Shadow effect in the encounter discard pile is dealt to the attacking enemy as one more shadow card for this attack (nothing with none there)`, read: ["trait"] }),
  EngageAll: (i) => ({ text: `${WHO[str(i.who)] ?? str(i.who)} engages ${i.inPlay === true ? "every enemy in play, the ones in the staging area and the ones engaged with another player" : "every enemy in the staging area"}${typeof i.trait === "string" ? ` with the trait ${i.trait}` : ""}`, read: ["who", "inPlay", "trait"] }),
};

/** The restrictions that bind the player guarding Gollum (02127:B:1, 02128:B:1), or null for any other Restrict. */
export function guardianRestrict(i: Obj): Made | null {
  if (i.what === "commit" && i.guardian === true) return { text: `the player guarding Gollum cannot commit characters to the quest${i.exceptAlone === true ? ", unless he is the only player remaining in the game" : ""}`, read: ["what", "guardian", "exceptAlone"] };
  if (i.what === "playFromHand") return { text: `${i.guardian === true ? "the player guarding Gollum" : "a player"} cannot play cards from his hand (a card put into play is not played)`, read: ["what", "guardian"] };
  return null;
}

export const GUARDIAN_CONDITIONS: Readonly<Record<string, (c: Obj, ctx: Ctx) => Made>> = {
  guardianCanChange: () => ({ text: "the player guarding Gollum may choose a new player: no card says he cannot change and another player is still in the game", read: [] }),
  encounterHas: (c) => ({ text: `the encounter discard pile${c.piles === "deckAndDiscard" ? " or deck" : ""} holds a ${typeof c.trait === "string" ? `${c.trait} ` : ""}${typeof c.cardType === "string" ? c.cardType : "card"}${c.aflame === true ? " with the Aflame keyword" : ""}${typeof c.code === "string" ? ` with code ${c.code}` : ""}`, read: ["piles", "cardType", "aflame", "trait", "code"] }),
  noneDiscarded: () => ({ text: "the running effect has discarded no card (with DiscardEach)", read: [] }),
};

export const GUARDIAN_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  GuardGollum: [{ verb: "GuardGollum", code: "02130" }],
  ChangeGuardian: [{ verb: "ChangeGuardian" }],
  RemoveDiscardFromGame: [{ verb: "RemoveDiscardFromGame" }],
  DealShadowFromDiscard: [{ verb: "DealShadowFromDiscard", trait: "Tantrum" }],
  EngageAll: [{ verb: "EngageAll", who: "guardian", inPlay: true, trait: "Spider" }],
};

export const GUARDIAN_CONDITION_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  guardianCanChange: [{ kind: "guardianCanChange" }],
  encounterHas: [{ kind: "encounterHas", piles: "deckAndDiscard", cardType: "treachery", aflame: true, trait: "Tantrum", code: "51031" }],
  noneDiscarded: [{ kind: "noneDiscarded" }],
};

