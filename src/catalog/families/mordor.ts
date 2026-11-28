// The vocabulary The Vengeance of Mordor cycle (A Shadow in the East, The River Running and the scenarios after it) adds to effect records: verbs, triggers and stat flags. effect-schema-verbs.ts, effect-schema.ts and
// effect-schema-stats.ts compose them. src/rules/families/mordor runs the verbs below and answers the one hook the shared engine calls (a holder class of a lasting effect).
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { cardRefSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";

const VERBS = [
  // "Attach the top Easterling treachery in the discard pile to it" (21021:A:1, 21021:A:2, 21024:A:2), "Attach that treachery to Easterling Captain" (21017:A:1): a treachery of the encounter discard pile lies attached to the enemy `to` (the source, the answered event's
  // subject, the attacking enemy ...) without its When Revealed or Surge resolving (rr.attachment-cards). `from: discardTop`: the topmost treachery of the pile with `trait` (the last one put there); `from: picked`: the card the running effect picked last
  // (a DiscardUntil that discarded it), only while it lies in the pile. Nothing attaches with no such card, or to a host that cannot have it.
  z.strictObject({ verb: z.literal("AttachTreachery"), from: z.enum(["discardTop", "picked"]), trait: z.string().min(1).optional(), to: cardRefSchema, ...when }),
  // "Each exhausted character gets -1 Willpower until the end of the phase" (21027:A:2), "Each copy of Rolling Plains gets +2 Threat until the end of the phase" (21025:A:1): a lasting effect on a class of cards, read live (faq.lasting-effects), so a card that joins the class later in the
  // phase is held too and one that leaves it is not. `holders: exhaustedCharacters`: every character in play that is exhausted now; `holders: sourceTitle`: every card in play (staging area, engaged or the active location) with the title of the source.
  z.strictObject({ verb: z.literal("ModifyHeld"), stat: z.enum(["willpower", "threat"]), amount: z.number().int(), holders: z.enum(["exhaustedCharacters", "sourceTitle"]), until: z.literal("endOfPhase"), ...when }),
] as const;

const TRIGGERS = [] as const;

const FLAGS = [] as const;

export const manifest = { name: "mordor", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
