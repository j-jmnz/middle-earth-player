// The vocabulary the prisoner of Escape from Dol Guldur adds to effect records: a hero taken prisoner (facedown with the cards
// attached to it, unusable), Mendor captured with it, and the rescue. The Ring-bearer facedown under the Watcher (south family) uses the
// same captive zone. Simple verbs and triggers; effect-schema-verbs.ts and effect-schema.ts compose
// them. src/rules/families/prisoner/ runs them.
import { z } from "zod";

import { when } from "../effect-schema-conditions.ts";

export const VERBS = [
  // 01123:B:1: one hero of all the heroes the players control is selected at random with the game's seed and turned facedown. It and each
  // card attached to it become the "prisoner": facedown, blank, still in play but controlled by nobody, so nothing can use or damage them,
  // and the hero collects no resources. `prisonerTaken` is announced about the hero.
  z.strictObject({ verb: z.literal("TakePrisoner"), ...when }),
  // 01131:A:3, the Forced effect that answers `prisonerTaken`: "the \"prisoner\" from the Campaign Log is selected instead". When the
  // log names a hero (its `prisoner` fact) that the players control, that hero is the prisoner and the one selected at random is back
  // among its player's heroes as it was. Nothing happens with no such hero, so the random one stays.
  z.strictObject({ verb: z.literal("SelectLoggedPrisoner"), ...when }),
  // 01131:A:3: the card in play with this code is captured as well: it is placed facedown next to the prisoner, in play but
  // controlled by nobody, and it does not leave play. Nothing happens when there is no prisoner or no such card.
  z.strictObject({ verb: z.literal("CaptureWithPrisoner"), code: z.string().min(1), ...when }),
  // 01124:B:1: the prisoner hero is flipped faceup and `damage` damage is placed on it. Its controller controls it again, with the cards
  // attached to it faceup. It has been "rescued": `prisonerRescued` is announced, and no hero is the prisoner any more.
  z.strictObject({ verb: z.literal("RescuePrisoner"), damage: z.number().int().min(0), ...when }),
  // 01131:B:1: the captured card in play with this code is flipped faceup and `damage` damage is placed on it. It returns to the play area
  // of the first player.
  z.strictObject({ verb: z.literal("FreeCaptive"), code: z.string().min(1), damage: z.number().int().min(0), ...when }),
] as const;

export const TRIGGERS = [
  // About the hero that was just taken prisoner (01131:A:3), and about the hero just rescued (01102:A:2, which a card out of play hears).
  "prisonerTaken",
  "prisonerRescued",
] as const;

export const FLAGS = [] as const;
