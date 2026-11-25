// Rules: rr.forced, rr.response, rr.then, rr.travel, rr.first-player, rr.player-elimination, rr.victory, rr.immune, rr.engaged, rr.in-play-and-out-of-play, rr.shadow-effects, faq.additional-attacks (data/rules/entries.json); docs/scenarios/standalone-scenarios/the-siege-of-annuminas.md (The Siege of Annúminas).
import { announce, answer, attack, cardSpecs, count, damageOn, deckCount, defend, endRound, exhausted, flag, lost, progressOn, quest, resolve, resourcesOn, reveal, stat, threat, travel, window, won, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Siege of Annúminas (standalone-scenarios part 8): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests). The lines a row cannot express (Lead the Sortie's Response, which no
// Standard game can offer, the Epic cards Enemy Camp and Siege Tunnel, the immunity of Battering Ram) are tests in lines.test.ts, each titled with its line id.
// A deck of locations: a card revealed in the staging step adds no enemy for Annúminas to count.
const PLACES = ["place", "place", "place", "place", "place", "place"];
const CITY = (resources: number) => ({ code: "50812", resources });
const HOST = "50817";
const LIEUTENANT = "50813";
const RAM = "50814";
const GATE = "50819";
const WARG = "50824";
const ORC = "50825";
const RIDER = "50826";
const WEREWOLF = "50827";
const VANGUARD = "50828";
const HORDES = "50829";
const SORCERY = "50830";
const PRESS = "50831";
const WEARY = "50832";
const DUNEDAIN = "50818";
const ADVANCING = { phase: "Quest", deck: ["f0"] } as const;
// The player's first hero is the one an enemy attacks.
const END_OF_ROUND = announce("endOfRound", undefined, { seat: null, phase: "End of round" });

const ROWS: readonly Row[] = [
  // 50801 Standard Game Mode.
  { line: "50801:A:1", name: "Setup: the city strength of Annúminas is set to 20", layout: { stage: "50803", staging: ["50812"] }, act: resolve("50801", "setup"), expect: [resourcesOn("50812", 20)] },
  { line: "50801:B:1", name: "Forced: advancing to stage 2A shuffles the set aside Dúnedain and one Host of Angmar (two players) into the encounter deck", layout: { threat: [0, 0], modeCard: true, stage: "50803", seats: 2, staging: [CITY(20)], setAside: [DUNEDAIN, DUNEDAIN, DUNEDAIN, HOST, HOST, HOST], phase: "Planning", deck: PLACES }, act: [endRound, endRound, endRound, endRound], expect: [zone("50804", "questStage"), count(DUNEDAIN, "setAside", 0), count(HOST, "setAside", 2)] },
  { line: "50801:B:1", name: "one Host with one player (a minimum of 1)", layout: { threat: [0, 0], modeCard: true, stage: "50803", staging: [CITY(20)], setAside: [HOST, HOST, HOST], phase: "Planning", deck: PLACES }, act: [endRound, endRound, endRound, endRound], expect: [zone("50804", "questStage"), count(HOST, "setAside", 2)] },
  { line: "50801:B:2", name: "a player eliminated: 9 damage to Annúminas", layout: { modeCard: true, stage: "50804", staging: [CITY(20)] }, act: announce("playerEliminated"), expect: [resourcesOn("50812", 11)] },
  // 50803 Rebuild the Defenses.
  { line: "50803:A:1", name: "Setup: the player searches the encounter deck for the Gate of Annúminas (a location) and adds it to the staging area", layout: { stage: "50803", deck: ["f0", GATE, "50821"] }, act: resolve("50803", "setup"), expect: [zone(GATE, "staging")] },
  { line: "50803:B:1", name: "Forced: a resource each round", layout: { threat: [0, 0], stage: "50803", staging: [CITY(20)], deck: PLACES }, act: endRound, expect: [resourcesOn("50803", 1)] },
  { line: "50803:B:1", name: "with 4 resources the quest advances to stage 2", layout: { threat: [0, 0], stage: "50803", staging: [CITY(20)], phase: "Planning", deck: PLACES }, act: [endRound, endRound, endRound, endRound], expect: [zone("50804", "questStage")] },
  // 50804 Defend the City.
  { line: "50804:A:1", name: "When Revealed: with two players an enemy is discarded from the top and added to the staging area, the discard pile shuffled in first", layout: { stage: "50804", seats: 2, deck: ["f0", "f3", "f0"], discard: ["f3"] }, act: resolve("50804", "whenRevealed"), expect: [count("f3", "staging", 1)] },
  { line: "50804:B:1", name: "-10 quest points for each Host of Angmar in the victory display", layout: { stage: "50804", victory: [HOST, HOST] }, act: [], expect: [stat("50804", "questPoints", 30)] },
  { line: "50804:B:2", name: "Forced: the highest Attack enemy in the staging area attacks the player", layout: { stage: "50804", staging: ["f0", ORC] }, act: announce("stagingStepBegins"), expect: [window("defense")] },
  { line: "50804:B:2", name: "with no enemy there, the top card of the encounter deck is revealed", layout: { stage: "50804", staging: [CITY(20)], deck: ["place", "f0", "f0"] }, act: announce("stagingStepBegins"), expect: [zone("place", "staging")] },
  // 50805 Lead the Sortie.
  { line: "50805:A:1", name: "When Revealed: the first player adds Battering Ram and the Lieutenant to the staging area and each other player reveals a card", layout: { stage: "50805", seats: 2, setAside: [RAM, LIEUTENANT], deck: ["f0", "f0"] }, act: resolve("50805", "whenRevealed"), expect: [zone(RAM, "staging"), zone(LIEUTENANT, "staging"), deckCount(1)] },
  { line: "50805:B:1", name: "no progress can be placed on the stage while Battering Ram is in the staging area", layout: { stage: "50805", staging: [RAM], progress: 0, ...ADVANCING }, act: quest("success"), expect: [progressOn("50805", 0)] },
  { line: "50805:B:3", name: "the Lieutenant in the victory display at the end of the round wins the game", layout: { threat: [0, 0], stage: "50805", victory: [LIEUTENANT], staging: [CITY(20)], deck: PLACES }, act: endRound, expect: [won] },
  // 50812 Annúminas.
  { line: "50812:A:1", name: "Forced: 1 damage for each enemy in play at the end of the round", layout: { threat: [0, 0], stage: "50804", staging: [CITY(20), "f3", "f3", "f3"], deck: PLACES }, act: endRound, expect: [resourcesOn("50812", 17)] },
  { line: "50812:A:1", name: "the engaged enemies count too", layout: { threat: [0, 0], stage: "50804", staging: [CITY(20), "f3"], engaged: ["f3"], deck: PLACES }, act: endRound, expect: [resourcesOn("50812", 18)] },
  { line: "50812:A:2", name: "the players lose the game when the city strength reaches 0", layout: { threat: [0, 0], stage: "50804", staging: [CITY(2), "f3", "f3", "f3"], deck: PLACES }, act: endRound, expect: [lost] },
  // 50813 Lieutenant of Angmar.
  { line: "50813:A:2", name: "it cannot take damage with less than 10 progress on the main quest", layout: { stage: "50805", progress: 9, staging: [LIEUTENANT] }, act: [], expect: [flag(LIEUTENANT, "cannotTakeDamage")] },
  { line: "50813:A:3", name: "Forced: at the end of the round it makes an immediate attack against the first player", layout: { stage: "50805", staging: [CITY(20), LIEUTENANT], deck: PLACES }, act: END_OF_ROUND, expect: [window("defense")] },
  // 50814 Battering Ram.
  { line: "50814:A:1", name: "X is 1 more than the resources on it", layout: { stage: "50805", staging: [{ code: RAM, resources: 2 }] }, act: [], expect: [stat(RAM, "threat", 3)] },
  { line: "50814:A:2", name: "Forced: a resource is placed first, then X damage is dealt to Annúminas", layout: { stage: "50805", staging: [CITY(20), RAM], deck: PLACES }, act: END_OF_ROUND, expect: [resourcesOn("50812", 18), resourcesOn(RAM, 1)] },
  { line: "50814:A:3", name: "Travel: reveal 1 encounter card per player", layout: { stage: "50805", seats: 2, phase: "Travel", staging: [RAM], deck: PLACES }, act: travel(RAM), expect: [deckCount(4)] },
  // 50815 Enemy Camp and 50816 Siege Tunnel (Epic cards: the Forced of Enemy Camp is a test in lines.test.ts).
  { line: "50815:A:3", name: "Travel: reveal 1 encounter card per player", layout: { stage: "50805", seats: 2, phase: "Travel", staging: ["50815"], deck: PLACES }, act: travel("50815"), expect: [deckCount(4)] },
  { line: "50816:A:2", name: "Forced: at the end of the round the first enemy discarded from the top of the deck is added to the staging area", layout: { stage: "50805", staging: [CITY(20), "50816"], deck: ["place", "f3", "f0"] }, act: END_OF_ROUND, expect: [count("f3", "staging", 1), zone("place", "encounterDiscard")] },
  { line: "50816:A:3", name: "Travel: reveal 1 encounter card per player", layout: { stage: "50805", seats: 2, phase: "Travel", staging: ["50816"], deck: PLACES }, act: travel("50816"), expect: [count("place", "staging", 2)] },
  // 50817 Host of Angmar.
  { line: "50817:A:3", name: "Forced: after it destroys a character the first player may return it to the staging area", layout: { stage: "50805", progress: 5, engaged: [HOST], play: ["ally"] }, act: [attack(HOST), defend("ally"), answer("staging")], expect: [zone(HOST, "staging")] },
  // 50818 Dúnedain of Annúminas.
  { line: "50818:A:2", name: "When Revealed: a player may spend 1 resource to take control of it", layout: { stage: "50804", heroResources: 2, deck: ["f0", "f0"] }, act: [reveal(DUNEDAIN), answer("control")], expect: [zone(DUNEDAIN, "play")] },
  { line: "50818:A:2", name: "otherwise it is discarded", layout: { stage: "50804", heroResources: 2, deck: ["f0", "f0"] }, act: [reveal(DUNEDAIN), answer("discard")], expect: [zone(DUNEDAIN, "encounterDiscard")] },
  { line: "50818:A:3", name: "Shadow: the defending character is readied and gets +2 Defense", layout: { engaged: [HOST] }, act: [attack(HOST, { shadow: DUNEDAIN }), defend("dh1")], expect: [exhausted("dh1", false), damageOn("dh1", 5)] },
  // 50819 Gate of Annúminas.
  { line: "50819:A:1", name: "X is 1 more than the enemies in play", layout: { stage: "50805", staging: [GATE, WARG], engaged: [ORC] }, act: [], expect: [stat(GATE, "threat", 3)] },
  { line: "50819:A:2", name: "Travel: each player engages an enemy in the staging area", layout: { stage: "50805", phase: "Travel", staging: [GATE, WARG] }, act: travel(GATE), expect: [zone(WARG, "engaged")] },
  // 50820 City Wall.
  { line: "50820:A:2", name: "Forced: a resource each round", layout: { threat: [0, 0], stage: "50804", staging: [CITY(20), "50820"], deck: PLACES }, act: endRound, expect: [resourcesOn("50820", 1), resourcesOn("50812", 20)] },
  { line: "50820:A:2", name: "with 3 resources it is discarded, deals 4 damage to Annúminas and an encounter card is revealed", layout: { threat: [0, 0], stage: "50804", staging: [CITY(20), { code: "50820", resources: 2 }], deck: ["place", "f0", "f0", "f0"] }, act: endRound, expect: [zone("50820", "encounterDiscard"), resourcesOn("50812", 15), zone("place", "staging")] },
  // 50821 Arnor Battlefield, 50822 Hills of Evendim, 50823 Shores of Lake Nenuial.
  { line: "50821:A:1", name: "each non-unique enemy gets -5 engagement cost while it is in the staging area", layout: { stage: "50805", staging: ["50821", WARG] }, act: [], expect: [stat(WARG, "engagementCost", 15)] },
  { line: "50821:A:2", name: "Travel: each player deals 1 damage to a hero he controls", layout: { stage: "50805", phase: "Travel", staging: ["50821"] }, act: travel("50821"), expect: [damageOn("dh1", 1)] },
  { line: "50822:A:2", name: "Travel: the discard pile is shuffled in and the first enemy discarded is added to the staging area", layout: { stage: "50805", phase: "Travel", staging: ["50822"], deck: ["place", "f3", "f0"], discard: ["f0"] }, act: travel("50822"), expect: [count("f3", "staging", 1)] },
  { line: "50823:A:1", name: "no progress can be placed on the other locations in the staging area", layout: { stage: "50805", staging: ["50823", "place"] }, act: [], expect: [flag("place", "noProgressPlaced" as never, true)] },
  { line: "50823:A:2", name: "Travel: each player raises his threat by 2", layout: { stage: "50805", phase: "Travel", staging: ["50823"], threat: [30, 30] }, act: travel("50823"), expect: [threat(33)] },
  // 50824 Warg of Carn Dûm, 50826 Angmar Warg-rider.
  { line: "50824:A:2", name: "Forced: after it engages you remove 1 progress from the main quest", layout: { stage: "50805", progress: 5, staging: [WARG] }, act: [announce("engaged", WARG), answer("progress")], expect: [progressOn("50805", 4)] },
  { line: "50824:A:2", name: "or exhaust a character you control", layout: { stage: "50805", progress: 5, staging: [WARG] }, act: [announce("engaged", WARG), answer("exhaust")], expect: [exhausted("dh1")] },
  { line: "50826:A:2", name: "Forced: after it engages you remove 2 progress from the main quest", layout: { stage: "50805", progress: 5, staging: [RIDER] }, act: [announce("engaged", RIDER), answer("progress")], expect: [progressOn("50805", 3)] },
  { line: "50826:A:2", name: "or it makes an immediate attack", layout: { stage: "50805", progress: 5, engaged: [RIDER], deck: PLACES }, act: [announce("engaged", RIDER), answer("attack")], expect: [window("defense")] },
  { line: "50826:A:3", name: "Shadow: exhaust a character you control", layout: { engaged: ["f3"] }, act: attack("f3", { shadow: RIDER, undefended: true }), expect: [exhausted("dh1")] },
  // 50825 Orc of Angmar.
  { line: "50825:A:2", name: "Forced: when it attacks remove 1 progress from the main quest", layout: { stage: "50805", progress: 5, engaged: [ORC] }, act: [attack(ORC, { undefended: true }), answer("progress")], expect: [progressOn("50805", 4)] },
  { line: "50825:A:2", name: "or it gets +2 Defense until the end of the phase", layout: { stage: "50805", progress: 5, engaged: [ORC] }, act: [attack(ORC, { undefended: true }), answer("defense")], expect: [stat(ORC, "defense", 4)] },
  { line: "50825:A:3", name: "Shadow: the defender gets -2 Defense until the end of the round", layout: { engaged: ["f3"] }, act: [attack("f3", { shadow: ORC }), defend("dh1")], expect: [stat("dh1", "defense", 0)] },
  // 50827 Savage Werewolf.
  { line: "50827:A:1", name: "Forced: after it destroys a character remove 3 progress from the main quest", layout: { stage: "50805", progress: 5, engaged: [WEREWOLF], play: ["ally"] }, act: [attack(WEREWOLF), defend("ally")], expect: [progressOn("50805", 2)] },
  { line: "50827:A:2", name: "Shadow: the attacking enemy makes an additional attack against you after this one", layout: { engaged: ["f3"], deck: PLACES }, act: attack("f3", { shadow: WEREWOLF, undefended: true }), expect: [damageOn("dh1", 2)] },
  // 50828 Vanguard of Carn Dûm.
  { line: "50828:A:3", name: "Shadow: the defender cannot ready this round", layout: { engaged: ["f3"] }, act: [attack("f3", { shadow: VANGUARD }), defend("dh1")], expect: [flag("dh1", "doesNotReady")] },
  // 50829 The Hordes of Angmar.
  { line: "50829:A:1", name: "When Revealed: the player returns the highest Threat enemy engaged with him to the staging area", layout: { stage: "50805", engaged: [WARG, ORC], deck: ["f0"] }, act: [reveal(HORDES), answer("return")], expect: [zone(ORC, "staging"), zone(WARG, "engaged")] },
  { line: "50829:A:1", name: "or searches the encounter deck for an enemy and puts it into play engaged with him", layout: { stage: "50805", deck: [WARG, "f0"] }, act: reveal(HORDES), expect: [zone(WARG, "engaged")] },
  { line: "50829:A:2", name: "Shadow: if the attack destroys a character, reveal the top card of the encounter deck", layout: { stage: "50805", engaged: [WEREWOLF], play: ["ally"], deck: ["place", "f0"] }, act: [attack(WEREWOLF, { shadow: HORDES }), defend("ally")], expect: [zone("place", "staging")] },
  // 50830 Sorcery of Carn Dûm.
  { line: "50830:A:2", name: "When Revealed: the player discards his highest cost attachment", layout: { stage: "50805", attached: [{ code: "attachment", to: "dh1" }], deck: ["f0"] }, act: [reveal(SORCERY), answer("discard")], expect: [zone("attachment", "discard")] },
  { line: "50830:A:2", name: "or assigns X damage among characters he controls, X the attachments he controls", layout: { stage: "50805", attached: [{ code: "attachment", to: "dh1" }], deck: ["f0"] }, act: [reveal(SORCERY), answer("damage")], expect: [damageOn("dh1", 1)] },
  { line: "50830:A:3", name: "Shadow: discard an attachment you control", layout: { engaged: ["f3"], attached: [{ code: "attachment", to: "dh1" }] }, act: attack("f3", { shadow: SORCERY, undefended: true }), expect: [zone("attachment", "discard")] },
  // 50831 Caught in the Press.
  { line: "50831:A:1", name: "When Revealed: 1 damage to each questing character the player controls", layout: { stage: "50805", committed: ["dh1"], deck: ["f0"] }, act: [reveal(PRESS), answer("damage")], expect: [damageOn("dh1", 1)] },
  { line: "50831:A:1", name: "or each questing character gets -1 Willpower until the end of the phase", layout: { stage: "50805", committed: ["dh1"], deck: ["f0"] }, act: [reveal(PRESS), answer("willpower")], expect: [stat("dh1", "willpower", 1)] },
  { line: "50831:A:2", name: "Shadow: remove 2 progress from the main quest", layout: { stage: "50805", progress: 5, engaged: ["f3"] }, act: [attack("f3", { shadow: PRESS, undefended: true }), answer("progress")], expect: [progressOn("50805", 3)] },
  { line: "50831:A:2", name: "or return the attacking enemy to the staging area after this attack", layout: { stage: "50805", progress: 5, engaged: ["f3"] }, act: [attack("f3", { shadow: PRESS, undefended: true }), answer("staging")], expect: [zone("f3", "staging")] },
  // 50832 Weary Warriors.
  { line: "50832:A:1", name: "When Revealed: each player deals 1 damage to a hero he controls; a questing hero is removed from the quest", layout: { stage: "50805", committed: ["dh1"], deck: ["f0"] }, act: reveal(WEARY), expect: [damageOn("dh1", 1), exhausted("dh1", false)] },
  { line: "50832:A:2", name: "Shadow: the attacker gets +1 Attack", layout: { engaged: ["f3"] }, act: attack("f3", { shadow: WEARY, undefended: true }), expect: [damageOn("dh1", 2)] },
  { line: "50832:A:2", name: "+2 Attack instead if the defender is damaged", layout: { engaged: ["f3"], play: [{ code: "ally", damage: 1 }] }, act: [attack("f3", { shadow: WEARY }), defend("ally")], expect: [damageOn("ally", 3)] },

  // 50820:A:3 "Travel: Reveal the top card of the encounter deck to travel here." One card, not one for each player: with two players one card of three leaves the deck.
  { line: "50820:A:3", name: "Travel: the top card of the encounter deck is revealed", layout: { stage: "50805", seats: 2, phase: "Travel", staging: ["50820"], deck: ["place", "f0", "f0"] }, act: travel("50820"), expect: [zone("place", "staging"), zone("50820", "activeLocation"), deckCount(2)] },
];

if (ROWS.length > 0) cardSpecs("the-siege-of-annuminas", ROWS);
