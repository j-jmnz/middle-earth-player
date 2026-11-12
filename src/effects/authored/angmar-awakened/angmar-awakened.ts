import type { Effect } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as THE_CITY_OF_CORSAIRS } from "../the-city-of-corsairs.ts";
import { copyLine, withCopies } from "../reprint.ts";

// The campaign cards of Angmar Awakened (10156, 10159, 10166, 10171, 10174, 10182, 10184, 10188, 10193; Setup on the front, Resolution on the back, ledger data/printed/angmar-awakened.json) that the box's campaign shell reads: the lines
// that only change the pool, the decks, the hand and the Campaign Log's Damage Tracking. Their vocabulary is the campaign family's (src/catalog/families/campaign.ts): the checklist deals the Setup verbs (src/campaign/checklist.ts) and the Resolution
// runs the rest (src/rules/setup/resolution.ts, src/rules/families/campaign/saga-end.ts). The lines that need their scenario's own table (a side quest in the staging area, the captured deck, Thaurdir's burdens, the Clues) are written in that scenario's file.
const PROTECT_THE_INNOCENT = "10158";
const ARNOR_RAVAGED = "100158";
const IARIONS_PENDANT = "10157";
const AMARTHIULS_COURAGE = "10167";
const DETERMINATION = "10172";
const FEND_OFF_DESPAIR = "10173";
// The boons Mysterious Omens offers (10160:A:3): the ones attached to heroes when the scenario is won stay with them in the pool (rr.campaign-pool, ltp.permanent).
const MYSTERIOUS_OMENS_BOONS = ["10161", "10162", "10163", "10164", "10165"];
const CARN_DUM_BOONS = ["10189", "10190", "10191", "10192"];

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies([
  // 10156 Intruders in Chetwood. Resolution: the damage on Protect the Innocent is noted in the log and the side quest joins the Campaign Pool.
  { id: "10156:resolution:1", cardCode: "10156", lines: ["10156:B:1"], timing: "resolution", instructions: [{ verb: "RecordDamageOn", codes: [PROTECT_THE_INNOCENT] }, { verb: "Earn", codes: [PROTECT_THE_INNOCENT] }] },

  // 10159 The Weather Hills. Resolution: the damage on Protect the Innocent replaces the number in the log, and each of Mysterious Omens' boons attached to a hero is recorded with it.
  { id: "10159:resolution:1", cardCode: "10159", lines: ["10159:B:1"], timing: "resolution", instructions: [{ verb: "RecordDamageOn", codes: [PROTECT_THE_INNOCENT] }, { verb: "EarnAttached", codes: MYSTERIOUS_OMENS_BOONS }] },

  // 10166 Deadmen's Dike. Resolution: the damage on Protect the Innocent is noted, Protect the Innocent leaves the pool and Arnor Ravaged takes its place, the first player chooses Iârion's Pendant or Amarthiúl's Courage for the group and which player takes it, the Omens boons attached to heroes are recorded with them, and the burden Thaurdir carried (or a hero holds now) joins the pool (to "player": fixed to that seat, as 11197:B:1 does; docs/brief.md, Angmar Awakened).
  { id: "10166:resolution:1", cardCode: "10166", lines: ["10166:B:1"], timing: "resolution", instructions: [
    { verb: "RecordDamageOn", codes: [PROTECT_THE_INNOCENT] },
    { verb: "RemoveFromPoolByCode", codes: [PROTECT_THE_INNOCENT] },
    { verb: "Earn", codes: [ARNOR_RAVAGED] },
    { verb: "ChooseCards", codes: [IARIONS_PENDANT, AMARTHIULS_COURAGE], who: "firstPlayer", to: "player", only: true },
    // A boon Mysterious Omens gave a hero in this scenario is recorded with its hero as in The Weather Hills (rr.campaign-pool, ltp.permanent: a Permanent card's hero is recorded); a boon the pool already had on a hero is not earned twice.
    { verb: "EarnAttached", codes: MYSTERIOUS_OMENS_BOONS },
    // "Add that card to the Campaign Pool" (10166:A:3): the burden the Forced effect attached to Thaurdir joins the pool when the scenario is won, whoever carries it then (rr.campaign-pool); a lost game writes nothing.
    { verb: "EarnAllBurdens" }] },

  // 10171 The Wastes of Eriador. Setup: no +1 for changing heroes; each player adds a Determination to their starting hand and to the pool; Fend Off Despair is shuffled into the encounter deck. Resolution: Fend Off Despair joins the pool, and the characters that carry a Determination are marked determined.
  { id: "10171:campaignSetup:1", cardCode: "10171", lines: ["10171:A:2"], timing: "campaignSetup", instructions: [
    { verb: "WaiveThreatPenalty" },
    { verb: "AddToHandAfterMulligan", code: DETERMINATION },
    { verb: "AddToPool", code: DETERMINATION, eachPlayer: true },
    { verb: "ShuffleIntoEncounterDeck", code: FEND_OFF_DESPAIR }] },
  // The Forced effect inside the line 10172:A:1 (a Determination: "If you win this scenario, mark in the Campaign Log that attached character is 'determined'"), whose line the Action record of 10172 owns: the Resolution marks each character in play that still carries one (a lost game writes nothing).
  { id: "10171:resolution:1", cardCode: "10171", lines: ["10171:B:1"], timing: "resolution", instructions: [{ verb: "Earn", codes: [FEND_OFF_DESPAIR] }, { verb: "RecordDetermined", code: DETERMINATION }] },

  // 10188 The Battle of Carn Dûm. Setup: no +1 for changing heroes (Amarthiúl may be a hero: src/campaign/loadout.ts HERO_BANS); each player in turn may take one of the four boons into their opening hand, and it joins the pool. Resolution: the damage on each hero is noted, and the characters that carry a Determination are marked determined.
  { id: "10188:campaignSetup:1", cardCode: "10188", lines: ["10188:A:2"], timing: "campaignSetup", instructions: [
    { verb: "WaiveThreatPenalty" },
    { verb: "ChooseCards", codes: CARN_DUM_BOONS, who: "eachSeat", to: "hand", optional: true, afterMulligan: true }] },
  // A Determination in a later scenario marks its host determined at that win too (10172:A:1): every later Resolution runs RecordDetermined (the Resolutions of 10174, 10182 and 10184 take it when their phases write them; 10193 ends the campaign and writes nothing).
  { id: "10188:resolution:1", cardCode: "10188", lines: ["10188:B:1"], timing: "resolution", instructions: [{ verb: "RecordHeroDamage" }, { verb: "RecordDetermined", code: DETERMINATION }] },

  // 10193 The Dread Realm. Setup: each player may search their deck for a boon and add it to their opening hand; each hero begins with the damage the log noted for it. Resolution: the players win the campaign (copied below).
  { id: "10193:campaignSetup:1", cardCode: "10193", lines: ["10193:A:2"], timing: "campaignSetup", instructions: [{ verb: "SearchBoonToHand" }, { verb: "PlaceLoggedHeroDamage" }] },
  // 10193:B:1 prints the line 11215:B:4 and 12195:B:1 print ("Resolution: The players win the campaign!"): it asks nothing and writes nothing, and the end screen reads the printed line.
  copyLine("11215:B:4", "10193:B:1"),
], { pool: THE_CITY_OF_CORSAIRS });

export const AUTHORED_REPLACES: readonly string[] = [];
