// Rules: mec113.fortitude-tests, mec113.player-actions-during-fortitude-tests, mec113.dire, mec113.saga-staging-rules, mec113.immune-to-player-card-effects, mec113.peril, rr.forced, rr.shadow-effects, rr.active-location, rr.travel, rr.first-player, rr.the-word-choose, rr.engaged, rr.then, faq.additional-attacks, faq.lasting-effects (data/rules/entries.json).
import { announce, answer, attack, attackersOf, cardSpecs, commit, damageOn, deckCount, defend, endPhase, exhausted, flag, frame, lost, quest, resourcesOn, respond, reveal, resolve, stat, threat, won, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Mount Doom (the-return-of-the-king, part 6 of the box): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish). What a row cannot hold (a bar on travel, the stages' own flow,
// the order of several players' tests) is in lines.test.ts, each test titled with its line; the campaign card is in campaign.test.ts and the golden.
// The stand-in heroes dh1 and dh2 have 2 Willpower, 2 Attack, 2 Defense and 6 hit points and every seat starts at threat 28, so X is 2 and a Fortitude test discards two cards: f0 and f3 print no Sauron's Eye icon, so a test with
// a committed hero passes (2 against 0) and one with none fails (0 against 0, a tie fails). The cards that print icons are named by code (146054 prints 3, 146052 prints 1).
const ARCHER = "146053";
const LIDLESS = "146055";
const MD = "146043";
const ROWS: readonly Row[] = [
  { line: "146042:A:2", name: "Forced: at the end of the round each player raises their threat by 1 for each non-Fellowship character they control", layout: { phase: "Refresh", staging: ["146042"], play: ["ally"], seats: 2 }, act: resolve("146042", "forced"), expect: [threat(31), threat(29, 1)] },

  { line: "146043:A:1", name: "its Threat X is the tens digit of the first player's threat", layout: { staging: [MD], threat: [34, 51] }, act: [], expect: stat(MD, "threat", 3) },
  { line: "146043:A:3", name: "Travel: each player makes a Fortitude test and raises their threat by 9 on a failure", layout: { staging: [MD], seats: 2 }, act: [resolve(MD, "travel"), commit(), commit("dh3")], expect: [threat(37), threat(28, 1)] },

  { line: "146044:A:1", name: "while it is in the staging area progress cannot be placed on other locations there", layout: { staging: ["146044", "place"] }, act: [], expect: flag("place", "noProgressPlaced") },
  { line: "146044:A:2", name: "Forced: after it becomes the active location the discard pile is shuffled in and cards are discarded until an Orc, which engages the first player", layout: { active: "146044", discard: ["treachery"], deck: ["f0", "146052", "f3"] }, act: announce("becameActive", "146044"), expect: zone("146052", "engaged") },

  { line: "146045:A:1", name: "+1 Threat for each ally the player with the most allies controls", layout: { staging: ["146045"], play: ["ally", "ally"] }, act: [], expect: stat("146045", "threat", 3) },
  { line: "146045:A:2", name: "Forced: after it becomes the active location each player discards the top card and each enemy discarded joins the staging area", layout: { active: "146045", seats: 2, deck: ["f3", "f0", "treachery"] }, act: announce("becameActive", "146045"), expect: [zone("f3", "staging"), zone("f0", "staging")] },

  { line: "146046:A:1", name: "+2 Threat once a player has failed a Fortitude test this round", layout: { staging: ["146046"], deck: ["f0", "f0"] }, act: [reveal(LIDLESS), commit()], expect: stat("146046", "threat", 4) },
  { line: "146046:A:2", name: "Travel: the first player makes a Fortitude test, and each player raises their threat by 4 on a failure", layout: { staging: ["146046"], seats: 2 }, act: [resolve("146046", "travel"), commit()], expect: [threat(32), threat(32, 1)] },
  { line: "146046:A:2", name: "and by nothing on a pass", layout: { staging: ["146046"], seats: 2 }, act: [resolve("146046", "travel"), commit("dh1")], expect: [threat(28), threat(28, 1), frame("fortitude")] },

  { line: "146047:A:1", name: "while it is in the staging area each Fortitude test counts one more Sauron's Eye icon (2 Willpower against 1 and 1 fails)", layout: { staging: ["146047"], deck: ["146052", "f0"] }, act: [reveal(LIDLESS), commit("dh1")], expect: threat(38) },
  { line: "146047:A:2", name: "Forced: after it becomes the active location each player assigns X damage among their characters", layout: { active: "146047", threat: [34, 28] }, act: [announce("becameActive", "146047"), answer("dh1"), answer("dh1"), answer("dh1")], expect: damageOn("dh1", 3) },

  { line: "146048:A:1", name: "while it is the active location it has the Response to reduce each player's threat by 5 when it is explored", layout: { active: "146048", threat: [34, 28], play: ["ally"], committed: ["ally"] }, act: [quest("success"), respond("146048")], expect: threat(29) },
  { line: "146048:A:2", name: "Travel: each player exhausts a hero they control", layout: { staging: ["146048"], seats: 2 }, act: resolve("146048", "travel"), expect: [exhausted("dh1"), exhausted("dh3")] },

  { line: "146049:A:1", name: "it is immune to non-Fellowship player card effects", layout: { staging: ["146049"] }, act: [], expect: flag("146049", "immuneToNonFellowship") },
  { line: "146049:A:2", name: "it engages the first player when it is added to the staging area", layout: { staging: ["146049"] }, act: announce("addedToStaging", "146049"), expect: zone("146049", "engaged") },
  { line: "146049:A:2", name: "and again, at once, when an effect returns it to the staging area", layout: { staging: ["146049"] }, act: announce("returnedToStaging", "146049"), expect: zone("146049", "engaged") },
  { line: "146049:A:3", name: "Forced: after it is discarded during a Fortitude test it comes into play engaged with the first player, and a card of the test is chosen", layout: { deck: ["146049", "146054", "f0", "f0"] }, act: [reveal(LIDLESS), commit()], expect: [zone("146049", "engaged"), threat(38)] },

  { line: "146050:A:2", name: "while it is in the staging area it engages the player who fails a Fortitude test and makes an immediate attack", layout: { staging: ["146050"], deck: ["f0", "f0"] }, act: [reveal(LIDLESS), commit(), endPhase], expect: [zone("146050", "engaged"), attackersOf("dh1", ["146050"])] },

  { line: "146051:A:1", name: "Forced: after it engages you, you make a Fortitude test and reveal the top card of the encounter deck on a failure", layout: { engaged: [{ code: "146051", seat: 0 }], deck: ["f0", "f0", "f0", "f3"] }, act: [announce("engaged", "146051"), commit()], expect: deckCount(1) },
  { line: "146051:A:1", name: "and none on a pass", layout: { engaged: [{ code: "146051", seat: 0 }], deck: ["f0", "f0", "f0", "f3"] }, act: [announce("engaged", "146051"), commit("dh1")], expect: [deckCount(2), frame("fortitude")] },
  { line: "146051:A:2", name: "Shadow: if the attack destroys a character the attacking enemy returns to the staging area", layout: { engaged: [{ code: "146051", seat: 0 }], play: [{ code: "ally" }] }, act: [attack("146051", { shadow: "146051" }), defend("ally")], expect: zone("146051", "staging") },

  { line: "146052:A:1", name: "Forced: after it engages you, either raise your threat by 4", layout: { engaged: [{ code: "146052", seat: 0 }] }, act: [announce("engaged", "146052"), answer("threat")], expect: threat(32) },
  { line: "146052:A:1", name: "or it makes an immediate attack against you", layout: { engaged: [{ code: "146052", seat: 0 }], deck: ["f0", "f0"] }, act: [announce("engaged", "146052"), answer("attack"), endPhase], expect: attackersOf("dh1", ["146052"]) },
  { line: "146052:A:2", name: "Shadow: the attacking enemy gets +1 Attack for each ally you control", layout: { play: ["ally", "ally"] }, act: attack("f3", { shadow: "146052", undefended: true }), expect: damageOn("dh1", 3) },

  { line: "146053:A:2", name: "When Revealed: either raise your threat by 1 for each ally you control", layout: { play: ["ally", "ally"], deck: ["f0", "f0"] }, act: [reveal(ARCHER), answer("threat")], expect: threat(30) },
  { line: "146053:A:2", name: "or discard an ally you control", layout: { play: ["ally"], deck: ["f0", "f0"] }, act: [reveal(ARCHER), answer("discard")], expect: [zone("ally", "discard"), threat(28)] },
  { line: "146053:A:3", name: "Shadow: exhaust a character you control", layout: {}, act: [attack("f3", { shadow: ARCHER, undefended: true }), answer("dh2")], expect: exhausted("dh2") },

  { line: "146054:A:1", name: "When Revealed: Gollum makes an immediate attack against the first player", layout: { engaged: [{ code: "146049", seat: 0 }], deck: ["f0", "f0", "f0"] }, act: [reveal("146054"), endPhase], expect: attackersOf("dh1", ["146049"]) },
  { line: "146054:A:1", name: "and when he is not in play he is searched for and put into play engaged with the first player", layout: { deck: ["f0", "146049"] }, act: reveal("146054"), expect: zone("146049", "engaged") },
  { line: "146054:A:2", name: "Shadow: if the attacking enemy is Gollum he makes an additional attack after this one", layout: { engaged: [{ code: "146049", seat: 0 }], deck: ["f0", "f0", "f0"] }, act: attack("146049", { shadow: "146054", undefended: true }), expect: attackersOf("dh1", ["146049", "146049"]) },

  { line: "146055:A:2", name: "When Revealed: make a Fortitude test and raise your threat by 10 on a failure", layout: { deck: ["f0", "f0"] }, act: [reveal(LIDLESS), commit()], expect: threat(38) },
  { line: "146055:A:3", name: "Shadow: +1 Attack", layout: {}, act: attack("f3", { shadow: LIDLESS, undefended: true }), expect: damageOn("dh1", 2) },

  { line: "146056:A:1", name: "When Revealed: each player makes a Fortitude test, and a player who fails deals 1 damage to each character they control", layout: { seats: 2, deck: ["f0", "f0", "f0", "f0"] }, act: [reveal("146056"), commit(), commit("dh3")], expect: [damageOn("dh1", 1), damageOn("dh2", 1), damageOn("dh3", 0)] },

  { line: "146057:A:1", name: "When Revealed: it attaches to the hero with the most attachments and exhausts that hero", layout: { attached: [{ code: "attachment", to: "dh2" }] }, act: reveal("146057"), expect: [exhausted("dh2"), exhausted("dh1", false)] },

  { line: "146075:A:1", name: "Setup: each player searches the encounter deck for a different location and adds it to the staging area", layout: { stage: "146075", seats: 2, deck: ["146044", "146045", "f0"] }, act: [resolve("146075", "setup"), answer("146044")], expect: [zone("146044", "staging"), zone("146045", "staging")] },
  { line: "146075:B:1", name: "+4 quest points for each player", layout: { stage: "146075", seats: 2 }, act: [], expect: stat("146075", "questPoints", 12) },
  { line: "146075:B:2", name: "the first treachery revealed each quest phase gains surge (the next card is revealed after it)", layout: { stage: "146075", phase: "Quest", deck: ["treachery", "f0", "f0"] }, act: reveal("treachery"), expect: deckCount(2) },

  { line: "146076:A:1", name: "When Revealed: Mordor Road is searched for and added to the staging area, and the players travel to it", layout: { stage: "146076", deck: ["f0", "146045"] }, act: resolve("146076", "whenRevealed"), expect: zone("146045", "activeLocation") },

  { line: "146076:B:1", name: "Forced: after progress is placed here from questing successfully each player makes a Fortitude test; a pass places a resource here and a failure engages the next enemy discarded", layout: { stage: "146076", phase: "Quest", seats: 2, deck: ["treachery", "treachery", "treachery", "treachery", "f3", "treachery", "treachery", "treachery"] }, act: [quest("success"), commit("dh3")], expect: [resourcesOn("146076", 1), zone("f3", "engaged")] },

  { line: "146077:A:1", name: "When Revealed: cards are discarded until a location for each player is discarded, and each is added to the staging area", layout: { stage: "146077", discard: ["f0"], deck: ["f3", "place"] }, act: resolve("146077", "whenRevealed"), expect: [zone("place", "staging"), zone("f3", "encounterDiscard")] },
  { line: "146077:B:1", name: "the first treachery revealed each quest phase gains surge (the next card is revealed after it)", layout: { stage: "146077", phase: "Quest", deck: ["treachery", "f0", "f0"] }, act: reveal("treachery"), expect: deckCount(2) },

  { line: "146078:A:1", name: "When Revealed: cards are discarded until an enemy for each player is discarded, and each is added to the staging area", layout: { stage: "146078", deck: ["place", "f3"] }, act: resolve("146078", "whenRevealed"), expect: zone("f3", "staging") },
  { line: "146078:B:2", name: "Forced: when Mount Doom is explored the first player makes a Fortitude test, and the players lose the game on a failure", layout: { stage: "146078", active: MD, deck: ["f0", "f0", "f0"] }, act: [announce("locationExplored", MD), commit()], expect: lost },
  { line: "146078:B:2", name: "and win it on a pass", layout: { stage: "146078", active: MD, deck: ["f0", "f0", "f0"] }, act: [announce("locationExplored", MD), commit("dh1")], expect: won },
];

cardSpecs("mount-doom", ROWS);
