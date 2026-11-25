import type { Cause } from "../core/cause.ts";
import type { Condition, Instruction, ModifierStat, ModifierUntil, Trigger } from "../../catalog/boundary.ts";

import type { AttackDefense } from "../families/defense/types.ts";
import type { Sphere } from "../core/printed.ts";
import type { Window } from "../core/state.ts";

// Plain data only, never a closure, so structuredClone and the undo replay keep working.

// `instanceId` names the holder: a card instance id, "table" (every seat), or "seat:<n>".
export type Modifier = {
  instanceId: string;
  sourceId: string;
  stat: ModifierStat;
  amount: number;
  until: ModifierUntil;
  // A constant effect put this modifier here. The engine rebuilds these from the effect list.
  origin?: string;
  // The amount counts once for each of these when the stat is read.
  per?: "committed" | "ally";
  // The modifier only applies to this seat (an enemy that cannot attack one player).
  seat?: number;
  // A condition read each time the stat is read (see isStatCondition).
  when?: Condition;
  // The modifier holds only while its holder attacks this enemy ("+2 Attack while attacking that enemy").
  against?: string;
  // The stat is set to `amount`, overriding every modifier that is not a set (rr.modifiers).
  set?: boolean;
  // A `moreStagingThreat` modifier that counts 1 for each ally in this seat's discard pile each time it is read (RaiseStagingThreat `live`, families/dungeon).
  allyDiscardSeat?: number;
  // A `moreStagingThreat` modifier that counts 1 for each Scout enemy in play each time it is read (RaiseStagingThreat `live: scoutEnemiesInPlay`).
  liveScouts?: true;
  // A `revealDoomed` modifier's amount while this stage is current, read when each card is revealed (RevealedGainDoomed `instead`, families/angmar/weather.ts).
  stageAmount?: { stage: number; amount: number };
  // The Trait a `traitGained` modifier gives its holder ("gain a Trait of your choice", 11195:A:5), or the Trait an `engagedThreatSeat` modifier narrows its enemies to (quest/engaged-threat.ts).
  trait?: string;
};

export type FrameName =
  | "reveal"
  | "hide"
  | "fortitude"
  | "escape"
  | "burgle"
  | "whenRevealed"
  | "forced"
  | "shadow"
  | "response"
  | "setup"
  | "travel"
  | "delayed"
  | "event"
  | "ResolveEffect";

export type HideResult = { success: boolean; willpower: number; threat: number };

// A finished Fortitude test (mec113.fortitude-tests): the committed heroes' total Willpower against the Sauron's Eye icons counted; it passes only when the Willpower is greater.
export type FortitudeResult = { success: boolean; willpower: number; eyes: number };

// A finished escape test (sotm.escape-test): the committed characters' total of the counted stat against the total Escape of the cards dealt; it passes only when the committed total is higher.
export type EscapeResult = { success: boolean; committed: number; escape: number };

// One instruction still to run, with the seat it runs for. `chosen` is the card a player picked for it.
// `offset` is where ArrangeTop has got to in the deck. `origin` is the record's instruction an item was expanded from (one pick of a DiscardFromHand), so the words find the record's entry and say which pick of how many it is (`nth` of `of`).
export type QueueItem = { instruction: Instruction; seat: number; chosen: string | null; cause?: Cause; offset?: number; origin?: Instruction; nth?: number; of?: number };

export type EffectWait =
  | { kind: "branch"; item: QueueItem }
  | { kind: "target"; item: QueueItem }
  | { kind: "cancel" };

// A paid cancel the first player may use before the effect resolves.
export type CancelOffer = { amount: number; sphere: Sphere | null; unless: Condition | null };

