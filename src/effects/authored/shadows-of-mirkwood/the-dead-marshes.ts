import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";

// Records for The Dead Marshes (Shadows of Mirkwood part 5, standalone, no campaign card). Every line is read from the scan ledger (data/printed/shadows-of-mirkwood.json). Gollum (02107) is an objective in the staging area that collects resource tokens
// from the Escape cards and from the quest; at 8 he shuffles back into the encounter deck. The players escape by making escape tests (the escape family, src/rules/families/escape/): committed characters against the Escape on the cards dealt from the encounter deck. The last stage
// holds the win until its own escape test is passed (the flag holdsWin) and resets the quest when it is failed.
// Rules: sotm.escape-test, sotm.escape-test-example, sotm.reset-the-quest-deck, sotm.setup-the-dead-marshes, rr.then, rr.staging, rr.active-location, rr.first-player, rr.forced, rr.winning-the-game (data/rules/entries.json); the readings are in docs/brief.md (The Dead Marshes).
const GOLLUM_CODE = "02107";
const GOLLUM: PickSpec = { type: "objective", control: "any", names: ["Gollum"] };
const GOLLUM_IN_PLAY: Condition = { kind: "canPick", pick: GOLLUM };
const GOLLUM_ABSENT: Condition = { kind: "not", condition: GOLLUM_IN_PLAY };
const FAILED: Condition = { kind: "lastEscapeFailed" };
const ACTIVE: Condition = { kind: "sourceIn", zone: "activeLocation" };
// The Bog is placed after its When Revealed resolves (rr.staging), so it is not counted: another location only (the engine places a revealed card before its effects resolve).
const OTHER_STAGED_LOCATION: PickSpec = { type: "location", control: "any", stagingOnly: true, other: true };
const LORE_HERO: PickSpec = { type: "hero", control: "you", sphere: "lore", state: "ready" };

// "Place N resource token(s) on Gollum" (02108:A:1, 02109:A:1, ...): on the card in play with his code; nothing when he is out of play.
const tokens = (amount: number, when?: Condition) => ({ verb: "PlaceResourceTokens" as const, amount, code: GOLLUM_CODE, ...(when ? { when } : {}) });

