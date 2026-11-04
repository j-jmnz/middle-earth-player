// The vocabulary the dungeon of Escape from Dol Guldur adds to effect records: deck cards that become facedown enemies (the Orc
// Guard), an encounter card attached to a player's deck (Iron Shackles), a limit on the cards the players play each round and a
// shadow effect that has just resolved. Simple verbs, triggers and a stat flag; effect-schema-verbs.ts, effect-schema.ts and
// effect-schema-stats.ts compose them. src/rules/families/dungeon/ runs them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";

const VERBS = [
  // 01107:A:1, 01125:B:1: the actor places the top card of their deck facedown in front of them "as if it just engaged" them. The card is
  // an "Orc Guard", an enemy with 1 hit point, 1 Attack and 1 Defense that is engaged with the actor, and it is held under that enemy
  // (the enemy is a stand-in the engine makes; when it leaves play the card goes to its owner's discard pile). Nothing happens
  // when the deck is empty.
  z.strictObject({ verb: z.literal("PlaceOrcGuard"), ...when }),
  // 01105:A:1: the source encounter card (a treachery being revealed) is attached to the top of the first player's deck, in play,
  // controlled by nobody. The next draw from that deck is replaced by discarding it (Iron Shackles' own text, a constant of the card).
  z.strictObject({ verb: z.literal("AttachToDeck"), who: z.literal("firstPlayer"), ...when }),
  // 01104:A:1, "Until the end of the phase, raise the total Threat in the staging area by X": the table holds the raise (moreStagingThreat) until
  // `until`. It adds to the Threat of the cards in the staging area, so it counts in the quest phase and for the engagement checks of the phase.
  z.strictObject({ verb: z.literal("RaiseStagingThreat"), amount: positiveAmountSchema, until: z.enum(["endOfPhase", "endOfRound"]), ...when }),
  // Setup (01123:A:1, "place the Nazgûl of Dol Guldur face up but out of play, alongside the quest deck"): the set-aside card with this code is
  // turned faceup, still out of play.
  z.strictObject({ verb: z.literal("TurnFaceUp"), code: z.string().min(1), ...when }),
  // Constant on a card in play (a quest card, 01123:B:2): the players, as a group, cannot play more than `max` cards of this type each
  // round. Cards put into play without being played are not counted.
  z.strictObject({ verb: z.literal("LimitPlays"), cardType: z.literal("ally"), max: z.number().int().min(0), ...when }),
] as const;

const TRIGGERS = [
  // About the enemy whose dealt shadow card's effect has just resolved in its attack (01102:A:3, "After a shadow effect dealt to ~
  // resolves"). The event's seat is the defending player. A shadow card with no effect is not announced.
  "shadowEffectResolved",
] as const;

const FLAGS = [
  // Held by the table: the total Threat in the staging area is raised by this much (RaiseStagingThreat, 01104:A:1). It adds to the Threat of
  // the cards there; lessStagingThreat (attachments family) takes away from the total.
  "moreStagingThreat",
] as const;

export const manifest = { name: "dungeon", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
