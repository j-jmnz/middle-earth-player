// Rules: rr.reveal, rr.staging, rr.forced, rr.shadow-effects, rr.first-player, rr.explored, rr.attacks-outside-the-combat-phase, rr.optional-engagement, rr.player-elimination, rr.running-out-of-cards, rr.quest-advancement, rr.objective-cards, ats.underworld, ats.setup-the-stewards-fear-underworld-deck (data/rules/entries.json). Lines that need a played Setup, a stage that advances, a stack that is released or a loss are tests titled with their line id in lines.test.ts.
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, count, damageOn, exhausted, flag, progressOn, resolve, resourcesOn, respond, stat, threat, zone, revealedBy, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Steward's Fear (against-the-shadow part 4): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests). The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points;
// every seat starts at threat 28. The cards the layout sets aside are all that the game has set aside (the layout deals what it lists), so a row names the one Plot or Villain it needs as the hidden one.
const STAR = "06022";
const ROOTS = "06019";
const PRISONER = "06028";

const ROWS: readonly Row[] = [
  { line: "06011:B:1", name: "When Revealed: The Fourth Star is found in the encounter deck and made the active location", layout: { deck: ["f0", STAR, "f0"] }, act: resolve("06011", "whenRevealed"), expect: [zone(STAR, "activeLocation")] },
  { line: "06011:B:2", name: "Forced: after the active location leaves play as an explored location, 1 resource token on the quest", layout: { active: "place", stage: "06011" }, act: announce("activeExplored", "place"), expect: resourcesOn("06011", 1) },
  { line: "06012:B:2", name: "Forced: after the active location leaves play as an explored location, 1 resource token on the quest (stage 2)", layout: { active: "place", stage: "06012" }, act: announce("activeExplored", "place"), expect: resourcesOn("06012", 1) },

  { line: "06012:A:1", name: "When Revealed: the set aside Plot is revealed (a reveal step names the revealing seat) and added to the staging area", layout: { stage: "06012", side: "A", setAside: ["06029"] }, act: resolve("06012", "whenRevealed"), expect: [zone("06029", "staging"), revealedBy("06029", 0)] },
  { line: "06012:B:1", name: "When Revealed: Roots of Mindolluin, set aside, becomes the active location and the old one returns to the staging area", layout: { stage: "06012", active: "place", setAside: [ROOTS] }, act: resolve("06012", "whenRevealed"), expect: [zone(ROOTS, "activeLocation"), zone("place", "staging")] },
  { line: "06013:A:1", name: "When Revealed: the set aside Villain is revealed and added to the staging area, not engaged", layout: { stage: "06013", side: "A", setAside: ["06016"] }, act: resolve("06013", "whenRevealed"), expect: [zone("06016", "staging"), revealedBy("06016", 0)] },

  { line: "06014:A:1", name: "+1 Attack for each Underworld location in play: the staging area and the active location count, The Fourth Star (City, no Underworld trait) does not", layout: { staging: ["06014", "06018", "06020", STAR], active: "06021" }, act: [], expect: stat("06014", "attack", 5) },
  { line: "06015:A:1", name: "Daughter of Berúthiel cannot be optionally engaged", layout: { staging: ["06015"] }, act: [], expect: flag("06015", "cannotBeOptionallyEngaged") },
  { line: "06015:A:2", name: "Forced after she attacks: she returns to the staging area", layout: {}, act: [attack("06015", { undefended: true }), answer("return")], expect: [zone("06015", "staging"), threat(29)] },
  { line: "06015:A:2", name: "The engaged player may raise his threat by 4 to prevent it: she stays engaged", layout: {}, act: [attack("06015", { undefended: true }), answer("raise")], expect: [zone("06015", "engaged"), threat(32)] },

  { line: "06017:A:1", name: "When Bane attacks, the top 3 cards of each player's deck are discarded", layout: { seats: 2, deckOf: Array.from({ length: 8 }, (_, index) => ({ code: "filler", seat: index % 2 })) }, act: attack("06017", { undefended: true }), expect: count("filler", "discard", 6) },

  { line: "06019:A:2", name: "Each location in the staging area gets +2 quest points: the location there does, Roots as the active location does not", layout: { active: ROOTS, staging: ["place"] }, act: [], expect: [stat("place", "questPoints", 4), stat(ROOTS, "questPoints", 5)] },
  { line: "06019:A:2", name: "Roots in the staging area gets the 2 itself", layout: { staging: [ROOTS] }, act: [], expect: stat(ROOTS, "questPoints", 7) },
  { line: "06020:A:2", name: "Shadow: the attacker gets +1 Attack when the attack is defended (Dissident 2 + 1 against Defense 2)", layout: {}, act: attack("06014", { shadow: "06020" }), expect: damageOn("dh1", 1) },
  { line: "06020:A:2", name: "Shadow: +2 Attack instead when undefended (2 + 2)", layout: {}, act: [attack("06014", { shadow: "06020", undefended: true }), answer("dh1")], expect: damageOn("dh1", 4) },
  { line: "06021:A:2", name: "Forced: after Houses of the Dead becomes the active location every character exhausts, allies too", layout: { staging: ["06021"], phase: "Travel", play: ["ally"] }, act: announce("becameActive", "06021"), expect: [exhausted("dh1"), exhausted("dh2"), exhausted("ally")] },

  { line: "06012:A:1", name: "Whichever Plot is hidden is revealed and staged: Up in Flames", layout: { stage: "06012", side: "A", setAside: ["06030"] }, act: resolve("06012", "whenRevealed"), expect: [zone("06030", "staging"), revealedBy("06030", 0)] },
  { line: "06012:A:1", name: "Whichever Plot is hidden is revealed and staged: Poisoned Counsels", layout: { stage: "06012", side: "A", setAside: ["06031"] }, act: resolve("06012", "whenRevealed"), expect: [zone("06031", "staging"), revealedBy("06031", 0)] },
  { line: "06013:A:1", name: "Whichever Villain is hidden is revealed and staged: Daughter of Berúthiel", layout: { stage: "06013", side: "A", setAside: ["06015"] }, act: resolve("06013", "whenRevealed"), expect: [zone("06015", "staging"), revealedBy("06015", 0)] },
  { line: "06013:A:1", name: "Whichever Villain is hidden is revealed and staged: Telemnar's Bane", layout: { stage: "06013", side: "A", setAside: ["06017"] }, act: resolve("06013", "whenRevealed"), expect: [zone("06017", "staging"), revealedBy("06017", 0)] },

  { line: "06026:A:1", name: "Action: a hero exhausts to claim A Scrap of History into the victory display and place 1 resource token on the current quest", layout: { staging: ["06026"], stage: "06011" }, act: respond("06026"), expect: [exhausted("dh1"), zone("06026", "victory"), resourcesOn("06011", 1)] },
  { line: "06028:A:1", name: "Action: a hero exhausts to claim A Prisoner into the victory display and place 2 resource tokens on the current quest", layout: { staging: [PRISONER], stage: "06011" }, act: respond(PRISONER), expect: [exhausted("dh1"), zone(PRISONER, "victory"), resourcesOn("06011", 2)] },
  { line: "06027:A:1", name: "Action: a hero exhausts to claim Secret Map and attach it to that hero", layout: { staging: ["06027"] }, act: respond("06027"), expect: [exhausted("dh1"), zone("06027", "attached")] },
  { line: "06027:A:2", name: "Action: attached to a hero, Secret Map goes to the victory display to place 3 progress tokens on the active location", layout: { active: "place", attached: [{ code: "06027", to: "dh1", encounter: true }] }, act: respond("06027"), expect: [zone("06027", "victory"), progressOn("place", 2)] },

  { line: "06031:A:1", name: "At the end of each round every player raises his threat by 2", layout: { seats: 2, staging: ["06031"] }, act: announce("endOfRound"), expect: [threat(30, 0), threat(30, 1)] },
];

if (ROWS.length > 0) cardSpecs("the-stewards-fear", ROWS);
else describe("the-stewards-fear card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
