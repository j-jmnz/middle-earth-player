// The vocabulary the guarded objectives of Escape from Dol Guldur add to effect records: an objective with the Guarded keyword that
// is revealed gets the next encounter card attached, and a player claims it once it is free of encounters. Simple verbs and
// triggers; effect-schema-verbs.ts and effect-schema.ts compose them. src/rules/families/objectives/ runs them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { cardRefSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

const VERBS = [
  // Guarded (rr.guarded, ltp.guarded): the objective (`target`, the source by default) is in the staging area, so the next card of the
  // encounter deck that is not itself an objective is revealed and attached to it, and both stay in the staging area. A revealed
  // enemy or location counts its Threat there and stays attached until it leaves play; a treachery resolves as it is revealed and
  // the objective gets no attachment. Used as a When Revealed effect on the objective, and by the Setup that attaches 1 encounter card
  // to each objective (01123:A:1).
  // Guarded (enemy) / Guarded (location) (emce.guarded-x, wor.guarded-x): with `types` the objective is guarded by an encounter card of one of those types. Cards come off the top of the encounter deck into its discard pile until one of them is discarded, and that
  // card is added to the staging area (it is not revealed) and attached to the objective as its guard; the discard pile is shuffled into an empty deck first. With no card of the types in the deck or the discard pile the objective stays unguarded.
  verbFlags(z.strictObject({ verb: z.literal("GuardObjective"), target: cardRefSchema.optional(), types: z.array(z.enum(["enemy", "location"])).min(1).optional(), ...when }), { setupRuns: "inEach" }),
  // Claiming (01108:A:2, 01109:A:2, 01110:A:2): the source objective, free of encounters, leaves the staging area and is attached to the
  // last picked hero, a card its controller controls ("Counts as an attachment"). It is announced as `claimed`. A hero with more
  // restricted attachments than it can hold discards the one its controller chooses, and a discarded objective returns to the staging area.
  z.strictObject({ verb: z.literal("ClaimObjective"), ...when }),
  // "Attach X to that objective, guarding it" (12121:A:1, 12126:A:3, 12127:A:3, 12133:A:1): the encounter card `guard` (the source by default), in the staging area or engaged
  // (an engaged one returns to the staging area first, 12133:A:1), is attached to the objective `to` (the last picked card by default) as its guard (rr.guarded). It stays
  // in the staging area, counts its Threat there, and leaves the objective when it leaves play. A guard that already guards another objective is moved and frees that one.
  // `replaceGuards`: the objective's own guards are detached first and stay in the staging area as the cards they are ("If it was guarded, detach the encounter guarding it first", 900401:A:2). `stayEngaged`: an engaged guard keeps its
  // engagement (the card never says to return it, 900401:A:2: agent recommendation).
  z.strictObject({ verb: z.literal("AttachGuard"), guard: cardRefSchema.optional(), to: cardRefSchema.optional(), replaceGuards: z.literal(true).optional(), stayEngaged: z.literal(true).optional(), ...when }),
  // A constant (12134:A:2 to 12137:A:2, "If ~ is free of encounters, add it to the staging area, controlled by the players"): the source objective in the staging area is controlled
  // by the players as soon as it is free of encounters and no effect is resolving (the settle sweep, families/objectives/control.ts): it is marked `claimed`, with no controller,
  // so it stays in the staging area. It does nothing when run.
  z.strictObject({ verb: z.literal("ControlWhenFree"), ...when }),
] as const;

const TRIGGERS = [
  // About an objective card: a player claimed it and attached it to a hero (01131:B:1, "After the first objective is claimed").
  "claimed",
] as const;

const FLAGS = [
  // On a claimed objective: when the hero it is attached to leaves play, the objective returns to the top of the encounter deck instead of the staging area ("Forced: After attached hero is damaged or leaves play, return this card to the top of the
  // encounter deck", 02014:A:2). Read where a card's attachments are released (families/objectives/claimed.ts).
  "returnsToEncounterDeck",
  // On a claimed objective: when the hero it is attached to leaves play, or it is discarded, the objective returns to the staging area ("If detached, return Gandalf's Map to the staging area", 01108:A:2). A claimed objective
  // without it counts as an attachment and is discarded with its host (Athelas 02063, the Rhudaur Clues). Read where a card is sent away (families/objectives/claimed.ts).
  "returnsToStagingArea",
] as const;

export const manifest = { name: "objectives", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
