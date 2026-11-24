// Rules: ats.villagers, ats.setup-amon-din-objectives, ats.villager-tokens-discarded, rr.reveal, rr.surge, rr.travel, rr.shadow-effects, rr.forced, rr.step-6-4-1, rr.step-6-4-3 (data/rules/entries.json). The lines that need a longer game moment are the tests of the files beside this one (setup.test.ts, villagers.test.ts, stage-one.test.ts, stage-two.test.ts, alcaron.test.ts, ghulat.test.ts, encounter-cards.test.ts, shadows.test.ts).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, damageOn, deckCount, defend, endRound, handCount, lost, quest, reveal, resolve, resourcesOn, stat, threat, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Encounter at Amon Dîn (against-the-shadow part 6): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests). The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points
// (threat 28 at the start); `f0` and `f3` are enemies of Attack 1 and Defense 1; the stand-in `ally` has Defense 1 and 2 hit points. The villager tokens are the `resources` of the card (ats.villagers).
const SAVAGERY = "06066";
const PROTECT = "06067";
const RESCUED = "06068";
const DEAD = "06069";
const ALCARON = "06070";
const GHULAT = "06071";
const MARAUDING = "06072";
const RAVAGER = "06073";
const EAGLE = "06074";
const FARMHOUSE = "06075";
const HAMLET = "06076";
const SECLUDED = "06077";
const HOMESTEAD = "06078";
const TRAPPED = "06079";
const PANICKED = "06080";

// Every row stands on stage 2 (Protect the Villagers) with no Rescued Villagers in the staging area unless it needs one: a stage-1 table holds no villager token on its quest card, and its quest would advance at once (06066:B:3). The stage-1 lines are tested in stage-one.test.ts.
// The stage-1 table of the Setup's end: Burning Farmhouse active, the two objectives in the staging area.
const STAGING = [RESCUED, DEAD];

