// The vocabulary the Nightmare decks (phase 36, docs/brief.md, Nightmare) add to effect records: verbs, triggers and stat flags.
// effect-schema-verbs.ts, effect-schema.ts and effect-schema-stats.ts compose them. src/rules/families/nightmare/index.ts runs them (with nightmare/dungeon.ts and nightmare/setup.ts).
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { cardRefSchema, positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { pickSchema } from "../effect-schema-pick.ts";
import { verbFlags } from "../verb-flags.ts";

const VERBS = [
  // The source (a treachery being revealed) attaches to the current quest card ("When Revealed: Attach to the current quest", 906107:A:2).
  // It leaves play with that stage, which discards it (rr.attachment-cards). With no quest card in play it stays where it is and goes to the
  // encounter discard pile as a revealed treachery does.
  z.strictObject({ verb: z.literal("AttachToQuest"), ...when }),
  // The card with this code's printed title is searched for in the encounter deck, then its discard pile, then the victory display, and the
  // first copy found is added to the staging area ("searches the encounter deck, discard pile, and victory display for Khamûl the Easterling and
  // adds it to the staging area", 906101:A:2; rr.search). It is not revealed. Nothing happens when no copy is in those places. The deck is
  // shuffled by a ShuffleEncounterDeck after it (the line says so). In a quest card's Setup it runs at the top level ("Search the encounter deck for Gollum, and add it to the staging area", 02105:A:1).
  verbFlags(z.strictObject({ verb: z.literal("SearchToStaging"), code: z.string().min(1), ...when }), { setupRuns: "top" }),
  // The source enemy attacks the actor now, as an attack outside the combat phase: from the staging area though it is not engaged, or while
  // it is engaged with the actor ("Southern Spy makes an immediate attack against you", 906203:A:1). It is dealt a shadow card of its own.
  // Nothing happens when it is engaged with another player or out of play.
  z.strictObject({ verb: z.literal("AttackActor"), ...when }),
  // A shadow effect: once the attack in progress ends, the source (the shadow card) is attached faceup to the defending character if this
  // attack dealt it damage ("If the defending character is damaged by this attack, attach Blade Tip to that character", 906209:A:2). An
  // undefended attack has no defending character. `card`, `to` and `dealt` are engine use: the instruction the shadow effect leaves for the
  // end of the attack names the shadow card and the defender, and asks the attack to keep the damage it dealt.
  z.strictObject({ verb: z.literal("AttachToDamagedDefender"), card: z.string().min(1).optional(), to: z.string().min(1).optional(), dealt: z.literal(true).optional(), ...when }),
  // A marker on a When Revealed record, which does nothing when it runs: a Response on a card with this trait cannot cancel the card's effects
  // ("This effect cannot be canceled by the Ring-bearer's effect", 906208:A:1; rr.cancel). Read by the response window (rules/windows/responses.ts).
  z.strictObject({ verb: z.literal("NotCanceledBy"), trait: z.string().min(1), ...when }),
  // Every copy of the card with this code in the encounter deck and its discard pile is set aside, facedown, out of play ("Setup: Set each copy
  // of Pale-green Tentacle aside, out of play", 906401:A:2).
  z.strictObject({ verb: z.literal("SetAsideFromDeck"), code: z.string().min(1), ...when }),
  // One set-aside copy of the card with this code is put into play engaged with the actor ("each player puts 1 copy of Pale-green Tentacle into
  // play engaged with him", 906401:A:3; rr.engaged). Nothing happens with no copy set aside.
  z.strictObject({ verb: z.literal("EngageSetAside"), code: z.string().min(1), ...when }),
  // The enemy in the staging area with the lowest engagement cost becomes the picked card; the first player chooses among a tie
  // (rr.first-player). Nothing is picked when there is none ("engage the lowest engagement cost enemy in the staging area", 906407:A:2).
  z.strictObject({ verb: z.literal("PickLowestEngagement"), ...when }),
  // The player with the highest threat becomes the picked player; the first player chooses among a tie (rr.first-player). "The player with
  // the highest threat exhausts all heroes he controls. Then, attach this card to one of that player's heroes" (900106:A:1).
  z.strictObject({ verb: z.literal("PickHighestThreat"), ...when }),
  // The topmost card of the encounter discard pile of one of these printed types becomes the picked card ("The topmost enemy or location
  // card in the encounter discard pile", 900107:A:2). `trait`: it must have that Trait too ("The topmost Undead enemy in the encounter discard pile", 144026:A:2). Nothing is picked with none there.
  z.strictObject({ verb: z.literal("PickDiscardTop"), types: z.array(z.enum(["enemy", "location", "treachery"])).min(1), trait: z.string().min(1).optional(), ...when }),
  // A shadow effect: the topmost card of the encounter discard pile that has a Shadow effect is dealt to the attacking enemy as one more
  // shadow card, and resolves in this attack after the ones it has ("Deal and resolve the topmost Shadow effect in the encounter discard
  // pile for this attack", 900107:A:3; rr.step-6-4-2). Nothing happens with none there.
  z.strictObject({ verb: z.literal("DealShadowFromDiscard"), ...when }),
  // The source enemy engages a player who is engaged with an enemy that matches `pick` ("Anduin Troll Spawn engages a player engaged with a
  // Hill Troll", 900203:A:2); the first player chooses among several (rr.first-player). Nothing happens when no player is, or when the source
  // is already engaged with one who is. `seat` is engine use: the player chosen.
  // `controls`: the player is one who controls a card in play that matches `pick` ("engages the player who controls Wilyador", 900603:A:2), whatever it is engaged with now: an enemy engaged with another player leaves that one.
  z.strictObject({ verb: z.literal("EngageSeatWith"), pick: pickSchema, controls: z.literal(true).optional(), ...when }),
  // The enemy with the most printed hit points in the victory display and the encounter discard pile becomes the picked card; the first player
  // chooses among a tie ("Search the victory display and encounter discard pile for the enemy with the most hit points", 900207:A:1). Nothing
  // is picked with no enemy there.
  z.strictObject({ verb: z.literal("PickMostHitPoints"), ...when }),
  // A shadow effect left for the end of the attack (inside AfterAttack, the source is the attacking enemy): the attack also resolves against
  // each other player, undefended ("resolve this attack against each player. (Attack is undefended against each player not engaged with this
  // enemy.)", 900208:A:2; ltp.undefended-attack): each of them chooses a hero they control, which takes the enemy's Attack as damage.
  z.strictObject({ verb: z.literal("AttackOthersUndefended"), ...when }),
  // All damage is removed from every enemy in play; each player raises his threat by the damage removed from the enemies engaged with him.
  // The effect's X becomes the damage removed ("Remove all damage from all enemies. Then, each player raises his threat by the amount of damage
  // just removed from his engaged enemies. If no damage is removed by this effect", 900209:A:1).
  z.strictObject({ verb: z.literal("RemoveEnemyDamage"), ...when }),
  // All damage on the card `from` names moves to the card `to` names; damage that reaches its hit points destroys it ("Move all damage on
  // this enemy to the defending character", 900209:A:2). Nothing moves when either card is missing or out of play. With `amount`, at most that much damage moves ("move 1 damage from Arnor Ravaged to that character", 100158:A:2).
  z.strictObject({ verb: z.literal("MoveDamageTo"), from: cardRefSchema, to: cardRefSchema, amount: z.number().int().positive().optional(), ...when }),
  // Heard when a hero was taken prisoner at stage 1B (900301:A:2): more heroes are captured at random with the game's seed, from players who have
  // none captured, until the number captured is 1 with 1 or 2 players, 2 with 3 and 3 with 4. Each is facedown, "the prisoner", as the first
  // (src/rules/families/prisoner/index.ts). Nothing is announced for them.
  z.strictObject({ verb: z.literal("TakeMorePrisoners"), ...when }),
  // In the effect an attack leaves for its end: the hero the reference names, still in play, is turned facedown as a "prisoner" when this attack
  // dealt it damage ("Any hero damaged (but not defeated) by this attack is turned face down, as a "prisoner."", 900302:A:2). It keeps its
  // damage. `dealt` asks the attack to keep the damage it dealt (families/defense/excess.ts).
  z.strictObject({ verb: z.literal("TakeHeroPrisoner"), card: cardRefSchema, dealt: z.literal(true), ...when }),
  // The players return to an earlier stage, side B: the current quest card goes back to the quest deck and the quest card of stage `stage` (its
  // place in the quest deck, counting from 1) is the current quest again, with no progress ("return to stage 2B of the quest", 900302:A:2). Its
  // When Revealed effects do not resolve again.
  z.strictObject({ verb: z.literal("ReturnToStage"), stage: z.number().int().positive(), ...when }),
  // The card with this code is put into play engaged with the first player from wherever it is out of play: set aside, the encounter deck, its
  // discard pile or the victory display ("put the Nazgûl of Dol Guldur into play (from any out of play area), engaged with the first player",
  // 900307:A:1). Nothing happens when it is in play.
  z.strictObject({ verb: z.literal("EngageOutOfPlay"), code: z.string().min(1), ...when }),
  // 1 resource moves from the pool of each hero the actor controls that has one to the card the reference names ("move 1 resource token from
  // each of your heroes' resource pools to that location", 900308:A:3).
  z.strictObject({ verb: z.literal("MoveResourceFromHeroes"), to: cardRefSchema, ...when }),
  // Places `amount` resource tokens on the card the reference names, an encounter card: it is no hero's resource pool, so nothing collects it and
  // no `resourcesAdded` is announced ("Add 1 resource token to each Dol Guldur location in play", 900302:A:1; "place 1 resource token on
  // Dungeon Labyrinth for each player in the game", 900306:A:2). With `code` instead of `on`: the card in play with that code ("Place 2 resource tokens on Gollum", 02108:A:1); when none is in play the tokens go on a card in play that holds
  // `redirectResources` ("If Gollum is not in play, any resource tokens that would be placed on Gollum are placed here instead", 900802:A:2), else nowhere.
  z.strictObject({ verb: z.literal("PlaceResourceTokens"), amount: positiveAmountSchema, on: cardRefSchema.optional(), code: z.string().min(1).optional(), ...when }).refine((verb) => (verb.on == null) !== (verb.code == null), "PlaceResourceTokens names a card or a code, not both"),
  // Deals `amount` damage to the card the reference names (the answered event's subject by default) unless a card with the source's title has already dealt it damage this round ("deal 1 damage to that character if it has not been dealt damage by another copy of
  // Brambles and Thorns this round", 900704:A:1). When damage is dealt (the card's damage grew: a shield or cap that prevented it all leaves it undealt) the card is marked for the round by that title (the flag `damagedByTitle`), so each copy that resolves
  // afterwards finds it marked. Read by nightmare/damage-once.ts.
  z.strictObject({ verb: z.literal("DamageOncePerRound"), amount: z.number().int().positive(), target: cardRefSchema.optional(), ...when }),
] as const;

const TRIGGERS = [
  // A quest card became the current stage ("When stage 3A is revealed", 906101:A:2). The event names the stage as its subject, so a record with
  // no `subject` hears it from any card in play (the Nightmare setup card, zone `nightmare`); a `matches` condition on `subject` says which stage.
  "stageRevealed",
  // The "when revealed" effects of an encounter card were canceled (a cancel Response to a card just revealed, or to its When Revealed effect;
  // rr.cancel). About no card: every card in play hears it ("After a 'when revealed' effect is canceled", 906304:A:1, 906406:A:1).
  "whenRevealedCanceled",
  // Setup is under way: a Forced effect of the Nightmare setup card that says "During setup" resolves once the piles are dealt and the
  // quest's own Setup is placed, before the first round ("Forced: During setup, each player reveals 1 card from the encounter deck",
  // 900101:A:2; rr.setup: card effects triggered during Setup are fully resolved). Only the setup card in zone `nightmare` hears it.
  "duringSetup",
] as const;

const FLAGS = [
  // On "table": no player may commit more than this many characters to a Hide test ("players cannot commit more than 2 characters to a Hide
  // test", 906106:A:1). The smallest amount held applies. Read by hideCommitReason (rules/quest/hide.ts) through families/nightmare.ts.
  "hideCommitLimit",
  // On a card: it is immune to player card effects while the flag holds ("While Bill Ferny is in the staging area, he gains: Immune to player
  // card effects", 906201:A:2; mec109.immune-to-player-card-effects). Read with the printed keyword (rules/core/keywords.ts playerCardEffectCanChoose).
  "immuneToPlayerCards",
  // On a card: it cannot ready, by a card effect or in the refresh phase, while the flag holds ("your cards cannot ready for the remainder
  // of the round", 900103:A:1). Read wherever a card readies (player-verbs.ts readyCard, refresh.ts, effect-verbs.ts ReadyHero).
  "cannotReady",
  // On "table": an empty encounter deck is refilled at once, at any time, by shuffling the encounter discard pile into it ("If the encounter
  // deck is empty (at any time), shuffle the encounter discard pile back into the encounter deck", 900201:A:3; rr.running-out-of-cards
  // otherwise does so only in the quest phase). Read by verbs.ts resetEncounterDeck, the settle loop and the shadow deal.
  "encounterRefill",
  // On "seat:N": that player cannot attack, or damage by his card effects, an enemy whose title is not the title of the modifier's source ("If
  // you are engaged with this enemy, you cannot attack or deal damage (through effects) to enemies with a title other than Marshland
  // Outlaws", 900202:A:1). Read by combat.ts canAttack and the DamageCard verb (families/nightmare/guards.ts).
  "attackOnlyTitle",
  // On a card, until the end of the round: a card with the modifier's source's title dealt it damage this round (DamageOncePerRound, 900704:A:1).
  "damagedByTitle",
] as const;

export const manifest = { name: "nightmare", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
