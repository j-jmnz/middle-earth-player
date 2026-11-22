// The south, pelennor and black-gate families' pieces (src/catalog/families/south.ts, pelennor.ts, black-gate.ts): the Ring-bearer's capture, Minas Tirith's damage, shadow cards that engage or attach, and the Embassy: templates and samples.
import { amt, type Samples, type Templates } from "../family-kit.ts";
import { str } from "../kit.ts";

export const SOUTH_TEMPLATES: Templates = {
  AttachToActiveLocation: () => ({ text: "this treachery attaches to the active location, chosen by the first player among them; it stays in the staging area's discard when the location already holds a copy (Limit 1 per location) or none is active; the effect's X is 1 when it attached, else 0", read: [] }),
  CaptureRingBearer: (i) => ({
    text: i.guarded === true
      ? `the Ring-bearer (the hero with that trait a player controls) lies faceup under the card in play with code ${str(i.under)} as a guarded objective, keeping its tokens and its attachments faceup; nobody controls it, it takes no damage while so held and its owner is not out of heroes; FreeRingBearer gives it back`
      : `the Ring-bearer (the hero with that trait a player controls) loses every token (damage, resources, progress), and it and each card attached to it are placed facedown under the card in play with code ${str(i.under)}; they stay in play and nobody controls them`,
    read: ["under", "guarded"],
  }),
  AssignFaceup: (i) => ({ text: `Setup: each player in player order places the top card of their deck faceup until ${str(i.cards)} are faceup between them; the first player then assigns them to the outcomes in order (${(Array.isArray(i.outcomes) ? i.outcomes : []).map(str).join(", ")}), one distinct card to each: play is played for no cost by its owner, hand goes to its owner's hand, discard to its owner's discard pile, shuffle is shuffled into its owner's deck`, read: ["cards", "outcomes"] }),
  ReleaseRingBearer: (i) => ({ text: `the first player takes control of the Ring-bearer facedown under this card and of the cards attached to it: it returns to play faceup in their play area exhausted with ${str(i.damage)} damage on it`, read: ["damage"] }),
  DamageActiveLocation: () => ({ text: "(a shadow effect) the undefended damage of the attack in progress is placed on an active location instead of a hero, the defending player choosing the location (the damage goes to the hero as usual when no location is active)", read: [] }),
  PickHighestEngagement: (i) => ({ text: `choose, among the enemies in the staging area with the trait ${str(i.trait)}, the one with the highest engagement cost (ties: the first player chooses), or pick nothing when there is none`, read: ["trait"] }),
  DamageMinasTirith: (i, ctx) => ({ text: `deal ${amt(i.amount, ctx)} damage to the objective Minas Tirith, through the City Wall (damageFirst), while it is in play (nothing with it out of play)`, read: ["amount"] }),
  EngageShadowCard: () => ({ text: "the shadow card this is, an enemy, leaves its attacker and engages the player the attack is against; it enters play there", read: [] }),
  AttachShadowToHero: (i) => ({ text: `when the attack ends: the attacking enemy's shadow card with code ${str(i.code)} attaches faceup to the hero the attack damaged (its defender, or the hero an undefended attack landed on), unless that hero carries one already (Limit 1 per hero); a damaged ally or no damage attaches nothing`, read: ["code"] }),
  DiscardAllyToStaging: () => ({ text: "the acting player discards cards from the top of their deck until they discard an ally that is not in play (an ally whose title a unique ally in play holds is skipped as one in play), and puts it into play in the staging area, its text box treated as blank until the end of the phase; it stays its owner's, under nobody's control (nothing is staged with no ally in the deck); a destroyed one goes to its owner's discard pile", read: [] }),
  TakeControlOfStagedAllies: () => ({ text: "the acting player takes control of each ally they own in the staging area and exhausts it: the allies come into their owner's play area", read: [] }),
  PlaceProgressActiveFirst: (i, ctx) => ({ text: `place ${amt(i.amount, ctx)} progress on the active location, up to its quest points, and what it cannot take on the current quest stage, whatever bars the stage's progress from questing or player cards (the assault flag); the stage advances when it is full`, read: ["amount"] }),
  EmbassyDeal: (i) => ({ text: `in player order, each player places the top card of their deck faceup in front of them until there are ${str(i.cards)} faceup player cards between the players (a player with an empty deck passes), and the top ${str(i.cards)} cards of the encounter deck are placed faceup; both rows lie set aside, faceup, out of the decks, and are remembered as the Embassy until EmbassyEnd`, read: ["cards"] }),
  EmbassyPair: () => ({ text: "the last two cards picked (a player card of the row, then an encounter card of it) make one pair, in the order they were paired (with either pick empty no pair is made)", read: [] }),
  EmbassyNext: () => ({ text: "the next pair, in the order they were paired, becomes the pair the running effect is on: its player card and its encounter card are picked (nothing is picked once the pairs are done)", read: [] }),
  EmbassyDiscard: () => ({ text: "the player card of the current pair goes to its owner's discard pile and its encounter card to the encounter discard pile", read: [] }),
  EmbassyReveal: () => ({ text: "the first player reveals the current pair's encounter card as a card revealed in the staging step (Peril, Surge and Doomed apply; \"you\" is the first player); the player card is played after it", read: [] }),
  EmbassyEnd: () => ({ text: "the Embassy is over: an encounter card of the row that was never paired goes back on top of the encounter deck in the order it was placed (a game with too few player cards), and the Embassy is forgotten", read: [] }),
};

export const SOUTH_SAMPLES: Samples = {
  AttachToActiveLocation: [{ verb: "AttachToActiveLocation" }],
  CaptureRingBearer: [{ verb: "CaptureRingBearer", under: "142024" }, { verb: "CaptureRingBearer", under: "146015", guarded: true }],
  AssignFaceup: [{ verb: "AssignFaceup", cards: 4, outcomes: ["play", "hand", "discard", "shuffle"] }],
  ReleaseRingBearer: [{ verb: "ReleaseRingBearer", damage: 1 }],
  DamageActiveLocation: [{ verb: "DamageActiveLocation" }],
  PickHighestEngagement: [{ verb: "PickHighestEngagement", trait: "Warg" }],
  DamageMinasTirith: [{ verb: "DamageMinasTirith", amount: 2 }],
  EngageShadowCard: [{ verb: "EngageShadowCard" }],
  AttachShadowToHero: [{ verb: "AttachShadowToHero", code: "145058" }],
  DiscardAllyToStaging: [{ verb: "DiscardAllyToStaging" }],
  TakeControlOfStagedAllies: [{ verb: "TakeControlOfStagedAllies" }],
  PlaceProgressActiveFirst: [{ verb: "PlaceProgressActiveFirst", amount: 2 }],
  EmbassyDeal: [{ verb: "EmbassyDeal", cards: 4 }],
  EmbassyPair: [{ verb: "EmbassyPair" }],
  EmbassyNext: [{ verb: "EmbassyNext" }],
  EmbassyDiscard: [{ verb: "EmbassyDiscard" }],
  EmbassyReveal: [{ verb: "EmbassyReveal" }],
  EmbassyEnd: [{ verb: "EmbassyEnd" }],
};