// A running effect. The queue is the rest of its instructions, so a window can stop it and a later
// intent can resume it.
export type EffectData = {
  kind: "effect";
  effectId: string;
  actor: number;
  queue: readonly QueueItem[];
  returned: number;
  canceled: boolean;
  cancel: CancelOffer | null;
  // Nothing may cancel the effect while this holds.
  blockCancel: Condition | null;
  // Set when the effect starts: true if the effect could not be canceled.
  uncancelable: boolean;
  wait: EffectWait | null;
  // The window to open again when the effect is done (an Action used in a pass window).
  resume?: { window: Window; seat: number } | null;
  // The cards and players (as "seat:N") the Pick instructions chose so far, oldest first. "" is a pick with nothing to choose.
  picked?: readonly string[];
  // An event played from the hand: when the effect is done the card goes to its owner's discard pile.
  finish?: "discardSource";
  // Set when the "when revealed" Responses (a cancel) have been offered for this frame.
  interrupted?: boolean;
  // The cards a Pick looked at in a deck: the ones still there are put back by ArrangeTop.
  looked?: readonly string[];
  // The seats that looked at cards of the encounter deck in this effect: the look is announced (`lookedAtEncounterDeck`) once the whole effect has resolved (families/encounter/looked.ts).
  lookedBy?: readonly number[];
  // The cards of the Investigation deck this effect showed in a look window: each hears the look (`lookedAtInvestigationDeck`) once the whole effect has resolved (families/investigation/look.ts).
  investigationLooked?: readonly string[];
  // The codes the actor named in this effect (NameInvestigation, `suspect:<code>` and `hideout:<code>`), for the accusation that follows (families/investigation/accuse.ts).
  named?: readonly string[];
  // The options a `different` Choose has taken in this effect (families/deck/choose.ts).
  options?: readonly string[];
  // The seat the event that offered this Response happened to.
  eventSeat?: number | null;
  // The X an event was played for (Stand and Fight), or the cost of the card an effect discarded (Flame of Anor).
  x?: number;
  // The characters that took part in the attack a Response answers.
  participants?: readonly string[];
  // The card the event a Response or Forced effect answers was about ("that ally", "that enemy"), and the other card it
  // names (the enemy a character defends against).
  subject?: string;
  other?: string;
  // The active location when a Travel effect began (absent: none): a Travel to itself that finds another location active was pre-empted by the effect itself (Dark-wood Grove reveals Giant Web, 51146:A:2; docs/scenarios/standalone-scenarios/the-woodland-realm.md, The Woodland Realm, reading 20).
  activeAtStart?: string;
  // The card the source was attached to when its own cost took it out of play ("Discard Cram to ready attached hero", 131011:A:2): "attached hero" still names it.
  host?: string;
  // The damage the answered event dealt, and the card whose destruction waits while this effect resolves.
  dealt?: number;
  // The damage an attack sent on past its defender (excessToShip): the X of "excess damage" an effect left for the attack's end reads.
  excess?: number;
  // The Attack the enemy struck with, for an effect the attack leaves for its end that resolves the same attack against another player (900208:A:2).
  struck?: number;
  // The ally the attack the effect was left by destroyed (DiscardCopiesFromDeck of "other", 10137:A:2).
  destroyedAlly?: string;
  // The first character the attack the effect was left by destroyed, a hero or an ally ("reanimate that character", 101161:A:2).
  destroyedCharacter?: string;
  // The seat that controlled the ally DestroyHighestCostAlly destroyed, so "that ally's controller" reanimates it (101162:A:2).
  destroyedController?: number;
  hold?: string;
  // The card DiscardBottom discarded from the bottom of a deck in this effect (the `discardedCost` condition, families/uncharted/cards.ts).
  discarded?: string;
  // Every card the running effect discarded from the top of a deck, over all the players it acted for, oldest first (the amount `discarded`, families/deck/discarded.ts).
  discardedFromDecks?: readonly string[];
  // How many cards DiscardEach has discarded in this effect (the `noneDiscarded` condition, families/south/damage.ts).
  discardedCount?: number;
  // The last Hide test this effect made failed (HideTest; the `lastHideFailed` condition, families/nightmare/guards.ts).
  hideFailed?: boolean;
  // The last Fortitude test this effect made (FortitudeTest; the `lastFortitudeFailed` and `lastFortitudePassed` conditions, families/mount-doom/conditions.ts).
  fortitude?: "failed" | "passed";
  // The last escape test this effect made (EscapeTest; the `lastEscapeFailed` and `lastEscapePassed` conditions, families/escape/conditions.ts).
  escape?: "failed" | "passed";
  // The last locate test this effect made (LocateTest; the `lastLocateFailed` and `lastLocatePassed` conditions, families/long-dark/conditions.ts).
  locate?: "failed" | "passed";
  // The last burgle attempt this effect made (BurgleAttempt; the `burgleSucceeded` and `burgleFailed` conditions, families/burgle/results.ts).
  burgle?: "failed" | "succeeded";
  // A Draw this effect ran drew a card (the `drew` condition: the text after "then" resolves only when the draw did, rr.then).
  drew?: boolean;
  // A Draw, a DiscardTopOfDeck or a DiscardResources this effect ran found too few cards or tokens (the `thenResolves` condition: the text after "then" is not attempted, rr.then).
  short?: boolean;
};

