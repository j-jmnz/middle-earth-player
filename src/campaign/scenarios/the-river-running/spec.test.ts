// Rules: rr.forced, rr.travel, rr.shadow-effects, rr.reveal, rr.attachment-cards, rr.optional-engagement, rr.first-player, rr.cost, faq.enemy-attacks-outside-combat (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, damageOn, deckCount, exhausted, offers, reveal, respond, resolve, resourcesOn, stagingThreat, stat, threat, travel, attachedTo, defend, flag, window, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The River Running (vengeance-of-mordor part 1): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
// What a row cannot express (a cap tallied over many characters, a damage cancel, a two-Rider search, the setup piles) is a test titled with its line id in lines.test.ts. The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; a layout's current stage is on its B side.
const S1 = "21075";
const S2 = "21076";
const PURSUIT = "21012";
const OUTRIDER = "21013";
const RIVER = "21014";
const RIVERBANK = "21015";
const CAPTAIN = "21017";
const RIDER = "21018";
const HORSE = "21019";
const RAIDER = "21020";
const SWORD = "21022";
const BOW = "21023";
const WARRIORS = "21024";
const horseOn = (to: string) => ({ code: HORSE, to, encounter: true as const });

const ROWS: readonly Row[] = [
  { line: "21012:A:1", name: "Forced at the end of the round: 1 resource, then with 3 the resources come off and an enemy is discarded and added to the staging area", layout: { stage: S1, staging: [{ code: PURSUIT, resources: 2 }], deck: [RAIDER] }, act: announce("endOfRound", PURSUIT), expect: [resourcesOn(PURSUIT, 0), zone(RAIDER, "staging")] },
  { line: "21012:A:1", name: "Forced at the end of the round: with fewer than 3 resources only the resource is placed", layout: { stage: S1, staging: [{ code: PURSUIT, resources: 0 }], deck: [RAIDER, "f0"] }, act: announce("endOfRound", PURSUIT), expect: [resourcesOn(PURSUIT, 1), deckCount(2)] },

  { line: "21013:A:2", name: "Forced after it engages a player: 1 resource on Easterling Pursuit", layout: { stage: S1, staging: [PURSUIT], engaged: [OUTRIDER] }, act: [announce("engaged", OUTRIDER), answer("pursuit")], expect: resourcesOn(PURSUIT, 1) },
  { line: "21013:A:2", name: "Forced after it engages a player: or it makes an immediate attack", layout: { stage: S1, staging: [PURSUIT], engaged: [OUTRIDER] }, act: [announce("engaged", OUTRIDER), answer("attack")], expect: [resourcesOn(PURSUIT, 0), window("defense")] },
  { line: "21013:A:3", name: "Shadow: the defending player discards an attachment they control", layout: { stage: S1, attached: [{ code: "attachment", to: "dh1" }] }, act: attack("f3", { shadow: OUTRIDER, undefended: true }), expect: zone("attachment", "discard") },

  { line: "21014:A:1", name: "While in the staging area enemies cannot be optionally engaged", layout: { stage: S1, phase: "Encounter", staging: [RIVER, OUTRIDER] }, act: [], expect: offers("Engage", undefined, false) },
  { line: "21014:A:2", name: "Travel: the first player engages the highest engagement cost enemy in the staging area", layout: { stage: S1, phase: "Travel", staging: [RIVER, OUTRIDER, RIDER] }, act: travel(RIVER), expect: [zone(RIDER, "engaged"), zone(OUTRIDER, "staging")] },

  { line: "21015:A:1", name: "In the staging area, a canceled when revealed effect puts 1 resource on Easterling Pursuit", layout: { stage: S1, staging: [RIVERBANK, PURSUIT] }, act: announce("whenRevealedCanceled"), expect: resourcesOn(PURSUIT, 1) },
  { line: "21015:A:2", name: "Travel: 1 resource on Easterling Pursuit while it lies in the staging area", layout: { stage: S1, phase: "Travel", staging: [RIVERBANK, PURSUIT] }, act: resolve(RIVERBANK, "travel"), expect: resourcesOn(PURSUIT, 1) },
  { line: "21015:A:2", name: "Travel: the players cannot travel here while Easterling Pursuit is not in play", layout: { stage: S1, phase: "Travel", staging: [RIVERBANK] }, act: [], expect: offers("Travel", undefined, false) },

  { line: "21016:A:1", name: "When Revealed: 1 resource on Easterling Pursuit, then each player raises threat by its resources", layout: { stage: S1, staging: [{ code: PURSUIT, resources: 1 }], seats: 2 }, act: reveal("21016"), expect: [resourcesOn(PURSUIT, 2), threat(30, 0), threat(30, 1)] },
  { line: "21016:A:2", name: "Shadow: the attacker gets +1 Attack", layout: { stage: S1, staging: [PURSUIT] }, act: attack("f3", { shadow: "21016", undefended: true }), expect: [damageOn("dh1", 2), resourcesOn(PURSUIT, 0)] },
  { line: "21016:A:2", name: "Shadow: a character destroyed by the attack puts 1 resource on Easterling Pursuit", layout: { stage: S1, staging: [PURSUIT], play: ["ally"] }, act: [attack(CAPTAIN, { shadow: "21016" }), defend("ally")], expect: resourcesOn(PURSUIT, 1) },

  { line: "21018:A:2", name: "-10 engagement cost for each Easterling attachment", layout: { stage: S1, staging: [RIDER], attached: [horseOn(RIDER)] }, act: [], expect: stat(RIDER, "engagementCost", 30) },
  { line: "21018:A:3", name: "When Revealed: the Easterling Horse in the deck is attached to it", layout: { stage: S1, deck: ["f0", HORSE] }, act: reveal(RIDER), expect: attachedTo(HORSE, RIDER) },

  { line: "21019:A:1", name: "Attached: the enemy gets +2 Threat", layout: { stage: S1, staging: [RAIDER], attached: [horseOn(RAIDER)] }, act: [], expect: stat(RAIDER, "threat", 4) },
  { line: "21019:A:1", name: "Attached: at the end of the round the enemy returns to the staging area", layout: { stage: S1, engaged: [RAIDER], attached: [horseOn(RAIDER)] }, act: announce("endOfRound"), expect: [zone(RAIDER, "staging"), attachedTo(HORSE, RAIDER)] },
  { line: "21019:A:2", name: "When Revealed: attaches to the lowest engagement cost Easterling enemy, which returns to the staging area", layout: { stage: S1, engaged: [OUTRIDER], staging: [RAIDER] }, act: reveal(HORSE), expect: [attachedTo(HORSE, OUTRIDER), zone(OUTRIDER, "staging")] },
  { line: "21019:A:2", name: "When Revealed: with no candidate it gains Surge", layout: { stage: S1, deck: ["f0", "f0", "f0"] }, act: reveal(HORSE), expect: deckCount(2) },

  { line: "21020:A:2", name: "+1 Attack and +1 Defense for each Easterling attachment", layout: { stage: S1, staging: [RAIDER], attached: [horseOn(RAIDER)] }, act: [], expect: [stat(RAIDER, "attack", 3), stat(RAIDER, "defense", 3)] },
  { line: "21020:A:3", name: "Shadow: the attacker gets +1 Attack", layout: { stage: S1 }, act: attack("f3", { shadow: RAIDER, undefended: true }), expect: damageOn("dh1", 2) },
  { line: "21020:A:3", name: "Shadow: +2 Attack in all when the attacker has an Easterling attachment", layout: { stage: S1, attached: [horseOn("f3")] }, act: attack("f3", { shadow: RAIDER, undefended: true }), expect: damageOn("dh1", 3) },

  { line: "21022:A:2", name: "Attached: the enemy gets +2 Attack", layout: { stage: S1, staging: [OUTRIDER], attached: [{ code: SWORD, to: OUTRIDER, encounter: true }] }, act: [], expect: stat(OUTRIDER, "attack", 4) },
  { line: "21022:A:3", name: "When Revealed: attaches to the Easterling enemy with the lowest Attack", layout: { stage: S1, staging: [RIDER, OUTRIDER] }, act: reveal(SWORD), expect: attachedTo(SWORD, OUTRIDER) },
  { line: "21023:A:2", name: "Attached: the enemy gains Archery 2", layout: { stage: S1, staging: [OUTRIDER], attached: [{ code: BOW, to: OUTRIDER, encounter: true }] }, act: [], expect: stat(OUTRIDER, "archery", 2) },
  { line: "21023:A:3", name: "When Revealed: attaches to the Easterling enemy with the highest engagement cost", layout: { stage: S1, staging: [OUTRIDER, RIDER] }, act: reveal(BOW), expect: attachedTo(BOW, RIDER) },

  { line: "21024:A:3", name: "Forced after it becomes the current quest: the highest Attack Easterling enemy in the staging area attacks the first player", layout: { stage: S1, staging: [WARRIORS, RAIDER, RIDER] }, act: announce("becameCurrentQuest", WARRIORS), expect: window("defense") },

  { line: "21025:A:2", name: "Travel: each player raises threat by 2", layout: { stage: S1, phase: "Travel", staging: ["21025"], seats: 2 }, act: resolve("21025", "travel"), expect: [threat(30, 0), threat(30, 1)] },

  { line: "21026:A:1", name: "In the staging area, characters cannot be readied by player card effects", layout: { stage: S1, staging: ["21026"] }, act: [], expect: flag("dh1", "cannotReadyByPlayerCard") },
  { line: "21026:A:2", name: "Travel: the first player exhausts a hero they control", layout: { stage: S1, phase: "Travel", staging: ["21026"] }, act: resolve("21026", "travel"), expect: exhausted("dh1") },
  { line: "21026:A:2", name: "Travel: the players cannot travel here with no ready hero", layout: { stage: S1, phase: "Travel", staging: ["21026"], exhaustedCards: ["dh1", "dh2"] }, act: [], expect: offers("Travel", undefined, false) },

  { line: "21027:A:3", name: "Shadow: 1 damage to the defending character", layout: { stage: S1 }, act: attack("f3", { shadow: "21027" }), expect: damageOn("dh1", 1) },

  { line: "21028:A:1", name: "When Revealed: each player exhausts a character and deals 1 damage to it", layout: { stage: S1, seats: 2 }, act: reveal("21028"), expect: [exhausted("dh1"), damageOn("dh1", 1)] },
  { line: "21028:A:1", name: "When Revealed: a player with no ready character takes no damage on a card another player chose", layout: { stage: S1, seats: 2, exhaustedCards: ["dh3"] }, act: reveal("21028"), expect: [damageOn("dh1", 1), damageOn("dh3", 0)] },
  { line: "21028:A:2", name: "Shadow: the defending player exhausts a character", layout: { stage: S1 }, act: [attack("f3", { shadow: "21028", undefended: true }), answer("exhaust"), answer("dh2")], expect: exhausted("dh2") },
  { line: "21028:A:2", name: "Shadow: or the attacking enemy returns to the staging area after the attack", layout: { stage: S1 }, act: [attack("f3", { shadow: "21028", undefended: true }), answer("staging")], expect: zone("f3", "staging") },

  { line: "21029:A:2", name: "Response: when it is defeated each player may ready a hero", layout: { stage: S1, seats: 2, staging: [{ code: "21029", progress: 6 }], exhaustedCards: ["dh1", "dh3"] }, act: [announce("questDefeated", "21029"), respond("21029")], expect: [exhausted("dh1", false), exhausted("dh3", false)] },

  { line: "21075:B:1", name: "This stage gets +5 quest points per player", layout: { stage: S1, seats: 2 }, act: [], expect: stat(S1, "questPoints", 15) },
  { line: "21075:B:2", name: "+1 Threat in the staging area for each resource on Easterling Pursuit", layout: { stage: S1, staging: [{ code: PURSUIT, resources: 3 }] }, act: [], expect: stagingThreat(3) },

  { line: "21076:A:1", name: "When Revealed: Warriors of the East is added to the staging area, then an enemy is discarded from the deck and added", layout: { stage: S2, side: "A", setAside: [WARRIORS], deck: ["f0", RAIDER] }, act: resolve(S2, "whenRevealed"), expect: [zone(WARRIORS, "staging")] },
  { line: "21076:B:1", name: "Each enemy in the staging area gets -10 engagement cost", layout: { stage: S2, staging: [OUTRIDER] }, act: [], expect: stat(OUTRIDER, "engagementCost", 14) },
];

if (ROWS.length > 0) cardSpecs("the-river-running", ROWS);
else describe("the-river-running card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
