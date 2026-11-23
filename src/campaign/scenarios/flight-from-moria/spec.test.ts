// Rules: rr.reveal, rr.staging, rr.damage, rr.shadow-effects, rr.guarded, rr.attachment-cards, rr.blank, rr.victory, dwd.the-nameless-fear, dwd.creating-the-quest-deck, dwd.encounter-card-actions, dwd.last-player (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, committed, count, damageOn, deckCount, defend, exhausted, flag, lost, progressOn, quest, resolve, reveal, side, stat, threat, won, zone, type Act, type Row } from "../../../../test/harness/card-spec.ts";
import type { Layout } from "../../../../test/harness/scene-kit.ts";

// Card specs for Flight from Moria (dwarrowdelf part 3): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests). The stage 2s and their quest-deck behaviour are in lines.test.ts (several steps each).
// Victory 3 on the Great Cave-troll (03042) in the victory display makes The Nameless Fear's X 3.
const FEAR_X3 = { staging: ["03025"], victory: ["03042"] } as const;

// The bypass: the end of the combat phase, the first player answers for the group; the stage keeps no progress and goes to the quest deck.
const BYPASS_ACT: readonly Act[] = [announce("endOfPhase", undefined, { phase: "Combat" }), answer("bypass")];
const bypassing = (stage: string): Layout => ({ stage, progress: 2, phase: "Combat" });
// A stage 2 that arrived side A and flips as the staging step begins.
const flipping = (stage: string, more: Layout = {}): Layout => ({ stage, side: "A", ...more });
const FLIP: Act = announce("stagingStepBegins");

