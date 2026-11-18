// The ambush pieces of the encounter family (src/catalog/families/encounter.ts, dwd.ambush): templates for the verbs the keyword and the Road to Rivendell cards add. read-fields-samples.ts holds their samples.
import { str, type Ctx, type Obj } from "./kit.ts";

type Made = { text: string; read: readonly string[] };

export const AMBUSH_TEMPLATES: Readonly<Record<string, (i: Obj, ctx: Ctx) => Made>> = {
  AmbushChecks: () => ({ text: "ambush: each player in turn, the first player first, makes an engagement check against this enemy alone; the first player whose threat reaches its engagement cost engages it and the checks end (no check while ambush is ignored)", read: [] }),
  DiscardTopEncounter: (i) => ({
    text: `the acting player discards the top card of the encounter deck${i.ambushCheck === true ? "; an enemy with the ambush keyword so discarded makes one engagement check against that player alone: it engages them from the discard pile when their threat reaches its engagement cost, else it stays in the discard pile" : ""}`,
    read: ["ambushCheck"],
  }),
  FirstEnemyGains: (i) => ({
    text: `the first enemy${i.withKeyword === "ambush" ? " with the ambush keyword" : ""} revealed from the encounter deck each round gains ${str(i.keyword)} (counted from the round's start, whether or not this card is in play)`,
    read: ["keyword", "withKeyword"],
  }),
  RevealEnemies: (i) => ({ text: `each enemy this effect discarded${Array.isArray(i.ids) ? ` (${i.ids.length} still to reveal)` : ""} is revealed in full, in the order discarded, and added to the staging area`, read: ["ids"] }),
};