// A window to open again once the frames above this one are done. Under a response or a Forced frame raised while an action
// window was open.
export type ResumeData = { kind: "resume"; window: Window; seat: number; passed: readonly number[] };

export type HideData = {
  kind: "hide";
  x: number;
  committedIds: readonly string[];
  discardedIds: readonly string[];
  threat: number;
  result: HideResult | null;
};

// A Fortitude test under way (families/mount-doom/fortitude.ts). `extraCards` and `extraEyes` are what the verb added, read as the test was made; `ignored` are the discarded cards whose icons a Forced effect set aside; `eyes` is the count once the cards are discarded.
export type FortitudeData = {
  kind: "fortitude";
  extraCards: number;
  extraEyes: number;
  committedIds: readonly string[];
  discardedIds: readonly string[];
  ignored: readonly string[];
  eyes: number;
  result: FortitudeResult | null;
};

// An escape test under way (families/escape/test.ts, sotm.escape-test). `stat`: the stat the committed characters count. `cards`: the cards to deal, read as the test was made. `seats`: the players who commit, in order, and `asked` how many have been asked
// (a party test asks every player, one test for them all). `fresh`: the characters just committed, whose "after a character commits" Forced effects are still to resolve. `dealtIds`: the cards dealt, held out of the encounter discard pile until the total is read.
// `escape`: their total Escape and what the table adds, read once they are dealt.
export type EscapeData = {
  kind: "escape";
  stat: "willpower" | "attack" | "defense";
  cards: number;
  seats: readonly number[];
  asked: number;
  fresh: readonly string[];
  committedIds: readonly string[];
  dealtIds: readonly string[];
  escape: number;
  result: EscapeResult | null;
};

// A burgle attempt under way (families/burgle/attempt.ts, hob.burgle). `seat`: the first player who makes it. `effectCardId`: the encounter card step 1 stopped at, whose burgle effect step 3 reads. `revealedId`: the card of the seat's deck step 2 revealed, which stays on the deck (null with
// no card to reveal). `matching`: the cards of the hand step 3 offered, and `need` how many it asks, read when the effect frame is pushed. `result`: whether the attempt succeeded, once step 3 is read.
export type BurgleData = {
  kind: "burgle";
  seat: number;
  effectCardId: string | null;
  dealtIds: readonly string[];
  revealedId: string | null;
  matching: readonly string[];
  need: number;
  result: boolean | null;
};

// An event the engine announces. `seat` is the player it happened to. `phase` is the phase that just ended.
// `cardId` limits the event to one card: only that card's effects hear it.
// `subject` is the card the event is about; every card in play hears it. `participants` are the characters in an attack.
// `other` is a second card the event names: the enemy a character defends against or attacks.
// `amount` is the damage a `damaged` event dealt. `attachments` are the cards that left play with the card a
// `leftPlayWithAttachments` event is about (families/play/zones.ts).
// `occurrence`: events one game occurrence created share it (each character of one commit), and are announced together in
// a single response window (rr.triggering-condition). `fromDeck`: a "revealed" card the encounter deck itself revealed. `fromStaging`: an
// "engaged" enemy that came from the staging area, kept only in a game with ships (Boarding, families/sea/boarding.ts). `exhaustedToDefend`: a "declaredDefender" character the declaration exhausted (not one that stayed ready or was exhausted already).
export type GameEvent = { trigger: Trigger; seat: number | null; phase?: string; cardId?: string; subject?: string; other?: string; participants?: readonly string[]; explored?: boolean; byPlayerCard?: true; amount?: number; attachments?: readonly string[]; occurrence?: string; fromDeck?: boolean; fromDiscard?: true; fromStaging?: boolean; exhaustedToDefend?: true; shadowBlank?: true; uncancelable?: true; at?: number };

