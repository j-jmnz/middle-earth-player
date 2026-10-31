// The vocabulary Journey in the Dark adds to effect records: damage tokens on an objective that count down to the Balrog, the Balrog's
// place beside the first player, a hero given up for damage, and the burden objectives that attach to the hero an event names. Simple
// verbs and stat flags; effect-schema-verbs.ts, effect-schema.ts and effect-schema-stats.ts compose them. src/rules/families/moria*.ts
// runs them.
import { z } from "zod";

import { when } from "../effect-schema-conditions.ts";

export const VERBS = [
  // Damage tokens go on the card in play with this printed code, none of it dealt: nothing answers or cancels them ("place 10 damage tokens
  // on it", 142040:A:1).
  z.strictObject({ verb: z.literal("PlaceDamageOn"), code: z.string().min(1), amount: z.number().int().positive(), ...when }),
  // Up to `amount` damage tokens come off the card in play with this printed code; it stops at 0 ("remove 1 damage token from Doom, Doom,
  // Doom", 142040:B:1, 142042:A:1, 142043:A:1, 142048:A:1, 142059:A:2).
  z.strictObject({ verb: z.literal("RemoveDamageFrom"), code: z.string().min(1), amount: z.number().int().positive(), ...when }),
  // Response of The Great Bridge (142050:A:2): the last picked hero is discarded from play to deal X damage to the card in play with this
  // printed code, X being that hero's threat cost; then that card loses all keywords for the remainder of the game (the `losesKeywords` flag).
  // The damage is an encounter card's, not a player card's, so the Balrog's immunity does not stop it. Nothing happens with no such card in play.
  z.strictObject({ verb: z.literal("SacrificeForDamage"), code: z.string().min(1), ...when }),
  // The source objective, in the staging area, attaches to the hero the answered event was about ("attach to that hero", 142088:A:2). A
  // card that is attached already stays where it is.
  z.strictObject({ verb: z.literal("AttachToSubject"), ...when }),
] as const;

export const TRIGGERS = [] as const;

export const FLAGS = [
  // On an enemy in the staging area: it cannot leave the staging area, but it is considered engaged with the first player. Only the first
  // player attacks it or declares attackers against it (ranged characters of the others may join); it attacks the first player in the combat
  // phase (src/rules/families/south-watcher.ts, which also reads `engagedWithAll`) (142044:A:2).
  "engagedWithFirst",
  // On a card: all its printed keywords are lost for the rest of the game ("The Balrog loses all keywords", 142050:A:2): it is no longer
  // Indestructible (rules/keywords.ts).
  "losesKeywords",
  // On an enemy: the shadow cards dealt to it are immune to player card effects, so no Response cancels their effects (142044:A:1; rules/shadow.ts).
  "shadowsImmune",
  // On a location in the staging area: progress must be placed on it before it can be placed on the current quest ("progress must be placed on
  // Mines of Moria before it can be placed on the current quest", 142052:A:1; rules/families/attachments-quest.ts).
  "progressFirstRequired",
] as const;
