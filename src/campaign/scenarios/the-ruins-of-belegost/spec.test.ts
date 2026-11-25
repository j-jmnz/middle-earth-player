// Rules: emce.discover, emce.loot, emce.immune, rr.forced, rr.surge, rr.travel, rr.guarded, rr.quest-advancement, rr.restricted, rr.victory, rr.cannot, rr.engaged, rr.shadow-effects, faq.additional-attacks, faq.next-player (data/rules/entries.json); docs/scenarios/standalone-scenarios/the-ruins-of-belegost.md (The Ruins of Belegost).
import { announce, answer, attack, cardSpecs, count, damageOn, deckCount, drew, endPhase, exhausted, flag, handCount, quest, resolve, resourcesOn, reveal, stat, stagingThreat, respond, threat, travel, won, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Ruins of Belegost (standalone-scenarios part 6): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests). The lines a row cannot express (the table-wide must-travel
// stat, the seeded hiding of a Loot objective) are tests in lines.test.ts, each titled with its line id.
const F0 = ["f0", "f0", "f0", "f0", "f0", "f0"];
const STALKING = "50608";
const NAURLHUG = "50615";
const LAIR = "50621";
const SWORD = "50609";
const MAP = "50610";
const KEYS = "50611";
const BOOK = "50612";
const TORCH = "50613";
const GEM = "50614";
const ON_HERO = (code: string) => ({ code, to: "dh1" });
const BEGINNING_OF = (phase: "Quest" | "Travel") => ({ seat: null, phase }) as const;
// A quest that succeeds at the stage: the heroes' willpower and the progress it already holds cover its quest points.
const EXPLORED = (times: number) => Array.from({ length: times }, () => announce("activeExplored", "50603"));
const ADVANCING = { phase: "Quest", deck: ["f0"] } as const;

const ROWS: readonly Row[] = [
  // 50601 Ruins of the First Age.
  { line: "50601:A:1", name: "Setup: one of the 5 other Loot objectives lies under Stalking the Ruins and the other 4 are shuffled into the encounter deck", layout: { stage: "50601", staging: [STALKING], setAside: [MAP, KEYS, BOOK, TORCH, GEM] }, act: resolve("50601", "setup"), expect: [deckCount(4), count(STALKING, "staging", 1)] },
  { line: "50601:B:1", name: "the players cannot advance with no Loot objective", layout: { stage: "50601", progress: 5, ...ADVANCING }, act: quest("success"), expect: [zone("50601", "questStage")] },
  { line: "50601:B:2", name: "Forced: at the beginning of the travel phase with no location in play the topmost location of the discard pile returns to the staging area", layout: { stage: "50601", phase: "Travel", discard: ["50622", "f0"] }, act: announce("beginningOfPhase", undefined, BEGINNING_OF("Travel")), expect: [zone("50622", "staging")] },
  { line: "50601:B:3", name: "Keys of Belegost attached to a hero: the quest advances to stage 2C", layout: { stage: "50601", progress: 5, attached: [ON_HERO(KEYS)], ...ADVANCING }, act: quest("success"), expect: [zone("50603", "questStage")] },
  // 50602 Ancient Evils Disturbed.
  { line: "50602:B:1", name: "the players cannot advance with fewer than 2 Loot objectives", layout: { stage: "50602", progress: 8, victory: ["50616"], attached: [ON_HERO(KEYS)], ...ADVANCING }, act: quest("success"), expect: [zone("50602", "questStage")] },
  { line: "50602:B:1", name: "nor without Lurker of the Depths in the victory display", layout: { stage: "50602", progress: 8, attached: [ON_HERO(KEYS), ON_HERO(MAP)], ...ADVANCING }, act: quest("success"), expect: [zone("50602", "questStage")] },
  { line: "50602:B:2", name: "Book of Aulë's Children attached to a hero: the quest advances to stage 3C", layout: { stage: "50602", progress: 8, victory: ["50616"], attached: [ON_HERO(BOOK), ON_HERO(KEYS)], ...ADVANCING }, act: quest("success"), expect: [zone("50605", "questStage")] },
  { line: "50602:B:2", name: "otherwise to stage 3A", layout: { stage: "50602", progress: 8, victory: ["50616"], attached: [ON_HERO(MAP), ON_HERO(KEYS)], ...ADVANCING }, act: quest("success"), expect: [zone("50604", "questStage")] },
  // 50603 Deeper into the Past.
  { line: "50603:A:1", name: "When Revealed: Lurker of the Depths and the discard pile are shuffled into the deck, cards are discarded until a location is, and it is added to the staging area", layout: { stage: "50603", setAside: ["50616"], discard: ["50622"] }, act: resolve("50603", "whenRevealed"), expect: [zone("50622", "staging"), count("50616", "setAside", 0)] },
  { line: "50603:B:1", name: "the players cannot advance with fewer than 3 resources on the stage", layout: { stage: "50603", progress: 8, attached: [ON_HERO(KEYS), ON_HERO(MAP)], ...ADVANCING }, act: [...EXPLORED(2), quest("success")], expect: [zone("50603", "questStage")] },
  { line: "50603:B:2", name: "Forced: after the active location is explored 1 resource is placed on the stage", layout: { stage: "50603", active: "50622" }, act: announce("activeExplored", "50603"), expect: [resourcesOn("50603", 1)] },
  { line: "50603:B:3", name: "Book of Aulë's Children attached to a hero: the quest advances to stage 3E", layout: { stage: "50603", progress: 8, attached: [ON_HERO(BOOK), ON_HERO(KEYS)], ...ADVANCING }, act: [...EXPLORED(3), quest("success")], expect: [zone("50606", "questStage")] },
  { line: "50603:B:3", name: "otherwise to stage 3C", layout: { stage: "50603", progress: 8, attached: [ON_HERO(MAP), ON_HERO(KEYS)], ...ADVANCING }, act: [...EXPLORED(3), quest("success")], expect: [zone("50605", "questStage")] },
  // 50604 The Servants of Morgoth, 50605 The Roots of Ered Luin, 50606 The Mines of Belegost.
  { line: "50604:A:1", name: "When Revealed: the encounter discard pile is shuffled into the deck and each player reveals a card", layout: { stage: "50604", deck: ["f0", "f0", "f0"], discard: ["f0", "f0"] }, act: resolve("50604", "whenRevealed"), expect: [deckCount(4)] },
  { line: "50604:B:1", name: "the first Hazard card revealed each round gains surge", layout: { stage: "50604", deck: F0 }, act: reveal("50629"), expect: [count("f0", "staging", 1)] },
  { line: "50604:B:3", name: "Dwarven Torch attached to a hero: the quest advances to stage 4A", layout: { stage: "50604", progress: 5, attached: [ON_HERO(TORCH)], ...ADVANCING }, act: quest("success"), expect: [zone("50607", "questStage")] },
  { line: "50605:A:1", name: "When Revealed: the encounter discard pile is shuffled into the deck and each player reveals a card", layout: { stage: "50605", deck: ["f0", "f0", "f0"], discard: ["f0", "f0"] }, act: resolve("50605", "whenRevealed"), expect: [deckCount(4)] },
  { line: "50605:B:1", name: "the Discover value of the active location is increased by 1", layout: { stage: "50605", active: "50625", staging: ["50617"] }, act: announce("beginningOfPhase", undefined, BEGINNING_OF("Quest")), expect: [stat("50625", "discoverValue", 1), stat("50617", "attack", 5)] },
  { line: "50605:B:3", name: "Map of Ered Luin attached to a hero: the quest advances to stage 4A", layout: { stage: "50605", progress: 5, attached: [ON_HERO(MAP)], ...ADVANCING }, act: quest("success"), expect: [zone("50607", "questStage")] },
  { line: "50606:A:1", name: "When Revealed: the encounter discard pile is shuffled into the deck and each player reveals a card", layout: { stage: "50606", deck: ["f0", "f0", "f0"], discard: ["f0", "f0"] }, act: resolve("50606", "whenRevealed"), expect: [deckCount(4)] },
  { line: "50606:B:2", name: "after Discover resolves with no Hazard card revealed the first player reveals the top card", layout: { stage: "50606", staging: ["50625"], deck: ["f3", "f0"] }, act: announce("discovered", "50625", { amount: 0 }), expect: [zone("f3", "staging")] },
  { line: "50606:B:3", name: "otherwise to stage 3A", layout: { stage: "50606", progress: 5, ...ADVANCING }, act: quest("success"), expect: [zone("50604", "questStage")] },
  // 50607 The Beast of Belegost.
  { line: "50607:A:1", name: "When Revealed: Naurlhûg and its Lair join the staging area and the Sword of Belegost is shuffled into the encounter deck", layout: { stage: "50607", setAside: [NAURLHUG, LAIR, SWORD], deck: ["f0"] }, act: resolve("50607", "whenRevealed"), expect: [zone(NAURLHUG, "staging"), zone(LAIR, "staging"), zone(SWORD, "encounterDeck")] },
  { line: "50607:B:1", name: "with Naurlhûg's Lair in the victory display Naurlhûg can take damage", layout: { stage: "50607", staging: [NAURLHUG], victory: [LAIR] }, act: [], expect: [flag(NAURLHUG, "losesNoDamage")] },
  { line: "50607:B:2", name: "after Naurlhûg attacks with a shadow card without a shadow effect it engages the next player and attacks again", layout: { stage: "50607", seats: 2, staging: [{ code: STALKING, resources: 0 }], deck: F0 }, act: attack(NAURLHUG, { shadow: "f0", undefended: true }), expect: [damageOn("dh1", 7), damageOn("dh3", 7)] },
  { line: "50607:B:3", name: "the players win the game when Naurlhûg is defeated", layout: { stage: "50607", engaged: [NAURLHUG] }, act: announce("enemyDestroyed", NAURLHUG), expect: [won] },
  // 50608 Stalking the Ruins.
  { line: "50608:A:1", name: "Forced: at the beginning of the quest phase 1 resource is placed and, with 3, Naurlhûg joins the staging area", layout: { phase: "Quest", staging: [{ code: STALKING, resources: 2 }], setAside: [NAURLHUG] }, act: announce("beginningOfPhase", undefined, BEGINNING_OF("Quest")), expect: [resourcesOn(STALKING, 3), zone(NAURLHUG, "staging")] },
  { line: "50608:A:1", name: "Naurlhûg engaged with a player returns to the staging area", layout: { phase: "Quest", staging: [{ code: STALKING, resources: 2 }], engaged: [NAURLHUG] }, act: announce("beginningOfPhase", undefined, BEGINNING_OF("Quest")), expect: [zone(NAURLHUG, "staging")] },
  { line: "50608:A:2", name: "Forced: when the players advance its tokens are discarded and Naurlhûg is set aside, before the new stage's When Revealed adds it", layout: { stage: "50606", progress: 5, staging: [{ code: STALKING, resources: 2 }], setAside: [NAURLHUG, LAIR, SWORD], attached: [ON_HERO(GEM)], ...ADVANCING }, act: quest("success"), expect: [zone("50607", "questStage"), resourcesOn(STALKING, 0), zone(NAURLHUG, "staging")] },
  { line: "50608:A:2", name: "Then: discarding all tokens with none on it still resolves in full, so Naurlhûg is set aside and comes back with no damage (reading 11)", layout: { stage: "50606", progress: 5, staging: [{ code: STALKING, resources: 0 }, { code: NAURLHUG, damage: 2 }], setAside: [LAIR, SWORD], attached: [ON_HERO(GEM)], ...ADVANCING }, act: quest("success"), expect: [zone("50607", "questStage"), damageOn(NAURLHUG, 0), zone(NAURLHUG, "staging")] },
  // 50609 Sword of Belegost and the other Loot objectives (the claim and the keyword are one record each, the same for the six).
  { line: "50609:A:1", name: "a Loot card revealed from the encounter deck is discarded and the next one revealed", layout: { phase: "Quest", deck: [SWORD, "f3", "f0"] }, act: quest("success"), expect: [zone(SWORD, "encounterDiscard"), zone("f3", "staging")] },
  { line: "50609:A:2", name: "free of encounters the first player claims it and attaches it to a hero", layout: { staging: [SWORD] }, act: announce("beginningOfPhase", undefined, BEGINNING_OF("Travel")), expect: [zone(SWORD, "attached")] },
  { line: "50609:A:3", name: "attached hero gets +4 Attack", layout: { attached: [ON_HERO(SWORD)] }, act: [], expect: [stat("dh1", "attack", 6)] },
  { line: "50610:A:1", name: "a Loot card revealed from the encounter deck is discarded and the next one revealed", layout: { phase: "Quest", deck: [MAP, "f3", "f0"] }, act: quest("success"), expect: [zone(MAP, "encounterDiscard"), zone("f3", "staging")] },
  { line: "50610:A:2", name: "free of encounters the first player claims it and attaches it to a hero", layout: { staging: [MAP] }, act: announce("beginningOfPhase", undefined, BEGINNING_OF("Travel")), expect: [zone(MAP, "attached")] },
  { line: "50610:A:3", name: "Action: exhaust it, a non-unique location gets -2 Threat until the end of the phase", layout: { attached: [ON_HERO(MAP)], staging: ["place"] }, act: resolve(MAP, "action"), expect: [stat("place", "threat", 0)] },
  { line: "50611:A:1", name: "a Loot card revealed from the encounter deck is discarded and the next one revealed", layout: { phase: "Quest", deck: [KEYS, "f3", "f0"] }, act: quest("success"), expect: [zone(KEYS, "encounterDiscard"), zone("f3", "staging")] },
  { line: "50611:A:2", name: "free of encounters the first player claims it and attaches it to a hero", layout: { staging: [KEYS] }, act: announce("beginningOfPhase", undefined, BEGINNING_OF("Travel")), expect: [zone(KEYS, "attached")] },
  { line: "50611:A:3", name: "Action: exhaust it, a hero gets 1 resource", layout: { attached: [ON_HERO(KEYS)] }, act: resolve(KEYS, "action"), expect: [resourcesOn("dh1", 1)] },
  { line: "50612:A:1", name: "a Loot card revealed from the encounter deck is discarded and the next one revealed", layout: { phase: "Quest", deck: [BOOK, "f3", "f0"] }, act: quest("success"), expect: [zone(BOOK, "encounterDiscard"), zone("f3", "staging")] },
  { line: "50612:A:2", name: "free of encounters the first player claims it and attaches it to a hero", layout: { staging: [BOOK] }, act: announce("beginningOfPhase", undefined, BEGINNING_OF("Travel")), expect: [zone(BOOK, "attached")] },
  { line: "50613:A:1", name: "a Loot card revealed from the encounter deck is discarded and the next one revealed", layout: { phase: "Quest", deck: [TORCH, "f3", "f0"] }, act: quest("success"), expect: [zone(TORCH, "encounterDiscard"), zone("f3", "staging")] },
  { line: "50613:A:2", name: "free of encounters the first player claims it and attaches it to a hero", layout: { staging: [TORCH] }, act: announce("beginningOfPhase", undefined, BEGINNING_OF("Travel")), expect: [zone(TORCH, "attached")] },
  { line: "50613:A:3", name: "Action: exhaust it, a non-unique enemy gets -1 Attack and -1 Defense until the end of the phase", layout: { attached: [ON_HERO(TORCH)], staging: ["f3"] }, act: resolve(TORCH, "action"), expect: [stat("f3", "attack", 0), stat("f3", "defense", 0)] },
  { line: "50614:A:1", name: "a Loot card revealed from the encounter deck is discarded and the next one revealed", layout: { phase: "Quest", deck: [GEM, "f3", "f0"] }, act: quest("success"), expect: [zone(GEM, "encounterDiscard"), zone("f3", "staging")] },
  { line: "50614:A:2", name: "free of encounters the first player claims it and attaches it to a hero", layout: { staging: [GEM] }, act: announce("beginningOfPhase", undefined, BEGINNING_OF("Travel")), expect: [zone(GEM, "attached")] },
  { line: "50614:A:3", name: "Action: exhaust it, a player reduces their threat by 1", layout: { attached: [ON_HERO(GEM)], threat: [30, 30] }, act: resolve(GEM, "action"), expect: [threat(29)] },
  // 50615 Naurlhûg.
  { line: "50615:A:1", name: "immune to player card effects and cannot take damage", layout: { staging: [NAURLHUG] }, act: [], expect: [flag(NAURLHUG, "immuneToPlayerCards"), flag(NAURLHUG, "cannotTakeDamage")] },
  { line: "50615:A:2", name: "when it attacks the defending player assigns X damage, X the resources on Stalking the Ruins", layout: { staging: [{ code: STALKING, resources: 3 }], deck: F0 }, act: attack(NAURLHUG, { undefended: true }), expect: [damageOn("dh1", 10)] },
  { line: "50615:A:3", name: "the defending player is the one it attacks, not the first player", layout: { seats: 2, staging: [{ code: STALKING, resources: 3 }], engaged: [{ code: NAURLHUG, seat: 1 }], deck: F0 }, act: attack(NAURLHUG, { undefended: true, lands: { [NAURLHUG]: "dh3" } }), expect: [damageOn("dh3", 10)] },
  // 50616 Lurker of the Depths.
  { line: "50616:A:2", name: "cannot be engaged and takes no more than 4 damage each round", layout: { staging: ["50616"] }, act: [], expect: [flag("50616", "cannotBeEngaged"), stat("50616", "damageCap", 4)] },
  { line: "50616:A:3", name: "in the staging area it is considered engaged with each player", layout: { seats: 2, staging: ["50616"] }, act: [], expect: [flag("50616", "engagedWithAll")] },
  // 50617 Nameless Cave Dweller.
  { line: "50617:A:2", name: "Threat, Attack and Defense X: 1 more than the Discover value of the active location", layout: { active: "50625", staging: ["50617"] }, act: [], expect: [stat("50617", "threat", 4), stat("50617", "attack", 4), stat("50617", "defense", 4)] },
  { line: "50617:A:2", name: "with no active location the Discover value is 0", layout: { staging: ["50617"] }, act: [], expect: [stat("50617", "attack", 1)] },
  { line: "50617:A:3", name: "Shadow: the attacker gets +1 Attack", layout: { engaged: ["f3"] }, act: attack("f3", { shadow: "50617", undefended: true }), expect: [damageOn("dh1", 2)] },
  { line: "50617:A:3", name: "+2 Attack instead with a Loot objective you control", layout: { engaged: ["f3"], attached: [ON_HERO(KEYS)] }, act: attack("f3", { shadow: "50617", undefended: true }), expect: [damageOn("dh1", 3)] },
  // 50618 Old Stone Troll.
  { line: "50618:A:2", name: "-10 engagement cost for each Loot objective attached to a hero", layout: { staging: ["50618"], attached: [ON_HERO(KEYS)] }, act: [], expect: [stat("50618", "engagementCost", 40)] },
  { line: "50618:A:3", name: "only the engaged player can declare attackers against it", layout: { staging: ["50618"] }, act: [], expect: [flag("50618", "attackOnlyByEngaged")] },
  // 50619 Orc of Ered Luin.
  { line: "50619:A:1", name: "When Revealed: it attacks each player who controls a Loot objective", layout: { seats: 2, deck: F0, attached: [ON_HERO(KEYS)] }, act: [reveal("50619"), endPhase], expect: [damageOn("dh1", 4), damageOn("dh3", 0)] },
  { line: "50619:A:2", name: "Shadow: after this attack it engages the next player and attacks", layout: { seats: 2, engaged: ["f3"], deck: F0 }, act: attack("f3", { shadow: "50619", undefended: true }), expect: [damageOn("dh1", 1), damageOn("dh3", 1)] },
  // 50620 Blue Mountain Goblin.
  { line: "50620:A:1", name: "while a Loot objective is attached to a hero it gains surge", layout: { deck: F0, attached: [ON_HERO(KEYS)] }, act: reveal("50620"), expect: [count("f0", "staging", 1)] },
  { line: "50620:A:2", name: "Shadow: with a Loot objective you control it is put into play engaged with you and is dealt a shadow card", layout: { engaged: ["f3"], deck: F0, attached: [ON_HERO(KEYS)] }, act: attack("f3", { shadow: "50620", undefended: true }), expect: [zone("50620", "engaged"), deckCount(5)] },
  // 50621 Naurlhûg's Lair.
  { line: "50621:A:1", name: "Discover 5: looks at the top 5 cards", layout: { phase: "Travel", staging: [LAIR], deck: F0 }, act: travel(LAIR), expect: [count("f0", "encounterDiscard", 5)] },
  { line: "50621:A:2", name: "immune to player card effects", layout: { staging: [LAIR] }, act: [], expect: [flag(LAIR, "immuneToPlayerCards")] },
  { line: "50621:A:3", name: "Forced: when it is explored the Loot objective under Stalking the Ruins is added to the staging area faceup", layout: { stage: "50607", phase: "Quest", active: LAIR, under: [{ code: KEYS, to: STALKING }], staging: [STALKING], deck: F0 }, act: announce("leftPlay", LAIR, { explored: true }), expect: [zone(KEYS, "attached")] },
  { line: "50621:A:4", name: "Travel: X resources are placed on Stalking the Ruins, X the number of players", layout: { phase: "Travel", seats: 2, staging: [LAIR, STALKING], deck: F0 }, act: travel(LAIR), expect: [resourcesOn(STALKING, 2)] },
  // 50622 Abandoned Mine.
  { line: "50622:A:1", name: "Discover 2: looks at the top 2 cards and as many more as there are players", layout: { phase: "Travel", staging: ["50622"], deck: F0 }, act: travel("50622"), expect: [count("f0", "encounterDiscard", 3)] },
  { line: "50622:A:2", name: "in the staging area no progress is placed on the other locations of the staging area", layout: { staging: ["50622", "place"] }, act: [], expect: [flag("place", "noProgressPlaced"), flag("50622", "noProgressPlaced", false)] },
  { line: "50622:A:3", name: "Forced: Discover looks at as many more cards as there are players", layout: { phase: "Travel", seats: 2, staging: ["50622"], deck: F0 }, act: travel("50622"), expect: [count("f0", "encounterDiscard", 4)] },
  // 50623 Flooded Hall.
  { line: "50623:A:1", name: "Discover 4: looks at the top 4 cards", layout: { phase: "Travel", staging: ["50623"], deck: F0 }, act: travel("50623"), expect: [count("f0", "encounterDiscard", 4)] },
  { line: "50623:A:3", name: "Forced: Discover reveals 1 more looked-at Hazard card for each other player", layout: { phase: "Travel", seats: 2, staging: ["50623"], deck: ["50617", "50617", "f0", "f0", "f0"] }, act: travel("50623"), expect: [count("50617", "staging", 2)] },
  // 50624 Darkened Tunnel.
  { line: "50624:A:1", name: "Discover 2: looks at the top 2 cards", layout: { phase: "Travel", staging: ["50624"], deck: F0 }, act: travel("50624"), expect: [count("f0", "encounterDiscard", 2)] },
  { line: "50624:A:2", name: "Forced: after a When Revealed effect is canceled the top card is discarded and a Hazard card so discarded is revealed", layout: { staging: ["50624"], deck: ["50629", "f0"] }, act: announce("whenRevealedCanceled", "50624"), expect: [damageOn("dh1", 1)] },
  { line: "50624:A:3", name: "Travel: 1 resource is placed on Stalking the Ruins", layout: { phase: "Travel", staging: ["50624", STALKING], deck: F0 }, act: travel("50624"), expect: [resourcesOn(STALKING, 1)] },
  // 50625 Sunken Treasury.
  { line: "50625:A:1", name: "Discover 3: looks at the top 3 cards", layout: { phase: "Travel", staging: ["50625"], deck: F0 }, act: travel("50625"), expect: [count("f0", "encounterDiscard", 3)] },
  { line: "50625:A:2", name: "+1 Threat for each Loot objective attached to a hero", layout: { staging: ["50625"], attached: [ON_HERO(KEYS), ON_HERO(MAP)] }, act: [], expect: [stat("50625", "threat", 3)] },
  { line: "50625:A:3", name: "Travel: each player discards a random card from hand", layout: { phase: "Travel", staging: ["50625"], hand: ["filler", "filler"], deck: F0 }, act: travel("50625"), expect: [handCount(1)] },
  { line: "50625:A:4", name: "Shadow: exhaust a character you control", layout: { engaged: ["f3"] }, act: attack("f3", { shadow: "50625", undefended: true }), expect: [exhausted("dh1")] },
  // 50626 Secret Chamber.
  { line: "50626:A:1", name: "Discover 3: looks at the top 3 cards", layout: { phase: "Travel", staging: ["50626"], deck: F0, attached: [{ code: KEYS, to: "50626" }] }, act: travel("50626"), expect: [count("f0", "encounterDiscard", 3)] },
  { line: "50626:A:2", name: "Response: after the players travel here a Loot objective of the encounter discard pile is attached to it as a guarded objective", layout: { phase: "Travel", staging: ["50626"], discard: [KEYS], deck: F0 }, act: [travel("50626"),respond("50626")], expect: [zone(KEYS, "staging")] },
  { line: "50626:A:3", name: "Travel: each player raises their threat by 2", layout: { phase: "Travel", staging: ["50626"], threat: [30, 30], deck: F0 }, act: travel("50626"), expect: [threat(32)] },
  // 50627 Echoes in the Dark.
  { line: "50627:A:2", name: "When Revealed: the total Threat in the staging area is up by the characters the first player controls", layout: { deck: F0 }, act: reveal("50627"), expect: [stagingThreat(2)] },
  { line: "50627:A:3", name: "Shadow: discard a random card from your hand; an event gives the attacker +2 Attack", layout: { engaged: ["f3"], hand: ["event"] }, act: attack("f3", { shadow: "50627", undefended: true }), expect: [damageOn("dh1", 3), handCount(0)] },
  // 50628 Spawn of Thangorodrim.
  { line: "50628:A:1", name: "When Revealed: with Naurlhûg in play it attacks the first player", layout: { engaged: [NAURLHUG], staging: [STALKING], deck: F0 }, act: [reveal("50628"), endPhase], expect: [damageOn("dh1", 7)] },
  { line: "50628:A:1", name: "otherwise 1 resource goes on Stalking the Ruins and, with 3, Naurlhûg is added", layout: { staging: [{ code: STALKING, resources: 2 }], setAside: [NAURLHUG], deck: F0 }, act: reveal("50628"), expect: [zone(NAURLHUG, "staging")] },
  { line: "50628:A:2", name: "Shadow: an additional attack against you, dealt a new shadow card", layout: { engaged: ["f3"] }, act: attack("f3", { shadow: "50628", undefended: true }), expect: [damageOn("dh1", 2), deckCount(2)] },
  // 50629 Concealed Spikes.
  { line: "50629:A:1", name: "When Revealed: each player assigns X damage, X 1 more than the Discover value of the active location", layout: { deck: F0 }, act: reveal("50629"), expect: [damageOn("dh1", 1)] },
  { line: "50629:A:1", name: "with an active location of Discover 3, 4 damage", layout: { active: "50625", deck: F0 }, act: reveal("50629"), expect: [damageOn("dh1", 4)] },
  { line: "50629:A:2", name: "Shadow: assign damage for each attachment you control", layout: { engaged: ["f3"], attached: [{ code: "attachment", to: "dh1" }] }, act: [attack("f3", { shadow: "50629", undefended: true }), answer("damage")], expect: [damageOn("dh1", 2)] },
  { line: "50629:A:2", name: "or discard the highest cost attachment you control", layout: { engaged: ["f3"], attached: [{ code: "attachment", to: "dh1" }] }, act: [attack("f3", { shadow: "50629", undefended: true }), answer("discard")], expect: [zone("attachment", "discard"), damageOn("dh1", 1)] },
  // 50630 Covered Pit.
  { line: "50630:A:1", name: "When Revealed: each player discards an ally they control", layout: { play: ["ally"], deck: F0 }, act: reveal("50630"), expect: [zone("ally", "discard")] },
  { line: "50630:A:2", name: "Shadow: with a non-unique attacker a Loot objective you control is attached to it as a guarded objective", layout: { engaged: ["f3"], attached: [ON_HERO(KEYS)] }, act: attack("f3", { shadow: "50630", undefended: true }), expect: [zone(KEYS, "staging")] },
  // "When Revealed: Add Lurker of the Depths to the staging area."
  { line: "50602:A:1", name: "When Revealed: the set-aside Lurker of the Depths is added to the staging area", layout: { stage: "50602", side: "A", setAside: ["50616"] }, act: resolve("50602", "whenRevealed"), expect: [zone("50616", "staging")] },
  // "Action: Exhaust Book of Aulë's Children to choose a player. That player draws 1 card."
  { line: "50612:A:3", name: "Action: the Book is exhausted and the player chosen draws 1 card", layout: { attached: [ON_HERO(BOOK)], deckOf: ["filler", "filler"] }, act: respond(BOOK), expect: [exhausted(BOOK), drew(1)] },
  { line: "50612:A:3", name: "with two players the second player may be the one chosen, and draws while the first does not", layout: { seats: 2, attached: [ON_HERO(BOOK)], deckOf: ["filler", "filler"] }, act: [respond(BOOK), answer("seat:1")], expect: [drew(1, 1), drew(0, 0)] },
];

cardSpecs("the-ruins-of-belegost", ROWS);
