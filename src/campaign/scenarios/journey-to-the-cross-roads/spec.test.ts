// Rules: mec112.setup-journey-to-the-cross-roads, mec112.multiplayer-the-one-ring, rr.forced, rr.reveal, rr.search, rr.travel, rr.engaged, rr.effects, rr.shadow-effects, rr.attacks-outside-the-combat-phase, faq.additional-attacks (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, damageOn, deckCount, defend, drew, endPhase, exhausted, flag, lost, resolve, reveal, stat, threat, travel, won, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Journey to the Cross-roads (the-two-towers part 5): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish). What a row cannot hold (a bar that is
// only checked by what is refused, a Forced effect that must not fire, a search of the deck alone, an effect that reaches the enemies arriving later) is a titled test of lines.test.ts in this folder.
// The Harad deck is the pile `haradDeck`, The Black Gate is a card in the staging area and the cards under it are the layout's `under`. scripts/checks/spec-coverage.test.ts fails a line with neither a row nor a titled test.
const TWO = { seats: 2 } as const;
const DOOMED_ALLY = { code: "ally", damage: 1 } as const;
const GATE = "144027";
// A Harad enemy facedown under The Black Gate.
const under = (code: string) => ({ code, to: GATE });

export const ROWS: readonly Row[] = [
  // 144014 Brace of Coneys (choose 2, two different options): the Picks over heroes take the hero named by its code.
  { line: "144014:A:2", name: "adds itself to the victory display and takes two different options: draw 2 cards and reduce threat by 2", layout: { phase: "Planning", hand: ["144014"], deckOf: ["f0", "f0", "f0"] }, act: [resolve("144014", "action"), answer("draw"), answer("threat")], expect: [zone("144014", "victory"), drew(2), threat(26)] },
  { line: "144014:A:2", name: "or 2 resources on a hero's pool", layout: { phase: "Planning", hand: ["144014"] }, act: [resolve("144014", "action"), answer("resources"), answer("dh2"), answer("threat")], expect: [stat("dh2", "willpower", 2), threat(26)] },

  // 144027 The Black Gate.
  { line: "144027:A:1", name: "at the end of the planning phase each Harad enemy in the staging area is placed facedown under it, no other enemy", layout: { phase: "Planning", staging: [GATE, "144057", "144058", "f3"] }, act: endPhase, expect: [zone("144057", "under"), zone("144058", "under"), zone("f3", "staging")] },
  { line: "144027:A:2", name: "the players lose at once when the facedown cards under it reach the players plus 3", layout: { phase: "Planning", staging: [GATE, "144057"], under: [under("144028"), under("144029"), under("144058")] }, act: endPhase, expect: lost },

  // 144028 Man of Harad, 144029 Captain of Harad.
  { line: "144028:A:2", name: "after it engages you, 1 random card is discarded from your hand", layout: { staging: ["144028"], hand: ["filler", "filler"] }, act: announce("engaged", "144028"), expect: { expect: "handCount", value: 1, seat: 0 } },
  { line: "144028:A:3", name: "Shadow: 1 random card is discarded from your hand", layout: { hand: ["filler", "filler"] }, act: attack("f3", { shadow: "144028", undefended: true }), expect: { expect: "handCount", value: 1, seat: 0 } },
  { line: "144029:A:1", name: "after it engages you each Harad enemy gets +1 Attack and -10 engagement cost until the end of the round", layout: { staging: ["144029", "144028"] }, act: announce("engaged", "144029"), expect: [stat("144028", "attack", 4), stat("144028", "engagementCost", 26), stat("144029", "attack", 5)] },
  { line: "144029:A:2", name: "Shadow: when the attack destroys a character the attacking enemy is returned to the staging area", layout: { play: [DOOMED_ALLY] }, act: [attack("144057", { shadow: "144029" }), defend("ally")], expect: zone("144057", "staging") },

  // 144031 Henneth Annûn, 144032 Southward Road, 144033 Foothills of Ephel Dúath, 144034 Ithilien Woods, 144035 Hills of Ithilien (lines.test.ts holds the lines that are bars and gains).
  { line: "144031:A:2", name: "after it becomes the active location each engaged enemy returns to the staging area", layout: { phase: "Travel", staging: ["144031"], engaged: ["f3", "144057"] }, act: travel("144031"), expect: [zone("f3", "staging"), zone("144057", "staging")] },
  { line: "144032:A:2", name: "Travel: the top Harad deck card is revealed and added to the staging area to travel here", layout: { phase: "Travel", staging: ["144032"], piles: { haradDeck: ["144057", "144058"] } }, act: travel("144032"), expect: [zone("144032", "activeLocation"), zone("144057", "staging"), zone("144058", "haradDeck")] },
  { line: "144033:A:1", name: "while active each Harad enemy gets -1 Threat", layout: { active: "144033", staging: ["144057", "f3"] }, act: [], expect: [stat("144057", "threat", 1), stat("f3", "threat", 3)] },
  { line: "144033:A:2", name: "Travel: the first player engages an enemy in the staging area to travel here", layout: { phase: "Travel", staging: ["144033", "f3"] }, act: travel("144033"), expect: [zone("144033", "activeLocation"), zone("f3", "engaged")] },
  { line: "144034:A:2", name: "Travel: the first player reveals the top card of the encounter deck to travel here", layout: { phase: "Travel", staging: ["144034"], deck: ["f3", "f0"] }, act: travel("144034"), expect: [zone("144034", "activeLocation"), zone("f3", "staging")] },
  { line: "144035:A:2", name: "Shadow: a non-objective attachment you control is discarded", layout: { attached: [{ code: "attachment", to: "dh1" }] }, act: attack("f3", { shadow: "144035", undefended: true }), expect: zone("attachment", "discard") },

  // 144036 The Dark Lord's Summons, 144037 Marching Up the Road, 144038 Fierce Southrons, 144039 Arrows Thick in the Air.
  { line: "144036:A:2", name: "the first option places the lowest Attack Harad enemy engaged with you facedown under The Black Gate", layout: { staging: [GATE], engaged: ["144029", "144028", "144057"] }, act: reveal("144036"), expect: [zone("144028", "under"), zone("144029", "engaged"), zone("144057", "engaged")] },
  { line: "144036:A:2", name: "the second option reveals the top card under The Cross-roads and puts it into play engaged with you, its Forced effect heard", layout: { staging: [GATE], engaged: ["144057"], hand: ["filler", "filler"], piles: { haradDeck: ["144028", "144056"] } }, act: [reveal("144036"), answer("reveal")], expect: [zone("144028", "engaged"), zone("144057", "engaged"), zone("144056", "haradDeck"), { expect: "handCount", value: 1, seat: 0 }] },
  { line: "144037:A:1", name: "each player either returns an enemy engaged with them to the staging area, or searches the encounter deck for a Harad enemy and puts it into play engaged", layout: { ...TWO, engaged: [{ code: "f3", seat: 0 }], deck: ["f0", "144028", "144057"] }, act: [reveal("144037"), answer("return"), answer("144057")], expect: [zone("f3", "staging"), zone("144057", "engaged"), zone("144028", "encounterDeck")] },
  { line: "144037:A:2", name: "Shadow: the attacking enemy gets +1 Attack", layout: {}, act: attack("f3", { shadow: "144037", undefended: true }), expect: damageOn("dh1", 2) },
  { line: "144037:A:2", name: "and when the attack destroys a character the attacking enemy (not the shadow card) is placed facedown under The Black Gate", layout: { staging: [GATE], play: [DOOMED_ALLY] }, act: [attack("f3", { shadow: "144037" }), defend("ally")], expect: [zone("f3", "under"), zone("144037", "encounterDiscard")] },
  { line: "144038:A:2", name: "the first option places the lowest Threat Harad enemy in the staging area under The Black Gate and reveals an additional card", layout: { staging: [GATE, "144057", "144058", "f0"], deck: ["f3", "f3"] }, act: [reveal("144038"), answer("place")], expect: [zone("144058", "under"), zone("144057", "staging"), zone("f3", "staging")] },
  { line: "144038:A:2", name: "the second option has each enemy in the staging area attack you, each dealt a shadow card", layout: { staging: ["144057"], deck: ["f0", "f0", "f0"] }, act: [reveal("144038"), answer("attack"), endPhase], expect: [damageOn("dh1", 4), deckCount(2)] },
  { line: "144039:A:1", name: "When Revealed: each Harad enemy gains Archery 2 until the end of the round", layout: { staging: ["144028", "f3"] }, act: reveal("144039"), expect: [stat("144028", "archery", 2), stat("f3", "archery", 0)] },
  { line: "144039:A:2", name: "Shadow: the first option places the attacking enemy under The Black Gate after the attack", layout: { staging: [GATE] }, act: [attack("f3", { shadow: "144039", undefended: true }), answer("place")], expect: [zone("f3", "under"), damageOn("dh1", 1)] },
  { line: "144039:A:2", name: "the second option makes an additional attack against you, dealt a new shadow card", layout: { deck: ["f0", "f0"] }, act: [attack("f3", { shadow: "144039", undefended: true }), answer("attack")], expect: [damageOn("dh1", 2), deckCount(1)] },

  // 144056 Oliphaunt, 144057 Haradrim Soldier, 144058 Haradrim Archer.
  { line: "144056:A:1", name: "it cannot have attachments", layout: { engaged: ["144056"] }, act: [], expect: flag("144056", "cannotHaveAttachments") },
  { line: "144056:A:2", name: "after it engages you each ally you control is exhausted", layout: { staging: ["144056"], play: ["ally", "ally"] }, act: announce("engaged", "144056"), expect: exhausted("ally") },
  { line: "144057:A:1", name: "after it engages you it makes an immediate attack", layout: { engaged: [{ code: "144057", seat: 0 }] }, act: [announce("engaged", "144057"), endPhase], expect: damageOn("dh1", 4) },
  { line: "144057:A:2", name: "Shadow: the additional attack against you is dealt a new shadow card", layout: { deck: ["f0", "f0"] }, act: attack("f3", { shadow: "144057", undefended: true }), expect: [damageOn("dh1", 2), deckCount(1)] },
  { line: "144058:A:1", name: "its Threat and Archery are the number of players", layout: { ...TWO, staging: ["144058"] }, act: [], expect: [stat("144058", "threat", 2), stat("144058", "archery", 2)] },
  { line: "144058:A:2", name: "after it engages you X damage is assigned among characters you control", layout: { staging: ["144058"] }, act: announce("engaged", "144058"), expect: damageOn("dh1", 1) },
  { line: "144058:A:3", name: "Shadow: 1 damage to the defending character", layout: {}, act: [attack("f3", { shadow: "144058" }), defend("dh2")], expect: damageOn("dh2", 1) },

  // 144068 Ambush the Men of Harad.
  { line: "144068:A:1", name: "Setup: each player but the first searches the encounter deck for a different non-unique location and adds it to the staging area", layout: { ...TWO, deck: ["f0", "place"] }, act: resolve("144068", "setup"), expect: zone("place", "staging") },
  { line: "144068:B:1", name: "at the beginning of the quest phase the top Harad deck card is revealed and added to the staging area", layout: { phase: "Planning", piles: { haradDeck: ["144057", "144058"] } }, act: endPhase, expect: [zone("144057", "staging"), zone("144058", "haradDeck")] },
  { line: "144068:B:2", name: "when The Cross-roads is explored the players win the game", layout: { active: "144030" }, act: announce("locationExplored", "144030"), expect: won },

  // 144056:A:3 "Shadow: Attacking enemy gets +3 Attack." f0 (1 Attack) undefended deals 4.
  { line: "144056:A:3", name: "Shadow: the attacking enemy gets +3 Attack", layout: {}, act: attack("f0", { shadow: "144056", undefended: true }), expect: damageOn("dh1", 4) },
];

if (ROWS.length > 0) cardSpecs("journey-to-the-cross-roads", ROWS);
else describe("journey-to-the-cross-roads card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
