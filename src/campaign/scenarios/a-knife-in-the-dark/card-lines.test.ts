// Rules: rr.shadow-effects, rr.attachment-cards, rr.constant-ability, rr.then, rr.travel, rr.search, rr.in-play-and-out-of-play, mec109.setup (data/rules/entries.json).
// Card specs for A Knife in the Dark (fellowship part 2) and its Nightmare deck, read from the printed lines (data/printed/fellowship-of-the-ring.json, data/printed/nightmare.json): 141018:A:2, 141018:A:3,
// 141019:A:2, 141019:A:3, 141020:A:2, 141020:A:3, 141021:A:2, 141021:A:3, 141025:A:1, 141054:A:3, 906203:A:2, 906205:A:1, 906205:A:3, 906206:A:1, 906206:A:2, 906207:A:1, 906207:A:2, 906208:A:2.
// The stand-in heroes dh1 and dh2 have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; dh3 is the second seat's. `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes.
import { cardSpecs, attack, announce, damageOn, defend, quest, resolve, resourcesOn, reveal, stat, travel, zone, progressOn, type Row } from "../../../../test/harness/card-spec.ts";

const ROWS: readonly Row[] = [
  // The four boons: "Setup: Attach to a hero." and "Attached hero gets +1 Defense / +2 hit points / +1 Attack / +1 Willpower and gains the <trait> trait."
  { line: "141018:A:2", name: "its Setup attaches it to a hero, who then gets its +1 Defense", act: resolve("141018", "setup"), expect: [zone("141018", "attached"), stat("dh1", "defense", 3)] },
  { line: "141019:A:2", name: "its Setup attaches it to a hero, who then gets its +2 hit points", act: resolve("141019", "setup"), expect: [zone("141019", "attached"), stat("dh1", "hitPoints", 8)] },
  { line: "141020:A:2", name: "its Setup attaches it to a hero, who then gets its +1 Attack", act: resolve("141020", "setup"), expect: [zone("141020", "attached"), stat("dh1", "attack", 3)] },
  { line: "141021:A:2", name: "its Setup attaches it to a hero, who then gets its +1 Willpower", act: resolve("141021", "setup"), expect: [zone("141021", "attached"), stat("dh1", "willpower", 3)] },
  { line: "141018:A:3", name: "the attached hero gets +1 Defense and the other hero does not", layout: { attached: [{ code: "141018", to: "dh1" }] }, act: [], expect: [stat("dh1", "defense", 3), stat("dh2", "defense", 2)] },
  { line: "141019:A:3", name: "the attached hero gets +2 hit points and the other hero does not", layout: { attached: [{ code: "141019", to: "dh1" }] }, act: [], expect: [stat("dh1", "hitPoints", 8), stat("dh2", "hitPoints", 6)] },
  { line: "141020:A:3", name: "the attached hero gets +1 Attack and the other hero does not", layout: { attached: [{ code: "141020", to: "dh1" }] }, act: [], expect: [stat("dh1", "attack", 3), stat("dh2", "attack", 2)] },
  { line: "141021:A:3", name: "the attached hero gets +1 Willpower and the other hero does not", layout: { attached: [{ code: "141021", to: "dh1" }] }, act: [], expect: [stat("dh1", "willpower", 3), stat("dh2", "willpower", 2)] },

  // 141025 Trouble in Bree: "Setup: Set all copies of Ringwraith, The Witch-king, Midgewater, and Weathertop aside, out of play. Add The Prancing Pony and Bill Ferny to the staging area."
  { line: "141025:A:1", name: "its Setup sets the Nazgûl and the two locations aside and adds The Prancing Pony and Bill Ferny to the staging area", layout: { deck: ["f0", "f0"] }, act: resolve("141025", "setup"), expect: [zone("141069", "setAside"), zone("141068", "setAside"), zone("141048", "setAside"), zone("141046", "setAside"), zone("141045", "staging"), zone("141051", "staging")] },

  // 141054 Unwanted Attention: "Shadow: Return attacking enemy to the staging area after this attack."
  { line: "141054:A:3", name: "its Shadow returns the attacking enemy to the staging area after the attack", act: [attack("f0", { shadow: "141054" }), defend("dh1")], expect: [zone("f0", "staging"), zone("141054", "encounterDiscard")] },

  // 906203 Southern Spy: "Shadow: Defending character gets -1 Defense (-3 Defense instead if The One Ring is exhausted)." Shady Bree-Lander attacks for 3 against the defender's 2 Defense, 1 with the Shadow.
  { line: "906203:A:2", name: "its Shadow gives the defender -1 Defense while The One Ring is not exhausted", act: [attack("141052", { shadow: "906203" }), defend("dh1")], expect: damageOn("dh1", 2) },

  // 906205 Weather Hills: "While the players are at stage 1, progress cannot be placed here." and "Shadow: Attacking enemy gets +2 Attack."
  { line: "906205:A:1", name: "at stage 1 the quest places no progress on it as the active location", layout: { stage: "141025", active: "906205" }, act: quest("success"), expect: progressOn("906205", 0) },
  { line: "906205:A:3", name: "its Shadow gives the attacking enemy +2 Attack", act: [attack("f0", { shadow: "906205" }), defend("dh1")], expect: damageOn("dh1", 1) },

  // 906206 The Old Road: "The Old Road enters play with 3 resource tokens on it." and "Forced: At the end of the round, discard 1 resource token here. Then, if there are no resource tokens here, shuffle 1 out of play Ringwraith into the encounter deck."
  { line: "906206:A:1", name: "revealed, it enters play with 3 resource tokens on it", layout: { deck: ["f0"] }, act: reveal("906206"), expect: [zone("906206", "staging"), resourcesOn("906206", 3)] },
  { line: "906206:A:2", name: "at the end of the round 1 resource token is discarded and with tokens left no Ringwraith is shuffled in", layout: { staging: [{ code: "906206", resources: 2 }], setAside: ["141069"] }, act: announce("endOfRound"), expect: [resourcesOn("906206", 1), zone("141069", "setAside")] },
  { line: "906206:A:2", name: "at the end of the round its last token is discarded, then a set-aside Ringwraith is shuffled into the encounter deck", layout: { staging: [{ code: "906206", resources: 1 }], setAside: ["141069"], deck: ["f0"] }, act: announce("endOfRound"), expect: [resourcesOn("906206", 0), zone("141069", "encounterDeck")] },

  // 906207 Forsaken Inn: "X is the number of characters the first player controls." and "Travel: The first player searches the encounter deck and discard pile for a Spy enemy, reveals it, and adds it to the staging area."
  { line: "906207:A:1", name: "its Threat is the number of characters the first player controls", layout: { staging: ["906207"], play: ["ally"] }, act: [], expect: stat("906207", "threat", 3) },
  { line: "906207:A:1", name: "two-handed its Threat counts the first player's characters, not the other seat's", layout: { seats: 2, firstPlayer: 1, staging: ["906207"], play: ["ally"] }, act: [], expect: stat("906207", "threat", 1) },
  { line: "906207:A:2", name: "travelling there finds a Spy enemy in the encounter deck and adds it to the staging area", layout: { phase: "Travel", staging: ["906207"], deck: ["f0", "141052", "f0"] }, act: travel("906207"), expect: zone("141052", "staging") },
  { line: "906207:A:2", name: "travelling there finds a Spy enemy in the encounter discard pile and adds it to the staging area", layout: { phase: "Travel", staging: ["906207"], deck: ["f0", "f0"], discard: ["141052"] }, act: travel("906207"), expect: zone("141052", "staging") },

  // 906208 The Ring's Will: "Shadow: After this attack, attacking enemy engages the next player then makes an immediate attack." The second attack is undefended and lands on the next player's hero.
  { line: "906208:A:2", name: "two-handed, after the attack the enemy engages the next player and attacks that player", layout: { seats: 2 }, act: [attack("f0", { shadow: "906208" }), defend("dh1")], expect: [zone("f0", "engaged"), damageOn("dh3", 1)] },
];

cardSpecs("a-knife-in-the-dark", ROWS);
