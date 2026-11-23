// Rules: rr.forced, rr.shadow-effects, rr.explored, rr.active-location, rr.travel, rr.engaged, rr.optional-engagement, rr.attachment-cards, rr.reveal, rr.setup,
// rr.lasting-effects, rr.in-player-order, mec109.stage-4 (data/rules/entries.json).
import { cardSpecs, announce, answer, attack, count, damageOn, deckCount, defend, exhausted, handCount, offers, progressOn, quest, resolve, revealedBy, reveal, stagingThreat, stat, threat, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Ring Goes South: one row for each printed line a single game moment shows (a line id, the table by zone, one action, what must hold afterwards); the lines that need a choice, a second step, a card the layout cannot
// place or the Ring-bearer are in card-lines-scenes.test.ts. The stand-in heroes dh1 and dh2 (and dh3 of a second seat) have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; every seat's threat starts at 28. The layout's stage
// is 142020 (no quest points), so questing progress beyond the active location goes on a stage that cannot advance; a row that explores a location sets its progress one quest of 4 Willpower short.
const ROWS: readonly Row[] = [
  // 142012 Mithril Shirt: "Attached hero gets +1 Defense and +1 hit point."
  { line: "142012:A:2", name: "the attached hero gets +1 Defense and +1 hit point and nothing else", layout: { attached: [{ code: "142012", to: "dh1" }] }, act: [], expect: [stat("dh1", "defense", 3), stat("dh1", "hitPoints", 7), stat("dh1", "attack", 2), stat("dh2", "defense", 2)] },
  // 142013 Glamdring: "Attached character gets +2 Attack."
  { line: "142013:A:2", name: "the attached character gets +2 Attack", layout: { attached: [{ code: "142013", to: "dh1" }] }, act: [], expect: [stat("dh1", "attack", 4), stat("dh1", "defense", 2), stat("dh2", "attack", 2)] },
  // 142014 Andúril: "Attached hero gets +1 Willpower, +1 Attack, and +1 Defense."
  { line: "142014:A:2", name: "the attached hero gets +1 Willpower, +1 Attack and +1 Defense", layout: { attached: [{ code: "142014", to: "dh1" }] }, act: [], expect: [stat("dh1", "willpower", 3), stat("dh1", "attack", 3), stat("dh1", "defense", 3), stat("dh1", "hitPoints", 6)] },

  // 142020 The Council of Elrond: "Setup: Set Lust for the Ring, Redhorn Pass, Doors of Durin and Watcher in the Water aside, out of play." The four are not in the encounter deck the piles deal: the Setup puts one of each aside.
  { line: "142020:A:1", name: "Setup sets one of each of the four cards aside out of play and adds none to the encounter deck", layout: { stage: "142020", side: "A", deck: ["f0"] }, act: resolve("142020", "setup"), expect: [count("142084", "setAside", 1), count("142029", "setAside", 1), count("142030", "setAside", 1), count("142024", "setAside", 1), deckCount(1)] },

  // 142021, 142022, 142023: "During the travel phase, the players must travel to a location, if able."
  { line: "142021:B:1", name: "the players cannot decline to travel while a location is in the staging area", layout: { stage: "142021", phase: "Travel", staging: ["place"] }, act: [], expect: [offers("Travel"), offers("DeclineTravel", undefined, false)] },
  { line: "142022:B:1", name: "the players cannot decline to travel while a location is in the staging area", layout: { stage: "142022", phase: "Travel", staging: ["place"] }, act: [], expect: [offers("Travel"), offers("DeclineTravel", undefined, false)] },
  // 142023: "There can be 2 active locations." A second location is traveled to while one is active, and the travel cannot be declined.
  { line: "142023:B:1", name: "the players travel to a second active location and cannot decline it", layout: { stage: "142023", phase: "Travel", active: "place", staging: ["142031"] }, act: [], expect: [offers("Travel"), offers("DeclineTravel", undefined, false)] },

  // 142022 The Hunt is Up!: "Forced: After a location enters play, place 1 damage on it."
  { line: "142022:B:2", name: "a location revealed from the encounter deck gets 1 damage", layout: { stage: "142022", deck: ["f0"] }, act: reveal("place"), expect: [zone("place", "staging"), damageOn("place", 1)] },

  // 142026 Hound of Sauron: "gets -5 engagement cost for each enemy in the staging area." Printed engagement cost 50; it is an enemy in the staging area itself, and an engaged enemy is not there.
  { line: "142026:A:2", name: "it gets -5 engagement cost for each enemy in the staging area, itself included", layout: { staging: ["142026", "f0", "f3"] }, act: [], expect: stat("142026", "engagementCost", 35) },
  { line: "142026:A:2", name: "an enemy engaged with a player does not count", layout: { staging: ["142026"], engaged: ["f0", "f3"] }, act: [], expect: stat("142026", "engagementCost", 45) },

  // 142028 Crebain from Dunland: "Forced: After Crebain from Dunland engages a player, reveal the top card of the encounter deck." The player it engaged reveals it.
  { line: "142028:A:3", name: "the top card is revealed by the player it engaged", layout: { seats: 2, engaged: [{ code: "142028", seat: 1 }], deck: ["f3", "f0"] }, act: announce("engaged", "142028", { seat: 1 }), expect: [zone("f3", "staging"), revealedBy("f3", 1), deckCount(1)] },

  // 142029 Redhorn Pass: "Forced: When Redhorn Pass is explored, each player assigns X damage among characters he controls. X is the number of damage here."
  { line: "142029:A:2", name: "each player assigns 2 damage among the characters he controls when it is explored with 2 damage", layout: { seats: 2, active: { code: "142029", damage: 2, progress: 5 } }, act: [quest("success"), answer("dh1"), answer("dh1")], expect: [zone("142029", "victory"), damageOn("dh1", 2), damageOn("dh2", 0), damageOn("dh3", 2)] },

  // 142031 Tree-crowned Hill: "While Tree-crowned Hill is the active location, each enemy gets -1 Threat."
  { line: "142031:A:1", name: "each enemy gets -1 Threat while it is the active location", layout: { active: "142031", staging: ["f3"] }, act: [], expect: [stat("f3", "threat", 2), stagingThreat(2)] },
  // "Forced: When Tree-crowned Hill is explored, the players, as a group, exhaust X characters in play." The committed heroes are exhausted already: the ally and the second player's hero are the 2.
  { line: "142031:A:2", name: "the players as a group exhaust 2 ready characters in play when it is explored with 2 damage", layout: { seats: 2, play: ["ally"], active: { code: "142031", damage: 2, progress: 3 } }, act: quest("success"), expect: [zone("142031", "encounterDiscard"), exhausted("ally"), exhausted("dh3")] },

  // 142032 Hills of Hollin: "While Hills of Hollin is the active location, each enemy in the staging area gets +5 engagement cost."
  { line: "142032:A:1", name: "an enemy in the staging area gets +5 engagement cost and an engaged one does not", layout: { active: "142032", staging: ["f0"], engaged: ["f3"] }, act: [], expect: [stat("f0", "engagementCost", 55), stat("f3", "engagementCost", 50)] },
  // "Forced: When Hills of Hollin is explored, each player raises his threat by 1 for each damage here."
  { line: "142032:A:2", name: "each player raises his threat by 3 when it is explored with 3 damage", layout: { seats: 2, active: { code: "142032", damage: 3, progress: 3 } }, act: quest("success"), expect: [zone("142032", "encounterDiscard"), threat(31, 0), threat(31, 1)] },

  // 142033 Redhorn Foothills: while active it gains "Forced: After an enemy is added to the staging area, it gets -5 engagement cost until the end of the round."
  { line: "142033:A:1", name: "an enemy revealed into the staging area gets -5 engagement cost while it is the active location", layout: { active: "142033", deck: ["f0"] }, act: reveal("f3"), expect: stat("f3", "engagementCost", 45) },
  // "Forced: When Redhorn Foothills is explored, each player must discard X cards from his hand at random."
  { line: "142033:A:2", name: "each player discards 2 cards from his hand when it is explored with 2 damage", layout: { seats: 2, hand: ["filler", "filler", "filler"], active: { code: "142033", damage: 2, progress: 4 } }, act: quest("success"), expect: [zone("142033", "encounterDiscard"), handCount(1, 0), handCount(1, 1)] },

  // 142034 Eregion: "Forced: When Eregion is explored, the players, as a group, must discard X allies from play."
  { line: "142034:A:1", name: "the players as a group discard 2 of their 3 allies and no hero when it is explored with 2 damage", layout: { seats: 2, play: [{ code: "ally", seat: 0 }, { code: "ally", seat: 1 }, { code: "ally", seat: 0 }], active: { code: "142034", damage: 2, progress: 3 } }, act: quest("success"), expect: [zone("142034", "encounterDiscard"), count("ally", "discard", 2), count("ally", "play", 1), zone("dh3", "heroes")] },

  // 142036 Snowdrifts: "No more than 3 progress can be placed on attached location each round." 4 Willpower quests: 3 on the location.
  { line: "142036:A:1", name: "no more than 3 progress is placed on the attached location in a round", layout: { active: "142031", attached: [{ code: "142036", to: "142031" }] }, act: quest("success"), expect: progressOn("142031", 3) },

  // 906402 Pale-green Tentacle: "Forced: After Pale-green Tentacle attacks and destroys a character, return Pale-green Tentacle to the staging area." Attack 5 destroys the ally (1 Defense, 2 hit points).
  { line: "906402:A:3", name: "it returns to the staging area after its attack destroys the defending ally", layout: { play: ["ally"] }, act: [attack("906402"), defend("ally")], expect: [zone("ally", "discard"), zone("906402", "staging")] },

  // 906403 Hunting Hawk: "Cannot have attachments or be optionally engaged."
  { line: "906403:A:1", name: "no player can optionally engage it", layout: { phase: "Encounter", staging: ["906403"] }, act: [], expect: [offers("Engage", undefined, false), offers("DeclineEngage")] },

  // 906404 Misty Mountain Warg: "Shadow: If this attack destroys a character, place 1 damage on an active location." Hound of Sauron's 4 Attack destroys the ally.
  { line: "906404:A:2", name: "its Shadow places 1 damage on the active location when the attack destroys a character", layout: { active: "place", play: ["ally"] }, act: [attack("142026", { shadow: "906404" }), defend("ally")], expect: [zone("ally", "discard"), damageOn("place", 1)] },

  // 906406 Slopes of Hithaeglir: "Forced: After a 'when revealed' effect is canceled, place 1 damage on each active location."
  { line: "906406:A:1", name: "the active location gets 1 damage after a when revealed effect is canceled, Slopes in the staging area", layout: { staging: ["906406"], active: "place" }, act: announce("whenRevealedCanceled"), expect: [damageOn("place", 1), damageOn("906406", 0)] },
  // "Forced: When Slopes of Hithaeglir is explored, each player raises his threat by 1 for each damage here."
  { line: "906406:A:2", name: "each player raises his threat by 2 when it is explored with 2 damage", layout: { seats: 2, active: { code: "906406", damage: 2, progress: 1 } }, act: quest("success"), expect: [zone("906406", "encounterDiscard"), threat(30, 0), threat(30, 1)] },

  // 906407 Hunted in Hollin: "Shadow: Raise your threat by 1 for each enemy engaged with you." Every enemy is dealt a Hunted in Hollin and every attack is played: the first player's two attacks raise his threat by 2 each, the second player's one by 1.
  { line: "906407:A:3", name: "the defending player raises his threat by 1 for each enemy engaged with him, not with another player", layout: { seats: 2, engaged: [{ code: "f3", seat: 0 }, { code: "f0", seat: 0 }, { code: "f0", seat: 1 }], deck: ["906407", "906407", "f0", "f0"] }, act: attack("f3", { shadow: "906407", undefended: true }), expect: [threat(32, 0), threat(29, 1)] },

  // 906408 Shelterless Land: "When Revealed: Until the end of the phase, add 1 to the total Threat in the staging area for each damage on each active location." It has surge: the 0-Threat f0 is revealed after it.
  { line: "906408:A:2", name: "the total Threat in the staging area rises by the 2 damage on the active location", layout: { active: { code: "place", damage: 2 }, deck: ["f0", "f0"] }, act: reveal("906408"), expect: stagingThreat(2) },
  // "Shadow: Attacking enemy gets +1 Attack for each damage on each active location."
  { line: "906408:A:3", name: "its Shadow gives the attacker +2 Attack for the 2 damage on the active location", layout: { active: { code: "place", damage: 2 } }, act: attack("f0", { shadow: "906408", undefended: true }), expect: damageOn("dh1", 3) },
];

cardSpecs("the-ring-goes-south", ROWS);
