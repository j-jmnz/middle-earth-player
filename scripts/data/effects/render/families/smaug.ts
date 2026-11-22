// The smaug family's pieces (src/catalog/families/smaug.ts, The Battle of Lake-town): templates for its verbs, the words of its stat flags and the samples read-fields.test.ts checks them with.
import { str, type Obj } from "../kit.ts";

type Made = { text: string; read: readonly string[] };

export const SMAUG_TEMPLATES: Readonly<Record<string, (i: Obj) => Made>> = {
  RevealSmaug: (i) => ({ text: `the first player reveals the top card of the Smaug deck (its discard pile shuffled into it first when it is empty) and puts it in ${i.to === "play" ? "his play area, engaged with him" : "the staging area"}; a Smaug already in play gives it all its damage and is discarded to the Smaug discard pile`, read: ["to"] }),
  ResolveBurn: (i) => ({
    text: `resolve all burn damage: the Burn of every location in play (staging area or active, the Burn 1 West Pier gives each included) is a pool; each player in turn from the first player may exhaust ready characters he controls and assign any of the pool to each, up to its remaining hit points, and the rest goes on Lake-town${i.pool != null || i.seats != null || i.pending != null || i.assign != null ? ` (the engine's own step: pool ${str(i.pool)}, seats ${str(i.seats)}, exhausted ${str(i.pending)}, share ${str(i.assign)})` : ""}`,
    read: ["pool", "seats", "pending", "assign"],
  }),
  AttackLakeTown: () => ({ text: "the Smaug in play (in the staging area or engaged) attacks the last player now, dealt a shadow card; the last player may declare a defender, undefended damage and the damage beyond a defender's hit points go on Lake-town (nothing with no Smaug in play)", read: [] }),
  HealLakeTownByProgress: (i) => ({ text: `the first player chooses how many of the replaced progress tokens (${i.progress != null ? str(i.progress) : "the event's X"}) to discard, at most the damage on Lake-town${i.heal != null ? `; ${str(i.heal)} chosen` : ""}: that much damage comes off Lake-town and the rest of the progress is placed on the quest card`, read: ["progress", "heal"] }),
};

// The plain words a stat flag of the family adds after its name.
export const SMAUG_STAT_NOTES: Readonly<Record<string, string>> = {
  locationsGainBurn: " (each location in play, this card included, gains Burn 1 for the burn damage that is resolved)",
  excessToLakeTown: " (the damage of its attacks beyond the remaining hit points of the defending character goes on Lake-town)",
  alliesCannotDefend: " (allies cannot be declared as defenders against it)",
  progressHealsLakeTown: " (progress that questing would place on this stage is not placed; the stage's record hears it and may discard it to remove damage from Lake-town)",
};

export const SMAUG_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  RevealSmaug: [{ verb: "RevealSmaug", to: "play" }],
  ResolveBurn: [{ verb: "ResolveBurn", pool: 3, seats: [0, 1], pending: "c1", assign: { id: "c1", amount: 2 } }],
  AttackLakeTown: [{ verb: "AttackLakeTown" }],
  HealLakeTownByProgress: [{ verb: "HealLakeTownByProgress", progress: 3, heal: 2 }],
};
