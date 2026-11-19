// Rules: rr.forced, rr.shadow-effects, rr.defending-player, rr.keywords, rr.travel, rr.active-location, rr.reveal, faq.lasting-effects (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, damageOn, defend, endPhase, exhausted, flag, quest, resolve, reveal, stat, stagingThreat, threat, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Massing at Osgiliath (standalone-scenarios part 1): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish).
// The lines a row cannot express (a card committed, an instruction run alone, a count of games) are tests in lines.test.ts; the players have crossed the Anduin on stage 4 (00019), so a row that needs it names that stage.
const CROSSED = "00019";
const QUEST_START = { seat: null, phase: "Quest" } as const;

const ROWS: readonly Row[] = [
  { line: "00001:A:1", name: "players cannot play attachments on the Witch-king", layout: { staging: ["00001"] }, act: resolve("00001", "constant"), expect: [flag("00001", "noPlayerAttachments")] },
  { line: "00001:A:2", name: "each character gets -1 Willpower while he is in the staging area", layout: { staging: ["00001"] }, act: [], expect: [stat("dh1", "willpower", 1)] },
  {
    line: "00001:A:3",
    name: "after he attacks the second player that player chooses, and his threat rises by 3 (the round's 1 more), not the first player's",
    layout: { seats: 2, engaged: [{ code: "00001", seat: 1 }] },
    act: [attack("00001"), defend("dh3"), answer("threat")],
    expect: [threat(32, 1), threat(29, 0)],
  },
  {
    line: "00001:A:3",
    name: "the defending player may rather have him return to the staging area",
    layout: { seats: 2, engaged: [{ code: "00001", seat: 1 }] },
    act: [attack("00001"), defend("dh3"), answer("staging")],
    expect: [zone("00001", "staging"), threat(29, 1)],
  },
  { line: "00002:A:1", name: "Snaga Scouts engage the player with the lowest threat at the start of the encounter phase", layout: { seats: 2, threat: [30, 25], staging: ["00002"] }, act: announce("beginningOfPhase", undefined, { seat: null, phase: "Encounter" }), expect: [zone("00002", "engaged")] },
  { line: "00003:A:1", name: "Wolves that destroy a character with their attack shuffle into the encounter deck", layout: { engaged: ["00003"] }, act: attack("00003", { shadow: "00005", undefended: true }), expect: [zone("00003", "encounterDeck")] },
  { line: "00003:A:2", name: "Shadow: 2 damage to the defending character", layout: { engaged: ["f3"] }, act: [attack("f3", { shadow: "00003" }), defend("dh1")], expect: [damageOn("dh1", 2)] },
  { line: "00004:A:1", name: "an undefended attack raises the attacked player's threat by the damage it places", layout: { engaged: ["00004"] }, act: attack("00004", { undefended: true }), expect: [threat(31), damageOn("dh1", 3)] },
  { line: "00004:A:1", name: "shadow damage raises no threat, only the attack's own damage past the defense", layout: { engaged: ["00004"] }, act: [attack("00004", { shadow: "00003" }), defend("dh1")], expect: [damageOn("dh1", 3), threat(29)] },
  { line: "00005:A:1", name: "When Revealed: the top Scout enemy of the encounter discard pile goes to the staging area", layout: { discard: ["00002", "00006"] }, act: resolve("00005", "whenRevealed"), expect: [zone("00002", "staging"), zone("00006", "encounterDiscard")] },
  {
    line: "00005:A:1",
    name: "once the players have crossed the top two Scout enemies go to the staging area",
    layout: { stage: CROSSED, discard: ["00002", "00003", "00004"] },
    act: resolve("00005", "whenRevealed"),
    expect: [zone("00003", "staging"), zone("00004", "staging"), zone("00002", "encounterDiscard")],
  },
  { line: "00005:A:2", name: "Shadow: an undefended attack by a Scout enemy gets +2 Attack", layout: { engaged: ["00004"] }, act: attack("00004", { shadow: "00005", undefended: true }), expect: [damageOn("dh1", 5)] },
  { line: "00006:A:1", name: "once the players have crossed Uruk Vanguard gets +3 Attack", layout: { stage: CROSSED, engaged: ["00006"] }, act: [], expect: [stat("00006", "attack", 5)] },
  { line: "00006:A:2", name: "Shadow: +1 Attack before the players have crossed", layout: { engaged: ["f3"] }, act: attack("f3", { shadow: "00006", undefended: true }), expect: [damageOn("dh1", 2)] },
  { line: "00006:A:2", name: "Shadow: +2 Attack instead once the players have crossed", layout: { stage: CROSSED, engaged: ["f3"] }, act: attack("f3", { shadow: "00006", undefended: true }), expect: [damageOn("dh1", 3)] },
  { line: "00007:A:1", name: "once the players have crossed Captured Watchtower gets +3 Threat", layout: { stage: CROSSED, staging: ["00007"] }, act: [], expect: [stat("00007", "threat", 4)] },
  {
    line: "00007:A:2",
    name: "Shadow: the defender is removed from combat, takes no damage and the attack is undefended",
    layout: { engaged: ["00004"] },
    act: [attack("00004", { shadow: "00007", lands: { "00004": "dh2" } }), defend("dh1")],
    expect: [damageOn("dh1", 0), damageOn("dh2", 3), exhausted("dh1")],
  },
  { line: "00008:A:1", name: "the first Scout enemy revealed each round gains surge and doomed 2", layout: { staging: ["00008"], deck: ["00011", "00011"] }, act: reveal("00002"), expect: [threat(30)] },
  { line: "00009:A:1", name: "while Morgulduin is active each character that commits to the quest takes 1 damage", layout: { active: "00009" }, act: quest("success"), expect: [damageOn("dh1", 1), damageOn("dh2", 1)] },
  { line: "00009:A:2", name: "Shadow: Morgulduin replaces the active location, which returns to the staging area", layout: { active: "place", engaged: ["f3"] }, act: attack("f3", { shadow: "00009", undefended: true }), expect: [zone("place", "staging"), zone("00009", "activeLocation")] },
  { line: "00010:A:1", name: "once crossed, traveling to another location raises each player's threat by 3 (the round's 1 more)", layout: { stage: CROSSED, seats: 2, phase: "Travel", staging: ["00010", "place"] }, act: travel("place"), expect: [threat(32, 0), threat(32, 1)] },
  { line: "00011:A:1", name: "Ruins of Osgiliath has 4 Threat until the players have crossed", layout: { staging: ["00011"] }, act: [], expect: [stat("00011", "threat", 4)] },
  { line: "00012:A:2", name: "When Revealed: each player discards every ally card from hand", layout: { seats: 2, hand: ["ally", "ally", "c1"] }, act: resolve("00012", "whenRevealed"), expect: [{ expect: "handCount", value: 1, seat: 0 }, { expect: "handCount", value: 1, seat: 1 }] },
  { line: "00012:A:3", name: "Shadow: the defending player discards an ally card from hand", layout: { engaged: ["f3"], hand: ["ally"] }, act: [attack("f3", { shadow: "00012" }), defend("dh1"), answer("discard")], expect: [{ expect: "handCount", value: 0, seat: 0 }, damageOn("dh1", 0)] },
  { line: "00012:A:3", name: "Shadow: or the attacking enemy gets +3 Attack", layout: { engaged: ["f3"], hand: ["ally"] }, act: [attack("f3", { shadow: "00012" }), defend("dh1"), answer("attack")], expect: [{ expect: "handCount", value: 1, seat: 0 }, damageOn("dh1", 2)] },
  { line: "00012:A:3", name: "Shadow: an undefended attack asks 2 ally cards", layout: { engaged: ["f3"], hand: ["ally", "ally"] }, act: [attack("f3", { shadow: "00012", undefended: true }), answer("discardTwo")], expect: [{ expect: "handCount", value: 0, seat: 0 }, damageOn("dh1", 1)] },
  { line: "00013:A:1", name: "When Revealed: the staging area's Threat rises by each Scout enemy in play, the engaged ones too", layout: { staging: ["00004"], engaged: ["00003"], deck: ["f0"] }, act: reveal("00013"), expect: [stagingThreat(4)] },
  { line: "00013:A:1", name: "With no Scout enemy in play it gains surge", layout: { deck: ["f3", "f0"] }, act: reveal("00013"), expect: [stagingThreat(3)] },
  { line: "00014:A:2", name: "each card revealed for the rest of the phase gains doomed 1", layout: { deck: ["00011"] }, act: [resolve("00014", "whenRevealed"), reveal("00002")], expect: [threat(29)] },
  { line: "00014:A:2", name: "each card revealed gains doomed 3 once the players have crossed", layout: { stage: CROSSED, deck: ["00011"] }, act: [resolve("00014", "whenRevealed"), reveal("00002")], expect: [threat(31)] },
  { line: "00015:A:1", name: "When Revealed: the first player takes control of the Ranger of Ithilien, exhausted", layout: { deck: ["f0"] }, act: reveal("00015"), expect: [zone("00015", "play"), exhausted("00015")] },
  { line: "00015:A:2", name: "Shadow: 2 damage to the attacking enemy, and the defending player may exhaust a character to take control of it", layout: { engaged: ["f3"] }, act: [attack("f3", { shadow: "00015", undefended: true }), answer("take"), answer("dh2")], expect: [damageOn("f3", 2), zone("00015", "play"), exhausted("dh2")] },
  { line: "00015:A:2", name: "Shadow: or the Ranger is discarded", layout: { engaged: ["f3"] }, act: [attack("f3", { shadow: "00015", undefended: true }), answer("decline"), endPhase], expect: [damageOn("f3", 2), zone("00015", "encounterDiscard")] },
  { line: "00018:B:3", name: "a player chooses a hero and it is discarded before committing", layout: { stage: "00018" }, act: [announce("beginningOfPhase", undefined, QUEST_START), answer("hero"), answer("dh1")], expect: [zone("dh1", "discard")] },
  { line: "00018:B:3", name: "a player whose candidate is a Ranger of Ithilien under his control may discard it", layout: { stage: "00018", play: ["00015"] }, act: [announce("beginningOfPhase", undefined, QUEST_START), answer("ranger")], expect: [zone("00015", "encounterDiscard")] },
  { line: "00019:B:1", name: "When Revealed: the set-aside Witch-king is added to the staging area", layout: { stage: CROSSED, setAside: ["00001"] }, act: resolve("00019", "whenRevealed"), expect: [zone("00001", "staging")] },
];

if (ROWS.length > 0) cardSpecs("the-massing-at-osgiliath", ROWS);
else describe("the-massing-at-osgiliath card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