// A Response a player may use after an event. It is offered once and may be passed. `event` is the one it answers, when a
// window answers several events of one occurrence.
export type ResponseOffer = { cardId: string; effectId: string; seat: number; event?: GameEvent };

export type FrameData =
  | ResumeData
  | { kind: "event"; event: GameEvent }
  | { kind: "responses"; event: GameEvent; offers: readonly ResponseOffer[] }
  | { kind: "none" }
  // `fromDeck`: the top card of the encounter deck, not a card an effect found. `canceled`: a Response canceled the
  // effects of the card just revealed (Frodo Baggins). `discard`: and the card is discarded, not shuffled back (The Master Ring).
  // `guards`: the card is revealed as the guard of this objective (rr.guarded): it is attached to it as it is placed in the staging area. `engage`: an enemy found by a search is put into play engaged with the revealing seat instead (SearchReveal `to: engaged`).
  | { kind: "reveal"; hide: HideResult | null; surge: boolean; extraSurge?: number; extraDoomed?: number; surgeLeft?: number; fromDeck?: boolean; fromDiscard?: true; canceled?: boolean; discard?: boolean; guards?: string; engage?: true }
  | HideData
  | FortitudeData
  | EscapeData
  | BurgleData
  | EffectData;

export type Frame = {
  id: string;
  frame: FrameName;
  cardId: string | null;
  seat: number;
  peril: boolean;
  step: number;
  data: FrameData;
};

export type DelayedEffect = {
  id: string;
  // `questSucceeded`: run when the players quest successfully this phase (families/quest/outcome.ts), dropped when the quest
  // resolves otherwise. `questFailed`: the same, when they quest unsuccessfully (900307:A:1).
  // `endOfAttack`: the end of the player attack in progress (families/attack/flow.ts).
  // `startOfGame`: run once the opening hands are settled (misc family).
  // `beginningOfTravel`: run when the next travel phase begins (windows/triggers.ts crossBoundary).
  until: "endOfPhase" | "endOfRound" | "questSucceeded" | "questFailed" | "endOfAttack" | "startOfGame" | "beginningOfTravel";
  sourceId: string | null;
  seat: number;
  // The phase the effect was scheduled in. An end-of-phase effect fires when that phase ends.
  phase: string;
  instructions: readonly Instruction[];
  uncancelable: Condition | null;
  cause?: Cause;
  // The card the delayed instructions act on as the picked card.
  subjectId?: string;
};

// One use of an effect with a limit. A oncePerPhase use is spent in the round and phase it was made.
// `game` keeps the use for the rest of the game (a once-per-game limit); `attack` names the attack it was made in.
export type UsedEffect = { effectId: string; sourceId: string; round: number; phase: string; seat?: number; game?: boolean; attack?: string };

export type HideFailure = { seat: number; round: number; phase: string };

