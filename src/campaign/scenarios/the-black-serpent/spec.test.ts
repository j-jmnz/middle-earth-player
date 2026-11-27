// Rules: hrd.guarded-x, hrd.guarded-x-example, hrd.stage-number, rr.guarded, rr.objective-cards, rr.attachment-cards, rr.engaged, rr.first-player, rr.forced, rr.shadow-effects, rr.cancel, rr.travel, rr.action (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attachedTo, attack, cardSpecs, damageOn, deckCount, defend, exhausted, flag, notWon, progressOn, quest, resolve, reveal, resourcesOn, stat, threat, window, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Black Serpent (haradrim part 7): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests). The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; f0 is a 1 Attack enemy,
// f3 a 1 Attack enemy with 3 Threat. A Harad enemy is Serpent Guard (17095: 3 Attack, 2 Threat). A Harad objective on a hero is `attached: [{ code, to: "dh1" }]`; one that an encounter card guards is the objective revealed with its guard on top of the deck; one hung on an
// encounter card is `attached: [{ code, to, encounter: true }]`. What a row cannot say (who may use an Action, the printed cap with a side quest current, the real play of an ally or an event, a player card in the staging area) is in lines.test.ts, titled with the line id.
const BANNER = "17091";
const GARB = "17092";
const SUMMONS = "17093";
const SERPENT = "17094";
const GUARD = "17095";
const REDOUBT = "17096";
const TOWER = "17097";
const BASTION = "17098";
const CAMP = "17099";
const COURTYARD = "17100";
const SIDE_QUEST = "17104";
const STAGE_1 = "17106";
const STAGE_2 = "17107";
const STAGE_3 = "17108";
// A Harad objective a hero holds: it lies free in the staging area and the stage's claim line (a settle sweep) attaches it to the first hero of the first player.
const CLAIM = announce("beginningOfPhase");
// The same objective placed on the hero directly, for a row that starts with an attack (an attack is the first action of a row).
const ON_HERO = (code: string) => ({ code, to: "dh1" });
const HUNG_ON = (code: string, to: string) => ({ code, to, encounter: true as const });

