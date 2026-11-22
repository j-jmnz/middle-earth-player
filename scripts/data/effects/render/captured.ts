// The captured family's pieces (src/catalog/families/captured.ts, Escape from Mount Gram; engine: src/rules/families/captured): templates, the three conditions, and the samples read-fields checks them with.
import { amt, type ConditionTemplates, type Samples, type Templates } from "./family-kit.ts";
import { str } from "./kit.ts";

const END = { top: "top", bottom: "bottom" } as const;

export const CAPTURED_TEMPLATES: Templates = {
  Capture: (i, ctx) => ({ text: `Capture ${amt(i.amount, ctx)} (a marker, the verb does nothing when run): when this card enters play (revealed, added to the staging area, put into play engaged, or a quest card that becomes a stage), before its When Revealed resolves, each player sharing its staging area captures the top ${amt(i.amount, ctx)} cards of their captured deck underneath it (fewer when the deck is shorter)`, read: ["amount"] }),
  CaptureFromDeck: (i, ctx) => ({
    text: `${i.who === "eachSeat" ? "each living player, the first player first," : "the acting player"} captures ${amt(i.amount, ctx)} cards from the ${END[i.end as keyof typeof END] ?? str(i.end)} of their captured deck underneath ${i.under === "self" ? "this card" : `the card in play with code ${str((i.under as { code?: unknown }).code)}`} (the cards that are left when the deck is shorter)`,
    read: ["amount", "end", "under", "who"],
  }),
  CaptureInsteadOfDamage: () => ({ text: "an ally the attack would damage is captured underneath the attacking enemy instead, with no damage dealt (on the enemy this is a marker the damage step reads; as a Shadow effect it makes the attack in progress do it)", read: [] }),
  PutCapturedIntoPlay: () => ({ text: "the last card picked is put into play at no cost under its owner: an ally or a hero, or an attachment attached to a hero its owner controls (the owner chooses which when several can have it); any other card stays where it is", read: [] }),
  PrepareCapturedDeck: () => ({ text: "Setup, for each player after the starting hero is chosen: their captured deck is every ally, Item, Mount and Artifact attachment of their deck and every hero but the starting hero, shuffled, with one of those heroes (chosen with the game's seed) put on top; the starting hero gets 2 resources and the player's threat is set to its threat cost; a hero's permanent boons wait for the campaign card's Setup", read: [] }),
  EngageSelfWithPicked: () => ({ text: "this enemy engages the player the last pick chose, leaving any other engagement, and keeps it with no engagement check", read: [] }),
  CaptureAttachments: () => ({ text: "each attachment attached to the defending character is captured underneath the attacking enemy (an encounter attachment too, rescued to the encounter discard pile)", read: [] }),
  CapturePicked: () => ({ text: "the card picked before the last pick, an ally the acting player controls, is captured from play underneath the card the last pick chose (nothing when the earlier pick found no ally)", read: [] }),
  DiscardCapturedTop: (i) => ({ text: `each player sharing the staging area, in turn, discards the top card of their captured deck to their discard pile${i.raiseByCost === true ? " and raises their threat by its printed resource cost (a hero counts 0)" : ""}; a player with no card to discard discards none`, read: ["raiseByCost"] }),
  DiscardCapturedUnder: (i) => ({ text: `this card discards each card captured underneath it, each to its owner's discard pile (a hero there is dead)${typeof i.threat === "number" ? `, and each player raises their threat by ${i.threat} for each of their own characters (heroes and allies) so discarded` : ""}`, read: ["threat"] }),
  SetAsideCapturedBoons: () => ({ text: "Campaign Setup: the permanent boons attached to heroes in a captured deck are set aside, still the hero's; they are attached again when the hero is put into play", read: [] }),
  AttachHeroBoons: () => ({ text: "campaign mode: each permanent boon set aside for the hero that just entered play is attached to it, in the order they were set aside", read: [] }),
  RecordStolenCards: () => ({ text: "Resolution, for each player: the unique cards still in their captured deck are recorded as stolen in the Campaign Log, and the campaign refuses them in that player's deck for the rest of the campaign (a recorded hero is not refused)", read: [] }),
  InEveryArea: () => ({ text: "(marker) this card is considered to be in each player's staging area: while the stages are separate it is in every seat's area, one card with one set of tokens and one pile of captured cards", read: [] }),
  ChooseBoonToHand: (i) => ({ text: `in order from the first player, each player may choose one of the boons with codes ${(Array.isArray(i.codes) ? i.codes : []).map(str).join(", ")} that are still set aside and add it to their hand, and it joins the Campaign Pool (a boon taken is not offered again)`, read: ["codes", "seat"] }),
};

export const CAPTURED_CONDITIONS: ConditionTemplates = {
  captured: (c) => ({
    text: c.is === "noneUnderSelf" ? "no card is captured underneath this card" : c.is === "noneUnderAttacker" ? "no card is captured underneath the attacking enemy" : "the Interrogation that resolved found a captured deck with no card to discard (at least 1 player discarded none)",
    read: ["is"],
  }),
};

export const CAPTURED_SAMPLES: Samples = {
  Capture: [{ verb: "Capture", amount: 7 }],
  CaptureFromDeck: [{ verb: "CaptureFromDeck", amount: 2, end: "top", under: "self" }, { verb: "CaptureFromDeck", amount: 5, end: "bottom", under: { code: "10175" }, who: "eachSeat" }],
  CaptureInsteadOfDamage: [{ verb: "CaptureInsteadOfDamage" }],
  PutCapturedIntoPlay: [{ verb: "PutCapturedIntoPlay" }],
  PrepareCapturedDeck: [{ verb: "PrepareCapturedDeck" }],
  EngageSelfWithPicked: [{ verb: "EngageSelfWithPicked" }],
  CaptureAttachments: [{ verb: "CaptureAttachments" }],
  CapturePicked: [{ verb: "CapturePicked" }],
  DiscardCapturedTop: [{ verb: "DiscardCapturedTop", raiseByCost: true }],
  DiscardCapturedUnder: [{ verb: "DiscardCapturedUnder", threat: 3 }],
  SetAsideCapturedBoons: [{ verb: "SetAsideCapturedBoons" }],
  AttachHeroBoons: [{ verb: "AttachHeroBoons" }],
  RecordStolenCards: [{ verb: "RecordStolenCards" }],
  InEveryArea: [{ verb: "InEveryArea" }],
  ChooseBoonToHand: [{ verb: "ChooseBoonToHand", codes: ["10176", "10177"] }],
};

export const CAPTURED_CONDITION_SAMPLES: Samples = {
  captured: [{ kind: "captured", is: "noneUnderSelf" }, { kind: "captured", is: "noneUnderAttacker" }, { kind: "captured", is: "someoneEmpty" }],
};