// The enemy attack in progress. `defenderId` and `heroId` stay empty until the player answers.
export type PendingAttack = {
  enemyId: string;
  seat: number;
  // An attack an effect started. It does not use up the enemy's attack for the phase.
  immediate?: boolean;
  // The attack is a shadow card's own (Wolf Rider, 01081:A:2), made once the attack it was dealt to ended.
  shadowAttack?: boolean;
  // The defending player must declare the character with the most damage, an exhausted one too, and cannot leave the attack undefended while one can defend (Ravenous Warg, 132059:A:1; families/armies/defender.ts).
  mustDefend?: true;
  defenderId?: string;
  // The hero an undefended attack lands on.
  heroId?: string;
  // The attack is undefended with no hero named for its damage yet (left undefended, rr.step-6-4-1), or a shadow effect made it count as undefended.
  undefended?: boolean;
  // The Attack the enemy dealt with, noted at the damage step only in a game with a card that resolves the attack against each player (AttackOthersUndefended).
  struck?: number;
  // Characters a shadow effect removed from this attack as its defender (RemoveDefender, 51335:A:2): none of them can be declared as a defender again for it.
  removedDefenders?: readonly string[];
  // A shadow effect made the attack capture an ally it would damage instead (CaptureInsteadOfDamage, families/captured/).
  captures?: true;
  shadowResolved?: boolean;
  // The Responses to the shadow effect have been offered, and a Response canceled it.
  shadowOffered?: boolean;
  shadowCanceled?: boolean;
  // Instructions to run, with the attacker as the source, when the attack ends.
  after?: readonly Instruction[];
  afterCause?: Cause;
  // The step that follows the action window open between two steps of the attack, and the stack depth it opened at.
  // `defenders`: more defenders were declared by an effect; the window after the declaration (6.4.1) comes next.
  awaiting?: "defense" | "shadow" | "damage" | "end" | "defenders";
  awaitDepth?: number;
  // Combat damage is placed; only the end of the attack is left.
  damaged?: boolean;
  // Forced effects "when this enemy attacks" (141069:A:2) are resolving: the defense window opens once they are done.
  defenseWaits?: boolean;
  // The additional shadow card (141069:A:2) turned face up whose cancel Responses are open; cleared once it resolves.
  extraOffered?: string;
  // A shadow card whose effect asks a player (a Pick or a Choose, 141071:A:2) is resolving in its own frame. The attack
  // goes on when it pops.
  shadowFrame?: string;
  // The shadow effects are resolved, and the window before combat damage has been offered.
  shadowsDone?: boolean;
  // The attacking enemy is in the staging area (an effect made it attack, 142038:A:2), not engaged (families/south/watcher.ts).
  fromStaging?: boolean;
  // A shadow effect says the undefended damage of this attack goes on an active location (142035:A:2).
  toLocation?: boolean;
  // A shadow effect says the undefended damage of this attack goes on one of these heroes (900408:A:3): the heroes the defending player may name.
  onlyHeroes?: readonly string[];
  // The attack is made against the main quest card, or an effect says its undefended damage goes on it (19083:B:1, 19081:A:1): the damage of an undefended attack is placed on the quest card, not a hero (families/wilderland/night.ts).
  toStage?: boolean;
  // The damage beyond the remaining hit points of the defending character goes on the main quest card (19083:B:1, 19080:A:3).
  excessToStage?: boolean;
  // The damage beyond the remaining hit points of the defending character goes on the card in play with this title (901407:A:2, ExcessToCard).
  excessToCard?: string;
  // The attack is Smaug's against Lake-town (Town-Baiting, 50211:A:1): the damage of an undefended attack is placed on Lake-town, and so is the damage beyond a defender's remaining hit points (families/smaug/attack.ts).
  toLakeTown?: boolean;
  // The damage beyond the remaining hit points of the defending character goes on Lake-town (Esgaroth Wharf's Shadow in a Town-Baiting attack; the flag `excessToLakeTown` of Smaug the Magnificent is read for the enemy).
  excessToLakeTown?: boolean;
  // Shadow cards that are enemies and say "attacks the defending player" (Wolf Rider, 01081:A:2): each attacks once this attack has ended
  // (families/defense/shadow-attack.ts).
  shadowAttackers?: readonly string[];
  // Extra defenders, damage marks and the attack's end, kept by the defense family (src/rules/families/defense/types.ts).
  defense?: AttackDefense;
};

// A player attack declared and not finished: the action windows between its steps (rr.attack-resolution-chart).
export type PendingStrike = {
  seat: number;
  enemyId: string;
  attackerIds: readonly string[];
  awaiting?: "strike" | "end";
  awaitDepth?: number;
  // The attack family's marks (families/attack/flow.ts). `back`: the window given back when the attack ends (absent: the
  // combat phase's player attack window; null: none, an effect declared the attack and goes on). `outer`: the player attack
  // this one was declared during, which goes on when it ends. `engagedSeat`: the player the enemy was engaged with when the
  // attack was declared. `ranged`: a card called it a ranged attack. `excessTo`: the enemy that takes its excess damage.
  back?: Window | null;
  outer?: PendingStrike;
  engagedSeat?: number;
  ranged?: boolean;
  excessTo?: string;
  // A card canceled the attack (CancelStrike, 18080:B:2): it deals no damage. Absent on every other attack.
  canceled?: true;
};
