// The vocabulary The Long Dark (Dwarrowdelf part 7) adds to effect records: the locate test, the Lost timing and the other lines the scenario's cards share with the cycle's later parts (dwd.locate-test, dwd.locate-test-example, dwd.lost-effects; ledger lines 04087:B:1, 04092:A:1, 04094:A:1, 04096:A:1,
// 04099:A:2, 901605:A:1, 901607:A:1). PASS is a printed keyword (src/catalog/keyword-line.ts); the conditions `hasPass`, `lastLocateFailed` and `lastLocatePassed` are in effect-schema-conditions.ts. src/rules/families/long-dark runs and reads them.
// A Lost line's record is a `forced` effect (a `triggered` one on an attachment's text) whose trigger is `lost`.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

const VERBS = [
  // "Makes a locate test" (dwd.locate-test): `who` makes it (the actor by default, the first player with `firstPlayer`). The tester may discard 1 card from his hand to discard the top card of the encounter deck, again and again: a card with PASS printed in its text box passes the test, any other
  // lets him try again; the test is failed when he will not discard more or has no card left (he may stop before the first). The hand card goes to its owner's discard pile and the encounter card to the encounter discard pile, one at a time. An empty encounter deck is refilled from the discard pile
  // during the quest phase and stays empty otherwise (the test is then failed at once, agent recommendation). The result is read after it by `lastLocateFailed` and `lastLocatePassed`. `handIds`, `dealtIds` are engine use: the cards the test has discarded so far.
  verbFlags(z.strictObject({ verb: z.literal("LocateTest"), who: z.enum(["actor", "firstPlayer"]).optional(), handIds: z.array(z.string()).optional(), dealtIds: z.array(z.string()).optional(), ...when }), { runsInFrame: true }),
  // "Trigger all Lost: effects in play" (dwd.lost-effects): `all` runs the Lost line of every faceup card in play (the staging area, the active location, engaged enemies, attachments, the Nightmare setup card; not a shadow card), each in full, the oldest first.
  // `chooseOne`: the actor chooses one card in play with a Lost line and only that one is triggered ("choose and trigger 1 Lost: effect in play", 901604:A:2). `eachDifferent`: starting with the first player each player in turn chooses a Lost line no earlier player chose in this
  // resolution and triggers it before the next player chooses ("each player must choose and trigger a different Lost: effect in play", 901607:A:1); a player with none left to choose does nothing. `taken`, `left` are engine use: the cards chosen and the seats still to choose.
  // Nothing happens when no card in play has a Lost line.
  verbFlags(z.strictObject({ verb: z.literal("TriggerLost"), mode: z.enum(["all", "chooseOne", "eachDifferent"]), taken: z.array(z.string()).optional(), left: z.array(z.number().int()).optional(), ...when }), { runsInFrame: true }),
  // The progress a `progressWouldBePlaced` event held back (the event's amount, the effect's X) is placed on the source location now, whole, without asking again ("do not place any progress tokens on Twisting Passage" unless the test is passed, 04092:A:1).
  z.strictObject({ verb: z.literal("PlaceHeldProgress"), ...when }),
  // The players' travel is used for the round and they do not travel (a failed locate test to travel to Eastern Mines: "return Eastern Mines to the staging area", 901605:A:1; rr.travel, rr.step-4-2). Only a Travel effect runs it: the instructions after it, the travel itself, are not run.
  z.strictObject({ verb: z.literal("EndTravel"), ...when }),
  // A constant marker on an attachment (Gathering Ground, "Each enemy revealed from the encounter deck gains surge", 04095:A:1): while its record is in force every enemy the encounter deck reveals gains surge as it is revealed, one more instance of surge for each marker.
  // An enemy that is not revealed (a shadow card, one an effect adds to the staging area) gains nothing (dwd.revealing-enemies). The verb itself does nothing when a record runs it.
  z.strictObject({ verb: z.literal("EnemiesGainSurge") }),
] as const;

const TRIGGERS = [
  // A Lost line's record: Lost effects are triggered only by card effects (TriggerLost), and every faceup card in play with such a record hears it (dwd.lost-effects). Not heard by a shadow card.
  "lost",
  // About a location whose Forced effect hears it (`progressHeldBy`, set at the start of the game): progress would be placed on it, by questing or by a card effect, the whole amount as one placement (the event's amount, the effect's X); the placement waits for the record, which places it with PlaceHeldProgress ("Forced: Before placing progress tokens on Twisting Passage", 04092:A:1).
  "progressWouldBePlaced",
] as const;

const FLAGS = [
  // On an enemy until the end of the round: one of its attacks placed damage on a character ("unless it has dealt at least 1 damage this round", 04100:A:1), set by its Forced effect on `attackDamagedCharacter` and read by the condition `flag` with holder `self`.
  "dealtDamageThisRound",
] as const;

export const manifest = { name: "long-dark", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