// "Escape: N" (02108:A:2 ... 02115:A:2): the value the card counts while it is dealt for an escape test. One record for each printed line.
const escapeValue = (code: string, amount: number, n = 1): Effect => ({ id: `${code}:constant:${n}`, cardCode: code, lines: [`${code}:A:2`], timing: "constant", instructions: [{ verb: "EscapeValue", amount }] });

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 02105 Into the Marshes (stage 1). Setup: Gollum is found in the encounter deck and added to the staging area, the deck is shuffled and one card for each player is revealed (the revealed cards resolve in Setup, an escape treachery included).
  {
    id: "02105:setup:1",
    cardCode: "02105",
    lines: ["02105:A:1"],
    timing: "setup",
    instructions: [{ verb: "SearchToStaging", code: GOLLUM_CODE }, { verb: "ShuffleEncounterDeck" }, { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RevealEncounter" }] }],
  },

  // 02106 The Capture (stage 2, the final stage). Forced: after it is defeated the first player chooses a player, who makes an escape test dealing 1 card for each resource token on Gollum. Failing resets the quest deck to stage 1B; with Gollum out of play there is nobody
  // to capture, so the capture fails (docs/brief.md, The Dead Marshes). Passing wins the game (02106:B:2): the stage holds the win until then.
  {
    id: "02106:forced:1",
    cardCode: "02106",
    lines: ["02106:B:1"],
    timing: "forced",
    trigger: "questCardDefeated",
    subject: "self",
    instructions: [
      { verb: "Pick", pick: { type: "player", control: "any", who: "firstPlayer" }, when: GOLLUM_IN_PLAY },
      { verb: "EscapeTest", who: "picked", cards: { stat: "resources", ofNamed: "Gollum" }, when: GOLLUM_IN_PLAY },
      { verb: "ReturnToStage", stage: 1, when: FAILED },
      { verb: "ReturnToStage", stage: 1, when: GOLLUM_ABSENT },
    ],
  },
  { id: "02106:constant:1", cardCode: "02106", lines: ["02106:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "holdsWin", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "02106:forced:2", cardCode: "02106", lines: ["02106:B:2"], timing: "forced", trigger: "escapePassed", instructions: [{ verb: "WinGame" }] },

  // 02107 Gollum (an objective in the staging area). At 8 resource tokens he shuffles into the encounter deck, tokens gone. Forced: at the end of the quest phase the party makes an escape test dealing 1 card for each player; failing puts 2 resource tokens on him.
  { id: "02107:constant:1", cardCode: "02107", lines: ["02107:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "shufflesAtTokens", amount: 8, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "02107:forced:1",
    cardCode: "02107",
    lines: ["02107:A:2"],
    timing: "forced",
    trigger: "endOfPhase",
    condition: { kind: "phase", is: "Quest" },
    instructions: [{ verb: "EscapeTest", who: "party", cards: { players: true } }, { verb: "PlaceResourceTokens", amount: 2, on: "self", when: FAILED }],
  },

  // 02108 A Wisp of Pale Sheen. 2 resource tokens on Gollum; any player, the first player first, may exhaust a Lore hero they control to reduce them to 1 (one reduction at most, offered only while Gollum is in play). Escape 4.
  {
    id: "02108:whenRevealed:1",
    cardCode: "02108",
    lines: ["02108:A:1"],
    timing: "whenRevealed",
    // X is 1 while the reduction is still open: the player who takes it brings X to 0, and the tokens are 1 + X.
    instructions: [
      { verb: "AddToX", amount: 1 },
      {
        verb: "ForEachPlayer",
        order: "firstFirst",
        instructions: [
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "reduce", requires: { kind: "all", conditions: [GOLLUM_IN_PLAY, { kind: "x", min: 1 }, { kind: "canPick", pick: LORE_HERO }] }, instructions: [{ verb: "Pick", pick: LORE_HERO }, { verb: "Exhaust", target: { kind: "picked" } }, { verb: "AddToX", amount: -1 }] },
              { id: "keep", instructions: [] },
            ],
          },
        ],
      },
      { verb: "PlaceResourceTokens", amount: { x: true, plus: 1 }, code: GOLLUM_CODE },
    ],
  },
  escapeValue("02108", 4),

  // 02109 Nightfall. The first player makes an escape test dealing 2 cards; failing puts 1 resource token on Gollum and raises each player's threat by 2. Escape 2.
  { id: "02109:whenRevealed:1", cardCode: "02109", lines: ["02109:A:1"], timing: "whenRevealed", instructions: [{ verb: "EscapeTest", who: "firstPlayer", cards: 2 }, tokens(1, FAILED), { verb: "RaiseThreat", amount: 2, who: "eachSeat", when: FAILED }] },
  escapeValue("02109", 2),

  // 02110 Through the Mist. As Nightfall, counting Attack, 1 threat. Escape 3.
  { id: "02110:whenRevealed:1", cardCode: "02110", lines: ["02110:A:1"], timing: "whenRevealed", instructions: [{ verb: "EscapeTest", who: "firstPlayer", cards: 2, stat: "attack" }, tokens(1, FAILED), { verb: "RaiseThreat", amount: 1, who: "eachSeat", when: FAILED }] },
  escapeValue("02110", 3),

  // 02111 The Lights of the Dead. Each player in turn makes an escape test dealing 2 cards; each player who fails puts 1 resource token on Gollum and raises their own threat by 1. Escape 5.
  {
    id: "02111:whenRevealed:1",
    cardCode: "02111",
    lines: ["02111:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "EscapeTest", who: "actor", cards: 2 }, tokens(1, FAILED), { verb: "RaiseThreat", amount: 1, who: "actor", when: FAILED }] }],
  },
  escapeValue("02111", 5),

  // 02112 Giant Marsh Worm. Forced: 2 damage come off it at the end of each round. Escape 2.
  { id: "02112:forced:1", cardCode: "02112", lines: ["02112:A:1"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "Heal", amount: 2, target: "self" }] },
  escapeValue("02112", 2),

  // 02113 Impassable Bog. 1 resource token on Gollum for each location in the staging area as it is revealed (the Bog itself is not there yet). Escape 2.
  { id: "02113:whenRevealed:1", cardCode: "02113", lines: ["02113:A:1"], timing: "whenRevealed", instructions: [{ verb: "PlaceResourceTokens", amount: { count: OTHER_STAGED_LOCATION }, code: GOLLUM_CODE }] },
  escapeValue("02113", 2),

  // 02114 The Heart of the Marshes. While it is the active location every card dealt for an escape test counts 1 more Escape, a card with no printed value too. Escape 1.
  { id: "02114:constant:1", cardCode: "02114", lines: ["02114:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "escapeValueBonus", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  escapeValue("02114", 1, 2),

  // 02115 Fens and Mires. Forced: after the players travel here, 1 resource token on Gollum. Escape 2.
  { id: "02115:forced:1", cardCode: "02115", lines: ["02115:A:1"], timing: "forced", trigger: "traveled", subject: "self", instructions: [tokens(1)] },
  escapeValue("02115", 2),
];

export const AUTHORED_REPLACES: readonly string[] = [];
