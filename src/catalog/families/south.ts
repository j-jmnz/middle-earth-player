// The vocabulary The Ring Goes South adds to effect records: a second active location, the Ring-bearer facedown under an enemy, an enemy
// engaged with every player, the faceup cards of stage 1B and a few locations' rules. Simple verbs, triggers and stat flags;
// effect-schema-verbs.ts, effect-schema.ts and effect-schema-stats.ts compose them. src/rules/families/south/ runs them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { amountSchema, positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { pickSchema } from "../effect-schema-pick.ts";
import { verbFlags } from "../verb-flags.ts";

const VERBS = [
  // The set-aside card with this code becomes the active location (not traveling: no Travel effect, nothing hears "traveled").
  // A location already active goes back to the staging area, unless a second active location slot is free (ExtraActiveLocation).
  z.strictObject({ verb: z.literal("MakeSetAsideActive"), code: z.string().min(1), ...when }),
  // Each player (`eachSeat`) assigns `amount` damage among the cards that match `pick` from their side, one damage at a time on the card
  // they choose ("each player assigns X damage among characters he controls", 142029:A:2). `single`: the player chooses one card and it takes all of the damage ("assigns 3 damage to 1 character he controls", 04072:A:3). `left` and `of` are engine use: the damage still to go, and the damage to assign in all.
  verbFlags(z.strictObject({ verb: z.literal("AssignDamage"), amount: positiveAmountSchema, pick: pickSchema, who: z.literal("eachSeat").optional(), single: z.literal(true).optional(), left: z.number().int().min(0).optional(), of: z.number().int().min(1).optional(), ...when }), { runsInFrame: true }),
  // The actor discards each card that matches `pick` (from their side) to its owner's discard pile ("discard each ally he controls",
  // 142037:A:1).
  z.strictObject({ verb: z.literal("DiscardEach"), pick: pickSchema, ...when }),
  // The first player reveals cards from the encounter deck, one after the other, until the staging area holds at least this much
  // Threat or the deck is empty (142021:A:1).
  z.strictObject({ verb: z.literal("RevealUntilThreat"), threat: amountSchema, ...when }),
  // Stage 1B (142020:B:1): each player places the top card of their deck faceup in player order until `cards` are faceup between
  // them; the first player then assigns them to the `outcomes` in order, one distinct card to each: `play` is played for no cost by
  // its owner, `hand` goes to its owner's hand, `discard` to its owner's discard pile, `shuffle` is shuffled into its owner's deck.
  z.strictObject({
    verb: z.literal("AssignFaceup"),
    cards: z.number().int().positive(),
    outcomes: z.array(z.enum(["play", "hand", "discard", "shuffle"])).min(1),
    // Engine use: the faceup cards still to be assigned, the outcome being assigned, and the card chosen for it.
    faceup: z.array(z.string()).optional(),
    next: z.number().int().min(0).optional(),
    ...when,
  }),
  // The Ring-bearer (the hero with that trait that a player controls) loses every token (damage, resources, progress), and it and
  // each card attached to it are placed facedown under the card in play with the code `under`. It and its attachments stay in play, and nobody controls
  // them (mec109.stage-4).
  // `guarded`: the hero lies faceup under the card as a guarded objective, keeping its tokens and its attachments faceup (The Tower of Cirith Ungol: "The first player loses control of the Ring-bearer and places it faceup under Topmost Chamber as a guarded objective", 146066:A:1). It is a held hero of its
  // owner (`guardedHero`, the flag Carried Away uses), so it takes no damage while nobody controls it and its owner is not out of heroes; FreeRingBearer gives it back.
  z.strictObject({ verb: z.literal("CaptureRingBearer"), under: z.string().min(1), guarded: z.literal(true).optional(), ...when }),
  // The first player takes control of the Ring-bearer facedown under the source and of the cards attached to it: it returns to play
  // faceup in their play area exhausted with `damage` damage on it (142024:A:3).
  z.strictObject({ verb: z.literal("ReleaseRingBearer"), damage: z.number().int().min(0), ...when }),
  // Constant (146067:B:2, "When the Ring-bearer is free of encounters, the first player gains control of it"): the settle loop gives the first player the Ring-bearer a card guards (CaptureRingBearer `guarded`) as soon as that card is out of play, with its tokens, its state and its attachments as they were. A marker: the record names the line,
  // and a game with such a record looks for the hero.
  z.strictObject({ verb: z.literal("FreeRingBearer") }),
  // A shadow card's effect on the attack in progress: undefended damage is placed on an active location instead of a hero, the
  // defending player choosing the location (142035:A:2). Damage goes to the hero as usual when no location is active.
  z.strictObject({ verb: z.literal("DamageActiveLocation"), ...when }),
  // A shadow card's effect on the attack in progress: the damage of an undefended attack must be placed on a hero the defending player controls that matches `pick`, if able ("Damage from this attack must be applied to a hero you control with a Clue card attached, if
  // able", 900408:A:3: agent recommendation, rr.step-6-4-3 names the one hero an undefended attack damages). The player names the hero among those; a hero already named that does not match is replaced. A defended attack still damages its defender, and an attack
  // against a player with no such hero damages the hero named as usual.
  // `character`: the card may be any player's character that matches `pick`, a hero or an ally, not only a hero the defending player controls ("If this attack is undefended, the damage must be placed on Wilyador", 02070:A:2): it takes the attack's damage as the named hero would, and nothing changes when it is not in play.
  z.strictObject({ verb: z.literal("UndefendedDamageTo"), pick: pickSchema, character: z.literal(true).optional(), ...when }),
  // The enemy (the picked card) in the staging area attacks the actor now, as an attack outside the combat phase, though it is not
  // engaged (142038:A:2). It is dealt a shadow card of its own.
  // `target: self`: the source enemy attacks (a When Revealed on the enemy, 142047:A:1). `who: firstPlayer`: the first player is attacked, whoever
  // the actor is ("The Balrog makes an attack", 142043:A:2, which is considered engaged with the first player). `raiseThreatIfDestroys`: the player attacked raises his threat by this much once the attack ends, if it destroyed a character ("If this attack destroys a character, raise your threat by 4", 146039:A:2). `who: eventSeat`: the player the answered event happened to is attacked ("The Mouth of Sauron makes an immediate attack against that player", 146031:A:2: the player who canceled the When Revealed).
  // `undefendedToStage`: "Undefended damage from this attack must be dealt to Hrogar's Hill" (19081:A:1): the damage of the attack if it is left undefended goes on the main quest card, not a hero (emce.side-quests).
  // `orEngaged`: the picked enemy may be engaged with a player instead and attacks as it is, without leaving its engagement ("Fram's Shade makes an immediate attack against each player", 19097:A:3).
  // `target: host`: the enemy the source is attached to attacks ("Saruman attacks that player", 143048:A:1). `target: subject`: the enemy the event is about attacks ("After an Orc enemy is added to the staging area, it makes an immediate attack against the first player", 09026:A:2). `shadows`: it is dealt this many shadow cards for the attack ("Deal and resolve 2 shadow cards", 143048:A:1).
  z.strictObject({ verb: z.literal("AttackFromStaging"), target: z.enum(["self", "host", "subject"]).optional(), shadows: z.number().int().min(2).max(4).optional(), who: z.enum(["firstPlayer", "eventSeat"]).optional(), raiseThreatIfDestroys: z.number().int().positive().optional(), undefendedToStage: z.literal(true).optional(), orEngaged: z.literal(true).optional(), ...when }),
  // Choose, among the enemies in the staging area with this trait, the one with the highest engagement cost (ties: the first player
  // chooses) and pick it, or pick nothing when there is none (142038:A:2).
  z.strictObject({ verb: z.literal("PickHighestEngagement"), trait: z.string().min(1), ...when }),
  // The source (a treachery) attaches to the active location, chosen by the first player among them; it stays in the staging area's
  // discard when the location already has a copy ("Limit 1 per location") or none is active. The effect's X is 1 when it attached,
  // else 0 (142036:A:1).
  z.strictObject({ verb: z.literal("AttachToActiveLocation"), ...when }),
] as const;

