import type { Effect } from "../../catalog/boundary.ts";

// The campaign cards of Angmar Awakened (10156, 10159, 10166, 10171, 10174, 10182, 10184, 10188, 10193; Setup on the front, Resolution on the back, ledger data/printed/angmar-awakened.json) that the box's campaign shell reads: the lines
// that only change the pool, the decks, the hand and the Campaign Log's Damage Tracking. Their vocabulary is the campaign family's (src/catalog/families/campaign.ts): the checklist deals the Setup verbs (src/campaign/checklist.ts) and the Resolution
// runs the rest (src/rules/setup/resolution.ts, src/rules/families/campaign/saga-end.ts). The lines that need their scenario's own table (a side quest in the staging area, the captured deck, Thaurdir's burdens, the Clues) are written in that scenario's file.
const PROTECT_THE_INNOCENT = "10158";
const ARNOR_RAVAGED = "100158";
const IARIONS_PENDANT = "10157";
const AMARTHIULS_COURAGE = "10167";
const DETERMINATION = "10172";
const FEND_OFF_DESPAIR = "10173";
const CARN_DUM_BOONS = ["10189", "10190", "10191", "10192"];

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 10156 Intruders in Chetwood. Resolution: the damage on Protect the Innocent is noted in the log and the side quest joins the Campaign Pool.
  { id: "10156:resolution:1", cardCode: "10156", lines: ["10156:B:1"], timing: "resolution", instructions: [{ verb: "RecordDamageOn", codes: [PROTECT_THE_INNOCENT] }, { verb: "Earn", codes: [PROTECT_THE_INNOCENT] }] },

  // 10159 The Weather Hills. Resolution: the damage on Protect the Innocent replaces the number in the log.
  { id: "10159:resolution:1", cardCode: "10159", lines: ["10159:B:1"], timing: "resolution", instructions: [{ verb: "RecordDamageOn", codes: [PROTECT_THE_INNOCENT] }] },

  // 10166 Deadmen's Dike. Resolution: the damage is noted (Protect the Innocent, or Arnor Ravaged on its other side), Protect the Innocent leaves the pool and Arnor Ravaged takes its place, and the first player chooses Iârion's Pendant or Amarthiúl's Courage for the group.
  { id: "10166:resolution:1", cardCode: "10166", lines: ["10166:B:1"], timing: "resolution", instructions: [
    { verb: "RecordDamageOn", codes: [PROTECT_THE_INNOCENT, ARNOR_RAVAGED] },
    { verb: "RemoveFromPoolByCode", codes: [PROTECT_THE_INNOCENT] },
    { verb: "Earn", codes: [ARNOR_RAVAGED] },
    { verb: "ChooseCards", codes: [IARIONS_PENDANT, AMARTHIULS_COURAGE], who: "firstPlayer", to: "pool", only: true }] },

  // 10171 The Wastes of Eriador. Setup: no +1 for changing heroes; each player adds a Determination to their starting hand and to the pool; Fend Off Despair is shuffled into the encounter deck. Resolution: Fend Off Despair joins the pool.
  { id: "10171:campaignSetup:1", cardCode: "10171", lines: ["10171:A:2"], timing: "campaignSetup", instructions: [
    { verb: "WaiveThreatPenalty" },
    { verb: "AddToHandAfterMulligan", code: DETERMINATION },
    { verb: "AddToPool", code: DETERMINATION, eachPlayer: true },
    { verb: "ShuffleIntoEncounterDeck", code: FEND_OFF_DESPAIR }] },
  { id: "10171:resolution:1", cardCode: "10171", lines: ["10171:B:1"], timing: "resolution", instructions: [{ verb: "Earn", codes: [FEND_OFF_DESPAIR] }] },

  // 10188 The Battle of Carn Dûm. Setup: no +1 for changing heroes (Amarthiúl may be a hero: src/campaign/loadout.ts HERO_BANS); each player in turn may take one of the four boons into their opening hand, and it joins the pool. Resolution: the damage on each hero is noted.
  { id: "10188:campaignSetup:1", cardCode: "10188", lines: ["10188:A:2"], timing: "campaignSetup", instructions: [
    { verb: "WaiveThreatPenalty" },
    { verb: "ChooseCards", codes: CARN_DUM_BOONS, who: "eachSeat", to: "hand", optional: true, afterMulligan: true }] },
  { id: "10188:resolution:1", cardCode: "10188", lines: ["10188:B:1"], timing: "resolution", instructions: [{ verb: "RecordHeroDamage" }] },

  // 10193 The Dread Realm. Setup: each player may search their deck for a boon and add it to their opening hand; each hero begins with the damage the log noted for it. Resolution: the players win the campaign.
  { id: "10193:campaignSetup:1", cardCode: "10193", lines: ["10193:A:2"], timing: "campaignSetup", instructions: [{ verb: "SearchBoonOrTreasureToHand" }, { verb: "PlaceLoggedHeroDamage" }] },
  { id: "10193:resolution:1", cardCode: "10193", lines: ["10193:B:1"], timing: "resolution", instructions: [{ verb: "EndCampaign", result: "won" }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
