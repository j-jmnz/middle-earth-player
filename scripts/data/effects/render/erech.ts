// The erech family's pieces (src/catalog/families/erech.ts, The Stone of Erech): templates for its verbs, the words of its stat flags, its conditions and the samples read-fields.test.ts checks them with.
import { str, type Ctx, type Obj } from "./kit.ts";

type Made = { text: string; read: readonly string[] };

export const ERECH_TEMPLATES: Readonly<Record<string, (i: Obj) => Made>> = {
  PutNightObjective: (i) => ({ text: `the set aside card with code ${str(i.code)} (a Night objective: Eventide, Dusk or Midnight) comes into play beside the current quest, with no progress; only one Night objective lies there at a time`, read: ["code"] }),
  PlaceNightProgress: (i) => ({ text: `place ${str(i.amount)} progress on the Night objective in play (nothing with none); a Night objective at its limit then gives way to the next`, read: ["amount"] }),
  NightAdvance: (i) => ({ text: `a passive check, made whenever the game settles: with ${str(i.at)} or more progress on this Night objective it goes to the victory display with its progress and the set aside card with code ${str(i.next)} comes into play beside the quest with none`, read: ["at", "next"] }),
  FreeAttachedObjective: (i) => ({ text: `this card, an objective ally attached to another card, leaves it and joins ${i.who === "firstPlayer" ? "the first player's" : "a player's"} play area, ready, controlled by him`, read: ["who"] }),
  PassHand: (i) => ({ text: `every player passes his whole hand to the player on his ${str(i.direction)} (the next seat in player order) at once; the only player discards his hand instead`, read: ["direction"] }),
};

// The plain words a stat flag of the family adds after its name.
export const ERECH_STAT_NOTES: Readonly<Record<string, string>> = {
  skipPlanning: " (the planning phase is skipped: no window opens)",
  noCollect: " (no hero collects resources in the resource phase; an effect that adds resources still works)",
  cannotPlayEvents: " (no player can play an event)",
  losesIcons: " (the hero has none of its Lore, Leadership, Spirit and Tactics icons, printed or gained)",
};

export const ERECH_CONDITIONS: Readonly<Record<string, (c: Obj, ctx: Ctx) => Made>> = {
  night: (c) => ({ text: c.is === "duskOrMidnight" ? "the Night objective in play is Dusk or Midnight" : `the Night objective in play is ${c.is === "midnight" ? "Midnight" : "Dusk"}`, read: ["is"] }),
};

export const ERECH_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  PutNightObjective: [{ verb: "PutNightObjective", code: "50308" }],
  PlaceNightProgress: [{ verb: "PlaceNightProgress", amount: 1 }],
  NightAdvance: [{ verb: "NightAdvance", at: 4, next: "50309" }],
  FreeAttachedObjective: [{ verb: "FreeAttachedObjective", who: "firstPlayer" }],
  PassHand: [{ verb: "PassHand", direction: "left" }],
};

export const ERECH_CONDITION_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  night: [{ kind: "night", is: "dusk" }, { kind: "night", is: "midnight" }, { kind: "night", is: "duskOrMidnight" }],
};
