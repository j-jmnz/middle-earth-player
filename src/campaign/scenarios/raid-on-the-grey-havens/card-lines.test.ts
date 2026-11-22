// Rules: dcce.aflame, dcce.stormcaller-elite, dcce.last-player, rr.forced, rr.then, rr.shadow-effects, rr.engaged, rr.reveal (data/rules/entries.json). Card specs for the encounter cards and quest stage 2 of
// Raid on the Grey Havens, written from their ledger lines: 11037:B:2, 11037:B:3, 11041:A:1, 11043:A:2, 11064:A:1, 11064:A:2, 11065:A:1, 11066:A:1, 11066:A:2, 11067:A:1, 11067:A:2, 11078:A:2, 11078:A:3,
// 11188:A:3, 11188:A:4. `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes. The stand-in heroes dh1 and dh2 have 2 Willpower, 2 Attack, 2 Defense, 6 hit points.
import { cardSpecs, announce, attack, count, damageOn, deckCount, handCount, resourcesOn, reveal, stat, won, zone, type Row } from "../../../../test/harness/card-spec.ts";

const ROWS: readonly Row[] = [
  // 11037 Sahír's Advance B:2: "Each Raider enemy revealed by the encounter deck enters play with 1 resource on it."
  { line: "11037:B:2", name: "a Raider enemy revealed from the encounter deck enters play with 1 resource", layout: { stage: "11037", deck: ["f0"] }, act: reveal("11064"), expect: [zone("11064", "staging"), resourcesOn("11064", 1)] },
  // A Raider revealed in the second seat's turn of a two-player reveal gets its resource too.
  { line: "11037:B:2", name: "a Raider revealed by the second player gets 1 resource too", layout: { stage: "11037", seats: 2, firstPlayer: 1, deck: ["f0"] }, act: reveal("11066"), expect: resourcesOn("11066", 1) },

  // 11037 B:3: "If Captain Sahír is in the victory display and each location in play has no damage, the players win the game."
  { line: "11037:B:3", name: "the players win with Captain Sahír in the victory display and no damage on a location in play", layout: { stage: "11037", victory: ["11076"], staging: ["11039", "11043"], deck: ["f0"] }, act: reveal("f0"), expect: won },

  // 11041 Sahír's Ravager: "After Sahír's Ravager attacks, place 1 resource on it. Then, deal X damage to the Aflame location in play with the lowest Aflame value, where X is the number of resources on Sahír's Ravager."
  // Dream-chaser is Aflame 12, Pillaged Ship 5, White Ship 4: White Ship takes the damage, 1 + 1 resources.
  { line: "11041:A:1", name: "after it attacks it gets 1 resource, then the lowest Aflame location takes damage equal to its resources", layout: { engaged: [{ code: "11041", seat: 0, resources: 1 }], staging: ["11039", "11044", "11045"] }, act: attack("11041"), expect: [resourcesOn("11041", 2), damageOn("11045", 2), damageOn("11044", 0), damageOn("11039", 0)] },
  // The active location is in play: Elven Wave-runner (Aflame 3) there is the lowest.
  { line: "11041:A:1", name: "the active Aflame location is in play and takes the damage when its value is the lowest", layout: { staging: ["11039", "11045"], active: "11046" }, act: attack("11041"), expect: [resourcesOn("11041", 1), damageOn("11046", 1), damageOn("11045", 0)] },

  // 11043 Burning Piers: "Burning Piers gets +1 Threat for each damage on it." (printed Threat 1)
  { line: "11043:A:2", name: "it gets +1 Threat for each damage on it", layout: { staging: [{ code: "11043", damage: 3 }] }, act: [], expect: stat("11043", "threat", 4) },
  // The damage Sahír's Ravager deals it (Aflame 5, the lowest in play) raises its Threat at once.
  { line: "11043:A:2", name: "the damage an attack deals to it raises its Threat", layout: { staging: ["11043", "11039"], engaged: [{ code: "11041", seat: 0, resources: 1 }] }, act: attack("11041"), expect: [damageOn("11043", 2), stat("11043", "threat", 3)] },

  // 11064 Umbar Raider: "Umbar Raider gets +1 Attack for each resource on it." (printed Attack 3). Battle-Hardened's Shadow places 2 resources on it before the damage: 3 + 2 lands on the undefended hero.
  { line: "11064:A:1", name: "the resources a Shadow places on it raise the attack's damage", layout: { heroResources: 1 }, act: attack("11064", { shadow: "11067", undefended: true }), expect: [resourcesOn("11064", 3), damageOn("dh1", 5)] },
  // "Forced: After Umbar Raider attacks you, move 1 resource from one of your heroes' resource pools to Umbar Raider."
  { line: "11064:A:2", name: "after it attacks, 1 resource moves from one of your heroes' pools to it", layout: { heroResources: 1 }, act: attack("11064"), expect: [resourcesOn("11064", 1), resourcesOn("dh1", 0), resourcesOn("dh2", 1)] },
  // "your heroes": the other player's hero keeps its resource.
  { line: "11064:A:2", name: "only a hero of the player it attacked loses a resource", layout: { seats: 2, heroResources: 1 }, act: attack("11064"), expect: [resourcesOn("11064", 1), resourcesOn("dh3", 1)] },

  // 11065 Corsair Infiltrator: "When Corsair Infiltrator attacks, deal it 1 additional shadow card for each resource on it." Five cards in the deck: 1 shadow card and 2 more for 2 resources.
  { line: "11065:A:1", name: "it is dealt 1 additional shadow card for each resource on it", layout: { engaged: [{ code: "11065", seat: 0, resources: 2 }], deck: ["f0", "f0", "f0", "f0"] }, act: attack("11065"), expect: deckCount(1) },

  // 11066 Raid Leader: "Raid Leader gets +1 Defense for each resource on it." (printed Defense 1) "Forced: When Raid Leader engages you, move 1 resource from each of your heroes' resource pools to Raid Leader."
  { line: "11066:A:1", name: "the resources it takes when it engages give it +1 Defense each", layout: { engaged: ["11066"], heroResources: 1 }, act: announce("engaged", "11066"), expect: stat("11066", "defense", 3) },
  { line: "11066:A:2", name: "when it engages you, 1 resource moves from each of your heroes' pools to it", layout: { engaged: ["11066"], heroResources: 2 }, act: announce("engaged", "11066"), expect: [resourcesOn("11066", 2), resourcesOn("dh1", 1), resourcesOn("dh2", 1)] },
  { line: "11066:A:2", name: "the other player's hero keeps its resources", layout: { seats: 2, engaged: ["11066"], heroResources: 1 }, act: announce("engaged", "11066"), expect: [resourcesOn("11066", 2), resourcesOn("dh3", 1)] },

  // 11067 Battle-Hardened: "Place 1 resource on each Raider enemy in play. Each engaged non-Ship enemy makes an immediate attack. If there are no engaged non-Ship enemies, Battle-Hardened gains surge."
  { line: "11067:A:1", name: "each Raider enemy in play gets 1 resource, in the staging area and engaged", layout: { staging: ["11064"], engaged: [{ code: "11066", seat: 0 }], deck: ["f0", "f0", "f0"] }, act: reveal("11067"), expect: [resourcesOn("11064", 1), resourcesOn("11066", 1)] },
  { line: "11067:A:1", name: "an enemy that is no Raider gets no resource", layout: { staging: ["11064", "11040"], deck: ["f0", "f0"] }, act: reveal("11067"), expect: [resourcesOn("11064", 1), resourcesOn("11040", 0)] },
  // The engaged enemy's immediate attack is dealt a shadow card: one card leaves the deck, and no surge reveals another.
  { line: "11067:A:1", name: "an engaged non-Ship enemy makes an immediate attack, dealt a shadow card, and there is no surge", layout: { engaged: ["f3"], deck: ["f0", "f0", "f0"] }, act: reveal("11067"), expect: [deckCount(2), count("f0", "staging", 0)] },
  { line: "11067:A:1", name: "with no engaged enemy it gains surge", layout: { staging: ["11064"], deck: ["f0", "f0"] }, act: reveal("11067"), expect: [count("f0", "staging", 1), deckCount(1)] },
  // "Shadow: If the attacking enemy is a Raider, place 2 resources on it."
  { line: "11067:A:2", name: "its Shadow places 2 resources on an attacking Raider", layout: {}, act: attack("11065", { shadow: "11067" }), expect: resourcesOn("11065", 2) },

  // 11078 Na'asiyah: "Forced: When Na'asiyah engages you, discard each event in your hand. Add 1 resource to Na'asiyah for each event discarded in this way."
  { line: "11078:A:2", name: "when she engages you each event in your hand is discarded and she gets 1 resource for each", layout: { engaged: ["11078"], hand: ["event", "ally", "event"] }, act: announce("engaged", "11078"), expect: [resourcesOn("11078", 2), count("event", "discard", 2), handCount(1)] },
  { line: "11078:A:2", name: "the other player's events stay in their hand", layout: { seats: 2, engaged: ["11078"], hand: [{ code: "event", seat: 1 }, { code: "event", seat: 0 }, { code: "ally", seat: 0 }] }, act: announce("engaged", "11078"), expect: [resourcesOn("11078", 1), handCount(1, 1), handCount(1, 0)] },
  // "Forced: When Na'asiyah attacks or defends, she gets +1 Attack and +1 Defense for this attack for each resource on her. After this attack, discard 1 resource from her." (printed Attack 2)
  { line: "11078:A:3", name: "she attacks with +1 Attack for each resource on her and discards 1 resource after the attack", layout: { engaged: [{ code: "11078", seat: 0, resources: 2 }] }, act: attack("11078", { undefended: true }), expect: [damageOn("dh1", 4), resourcesOn("11078", 1), stat("11078", "attack", 2), stat("11078", "defense", 2)] },

  // 11188 Graxar: "Graxar gets +1 Attack for each damage on him and +1 Defense for each resource on him." (printed 3 Attack, 0 Defense) "Forced: When Graxar is dealt a shadow card, place 1 resource on him."
  { line: "11188:A:3", name: "he attacks with +1 Attack for each damage on him", layout: { engaged: [{ code: "11188", seat: 0, damage: 2 }] }, act: attack("11188", { undefended: true }), expect: damageOn("dh1", 5) },
  { line: "11188:A:3", name: "the resource his shadow card gives him is +1 Defense", layout: {}, act: attack("11188"), expect: [resourcesOn("11188", 1), stat("11188", "defense", 1)] },
  { line: "11188:A:4", name: "he gets 1 resource when he is dealt a shadow card", layout: {}, act: attack("11188"), expect: resourcesOn("11188", 1) },
  // Engaged with the second player, he is dealt his shadow card in the same combat phase.
  { line: "11188:A:4", name: "he gets 1 resource when he is dealt a shadow card while engaged with the second player", layout: { seats: 2, engaged: [{ code: "11188", seat: 1 }] }, act: attack("f0"), expect: resourcesOn("11188", 1) },
];

cardSpecs("raid-on-the-grey-havens", ROWS);
