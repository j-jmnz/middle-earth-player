// Rules: hrd.captives-of-cirith-gurat, hrd.guarded-heroes, rr.forced, rr.response, rr.shadow-effects, rr.travel, rr.immune, rr.modifiers, rr.cancel, rr.then (data/rules/entries.json); ledger lines of The Dungeons of Cirith Gurat (data/printed/haradrim.json).
import { describe, it } from "vitest";

import { attack, cardSpecs, deckCount, defend, flag, heldBy, notWon, quest, reveal, resolve, resourcesOn, stat, threat, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Dungeons of Cirith Gurat (haradrim part 8): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
// The stand-in ally has 1 Willpower, 1 Attack, 1 Defense and 2 hit points, the stand-in heroes 2 Willpower; f0 has Threat 0, f3 Threat 3. A hero under a card is the guarded objective it holds (`staged`). The lines that need a real ally or two tables are in lines.test.ts.
const CAPTIVES = "17119";
const JAILER = "17121";
const GUARD = "17122";
const GATE = "17124";
const ROOM = "17128";
const STAGE_1 = "17132";
const STAGE_2 = "17133";
const STAGE_3 = "17134";
const HELD_BY_GUARD = { staging: [CAPTIVES, GUARD], heroes: ["dh3"], staged: [{ hero: "dh3", under: GUARD }] } as const;

const ROWS: readonly Row[] = [
  // 17120:A:2 "Response: After Abaan exhausts, choose a Harad character to get +1 Willpower, +1 Attack, and +1 Defense until the end of the round." Abaan prints 1 / 1 / 1 and is the only Harad character here.
  { line: "17120:A:2", name: "Response: after Abaan exhausts the chosen Harad character gets +1 Willpower, +1 Attack and +1 Defense", layout: { play: ["17120"] }, act: resolve("17120", "response"), expect: [stat("17120", "willpower", 2), stat("17120", "attack", 2), stat("17120", "defense", 2)] },

  // 17121:A:1 "Forced: After Jailer of Cirith Gurat engages you, attach an ally you control to it."
  { line: "17121:A:1", name: "Forced: after it engages you an ally you control is attached to it", layout: { engaged: [{ code: JAILER, seat: 0 }], play: ["ally"], staging: [CAPTIVES] }, act: resolve(JAILER, "forced"), expect: heldBy("ally", JAILER) },
  // 17121:A:2 "Shadow: If attacking enemy's Threat is greater than defending ally's Willpower, attach defending ally to attacking enemy. Then, cancel this attack." f3 has Threat 3 and the ally 1 Willpower; f0 has Threat 0.
  { line: "17121:A:2", name: "Shadow: the attacker's Threat is greater than the defending ally's Willpower, so the ally is attached to the attacker", layout: { play: ["ally"], staging: [CAPTIVES] }, act: [attack("f3", { shadow: JAILER }), defend("ally")], expect: heldBy("ally", "f3") },

  // 17122:A:1 "While Prison Guard is guarding an objective, it gets +2 Defense." It prints Defense 1; a hero held under it is the objective it guards.
  { line: "17122:A:1", name: "While it is guarding an objective it gets +2 Defense", layout: HELD_BY_GUARD, act: [], expect: stat(GUARD, "defense", 3) },

  // 17124:A:1 "While Gate of Iron is in the staging area, progress cannot be placed on locations in the staging area."
  { line: "17124:A:1", name: "While it is in the staging area progress cannot be placed on the locations there", layout: { staging: [GATE, "place"] }, act: [], expect: flag("place", "noProgressPlaced") },
  // 17124:A:2 "Travel: Discard the top card of the encounter deck. Then, the first player must discard a card from his hand with cost greater than the discarded card's Threat, or raise each player's threat by 3." f3 has Threat 3 and the stand-in event costs 1: no card pays.
  { line: "17124:A:2", name: "Travel: the top card is discarded, and with no card costing more than its Threat each player raises his threat by 3", layout: { phase: "Travel", staging: [GATE], deck: ["f3", "f0"], hand: ["event"] }, act: travel(GATE), expect: [zone("f3", "encounterDiscard"), threat(32)] },
  { line: "17124:A:2", name: "Travel: with an empty encounter deck the discard pile is shuffled in and its top card is discarded, so each player raises his threat by 3", layout: { phase: "Travel", staging: [GATE], discard: ["f3"], hand: ["event"] }, act: travel(GATE), expect: threat(32) },



  // 17129:A:2 "Shadow: Attacking enemy gets +1 Attack. If this attack destroys an ally, reveal the top card of the encounter deck." Prison Guard has Attack 4, so the ally (Defense 1, 2 hit points) is destroyed; the shadow card and the revealed card leave the deck.
  { line: "17129:A:2", name: "Shadow: the attacking enemy gets +1 Attack and, when the attack destroys an ally, the top card of the encounter deck is revealed", layout: { play: ["ally"], staging: [CAPTIVES] }, act: [attack(GUARD, { shadow: "17129" }), defend("ally")], expect: [zone("ally", "discard"), deckCount(2)] },

  // 17130:A:1 "When Revealed: Each player raises his threat by 1 for each guarded objective he owns. If any player does not own a guarded objective, Tormented by Orcs gains surge." With two players who own none one card is revealed for the surge, not two.
  { line: "17130:A:1", name: "When Revealed: with two players who own no guarded objective it gains surge once, not once for each player", layout: { seats: 2, staging: [CAPTIVES], deck: ["f0", "f0", "f0"] }, act: reveal("17130"), expect: [deckCount(2), threat(28)] },
  { line: "17130:A:1", name: "When Revealed: each player raises his threat by 1 for each guarded objective he owns, and with all owning one it gains no surge", layout: { staging: [CAPTIVES, GUARD], heroes: ["dh3"], staged: [{ hero: "dh3", under: GUARD }], deck: ["f0", "f0"] }, act: reveal("17130"), expect: [threat(29), deckCount(2)] },

  // 17133:A:1 "When Revealed: Shuffle the encounter discard pile into the encounter deck. Each player discards cards from the encounter deck until an enemy is discarded and adds that enemy to the staging area."
  { line: "17133:A:1", name: "When Revealed: the discard pile is shuffled into the deck and each player's enemy is discarded and added to the staging area", layout: { stage: STAGE_2, discard: ["f3"] }, act: resolve(STAGE_2, "whenRevealed"), expect: zone("f3", "staging") },
  // 17133:B:2 "Forced: At the end of the round, reveal an encounter card. Then, place 1 resource here if no enemies were engaged this round."
  { line: "17133:B:2", name: "Forced: at the end of the round an encounter card is revealed and, with no enemy engaged this round, 1 resource is placed here", layout: { stage: STAGE_2, deck: ["f3"] }, act: resolve(STAGE_2, "forced"), expect: [resourcesOn(STAGE_2, 1), zone("f3", "staging")] },

  // 17128:A:2 "While Torture Room is guarding an objective, it gains: "Forced: At the end of the round, raise each player's threat by 1."" The hero under it is the objective.
  { line: "17128:A:2", name: "While it is guarding an objective each player raises his threat by 1 at the end of the round", layout: { staging: [CAPTIVES, ROOM], heroes: ["dh3"], staged: [{ hero: "dh3", under: ROOM }] }, act: resolve(ROOM, "forced"), expect: threat(29) },

  // 17130:A:2 "Shadow: Until the end of the phase, attacking enemy gets +1 Defense (+2 Defense instead if it is guarding an objective)." f3 prints Defense 1.
  { line: "17130:A:2", name: "Shadow: until the end of the phase the attacking enemy gets +1 Defense", layout: { staging: [CAPTIVES] }, act: attack("f3", { shadow: "17130" }), expect: stat("f3", "defense", 2) },
  { line: "17130:A:2", name: "Shadow: the attacking enemy that guards an objective gets +2 Defense instead until the end of the phase", layout: { staging: [CAPTIVES], engaged: [{ code: "f3", seat: 0 }], heroes: ["dh3"], staged: [{ hero: "dh3", under: "f3" }] }, act: attack("f3", { shadow: "17130" }), expect: stat("f3", "defense", 3) },

  // 17132:B:1 "Each enemy and location in the staging area that is guarding an objective is immune to player card effects."
  { line: "17132:B:1", name: "Each enemy in the staging area that is guarding an objective is immune to player card effects", layout: { stage: STAGE_1, ...HELD_BY_GUARD }, act: [], expect: flag(GUARD, "immuneToPlayerCards") },
  // 17132:B:3 "This stage cannot be defeated while a guarded objective is in play." The heroes' 4 Willpower beats the Threat and the stage holds all its quest points.
  { line: "17132:B:3", name: "This stage cannot be defeated while a guarded objective is in play", layout: { stage: STAGE_1, progress: 10, phase: "Quest", deck: ["f0"], ...HELD_BY_GUARD }, act: quest("success"), expect: [zone(STAGE_1, "questStage")] },

  // 17133:B:1 "Each enemy in the staging area cannot take damage and gets +X engagement cost, where X is the number of progress tokens here." f0 prints engagement cost 50.
  { line: "17133:B:1", name: "Each enemy in the staging area cannot take damage and gets +X engagement cost, X the progress here", layout: { stage: STAGE_2, progress: 3, staging: ["f0"] }, act: [], expect: [flag("f0", "cannotTakeDamage"), stat("f0", "engagementCost", 53)] },
  // 17133:B:3 "The players cannot defeat this stage unless there are at least 2 resources here."
  { line: "17133:B:3", name: "The players cannot defeat this stage unless there are at least 2 resources here", layout: { stage: STAGE_2, progress: 15, phase: "Quest", deck: ["f0"] }, act: quest("success"), expect: [zone(STAGE_2, "questStage")] },

  // 17134:B:2 "The players cannot defeat this stage while a guarded objective is in play. If the players defeat this stage, they win the game."
  { line: "17134:B:2", name: "The players cannot defeat this stage while a guarded objective is in play: the game is not won", layout: { stage: STAGE_3, progress: 10, phase: "Quest", deck: ["f0"], ...HELD_BY_GUARD }, act: quest("success"), expect: [notWon, zone(STAGE_3, "questStage")] },
];


if (ROWS.length > 0) cardSpecs("the-dungeons-of-cirith-gurat", ROWS);
else describe("the-dungeons-of-cirith-gurat card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