const ROWS: readonly Row[] = [
  // The Setup puts the villager tokens on Burning Farmhouse, gives Alcaron to the first player (he stays under the first player's control, in play), keeps Ghulat aside and reveals 1 card for each player.
  { line: "06066:A:1", name: "Setup, one player: Burning Farmhouse holds 4 villager tokens, Lord Alcaron is in play, Ghulat stays set aside and 1 card is revealed", layout: { stage: PROTECT, active: FARMHOUSE, staging: STAGING, setAside: [ALCARON, GHULAT], deck: ["f3", "f0", "f0"] }, act: resolve(SAVAGERY, "setup"), expect: [resourcesOn(FARMHOUSE, 4), zone(ALCARON, "play"), zone(GHULAT, "setAside"), deckCount(2)] },
  { line: "06066:A:1", name: "Setup, two players: 2 cards are revealed, 1 for each player", layout: { seats: 2, stage: PROTECT, active: FARMHOUSE, staging: STAGING, setAside: [ALCARON, GHULAT], deck: ["f0", "f0", "f0"] }, act: resolve(SAVAGERY, "setup"), expect: [resourcesOn(FARMHOUSE, 4), zone(ALCARON, "play"), deckCount(1)] },
  { line: "06066:B:1", name: "Villagers 5: the quest card is revealed with 5 villager tokens on it", layout: { stage: SAVAGERY, staging: STAGING }, act: resolve(SAVAGERY, "whenRevealed"), expect: resourcesOn(SAVAGERY, 5) },


  // Rescued Villagers: an explored location moves its tokens here, with no damage token.
  { line: "06068:A:1", name: "A location explored by a successful quest leaves play and its villager tokens move to Rescued Villagers (no damage token)", layout: { stage: PROTECT, active: { code: FARMHOUSE, progress: 4, resources: 3 }, staging: [{ code: RESCUED, resources: 1 }, DEAD] }, act: quest("success"), expect: [resourcesOn(RESCUED, 4), damageOn(DEAD, 0), zone(FARMHOUSE, "victory")] },

  // Protect the Villagers: Ghulat joins the staging area from the set-aside pile (added, not revealed).
  { line: "06067:A:1", name: "Ghulat is added to the staging area from the set-aside pile, not revealed and not engaged", layout: { stage: PROTECT, side: "A", staging: STAGING, setAside: [GHULAT] }, act: resolve(PROTECT, "whenRevealed"), expect: zone(GHULAT, "staging") },

  // Ghulat: X is the damage tokens on Dead Villagers; the Forced effect puts one there when he attacks.
  { line: "06071:A:1", name: "X is the number of damage tokens on Dead Villagers: with 3 there, Ghulat's Attack is 3", layout: { stage: PROTECT, staging: [RESCUED, { code: DEAD, damage: 3 }, GHULAT] }, act: [], expect: stat(GHULAT, "attack", 3) },
  { line: "06071:A:2", name: "When Ghulat attacks, 1 damage token is placed on Dead Villagers", layout: { stage: PROTECT, staging: STAGING }, act: attack(GHULAT), expect: damageOn(DEAD, 1) },
  { line: "06071:A:2", name: "Ghulat's Attack counts that token: with 2 tokens before he attacks, X is 3 and a hero with Defense 2 takes 1 damage", layout: { stage: PROTECT, staging: [RESCUED, { code: DEAD, damage: 2 }] }, act: attack(GHULAT), expect: [damageOn(DEAD, 3), damageOn("dh1", 1)] },

  // Marauding Orc.
  { line: "06072:A:1", name: "After Marauding Orc attacks and destroys a character, 1 damage token is placed on Dead Villagers (an ally with 2 hit points defends)", layout: { stage: PROTECT, staging: [RESCUED, { code: DEAD }], play: ["ally"] }, act: [attack(MARAUDING), defend("ally")], expect: [zone("ally", "discard"), damageOn(DEAD, 1)] },
  { line: "06072:A:2", name: "Shadow: the attack destroys a character, so 1 villager token is discarded from Rescued Villagers (Dead Villagers gets 1 damage token)", layout: { stage: PROTECT, staging: [{ code: RESCUED, resources: 3 }, DEAD], play: ["ally"] }, act: [attack(RAVAGER, { shadow: MARAUDING }), defend("ally")], expect: [zone("ally", "discard"), resourcesOn(RESCUED, 2), damageOn(DEAD, 1)] },
  { line: "06079:A:3", name: "Shadow of Trapped Inside: the attack destroys a character, so 1 villager token is discarded from Rescued Villagers", layout: { stage: PROTECT, staging: [{ code: RESCUED, resources: 3 }, DEAD], play: ["ally"] }, act: [attack(RAVAGER, { shadow: TRAPPED }), defend("ally")], expect: [zone("ally", "discard"), resourcesOn(RESCUED, 2), damageOn(DEAD, 1)] },

  // Orc Ravager.
  { line: "06073:A:1", name: "When Revealed: 1 villager token is discarded from the active location, and Dead Villagers gets a damage token", layout: { stage: PROTECT, active: { code: FARMHOUSE, resources: 2 }, staging: STAGING, deck: ["f3", "f0", "f0"] }, act: reveal(RAVAGER), expect: [resourcesOn(FARMHOUSE, 1), damageOn(DEAD, 1), deckCount(3)] },
  { line: "06073:A:1", name: "When Revealed: no token on the active location, so Orc Ravager gains surge", layout: { stage: PROTECT, active: { code: FARMHOUSE, resources: 0 }, staging: STAGING, deck: ["f3", "f0", "f0"] }, act: reveal(RAVAGER), expect: [zone("f3", "staging"), damageOn(DEAD, 0)] },
  { line: "06073:A:2", name: "Shadow: a defended attack gets +1 Attack (Attack 2 against the ally's Defense 1 is 1 damage)", layout: { stage: PROTECT, staging: STAGING, play: ["ally"] }, act: [attack("f0", { shadow: RAVAGER }), defend("ally")], expect: damageOn("ally", 1) },
  { line: "06073:A:2", name: "Shadow: an undefended attack gets +2 Attack in all, not +1 and +2 (Attack 3 on the hero)", layout: { stage: PROTECT, staging: [DEAD] }, act: attack("f0", { shadow: RAVAGER, undefended: true }), expect: damageOn("dh1", 3) },

  // Craven Eagle: the character with the fewest hit points left is discarded unless its controller discards 3 cards at random from his hand.
  { line: "06074:A:1", name: "When Revealed: Lord Alcaron (3 hit points, the fewest) is discarded when his controller declines to discard 3 cards, and the players lose", layout: { stage: PROTECT, staging: STAGING, play: [ALCARON], hand: ["filler", "filler", "filler"], deck: ["f0", "f0"] }, act: [reveal(EAGLE), answer("allow")], expect: [zone(ALCARON, "encounterDiscard"), lost] },
  { line: "06074:A:1", name: "When Revealed: the controller discards 3 cards at random from his hand and Lord Alcaron stays", layout: { stage: PROTECT, staging: STAGING, play: [ALCARON], hand: ["filler", "filler", "filler"], deck: ["f0", "f0"] }, act: [reveal(EAGLE), answer("prevent")], expect: [zone(ALCARON, "play"), handCount(0)] },

  // Locations: Villagers X when the location enters play from the deck or by a search.
  { line: "06075:A:1", name: "Villagers 4: Burning Farmhouse is revealed with 4 villager tokens on it", layout: { stage: PROTECT, staging: STAGING, deck: ["f0", "f0"] }, act: reveal(FARMHOUSE), expect: resourcesOn(FARMHOUSE, 4) },
  { line: "06075:A:2", name: "At the end of the round 1 villager token is discarded from Burning Farmhouse in the staging area (Dead Villagers gets a damage token)", layout: { stage: PROTECT, staging: [{ code: FARMHOUSE, resources: 4 }, RESCUED, DEAD] }, act: endRound, expect: [resourcesOn(FARMHOUSE, 3), damageOn(DEAD, 1)] },
  { line: "06076:A:1", name: "Villagers 3: Gondorian Hamlet is revealed with 3 villager tokens on it", layout: { stage: PROTECT, staging: STAGING, deck: ["f0", "f0"] }, act: reveal(HAMLET), expect: resourcesOn(HAMLET, 3) },
  { line: "06076:A:2", name: "In the staging area it gains: after a treachery is revealed from the encounter deck, 1 villager token is discarded from it", layout: { stage: PROTECT, staging: [{ code: HAMLET, resources: 3 }, RESCUED, DEAD], deck: ["treachery", "f0"] }, act: reveal("treachery"), expect: [resourcesOn(HAMLET, 2), damageOn(DEAD, 1)] },
  { line: "06077:A:1", name: "Villagers 2: Secluded Farmhouse is revealed with 2 villager tokens on it", layout: { stage: PROTECT, staging: STAGING, deck: ["f0", "f0"] }, act: reveal(SECLUDED), expect: resourcesOn(SECLUDED, 2) },
  { line: "06077:A:1", name: "Villagers 2: a search that puts it into play places the 2 tokens too", layout: { stage: PROTECT, staging: [SECLUDED, RESCUED, DEAD] }, act: announce("searchedIntoPlay", SECLUDED), expect: resourcesOn(SECLUDED, 2) },
  { line: "06077:A:2", name: "Travel: the players reveal the top card of the encounter deck, which is added to the staging area", layout: { stage: PROTECT, phase: "Travel", staging: [SECLUDED, RESCUED, DEAD], deck: ["f3", "f0", "f0"] }, act: travel(SECLUDED), expect: [zone("f3", "staging"), deckCount(2)] },

  // Burnt Homestead.
  { line: "06078:A:2", name: "When Revealed: each player raises his threat by the damage tokens on Dead Villagers (2 here, two players)", layout: { stage: PROTECT, seats: 2, staging: [RESCUED, { code: DEAD, damage: 2 }], deck: ["f0", "f0"] }, act: reveal(HOMESTEAD), expect: [threat(30, 0), threat(30, 1)] },
  { line: "06078:A:3", name: "Shadow: the defending player raises his threat by 1 for each damage token on Dead Villagers (3 here)", layout: { stage: PROTECT, staging: [RESCUED, { code: DEAD, damage: 3 }] }, act: attack("f0", { shadow: HOMESTEAD }), expect: threat(31) },

  // Trapped Inside.
  { line: "06079:A:2", name: "When Revealed: 1 villager token for each player is discarded from the active location (2 players: 2 of 5)", layout: { stage: PROTECT, seats: 2, active: { code: FARMHOUSE, resources: 5 }, staging: STAGING, deck: ["f3", "f0"] }, act: reveal(TRAPPED), expect: [resourcesOn(FARMHOUSE, 3), damageOn(DEAD, 2), deckCount(2)] },
  { line: "06079:A:2", name: "When Revealed: with fewer tokens than players all are discarded and, with none discarded at all, it gains surge", layout: { stage: PROTECT, seats: 2, active: { code: FARMHOUSE, resources: 0 }, staging: STAGING, deck: ["f3", "f0"] }, act: reveal(TRAPPED), expect: [zone("f3", "staging"), damageOn(DEAD, 0)] },

  // Panicked! is a treachery: a Gondorian Hamlet in the staging area would discard a token it has just been given (06076:A:2), so the location here is Secluded Farmhouse.
  { line: "06080:A:1", name: "When Revealed: the player takes a villager token from Rescued Villagers and places it on a location in the staging area", layout: { stage: PROTECT, staging: [{ code: RESCUED, resources: 2 }, DEAD, SECLUDED], deck: ["f3", "f0"] }, act: reveal(PANICKED), expect: [resourcesOn(RESCUED, 1), resourcesOn(SECLUDED, 1), damageOn(DEAD, 0), deckCount(2)] },
  { line: "06080:A:1", name: "When Revealed: no token on Rescued Villagers, so no token is placed and Panicked! gains surge", layout: { stage: PROTECT, staging: [RESCUED, DEAD, SECLUDED], deck: ["f3", "f0"] }, act: reveal(PANICKED), expect: [zone("f3", "staging"), resourcesOn(SECLUDED, 0)] },
  { line: "06080:A:2", name: "Shadow: the attacking enemy gets +1 Attack for each damage token on Dead Villagers (2 here: Attack 3 against Defense 2 is 1 damage)", layout: { stage: PROTECT, staging: [RESCUED, { code: DEAD, damage: 2 }] }, act: attack("f0", { shadow: PANICKED }), expect: damageOn("dh1", 1) },
];

if (ROWS.length > 0) cardSpecs("encounter-at-amon-din", ROWS);
else describe("encounter-at-amon-din card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