const ROWS: readonly Row[] = [
  // 03025 The Nameless Fear: cannot engage or be engaged; Threat, Attack and Defense are the Victory points of the victory display, read live.
  { line: "03025:A:2", name: "it cannot be engaged", layout: { staging: ["03025"] }, act: [], expect: flag("03025", "cannotBeEngaged") },
  { line: "03025:A:3", name: "its Threat, Attack and Defense are the Victory points in the victory display", layout: FEAR_X3, act: [], expect: [stat("03025", "threat", 3), stat("03025", "attack", 3), stat("03025", "defense", 3)] },

  // 03026 New Devilry.
  { line: "03026:A:1", name: "on stage 1 it gains surge: one more card is revealed", layout: { stage: "03069", deck: ["f0", "f0"] }, act: reveal("03026"), expect: deckCount(1) },
  { line: "03026:A:2", name: "its Shadow raises the threat of the undefended player by The Nameless Fear's Threat", layout: FEAR_X3, act: attack("f0", { shadow: "03026", undefended: true }), expect: threat(31) },

  // 03027 Shadow of Fear.
  { line: "03027:A:1", name: "it attaches to a hero of the first player, who cannot exhaust or ready and whose text box is blank", layout: { deck: ["f0"] }, act: reveal("03027"), expect: [flag("dh1", "cannotExhaust"), flag("dh1", "cannotReady"), flag("dh1", "blankText")] },
  { line: "03027:A:1", name: "its Action: any player discards 3 resources from the attached hero's pool to discard it", layout: { attached: [{ code: "03027", to: "dh1" }], heroResources: 3 }, act: resolve("03027", "action"), expect: [zone("03027", "encounterDiscard")] },

  // 03028 A Foe Beyond.
  { line: "03028:A:1", name: "the last player's hero takes damage equal to The Nameless Fear's Attack", layout: FEAR_X3, act: reveal("03028"), expect: damageOn("dh1", 3) },
  { line: "03028:A:2", name: "its Shadow: the defending character takes damage equal to The Nameless Fear's Attack", layout: FEAR_X3, act: [attack("f0", { shadow: "03028" }), defend("dh1")], expect: damageOn("dh1", 3) },

  // 03029 Abandoned Tools.
  { line: "03029:A:1", name: "revealed from the encounter deck it is Guarded: the next card is attached to it", layout: { deck: ["f0", "f0"] }, act: reveal("03029"), expect: deckCount(1) },
  { line: "03029:A:2", name: "a ready hero exhausts to claim it from the staging area and it attaches to that hero", layout: { staging: ["03029"] }, act: [resolve("03029", "action"), answer("dh1")], expect: [zone("03029", "attached"), exhausted("dh1")] },
  { line: "03029:A:2", name: "a hero that cannot exhaust is not offered: Shadow of Fear on dh1 leaves dh2 the only hero that claims", layout: { staging: ["03029"], attached: [{ code: "03027", to: "dh1" }] }, act: resolve("03029", "action"), expect: [zone("03029", "attached"), exhausted("dh2"), exhausted("dh1", false)] },

  // 03042 Great Cave-troll and 03043 Orc Drummer.
  { line: "03042:A:1", name: "characters that attack it by the ranged keyword deal it no damage", layout: { staging: ["03042"] }, act: [], expect: flag("03042", "immuneToRangedDamage") },
  { line: "03042:A:2", name: "no attachments can be played on it", layout: { staging: ["03042"] }, act: [], expect: flag("03042", "cannotHaveAttachments") },
  { line: "03043:A:1", name: "each enemy in play gets +X Threat while it is in the staging area, X the players", layout: { staging: ["03043", "f0"] }, act: [], expect: [stat("f0", "threat", 1), stat("03043", "threat", 2)] },

  // 03044 Stray Goblin, 03046 Massing in the Deep, 03047 The Mountains' Roots: X is the number of players.
  { line: "03044:A:1", name: "Threat and Attack are X, the players", layout: { seats: 2, staging: ["03044"] }, act: [], expect: [stat("03044", "threat", 2), stat("03044", "attack", 2)] },
  { line: "03044:A:2", name: "its Shadow gives the attacker +X Attack, X the players", layout: { seats: 2 }, act: attack("f0", { shadow: "03044", undefended: true }), expect: damageOn("dh1", 3) },
  { line: "03045:A:1", name: "the topmost enemy of the encounter discard pile is put into play engaged with the first player, not revealed", layout: { discard: ["f3"], deck: ["f0"] }, act: reveal("03045"), expect: [zone("f3", "engaged"), deckCount(1)] },
  { line: "03045:A:1", name: "with no enemy in the discard pile it gains surge", layout: { discard: ["place"], deck: ["f0", "f0"] }, act: reveal("03045"), expect: deckCount(1) },
  { line: "03045:A:2", name: "its Shadow gives the attacker +3 Attack when the attacked player is the first player", layout: {}, act: attack("f0", { shadow: "03045", undefended: true }), expect: damageOn("dh1", 4) },
  { line: "03045:A:2", name: "its Shadow gives the attacker +1 Attack when the attacked player is not the first player", layout: { seats: 2, firstPlayer: 1 }, act: attack("f0", { shadow: "03045", undefended: true }), expect: damageOn("dh1", 2) },
  { line: "03046:A:2", name: "each player reveals 1 more card", layout: { seats: 2, deck: ["f0", "f0", "f0"] }, act: reveal("03046"), expect: deckCount(1) },
  { line: "03046:A:3", name: "its Shadow gives the attacker +X Attack, X the players", layout: { seats: 2 }, act: attack("f0", { shadow: "03046", undefended: true }), expect: damageOn("dh1", 3) },
  { line: "03047:A:1", name: "Threat and quest points are X, the players", layout: { seats: 2, staging: ["03047"] }, act: [], expect: [stat("03047", "threat", 2)] },
  { line: "03047:A:2", name: "its Shadow gives the attacker +X Attack, X the players", layout: { seats: 2 }, act: attack("f0", { shadow: "03047", undefended: true }), expect: damageOn("dh1", 3) },

  // 03069 A Presence in the Dark (stage 1).
  { line: "03069:A:1", name: "Setup shuffles 1 set aside copy of A Foe Beyond per player into the encounter deck", layout: { stage: "03069", side: "A", setAside: ["03028", "03028"], deck: ["f0"] }, act: resolve("03069", "setup"), expect: [deckCount(2)] },
  { line: "03069:B:1", name: "each player reveals 1 card into the staging area, and stage 1 goes to the victory display as the quest advances", layout: { stage: "03069", seats: 2, deck: ["f0", "f3", "f0"] }, act: resolve("03069", "whenRevealed"), expect: [zone("f0", "staging"), zone("f3", "staging"), deckCount(1), zone("03069", "victory")] },

  // The flip at the beginning of the staging step, one line on each stage 2 (A:1): side B shows and its When Revealed resolves.
  { line: "03070:A:1", name: "Heading Down shows side B as the staging step begins", layout: flipping("03070"), act: FLIP, expect: side("03070", "B") },
  { line: "03071:A:1", name: "Heading Up shows side B as the staging step begins", layout: flipping("03071"), act: FLIP, expect: side("03071", "B") },
  { line: "03072:A:1", name: "stage 2B shows as the staging step begins and its When Revealed reveals 1 card per player", layout: flipping("03072", { deck: ["f0", "f0"] }), act: FLIP, expect: [side("03072", "B"), deckCount(1)] },
  { line: "03073:A:1", name: "Narrow Paths shows side B as the staging step begins", layout: flipping("03073"), act: FLIP, expect: side("03073", "B") },
  { line: "03074:A:1", name: "Hasty Council shows side B as the staging step begins", layout: flipping("03074"), act: [FLIP, answer("03076")], expect: [side("03076", "B"), zone("03075", "questDeck")] },
  { line: "03075:A:1", name: "Blocked by Shadow shows side B as the staging step begins", layout: flipping("03075"), act: FLIP, expect: side("03075", "B") },
  { line: "03076:A:1", name: "Escape from Darkness shows side B as the staging step begins", layout: flipping("03076"), act: FLIP, expect: side("03076", "B") },

  // 03070 Heading Down and 03071 Heading Up.
  { line: "03070:B:1", name: "at the end of a quest phase with Heading Up in the victory display it is shuffled back into the quest deck", layout: { stage: "03070", victory: ["03071"] }, act: announce("endOfPhase", undefined, { phase: "Quest" }), expect: [count("03071", "victory", 0), count("03071", "questDeck", 2)] },
  { line: "03070:B:2", name: "the players may bypass it at the end of the combat phase", layout: bypassing("03070"), act: BYPASS_ACT, expect: [progressOn("03070", 0), zone("03070", "questDeck")] },
  { line: "03071:B:1", name: "at the end of a quest phase with Heading Down in the victory display it is shuffled back into the quest deck", layout: { stage: "03071", victory: ["03070"] }, act: announce("endOfPhase", undefined, { phase: "Quest" }), expect: [count("03070", "victory", 0), count("03070", "questDeck", 1)] },
  { line: "03071:B:2", name: "the players may bypass it at the end of the combat phase", layout: bypassing("03071"), act: BYPASS_ACT, expect: [progressOn("03071", 0), zone("03071", "questDeck")] },

  // 03072 Search for an Exit.
  { line: "03072:B:1", name: "each player reveals 1 card and adds it to the staging area", layout: { stage: "03072", seats: 2, deck: ["f0", "f3", "f0"] }, act: resolve("03072", "whenRevealed"), expect: [zone("f0", "staging"), zone("f3", "staging"), deckCount(1)] },
  { line: "03072:B:2", name: "the players may bypass it at the end of the combat phase", layout: bypassing("03072"), act: BYPASS_ACT, expect: [progressOn("03072", 0), zone("03072", "questDeck")] },

  // 03073 Narrow Paths.
  { line: "03073:B:1", name: "each player chooses 1 questing character: the others do not count their Willpower", layout: { stage: "03073", committed: ["dh1", "dh2"] }, act: [resolve("03073", "whenRevealed"), answer("dh1")], expect: [flag("dh1", "countsWillpower"), flag("dh2", "countsWillpower", false)] },
  { line: "03073:B:2", name: "after the 1st progress token the encounter deck is searched for Abandoned Tools, which joins the staging area", layout: { stage: "03073", progress: 2, deck: ["f0", "03029"] }, act: announce("progressPlaced", "03073", { amount: 2 }), expect: [zone("03029", "staging")] },
  { line: "03073:B:3", name: "the players may bypass it at the end of the combat phase", layout: bypassing("03073"), act: BYPASS_ACT, expect: [progressOn("03073", 0), zone("03073", "questDeck")] },

  // 03074 Hasty Council.
  { line: "03074:B:1", name: "A Foe Beyond returns from the discard pile, the first player chooses 1 of the top 2 stages and it is flipped at once, and Hasty Council goes to the victory display", layout: { stage: "03074", discard: ["03028"], deck: ["f0"] }, act: [resolve("03074", "whenRevealed"), answer("03076")], expect: [zone("03028", "encounterDeck"), zone("03076", "questStage"), side("03076", "B"), zone("03074", "victory"), zone("03075", "questDeck")] },

  // 03075 Blocked by Shadow.
  { line: "03075:B:1", name: "the first player chooses 1 of the two options: the second reveals the next quest card", layout: { stage: "03075" }, act: [resolve("03075", "whenRevealed"), answer("next")], expect: [zone("03076", "questStage"), zone("03075", "questDeck")] },
  { line: "03075:B:2", name: "each player discards the top card of the encounter deck, and a treachery eliminates the player who discarded it", layout: { stage: "03075", deck: ["treachery", "f0"] }, act: [resolve("03075", "whenRevealed"), answer("discard")], expect: lost },
  { line: "03075:B:2", name: "a card that is not a treachery is only discarded", layout: { stage: "03075", deck: ["f0", "f0"] }, act: [resolve("03075", "whenRevealed"), answer("discard")], expect: [zone("f0", "encounterDiscard"), deckCount(1)] },
  { line: "03075:B:3", name: "or the next quest card is revealed and Blocked by Shadow goes to the bottom of the quest deck with no progress", layout: { stage: "03075", progress: 3 }, act: [resolve("03075", "whenRevealed"), answer("next")], expect: [zone("03075", "questDeck"), progressOn("03075", 0), zone("03076", "questStage")] },
  { line: "03075:B:4", name: "the players may bypass it at the end of the combat phase", layout: bypassing("03075"), act: BYPASS_ACT, expect: [progressOn("03075", 0), zone("03075", "questDeck")] },
  { line: "03075:B:5", name: "defeating it wins the game", layout: { stage: "03075", progress: 9 }, act: announce("questCardDefeated", "03075"), expect: won },

  // 03076 Escape from Darkness.
  { line: "03076:B:1", name: "the Refresh Action: a ready hero with the Tools exhausts to put 1 progress token on the stage", layout: { stage: "03076", phase: "Refresh", attached: [{ code: "03029", to: "dh1" }] }, act: resolve("03076", "action"), expect: [exhausted("dh1"), progressOn("03076", 1)] },
  { line: "03076:B:2", name: "the players may bypass it at the end of the combat phase", layout: { ...bypassing("03076"), piles: { questDeck: ["03072"] } }, act: BYPASS_ACT, expect: [progressOn("03076", 0), zone("03076", "questDeck")] },
  { line: "03076:B:3", name: "questing places no progress token on it", layout: { stage: "03076" }, act: quest("success"), expect: progressOn("03076", 0) },
  { line: "03076:B:4", name: "defeating it wins the game", layout: { stage: "03076", progress: 4, piles: { questDeck: ["03072"] } }, act: announce("questCardDefeated", "03076"), expect: won },

  // The Nightmare deck (901201 to 901209).
  { line: "901202:A:1", name: "Pursued by Shadow shows side B as the staging step begins", layout: flipping("901202"), act: FLIP, expect: side("901202", "B") },
  { line: "901202:B:1", name: "at the end of the round the discard pile is shuffled in, the top 5 are discarded and each A Foe Beyond among them resolves", layout: { stage: "901202", discard: ["03028"], deck: ["f0", "f0", "f0", "f0"], ...FEAR_X3 }, act: announce("endOfRound"), expect: [damageOn("dh1", 3), deckCount(0)] },
  { line: "901202:B:2", name: "no more than 1 progress token a round is placed on it", layout: { stage: "901202" }, act: quest("success"), expect: progressOn("901202", 1) },
  { line: "901202:B:3", name: "defeating it wins the game", layout: { stage: "901202", progress: 5, piles: { questDeck: ["03072"] } }, act: announce("questCardDefeated", "901202"), expect: won },
  { line: "901202:B:4", name: "the players may bypass it at the end of the combat phase", layout: bypassing("901202"), act: BYPASS_ACT, expect: [progressOn("901202", 0), zone("901202", "questDeck")] },
  { line: "901203:A:1", name: "Blocked by Flame shows side B as the staging step begins", layout: flipping("901203"), act: FLIP, expect: side("901203", "B") },
  { line: "901203:B:1", name: "every character may be declared as an attacker against The Nameless Fear in the staging area", layout: { stage: "901203", staging: ["03025"] }, act: [], expect: flag("03025", "attackableByAny") },
  { line: "901203:B:2", name: "with 10 damage on The Nameless Fear all its damage is removed and the stage advances to the victory display", layout: { stage: "901203", staging: [{ code: "03025", damage: 10 }] }, act: announce("damaged", "03025"), expect: [damageOn("03025", 0), count("901203", "victory", 1)] },
  { line: "901203:B:3", name: "the players may bypass it at the end of the combat phase", layout: bypassing("901203"), act: BYPASS_ACT, expect: [progressOn("901203", 0), zone("901203", "questDeck")] },
  { line: "901204:A:1", name: "Ghâsh shows side B as the staging step begins", layout: flipping("901204"), act: FLIP, expect: side("901204", "B") },
  { line: "901204:B:1", name: "each questing character takes 1 damage", layout: { stage: "901204", committed: ["dh1", "dh2"] }, act: resolve("901204", "whenRevealed"), expect: [damageOn("dh1", 1), damageOn("dh2", 1)] },
  { line: "901204:B:2", name: "the players may bypass it at the end of the combat phase", layout: { ...bypassing("901204"), piles: { questDeck: ["03072"] } }, act: BYPASS_ACT, expect: [progressOn("901204", 0), zone("901204", "questDeck")] },
  { line: "901205:A:2", name: "when a stage is bypassed Swarming Goblins engaged with a player puts a Goblin Spearman from the discard pile into play engaged with him", layout: { engaged: ["901205"], discard: ["03031"] }, act: announce("stageBypassed"), expect: zone("03031", "engaged") },
  { line: "901206:A:1", name: "Coal-Black Orc's Threat and Attack are the Victory points in the victory display", layout: { staging: ["901206"], victory: ["03042"] }, act: [], expect: [stat("901206", "threat", 3), stat("901206", "attack", 3)] },
  { line: "901206:A:2", name: "its Shadow gives the attacker +X Attack, X the Victory points in the victory display", layout: { victory: ["03042"] }, act: attack("f0", { shadow: "901206", undefended: true }), expect: damageOn("dh1", 4) },
  { line: "901207:A:1", name: "each copy in play makes a bypass cost each player 2 threat", layout: { ...bypassing("03072"), staging: ["901207"] }, act: BYPASS_ACT, expect: threat(31) },
  { line: "901207:A:2", name: "its Shadow discards the resources of the defending hero and the attacker is dealt another shadow card for each", layout: { heroResources: 2, deck: ["f0", "f0", "f0"] }, act: [attack("f0", { shadow: "901207" }), defend("dh1")], expect: [deckCount(1)] },
  { line: "901208:A:1", name: "the first player removes questing characters, any player's, until the Willpower removed is at least The Nameless Fear's Threat", layout: { ...FEAR_X3, committed: ["dh1", "dh2"], deck: ["f0"] }, act: reveal("901208"), expect: [committed("dh1", false), committed("dh2", false)] },
  { line: "901208:A:2", name: "its Shadow discards each attachment the defending player controls that costs less than The Nameless Fear's Threat", layout: { ...FEAR_X3, attached: [{ code: "attachment", to: "dh1" }] }, act: [attack("f0", { shadow: "901208" }), defend("dh1")], expect: zone("attachment", "discard") },
  { line: "901209:A:2", name: "An Evil Fortune goes to the victory display when revealed", layout: { deck: ["f0"] }, act: reveal("901209"), expect: zone("901209", "victory") },
  { line: "901209:A:3", name: "its Shadow goes to the victory display after an attack that destroyed a character", layout: { play: ["ally"] }, act: [attack("03030", { shadow: "901209" }), defend("ally")], expect: zone("901209", "victory") },
];

if (ROWS.length > 0) cardSpecs("flight-from-moria", ROWS);
else describe("flight-from-moria card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
