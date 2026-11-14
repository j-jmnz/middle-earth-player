// Rules: mec112.mire, mec112.gollum-smeagol, mec112.saga-staging-rules, rr.forced, rr.reveal, rr.shadow-effects, rr.first-player, rr.defending-player, rr.effects, rr.cancel (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, damageOn, defend, endPhase, exhausted, flag, quest, resolve, resourcesOn, reveal, revealedBy, stat, threat, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Passage of the Marshes (the-two-towers part 4): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish). What a row cannot hold is a titled test of
// lines.test.ts in this folder (the Mire keyword's refresh step and discards, the gates on the first player's Sméagol, the first player of a stage Forced effect, the Gollum flips) or of verbs.test.ts (the new vocabulary). The mire and
// gollum families' own tests are src/rules/families/mire/index.test.ts and src/rules/families/gollum/index.test.ts. scripts/checks/spec-coverage.test.ts fails a line with neither a row nor a titled test.
const TWO = { seats: 2 } as const;
// Two seats where the second holds the first-player token: an effect that says "the first player" must read seat 1, whoever revealed, attacked or defended.
const SECOND_FIRST = { seats: 2, firstPlayer: 1 } as const;
const DOOMED_ALLY = { code: "ally", damage: 1 } as const;

export const ROWS: readonly Row[] = [
  // 144016 Groping Dead, 144017 Dead Things, 144018 Candle-bearer.
  { line: "144016:A:2", name: "after it destroys a character a mire token is placed on the active location", layout: { active: "144021", play: [DOOMED_ALLY] }, act: [attack("144016"), defend("ally")], expect: resourcesOn("144021", 1) },
  { line: "144016:A:3", name: "Shadow: when the attack destroys a character a mire token is placed on the active location", layout: { active: "144021", play: [DOOMED_ALLY] }, act: [attack("144053", { shadow: "144016" }), defend("ally")], expect: resourcesOn("144021", 1) },
  { line: "144017:A:2", name: "after it destroys a character the defending player raises their threat by 3", layout: { play: [DOOMED_ALLY] }, act: [attack("144017"), defend("ally")], expect: threat(31) },
  { line: "144017:A:3", name: "Shadow: threat rises by 1 for each Undead enemy engaged with the defending player, the attacker not Undead", layout: { engaged: ["f3", "144016", "144018"] }, act: attack("f3", { shadow: "144017", undefended: true }), expect: threat(30) },
  { line: "144018:A:2", name: "after it destroys a character it cannot take damage until the end of the round", layout: { play: [DOOMED_ALLY] }, act: [attack("144018"), defend("ally")], expect: flag("144018", "cannotTakeDamage") },
  { line: "144018:A:3", name: "Shadow: the attacking enemy cannot take damage until the end of the round", layout: {}, act: attack("f3", { shadow: "144018", undefended: true }), expect: flag("f3", "cannotTakeDamage") },

  // 144019 to 144023 the locations (their Mire discards are in lines.test.ts).
  { line: "144019:A:2", name: "Travel: each player raises their threat by 1", layout: { ...TWO, staging: ["144019"], phase: "Travel" }, act: travel("144019"), expect: [threat(30, 0), threat(30, 1)] },
  { line: "144019:A:3", name: "Shadow: 1 damage to the defending character", layout: {}, act: [attack("f3", { shadow: "144019" }), defend("dh2")], expect: damageOn("dh2", 1) },
  { line: "144023:A:2", name: "Travel: each player raises their threat by 1", layout: { ...TWO, staging: ["144023"], phase: "Travel" }, act: travel("144023"), expect: [threat(30, 0), threat(30, 1)] },
  { line: "144020:A:2", name: "discarded by Mire the first player chooses: a random victory location returns to the staging area", layout: { ...SECOND_FIRST, staging: [{ code: "144020", resources: 0 }], victory: ["144021"] }, act: [announce("discardedByMire", "144020"), answer("return")], expect: zone("144021", "staging") },
  { line: "144022:A:1", name: "discarded by Mire each player raises their threat by 5", layout: { ...TWO, staging: ["144022"] }, act: announce("discardedByMire", "144022"), expect: [threat(33, 0), threat(33, 1)] },
  { line: "144022:A:2", name: "it gets +1 Threat for each mire token on it", layout: { staging: [{ code: "144022", resources: 3 }] }, act: [], expect: stat("144022", "threat", 6) },
  { line: "144019:A:1", name: "discarded by Mire it deals 1 damage to each character", layout: { staging: ["144019"], play: ["ally"] }, act: announce("discardedByMire", "144019"), expect: [damageOn("dh1", 1), damageOn("dh2", 1), damageOn("ally", 1)] },
  { line: "144023:A:1", name: "discarded by Mire the first player reveals the top card, whoever else is acting", layout: { ...SECOND_FIRST, staging: ["144023"], deck: ["f0", "f3"] }, act: announce("discardedByMire", "144023"), expect: revealedBy("f0", 1) },

  // 144025 Bitter Reek, 144054 Call of the Ring, 144055 We Hates Them!.
  { line: "144025:A:2", name: "When Revealed: the first option raises the revealer's threat by 1 for each character they control committed to the quest", layout: { committed: ["dh1", "dh2"], deck: ["f0"] }, act: [reveal("144025"), answer("threat")], expect: threat(30) },
  { line: "144025:A:2", name: "the second option deals 1 damage to each committed character", layout: { committed: ["dh1", "dh2"], deck: ["f0"] }, act: [reveal("144025"), answer("damage")], expect: [damageOn("dh1", 1), damageOn("dh2", 1)] },
  { line: "144025:A:3", name: "Shadow: the defending player's threat rises by the attacking enemy's Threat", layout: {}, act: attack("144016", { shadow: "144025", undefended: true }), expect: threat(30) },
  { line: "144054:A:1", name: "When Revealed: the first player may search the encounter deck for a Nazgûl and add it to the staging area", layout: { ...SECOND_FIRST, deck: ["f0", "144053"] }, act: [reveal("144054"), answer("search")], expect: zone("144053", "staging") },
  { line: "144054:A:1", name: "or exhaust The One Ring and reveal the top card", layout: { ...SECOND_FIRST, play: ["144063"], deck: ["f0", "144053"] }, act: [reveal("144054"), answer("reveal")], expect: [exhausted("144063"), zone("f0", "staging")] },
  { line: "144054:A:2", name: "Shadow: the attacking enemy makes an additional attack", layout: {}, act: attack("f3", { shadow: "144054", undefended: true }), expect: damageOn("dh1", 2) },
  { line: "144055:A:2", name: "When Revealed: the first player may flip Sméagol to Gollum", layout: { ...SECOND_FIRST, play: ["144076"] }, act: reveal("144055"), expect: zone("144075", "engaged") },
  { line: "144055:A:3", name: "Shadow: the attacking enemy gets +1 Attack", layout: {}, act: attack("f3", { shadow: "144055", undefended: true }), expect: damageOn("dh1", 2) },
  { line: "144055:A:3", name: "and +3 instead when it is Gollum", layout: { engaged: [{ code: "144075", seat: 0 }] }, act: attack("144075", { shadow: "144055", undefended: true }), expect: damageOn("dh1", 5) },

  // 144064 to 144066 the quest.
  { line: "144064:A:1", name: "Setup: Gollum is put into play engaged with the first player", layout: { ...SECOND_FIRST, setAside: ["144075"], deck: ["place", "place", "f0"] }, act: resolve("144064", "setup"), expect: zone("144075", "engaged") },
  { line: "144065:A:1", name: "When Revealed: with fewer locations in staging than players, cards are discarded until a location is, and it is added to the staging area", layout: { ...TWO, stage: "144065", deck: ["f0", "f3", "place"] }, act: resolve("144065", "whenRevealed"), expect: zone("place", "staging") },
  { line: "144065:B:3", name: "at the end of the staging step with fewer locations than players the first player reveals a card", layout: { ...SECOND_FIRST, stage: "144065", deck: ["f0", "f3"] }, act: announce("stagingStepEnds"), expect: revealedBy("f0", 1) },
  { line: "144066:A:1", name: "When Revealed: each player searches for an Undead enemy and puts it into play engaged with them", layout: { ...TWO, stage: "144066", deck: ["144016", "144017"], victory: [] }, act: resolve("144066", "whenRevealed"), expect: [zone("144016", "engaged"), zone("144017", "engaged")] },

  // 144075 Gollum, 144076 Sméagol.
  { line: "144075:A:1", name: "he is immune to the effects of non-Fellowship player cards", layout: { engaged: ["144075"] }, act: [], expect: flag("144075", "immuneToNonFellowship") },
  { line: "144075:A:2", name: "after he engages a player during the refresh phase he makes an immediate attack", layout: { phase: "Refresh", engaged: [{ code: "144075", seat: 0 }] }, act: [announce("engaged", "144075", { seat: 1 }), endPhase], expect: damageOn("dh1", 2) },
  { line: "144076:A:1", name: "he is immune to player card effects", layout: { play: ["144076"] }, act: [], expect: flag("144076", "immuneToPlayerCards") },
  { line: "144076:A:2", name: "after the players quest unsuccessfully he flips to Gollum, engaged with the first player", layout: { ...SECOND_FIRST, play: ["144076"], staging: ["f3", "f3", "f3"], committed: [] }, act: quest("fail"), expect: zone("144075", "engaged") },
];

if (ROWS.length > 0) cardSpecs("the-passage-of-the-marshes", ROWS);
else describe("the-passage-of-the-marshes card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
