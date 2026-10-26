// The vocabulary putting cards into play, leaving play, delayed returns, control changes and card type changes adds to effect records: simple verbs, triggers and stat flags.
// effect-schema-verbs.ts, effect-schema.ts and effect-schema-stats.ts compose them.
import { z } from "zod";

import { when } from "../effect-schema-conditions.ts";
import { pickSchema } from "../effect-schema-pick.ts";

// "At the end of the phase/round, if it is still in play, [return it to its owner's hand | shuffle it into its owner's deck |
// discard it]": the engine schedules that for each card the verb put into play (rr.delayed-effects).
const temporary = {
  until: z.enum(["endOfPhase", "endOfRound"]).optional(),
  then: z.enum(["returnToHand", "shuffleIntoDeck", "discard"]).optional(),
};

// Which card a verb of this family acts on: the source, the last picked card (a player picked is skipped), the card the
// answered event was about, or the source's host.
const card = z.enum(["self", "picked", "subject", "host"]);

export const VERBS = [
  // Puts the card (the source by default) into play from wherever it is out of play (hand, discard pile, deck): it is not
  // played, so no cost is paid and no play restriction applies (rr.play-and-put-into-play), and a unique card with a copy in
  // play stays where it is. A hero goes among its controller's heroes, any other card into the play area, ready unless
  // `exhausted`, `committed` to the quest if asked, with `damage` tokens on it. `who` is its controller: the actor, the picked
  // player, its owner, or a player the actor chooses ("under any player's control"). `until` and `then` schedule its leaving.
  // An attachment goes on a card it may be attached to that matches `host`, chosen by the actor; it stays where it is when
  // none can take it (families/attachments-play.ts). An attachment with Guarded (X) put into play from out of play is guarded
  // first (wor.guarded-x); `unguarded` is the step after (engine use, the `unguarded` event): its guard left play, so its owner
  // puts it into play, or it goes to the owner's discard pile when it has nowhere to go.
  z.strictObject({
    verb: z.literal("PutIntoPlay"),
    card: card.optional(),
    who: z.enum(["actor", "picked", "owner", "choose"]).optional(),
    exhausted: z.boolean().optional(),
    committed: z.boolean().optional(),
    damage: z.number().int().positive().optional(),
    host: pickSchema.optional(),
    unguarded: z.boolean().optional(),
    ...temporary,
    ...when,
  }),
  // A player may put cards that match `pick` into play from a hand, one at a time, up to `upTo` (1 by default), and may stop
  // ("None"). `from`: the actor's hand, the picked player's hand (that player chooses), or any player's hand (the actor
  // chooses, "the players as a group"). `anyController`: the chooser then names the player who controls each card. Each card is
  // picked for the instructions after it. `card` is engine use: the card chosen, waiting for its controller.
  z.strictObject({
    verb: z.literal("PutIntoPlayFromHand"),
    pick: pickSchema,
    from: z.enum(["actor", "picked", "any"]).optional(),
    upTo: z.number().int().positive().optional(),
    anyController: z.boolean().optional(),
    card: z.string().optional(),
    ...temporary,
    ...when,
  }),
  // The card (the source by default) and every card attached to it pass to a player: the last picked player, the player the
  // answered event happened to, the first player or the actor. It keeps its state, tokens and resources and stays its owner's
  // card (rr.ownership-and-control); `changedControl` is announced. With `until` control goes back at that time, if it is
  // still in play.
  z.strictObject({
    verb: z.literal("ChangeControl"),
    card: card.optional(),
    to: z.enum(["picked", "eventSeat", "firstPlayer", "actor"]),
    until: z.enum(["endOfPhase", "endOfRound"]).optional(),
    ...when,
  }),
  // Constant: while the source is in play the card (the source, or its host) is controlled by the first player ("The first
  // player gains control of attached ally"). The engine moves it whenever the first player changes.
  z.strictObject({ verb: z.literal("ControlledBy"), who: z.literal("firstPlayer"), card: z.enum(["self", "host"]), ...when }),
  // The actor takes the first player token: they are the first player from now on (rr.first-player).
  z.strictObject({ verb: z.literal("TakeFirstPlayer"), ...when }),
  // Each player raises their threat by `amount` from the doomed keyword the source gains (rr.doomed-x): "You may give ~
  // doomed 2". `doomedRaised` is announced for each.
  z.strictObject({ verb: z.literal("Doomed"), amount: z.number().int().positive(), ...when }),
  // The card (the answered event's by default), now in a discard pile, goes to its owner's hand ("return that ally to your
  // hand").
  z.strictObject({ verb: z.literal("TakeIntoHand"), card: card.optional(), ...when }),
  // Answering `leftPlayWithAttachments`: each attachment the card took with it, still in a discard pile, goes to its owner's
  // hand ("return each attachment attached to that character to its owner's hand").
  z.strictObject({ verb: z.literal("ReturnAttachments"), ...when }),
  // The card (the answered event's by default), now in a discard pile, is attached facedown to the source: out of play under
  // it, with no text, and discarded to its owner's discard pile when the source leaves play.
  z.strictObject({ verb: z.literal("AttachFacedown"), card: card.optional(), ...when }),
  // The rest of the running effect is the picked player's: they make its choices, and "you" is that player ("Then, that player
  // moves 1 resource ...").
  z.strictObject({ verb: z.literal("SwitchActor"), to: z.literal("picked"), ...when }),
  // Constant: the source is discarded as soon as this stat of it is at most `max` ("Discard Denethor if his Willpower is 0 or
  // less").
  z.strictObject({ verb: z.literal("DiscardWhen"), stat: z.enum(["willpower", "attack", "defense", "hitPoints"]), max: z.number().int(), ...when }),
  // Places damage tokens on the card (the source by default) without dealing damage: nothing answers or cancels them ("enters
  // play with 1 damage on it"). A character with damage at its hit points is destroyed (rr.hit-points).
  z.strictObject({ verb: z.literal("PlaceDamage"), amount: z.number().int().positive(), card: card.optional(), ...when }),
  // The actor spends `amount` resources from the pool of the card (the last picked by default): nothing is spent when it holds
  // fewer ("Spend 1 resource from a Rohan hero's resource pool").
  z.strictObject({ verb: z.literal("SpendFrom"), amount: z.number().int().positive(), card: card.optional(), ...when }),
  // Discards one card in the staging area with the same title as the card the answered event was about ("discard a location in
  // the staging area with the same title as the just explored location").
  z.strictObject({ verb: z.literal("DiscardSameTitle"), ...when }),
] as const;

export const TRIGGERS = [
  // About a player card in play that a card effect or cost discarded to its owner's discard pile. A card destroyed by damage
  // was not discarded (rr.destroy).
  "discardedFromPlay",
  // About the seat: its threat was raised by the doomed keyword (rr.doomed-x).
  "doomedRaised",
  // Heard on either event: a card entered play, or it left play ("After an Eagle ally enters or leaves play").
  "enteredOrLeftPlay",
  // About a card that left play with attachments on it, which left with it (the event's attachments): "When a character
  // leaves play, return each attachment attached to that character".
  "leftPlayWithAttachments",
] as const;

// `heroType`: the holder loses the ally card type and gains the hero card type (Sword-thain): it is among its controller's
// heroes while it holds the flag. `threatCeiling` (on "seat:N"): while the seat's threat is higher than the amount, it is
// treated as the amount ("treat your threat as if it is 20"); the dial does not move.
export const FLAGS = ["heroType", "threatCeiling"] as const;
