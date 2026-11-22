// The nightmare, prisoner and dungeon families' pieces (src/catalog/families/nightmare.ts, prisoner.ts, dungeon.ts): immediate attacks, set-aside engagements, prisoners and Orc Guards: templates and samples.
import { type Samples, type Templates } from "./family-kit.ts";
import { cardRef } from "./amounts.ts";
import { str } from "./kit.ts";

export const NIGHTMARE_TEMPLATES: Templates = {
  AttackActor: () => ({ text: "this enemy attacks the acting player now, as an attack outside the combat phase: from the staging area though it is not engaged, or while it is engaged with them; it is dealt a shadow card of its own (nothing when it is engaged with another player or out of play)", read: [] }),
  EngageSetAside: (i) => ({ text: `one set-aside copy of the card with code ${str(i.code)} is put into play engaged with the acting player (nothing with no copy set aside)`, read: ["code"] }),
  NotCanceledBy: (i) => ({ text: `(marker, does nothing when run) a Response on a card with the trait ${str(i.trait)} cannot cancel this card's effects`, read: ["trait"] }),
  AttachToDamagedDefender: () => ({ text: "(a shadow effect) once the attack in progress ends, this shadow card is attached faceup to the defending character if the attack dealt it damage (an undefended attack has no defending character)", read: ["card", "to", "dealt"] }),
  TakeMorePrisoners: () => ({ text: "heard when a hero was taken prisoner at stage 1B: more heroes are captured at random with the game's seed, from players who have none captured, until the number captured is 1 with 1 or 2 players, 2 with 3 and 3 with 4; each is facedown, \"the prisoner\", as the first (nothing is announced for them)", read: [] }),
  TakeHeroPrisoner: (i) => ({ text: `when the attack ends: ${cardRef(i.card)}, the hero the reference names, if it is still in play, is turned facedown as a "prisoner" when this attack dealt it damage${i.dealt === true ? " (the attack keeps the damage it dealt for this)" : ""}; it keeps its damage`, read: ["card", "dealt"] }),
  EngageOutOfPlay: (i) => ({ text: `the card with code ${str(i.code)} is put into play engaged with the first player from wherever it is out of play: set aside, the encounter deck, its discard pile or the victory display (nothing when it is in play)`, read: ["code"] }),
  PickMostHitPoints: () => ({ text: "the enemy with the most printed hit points in the victory display and the encounter discard pile becomes the picked card (the first player chooses among a tie; nothing is picked with no enemy there)", read: [] }),
  AttackOthersUndefended: () => ({ text: "(a shadow effect, left for the end of the attack) the attack also resolves against each other player, undefended: each of them chooses a hero they control, which takes the enemy's Attack as damage", read: [] }),
  RemoveEnemyDamage: () => ({ text: "all damage is removed from every enemy in play; each player raises their threat by the damage removed from the enemies engaged with them; the effect's X becomes the damage removed", read: [] }),
  PickLowestEngagement: () => ({ text: "the enemy in the staging area with the lowest engagement cost becomes the picked card (the first player chooses among a tie; nothing is picked when there is none)", read: [] }),
  PlaceOrcGuard: () => ({ text: "the acting player places the top card of their deck facedown in front of them as if it just engaged them: it is an \"Orc Guard\", an enemy with 1 hit point, 1 Attack and 1 Defense engaged with them, held under an enemy the engine makes as a stand-in (when it leaves play the card goes to its owner's discard pile; nothing with an empty deck)", read: [] }),
  LimitPlays: (i) => ({ text: `the players, as a group, cannot play more than ${str(i.max)} ${str(i.cardType)} cards each round (cards put into play without being played are not counted)`, read: ["cardType", "max"] }),
  AttachToDeck: (i) => ({ text: `this treachery, being revealed, is attached to the top of ${i.who === "firstPlayer" ? "the first player's" : "a player's"} deck, in play, controlled by nobody; the next draw from that deck is replaced by discarding it (the card's own constant says so)`, read: ["who"] }),
  TurnFaceUp: (i) => ({ text: `Setup: the set-aside card with code ${str(i.code)} is turned faceup, still out of play`, read: ["code"] }),
  TakePrisoner: () => ({ text: "one hero of all the heroes the players control is selected at random with the game's seed and turned facedown: it and each card attached to it become the \"prisoner\": facedown, blank, in play but controlled by nobody, so nothing can use or damage them, and the hero collects no resources (prisonerTaken is announced about the hero)", read: [] }),
  RescuePrisoner: (i) => ({ text: `the prisoner hero is flipped faceup with ${str(i.damage)} damage placed on it; its controller controls it again, with the cards attached to it faceup; it has been rescued (prisonerRescued is announced) and no hero is the prisoner any more`, read: ["damage"] }),
  SelectLoggedPrisoner: () => ({ text: "the prisoner named in the Campaign Log is selected instead: when the log names a hero the players control, that hero is the prisoner and the one selected at random is back among its player's heroes as it was (nothing with no such hero, so the random one stays)", read: [] }),
  CaptureWithPrisoner: (i) => ({ text: `the card in play with code ${str(i.code)} is captured as well: placed facedown next to the prisoner, in play but controlled by nobody, and it does not leave play (nothing with no prisoner or no such card)`, read: ["code"] }),
  FreeCaptive: (i) => ({ text: `the captured card in play with code ${str(i.code)} is flipped faceup with ${str(i.damage)} damage placed on it and returns to the first player's play area`, read: ["code", "damage"] }),
};

export const NIGHTMARE_SAMPLES: Samples = {
  AttackActor: [{ verb: "AttackActor" }],
  EngageSetAside: [{ verb: "EngageSetAside", code: "12158" }],
  NotCanceledBy: [{ verb: "NotCanceledBy", trait: "Ring-bearer" }],
  AttachToDamagedDefender: [{ verb: "AttachToDamagedDefender" }],
  TakeMorePrisoners: [{ verb: "TakeMorePrisoners" }],
  TakeHeroPrisoner: [{ verb: "TakeHeroPrisoner", card: "other", dealt: true }],
  EngageOutOfPlay: [{ verb: "EngageOutOfPlay", code: "01102" }],
  PickMostHitPoints: [{ verb: "PickMostHitPoints" }],
  AttackOthersUndefended: [{ verb: "AttackOthersUndefended" }],
  RemoveEnemyDamage: [{ verb: "RemoveEnemyDamage" }],
  PickLowestEngagement: [{ verb: "PickLowestEngagement" }],
  PlaceOrcGuard: [{ verb: "PlaceOrcGuard" }],
  LimitPlays: [{ verb: "LimitPlays", cardType: "ally", max: 1 }],
  AttachToDeck: [{ verb: "AttachToDeck", who: "firstPlayer" }],
  TurnFaceUp: [{ verb: "TurnFaceUp", code: "01102" }],
  TakePrisoner: [{ verb: "TakePrisoner" }],
  RescuePrisoner: [{ verb: "RescuePrisoner", damage: 1 }],
  SelectLoggedPrisoner: [{ verb: "SelectLoggedPrisoner" }],
  CaptureWithPrisoner: [{ verb: "CaptureWithPrisoner", code: "01135" }],
  FreeCaptive: [{ verb: "FreeCaptive", code: "01135", damage: 1 }],
};