const ROWS: readonly Row[] = [
  // 17091 Banner of the Serpent.
  { line: "17091:A:3", name: "Action: each Harad enemy engaged with you gets -1 Attack until the end of the phase", layout: { engaged: [GUARD], staging: [BANNER] }, act: [CLAIM, resolve(BANNER, "action")], expect: stat(GUARD, "attack", 2) },

  { line: "17091:A:1", name: "Guarded (enemy or location): the first enemy or location discarded guards it", layout: { staging: [BANNER], deck: ["treachery", "place", "f0"] }, act: resolve(BANNER, "whenRevealed"), expect: [attachedTo("place", BANNER), zone("treachery", "encounterDiscard"), deckCount(1)] },
  { line: "17091:A:2", name: "While attached to an encounter card that guards it in the staging area: each Harad enemy gets +1 Attack", layout: { staging: [BANNER, GUARD], deck: ["f0"] }, act: resolve(BANNER, "whenRevealed"), expect: stat(GUARD, "attack", 4) },
  { line: "17091:A:2", name: "While attached to an encounter card it hangs on in the staging area: each Harad enemy gets +1 Attack", layout: { staging: [GUARD, "place"], attached: [HUNG_ON(BANNER, "place")] }, act: [], expect: stat(GUARD, "attack", 4) },

  // 17092 The Serpent's Garb.
  { line: "17092:A:1", name: "Guarded (enemy): the first enemy discarded guards it, a location discarded before it is not a guard", layout: { staging: [GARB], deck: ["place", "f0", "f3"] }, act: resolve(GARB, "whenRevealed"), expect: [attachedTo("f0", GARB), zone("place", "encounterDiscard"), deckCount(1)] },
  { line: "17092:A:2", name: "While attached to an encounter card that guards it in the staging area: +2 Threat and immune to player card effects", layout: { staging: [GARB], deck: ["f0"] }, act: resolve(GARB, "whenRevealed"), expect: [stat("f0", "threat", 2), flag("f0", "immuneToPlayerCards")] },
  { line: "17092:A:3", name: "Action: a Harad enemy in the staging area gets -2 Threat until the end of the phase", layout: { staging: [GUARD, GARB] }, act: [CLAIM, resolve(GARB, "action")], expect: stat(GUARD, "threat", 0) },

  // 17093 Summons from Mordor.
  { line: "17093:A:1", name: "Guarded (location): the first location discarded guards it, an enemy discarded before it is not a guard", layout: { staging: [SUMMONS], deck: ["f0", "place", "f3"] }, act: resolve(SUMMONS, "whenRevealed"), expect: [attachedTo("place", SUMMONS), zone("f0", "encounterDiscard"), deckCount(1)] },
  { line: "17093:A:3", name: "Action: add 1 resource to the pool of the hero it is attached to", layout: { staging: [SUMMONS] }, act: [CLAIM, resolve(SUMMONS, "action")], expect: [resourcesOn("dh1", 1), resourcesOn("dh2", 0)] },

  // 17094 The Black Serpent (the attack from the staging area and the stage 2B engagement are in black-serpent.test.ts, src/rules/families/haradrim).
  { line: "17094:A:1", name: "Cannot leave the staging area or take damage", layout: { staging: [SERPENT] }, act: [], expect: [flag(SERPENT, "cannotLeaveStaging"), flag(SERPENT, "neverEngaged"), flag(SERPENT, "cannotTakeDamage")] },
  { line: "17094:A:2", name: "X is the stage number of the main quest: at stage 2 it gets +2 Threat, +2 Attack and +2 Defense", layout: { stage: STAGE_2, staging: [SERPENT] }, act: [], expect: [stat(SERPENT, "threat", 2), stat(SERPENT, "attack", 4), stat(SERPENT, "defense", 3)] },
  { line: "17094:A:3", name: "Forced at the end of the encounter phase: the first player removes X progress from the main quest", layout: { phase: "Encounter", progress: 4, stage: STAGE_2, staging: [SERPENT, "f0"] }, act: [announce("endOfPhase"), answer("progress")], expect: progressOn(STAGE_2, 2) },
  { line: "17094:A:3", name: "Forced at the end of the encounter phase: or the Black Serpent attacks the first player from the staging area", layout: { phase: "Encounter", progress: 4, staging: [SERPENT, "f0"] }, act: [announce("endOfPhase"), answer("attack")], expect: [window("defense"), progressOn(STAGE_1, 4)] },

  // 17095 Serpent Guard.
  { line: "17095:A:1", name: "Forced after it engages you: remove 2 progress from the main quest", layout: { progress: 4, engaged: [GUARD] }, act: [announce("engaged", GUARD), answer("progress")], expect: progressOn(STAGE_1, 2) },
  { line: "17095:A:1", name: "Forced after it engages you: or the enemies engaged with you cannot take damage this round", layout: { progress: 4, engaged: [GUARD, "f0"] }, act: [announce("engaged", GUARD), answer("noDamage")], expect: [flag("f0", "cannotTakeDamage"), flag(GUARD, "cannotTakeDamage"), progressOn(STAGE_1, 4)] },
  { line: "17095:A:2", name: "Shadow: the defending player removes 2 progress from the main quest", layout: { progress: 4 }, act: [attack("f0", { shadow: GUARD, undefended: true }), answer("progress")], expect: progressOn(STAGE_1, 2) },

  // 17096 The Serpent's Redoubt.
  { line: "17096:A:1", name: "While in the staging area: after a player plays an ally he removes 1 progress from the main quest", layout: { progress: 3, staging: [REDOUBT], play: ["ally"] }, act: [announce("played", "ally"), answer("progress")], expect: [progressOn(STAGE_1, 2), exhausted("ally", false)] },
  { line: "17096:A:1", name: "While in the staging area: or he exhausts that ally", layout: { progress: 3, staging: [REDOUBT], play: ["ally"] }, act: [announce("played", "ally"), answer("exhaust")], expect: [exhausted("ally"), progressOn(STAGE_1, 3)] },
  { line: "17096:A:2", name: "Travel: the first player searches the encounter deck for an enemy and puts it into play engaged with him, and the deck is shuffled", layout: { staging: [REDOUBT], deck: ["treachery", "f3", "place"] }, act: [resolve(REDOUBT, "travel")], expect: [zone("f3", "engaged"), deckCount(2)] },

  // 17097 Roofless Tower (the cancel option is in lines.test.ts: it needs an event that is really played).
  { line: "17097:A:1", name: "While in the staging area: when a player plays an event he removes 1 progress from the main quest", layout: { progress: 3, staging: [TOWER], hand: ["event"] }, act: [announce("played", "event"), answer("progress")], expect: progressOn(STAGE_1, 2) },
  { line: "17097:A:2", name: "Travel: exhaust a hero", layout: { staging: [TOWER] }, act: [resolve(TOWER, "travel"), answer("dh2")], expect: [exhausted("dh2"), exhausted("dh1", false)] },

  // 17098 Desert Bastion.
  { line: "17098:A:1", name: "+1 Threat for each Harad objective the players control", layout: { staging: [BASTION, BANNER, GARB] }, act: CLAIM, expect: stat(BASTION, "threat", 3) },
  { line: "17098:A:2", name: "Shadow: the attacking enemy gets +1 Attack for each Harad objective the players control", layout: { attached: [ON_HERO(BANNER), ON_HERO(GARB)] }, act: attack("f0", { shadow: BASTION, undefended: true }), expect: damageOn("dh1", 3) },

  // 17099 Southron Camp.
  { line: "17099:A:1", name: "While in the staging area: at the end of the round all progress comes off each location in play, the staging area's and the active one", layout: { staging: [CAMP, { code: "place", progress: 1 }], active: { code: COURTYARD, progress: 2 } }, act: announce("endOfRound"), expect: [progressOn("place", 0), progressOn(COURTYARD, 0)] },
  { line: "17099:A:2", name: "Travel: raise each player's threat by 1", layout: { staging: [CAMP] }, act: resolve(CAMP, "travel"), expect: threat(29) },

  // 17100 Broken Courtyard (Surge is a keyword). The cap is in lines.test.ts.
  { line: "17100:A:3", name: "Shadow: the defending player removes 2 progress from the main quest", layout: { progress: 3 }, act: [attack("f0", { shadow: COURTYARD, undefended: true }), answer("progress")], expect: [progressOn(STAGE_1, 1), zone("f0", "engaged")] },
  { line: "17100:A:3", name: "Shadow: or the attacking enemy returns to the staging area after the attack", layout: { progress: 3 }, act: [attack("f0", { shadow: COURTYARD, undefended: true }), answer("staging")], expect: [zone("f0", "staging"), progressOn(STAGE_1, 3)] },

  // 17101 Bold and Grim (Doomed 1 and Surge are keywords).
  { line: "17101:A:2", name: "When Revealed: 1 damage to each hero with an objective attached", layout: { staging: [BANNER, "17101"] }, act: [CLAIM, resolve("17101", "whenRevealed")], expect: [damageOn("dh1", 1), damageOn("dh2", 0)] },
  { line: "17101:A:3", name: "Shadow: a non-unique attacker is attached to a Harad objective the defender controls, guarding it (the Banner then gives it +1 Attack)", layout: { attached: [ON_HERO(BANNER)] }, act: [attack(GUARD, { shadow: "17101", undefended: true }), answer("attach")], expect: [attachedTo(GUARD, BANNER), damageOn("dh1", 4)] },
  { line: "17101:A:3", name: "Shadow: or it makes an additional attack after this one", layout: { attached: [ON_HERO(BANNER)] }, act: [attack(GUARD, { shadow: "17101", undefended: true }), answer("attack")], expect: damageOn("dh1", 6) },

  // 17102 No Quarter. The When Revealed line is in black-serpent.test.ts (RevealDetached).
  { line: "17102:A:2", name: "Shadow: if the attack destroys a character, a Harad objective the defender controls is attached to a non-unique encounter card in the staging area (never a player card there)", layout: { attached: [ON_HERO(BANNER)], staging: ["attachment", "f3"], play: [{ code: "ally", damage: 1 }] }, act: [attack(GUARD, { shadow: "17102" }), defend("ally")], expect: [attachedTo("f3", BANNER), zone("ally", "discard")] },

  // 17102 No Quarter, When Revealed (RevealDetached is also in black-serpent.test.ts, src/rules/families/haradrim).
  { line: "17102:A:1", name: "When Revealed: the first player reveals 2 encounter cards (no Harad objective is on a hero, so the other option is not offered)", layout: { stage: STAGE_2, deck: ["17102", "f0", "f3"] }, act: reveal("17102"), expect: [zone("f0", "staging"), zone("f3", "staging")] },
  { line: "17102:A:1", name: "When Revealed: or a Harad objective is detached from a hero, revealed (its Guarded resolves) and added to the staging area", layout: { stage: STAGE_2, deck: ["17102", "f0", "f3"], attached: [ON_HERO(BANNER)] }, act: [reveal("17102"), answer("detach")], expect: [zone(BANNER, "staging"), attachedTo("f0", BANNER), deckCount(1)] },

  // 17103 Chaos in the Night.
  { line: "17103:A:1", name: "When Revealed: the first player raises each player's threat by 3", layout: { deck: ["17103", "f0"] }, act: [reveal("17103"), answer("threat")], expect: [threat(31), flag("table", "noQuestProgress", false)] },
  { line: "17103:A:1", name: "When Revealed: or progress cannot be placed on quest cards (the main quest, current or not) until the end of the round", layout: { deck: ["17103", "f0"] }, act: [reveal("17103"), answer("noProgress")], expect: [flag("table", "noQuestProgress"), flag("table", "noMainQuestProgress"), threat(28)] },
  { line: "17103:A:2", name: "Shadow: the attacker gets +1 Attack and, when the attack destroys a character, all progress comes off the main quest", layout: { progress: 3, play: [{ code: "ally", damage: 1 }] }, act: [attack(GUARD, { shadow: "17103" }), defend("ally")], expect: [progressOn(STAGE_1, 0), zone("ally", "discard")] },
  { line: "17103:A:2", name: "Shadow: the attacker gets +1 Attack, and no progress comes off when no character is destroyed", layout: { progress: 3 }, act: attack("f0", { shadow: "17103", undefended: true }), expect: [damageOn("dh1", 2), progressOn(STAGE_1, 3)] },

  // 17104 Don't Let Them Escape! (the staged side quest as the current quest is in lines.test.ts).
  { line: "17104:A:1", name: "Forced at the end of the round: all progress comes off the main quest while it lies in the staging area", layout: { progress: 3, staging: [SIDE_QUEST] }, act: announce("endOfRound"), expect: progressOn(STAGE_1, 0) },
  { line: "17104:A:2", name: "Forced after it becomes the current quest: an encounter card is revealed", layout: { staging: [SIDE_QUEST], deck: ["f0", "f3"] }, act: announce("becameCurrentQuest", SIDE_QUEST), expect: [zone("f0", "staging"), deckCount(1)] },

  // 17106 The Crossroads Fort.
  { line: "17106:A:1", name: "Setup: the first player reveals a random set aside Harad objective and adds it to the staging area, its Guarded (location) resolves", layout: { side: "A", setAside: [SUMMONS], staging: [SERPENT], deck: ["f0", "place", "f3"] }, act: resolve(STAGE_1, "setup"), expect: [zone(SUMMONS, "staging"), attachedTo("place", SUMMONS), zone("f0", "encounterDiscard")] },
  { line: "17106:A:1", name: "Setup: with no card of its type in the deck or the discard pile the objective is unguarded, so the stage claims it for a hero", layout: { side: "A", setAside: [SUMMONS], staging: [SERPENT], deck: ["f0"] }, act: resolve(STAGE_1, "setup"), expect: [attachedTo(SUMMONS, "dh1"), deckCount(1)] },
  { line: "17106:B:1", name: "A Harad objective that is not attached is claimed by the first player and attached to a hero he controls", layout: { staging: [BANNER] }, act: CLAIM, expect: attachedTo(BANNER, "dh1") },
  { line: "17106:B:2", name: "The stage cannot be defeated while a Harad objective hangs on an encounter card", layout: { progress: 6, staging: ["place"], attached: [HUNG_ON(SUMMONS, "place")] }, act: quest("success"), expect: [zone(STAGE_1, "questStage"), zone(STAGE_2, "questDeck")] },

  // 17107 Battle in the Camp.
  { line: "17107:A:1", name: "When Revealed: the discard pile is shuffled into the deck and the first player reveals a random set aside Harad objective", layout: { stage: STAGE_2, side: "A", setAside: [BANNER], discard: ["f3"], deck: ["f0"] }, act: resolve(STAGE_2, "whenRevealed"), expect: [zone(BANNER, "staging"), deckCount(1)] },
  { line: "17107:B:1", name: "A Harad objective that is not attached is claimed by the first player and attached to a hero he controls", layout: { stage: STAGE_2, staging: [BANNER] }, act: CLAIM, expect: attachedTo(BANNER, "dh1") },
  { line: "17107:B:2", name: "The Black Serpent is considered engaged with each player who controls a Harad objective and adds no Threat to the staging area", layout: { stage: STAGE_2, staging: [SERPENT, BANNER] }, act: CLAIM, expect: [flag(SERPENT, "engagedWithClaimers"), flag(SERPENT, "noThreatContribution")] },
  { line: "17107:B:3", name: "The stage cannot be defeated while a Harad objective hangs on an encounter card", layout: { stage: STAGE_2, progress: 6, staging: ["place"], attached: [HUNG_ON(SUMMONS, "place")] }, act: quest("success"), expect: [zone(STAGE_2, "questStage"), zone(STAGE_3, "questDeck")] },

  // 17108 Defeat the Serpent.
  { line: "17108:A:1", name: "When Revealed: a random set aside Harad objective is attached to The Black Serpent (not revealed), the discard pile is shuffled in and each player reveals 1 encounter card", layout: { stage: STAGE_3, side: "A", setAside: [SUMMONS], staging: [SERPENT], discard: ["f0"], deck: ["f3"] }, act: resolve(STAGE_3, "whenRevealed"), expect: [attachedTo(SUMMONS, SERPENT), deckCount(1)] },
  { line: "17108:B:2", name: "With 6 progress on the stage The Black Serpent loses its first sentence", layout: { stage: STAGE_3, progress: 6, staging: [SERPENT] }, act: [], expect: [flag(SERPENT, "losesNoDamage"), flag(SERPENT, "losesCannotLeaveStaging")] },
  { line: "17108:B:1", name: "A Harad objective that is not attached is claimed by the first player and attached to a hero he controls", layout: { stage: STAGE_3, staging: [GARB] }, act: CLAIM, expect: attachedTo(GARB, "dh1") },
  { line: "17108:B:3", name: "The stage cannot be defeated while the objective hangs on The Black Serpent in the staging area", layout: { stage: STAGE_3, progress: 5, staging: [SERPENT], attached: [HUNG_ON(SUMMONS, SERPENT)] }, act: quest("success"), expect: [notWon, progressOn(STAGE_3, 6)] },
];

if (ROWS.length > 0) cardSpecs("the-black-serpent", ROWS);
else describe("the-black-serpent card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