const TRIGGERS = [] as const;

const FLAGS = [
  // On "table" (target table, while the source is in play): there can be 2 active locations (mec109.stage-4). Traveling then fills the free
  // slot (142023:B:1).
  "extraActiveLocation",
  // On "table": during the travel phase the players must travel to a location, if able (mec109.stage-4): the travel step offers no way
  // to decline while a location in the staging area could be traveled to and an active location slot is free (142021:B:1).
  "mustTravel",
  // On a location: progress cannot be placed on it until each other active location is full (142030:A:2).
  "progressAfterOthers",
  // On a location: progress cannot be placed on it unless the first player controls the Ring-bearer (142030:A:2).
  "progressNeedsRingBearer",
  // On a card: the players lose the game while it holds this many damage tokens (142030:A:3).
  "loseAtDamage",
  // On an enemy in the staging area: it cannot leave the staging area, but it is considered engaged with each player. It makes an
  // attack against each player in the combat phase, in player order; each player may attack it; it adds no Threat to the staging
  // area (rr.engaged) (142024:A:2).
  "engagedWithAll",
  // On an enemy in the staging area: as `engagedWithAll`, but it is considered engaged only with each player whose threat is 1 or greater, read live: it attacks each of them once in the combat phase and only they declare attackers against it; a player whose threat was below 1 when the combat phase began and is raised during it is attacked
  // with no shadow card dealt (Durin's Bane, 04150:A:2, dwd.durins-bane).
  "engagedWithThreatening",
  // On a location: at most this much progress can be placed on it each round (142036:A:1), and the progress placed on it this round
  // (engine use).
  "progressCap",
  "progressPlaced",
  // On a location in the staging area: each placement of progress on it is reduced by this much, a placement of 1 becoming 0 ("When any amount of progress would be placed on a location in the staging area, reduce that amount by 1", 144048:A:1).
  // Several holders add. Read where progress is placed (rules/interpret/effect-verbs.ts placeProgress, families/south/locations.ts reducedProgress).
  "progressReduced",
] as const;

export const manifest = { name: "south", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
