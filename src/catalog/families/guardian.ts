// The guardian family (Return to Mirkwood, sotm.guarding-gollum): the player who guards the Gollum objective card (02130), who the encounter and quest cards name ("the player guarding Gollum"). The guard is the controller of the Gollum card in play, so a change of guard is a change of
// control. The seat selector is `who: "guardian"` (effect-schema-pick.ts) and `seats: "guardian"` on a ForEachPlayer (effect-schema.ts); the restrictions that bind the guard are `guardian` and `exceptAlone` on Restrict (effect-schema-verbs.ts); the condition `guardianCanChange` is in
// effect-schema-conditions.ts. src/rules/families/guardian/ runs and reads them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

const VERBS = [
  // "Search the encounter deck for Gollum. Choose a player to guard Gollum at the start of the game, and place Gollum in front of that player" (02126:A:1): the card with this code, in the encounter deck or set aside, enters the play area of the player the effect picked last (the
  // first player when it picked none) faceup and ready. Nothing happens when no copy is there or one is in play already.
  verbFlags(z.strictObject({ verb: z.literal("GuardGollum"), code: z.string().min(1), ...when }), { setupRuns: "top" }),
  // The player the effect picked last becomes the guard: Gollum, and what is attached to him, goes to that player's play area, the way and in the state any change of control does (rr.ownership-and-control; announced as a change of control, which "After the player guarding Gollum changes"
  // hears, 900903:A:2). Nothing happens when a card says the guard cannot change (the flag `guardianLocked`), when no player is picked, or when the picked player already guards him or is out of the game.
  z.strictObject({ verb: z.literal("ChangeGuardian"), ...when }),
] as const;

const TRIGGERS = [] as const;

const FLAGS = [
  // On the table: the player guarding Gollum cannot change ("While The Spider's Ring is the active location, the player guarding Gollum cannot change", 02131:A:1; Isolation, 900907:A:2). Read by ChangeGuardian and the condition `guardianCanChange`.
  "guardianLocked",
  // On the table: a treachery card's When Revealed effect that targets the player guarding Gollum also targets each other player (Dry Watercourse, 02132:A:1). Read by a ForEachPlayer with `seats: "guardian"`.
  "treacheryHitsAll",
  // On an enemy: a shadow card it is dealt that targets the player guarding Gollum also targets each other player (Ambushing Orcs, 900902:A:1). Read by a ForEachPlayer with `seats: "guardian"` in the shadow effect.
  "shadowHitsAll",
  // On a card in play: damage from undefended attacks against its controller must be dealt to it ("Damage from undefended attacks against you must be dealt to Gollum", 02130:A:1). Read as the undefended attack's damage is assigned (src/rules/families/guardian/combat.ts).
  "undefendedToHolder",
] as const;

export const manifest = { name: "guardian", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
