// Rules: rr.forced, rr.response, rr.then, rr.travel, rr.first-player, rr.victory, rr.engaged, rr.destroy, rr.explored, rr.shadow-effects, rr.cancel, rr.in-play-and-out-of-play, faq.additional-attacks, faq.lasting-effects (data/rules/entries.json); docs/brief.md (Attack on Dol Guldur).
import { announce, answer, attack, cardSpecs, count, damageOn, deckCount, defend, endRound, exhausted, flag, handCount, lost, offers, progressOn, quest, refused, resolve, resourcesOn, respond, reveal, stat, threat, travel, window, won, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Attack on Dol Guldur (standalone-scenarios part 9): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish). The lines a row cannot express (the Setup piles and the Keyword lines) are tests in lines.test.ts, each titled with its line id.
// A deck of locations: a card revealed in the staging step adds no enemy.
const PLACES = ["place", "place", "place", "place", "place", "place"];
const DG = (resources: number) => ({ code: "50907", resources });
const POWER = (progress: number) => ({ code: "50908", progress });
const HOST_L = "50909";
const BANE = "50910";
const SORCERER = "50911";
const MORLUG = "50912";
const DWELLER = "50913";
const HOST = "50914";
const OLOG = "50915";
const BEAST = "50916";
const ARCHER = "50917";
const MARAUDER = "50918";
const WARG = "50919";
const END_OF_ROUND = announce("endOfRound", undefined, { seat: null, phase: "End of round" });

// The four stage 3s: the quest card, the Lieutenant it brings, the Lieutenant of another stage that is in play when it is revealed.
const STAGES_3 = [
  { stage: "50903", lieutenant: BANE, other: SORCERER },
  { stage: "50904", lieutenant: SORCERER, other: MORLUG },
  { stage: "50905", lieutenant: MORLUG, other: DWELLER },
  { stage: "50906", lieutenant: DWELLER, other: BANE },
] as const;
const stage3Rows = (): Row[] =>
  STAGES_3.flatMap(({ stage, lieutenant, other }): Row[] => [
    { line: `${stage}:A:1`, name: "When Revealed: the other Lieutenant is set aside with its tokens gone, this one is added to the staging area and, with city strength 5 or less, attacks the player at once", layout: { stage, side: "A", staging: [DG(5), { code: other, damage: 2 }], setAside: [lieutenant] }, act: resolve(stage, "whenRevealed"), expect: [count(other, "setAside", 1), zone(lieutenant, "staging"), window("defense")] },
    { line: `${stage}:A:1`, name: "with city strength 6 it makes no immediate attack", layout: { stage, side: "A", staging: [DG(6), other], setAside: [lieutenant] }, act: resolve(stage, "whenRevealed"), expect: [zone(lieutenant, "staging"), window("defense", false)] },
    { line: `${stage}:B:1`, name: "the Lieutenant gets -1 engagement cost for each progress on the stage", layout: { stage, progress: 4, staging: [lieutenant] }, act: [], expect: [stat(lieutenant, "engagementCost", 41)] },
  ]);

const ROWS: readonly Row[] = [
  // 50901 Assault on the Golden Wood.
  { line: "50901:B:1", name: "Forced: a resource is placed and all the progress moves to Power of Lórien", layout: { threat: [0, 0], stage: "50901", progress: 4, staging: [DG(10), POWER(0)], deck: PLACES }, act: END_OF_ROUND, expect: [resourcesOn("50901", 1), progressOn("50908", 4), progressOn("50901", 0)] },
  { line: "50901:B:1", name: "with 3 resources the quest advances to stage 2", layout: { threat: [0, 0], stage: "50901", staging: [DG(10), POWER(0)], phase: "Planning", deck: PLACES }, act: [endRound, endRound, endRound], expect: [zone("50903", "questStage")] },
  // 50908 Power of Lórien.
  { line: "50908:A:1", name: "Response: the player who controls it adds it to the victory display to cancel and discard the card just revealed from the encounter deck", layout: { stage: "50903", play: ["50908"], staging: [DG(10)], deck: ["treachery", "f0", "f0"] }, act: [reveal("50926"), respond("50908")], expect: [zone("50908", "victory"), zone("50926", "encounterDiscard")] },
  // 50902 Crossing the Anduin.
  { line: "50902:A:1", name: "When Revealed: 10 progress from Power of Lórien bring the Host of Lórien into play, and 20 more keep Power of Lórien", layout: { stage: "50902", side: "A", staging: [DG(10), POWER(30)], setAside: [HOST_L] }, act: [resolve("50902", "whenRevealed"), answer("host"), answer("power")], expect: [zone(HOST_L, "play"), zone("50908", "play"), progressOn("50908", 0)] },
  { line: "50902:A:1", name: "10 progress and no more: Power of Lórien is discarded", layout: { stage: "50902", side: "A", staging: [DG(10), POWER(10)], setAside: [HOST_L] }, act: [resolve("50902", "whenRevealed"), answer("host")], expect: [zone(HOST_L, "play"), count("50908", "encounterDiscard", 1)] },
  { line: "50902:A:1", name: "paying 10 and declining the 20: Power of Lórien is discarded", layout: { stage: "50902", side: "A", staging: [DG(10), POWER(30)], setAside: [HOST_L] }, act: [resolve("50902", "whenRevealed"), answer("host"), answer("discard")], expect: [zone(HOST_L, "play"), count("50908", "encounterDiscard", 1), progressOn("50908", 20)] },
  { line: "50902:A:1", name: "less than 10 progress: Power of Lórien is discarded and the Host stays aside", layout: { stage: "50902", side: "A", staging: [DG(10), POWER(9)], setAside: [HOST_L] }, act: resolve("50902", "whenRevealed"), expect: [count("50908", "encounterDiscard", 1), count(HOST_L, "setAside", 1)] },
  { line: "50902:B:1", name: "When Revealed: each player searches for a Dol Guldur location and the first player advances to a stage 3 of his choice", layout: { stage: "50902", staging: [DG(10)], deck: ["f0", "50920", "f0"] }, act: [resolve("50902", "whenRevealed"), answer("50905")], expect: [zone("50920", "staging"), zone("50905", "questStage")] },
  ...stage3Rows(),
  // The stage 3 Forced effects (the first player removes 5 progress or takes the penalty, and may remove 5 more).
  { line: "50903:B:2", name: "Forced: 5 progress come off the stage", layout: { threat: [0, 0], stage: "50903", progress: 5, staging: [DG(10)], deck: PLACES }, act: [END_OF_ROUND, answer("progress")], expect: [progressOn("50903", 0), resourcesOn("50907", 10)] },
  { line: "50903:B:2", name: "the penalty raises the city strength by 3", layout: { threat: [0, 0], stage: "50903", progress: 5, staging: [DG(10)], deck: PLACES }, act: [END_OF_ROUND, answer("penalty")], expect: [progressOn("50903", 5), resourcesOn("50907", 13)] },
  { line: "50903:B:2", name: "5 more progress lower the city strength by 3", layout: { threat: [0, 0], stage: "50903", progress: 10, staging: [DG(10)], deck: PLACES }, act: [END_OF_ROUND, answer("progress"), answer("extra")], expect: [progressOn("50903", 0), resourcesOn("50907", 7)] },
  { line: "50904:B:2", name: "the penalty: each player discards all but 1 card from his hand", layout: { threat: [0, 0], stage: "50904", staging: [DG(10)], hand: ["filler", "filler", "filler"], deck: PLACES }, act: END_OF_ROUND, expect: [handCount(1)] },
  { line: "50904:B:2", name: "the extra 5 progress: a chosen player searches his deck and adds a card to his hand", layout: { threat: [0, 0], stage: "50904", progress: 10, staging: [DG(10)], hand: [], deckOf: ["filler", "filler"], deck: PLACES }, act: [END_OF_ROUND, answer("extra")], expect: [progressOn("50904", 0), handCount(1)] },
  { line: "50905:B:2", name: "the penalty: each player discards from the encounter deck to the first enemy and it engages him", layout: { threat: [0, 0], stage: "50905", staging: [DG(10)], deck: ["place", "f3", "f0"] }, act: END_OF_ROUND, expect: [count("f3", "engaged", 1), zone("place", "encounterDiscard")] },
  { line: "50905:B:2", name: "the extra 5 progress destroy a non-unique enemy in the staging area", layout: { threat: [0, 0], stage: "50905", progress: 10, staging: [DG(10), "f3"], deck: PLACES }, act: [END_OF_ROUND, answer("progress"), answer("extra")], expect: [progressOn("50905", 0), count("f3", "staging", 0)] },
  { line: "50906:B:2", name: "the penalty: each player discards an ally he controls", layout: { threat: [0, 0], stage: "50906", staging: [DG(10)], play: ["ally"], deck: PLACES }, act: END_OF_ROUND, expect: [count("ally", "play", 0)] },
  { line: "50906:B:2", name: "the extra 5 progress: a chosen player puts an ally from the top 10 of his deck into play", layout: { threat: [0, 0], stage: "50906", progress: 10, staging: [DG(10)], deckOf: ["ally", "filler"], deck: PLACES }, act: [END_OF_ROUND, answer("extra")], expect: [progressOn("50906", 0), count("ally", "play", 1)] },
  // 50907 Dol Guldur: the Siege values of what is destroyed or explored this round come off the city strength at the end of the round, at stage 3.
  { line: "50907:A:1", name: "an enemy destroyed in the staging area adds its Siege value (4) and the tally comes off at the end of the round", layout: { threat: [0, 0], stage: "50906", staging: [DG(10), HOST], deck: PLACES }, act: [announce("enemyDestroyed", HOST, { seat: 0 }), END_OF_ROUND], expect: [resourcesOn("50907", 6)] },
  { line: "50907:A:1", name: "an engaged enemy and an explored location count too", layout: { threat: [0, 0], stage: "50906", staging: [DG(10), "50920"], engaged: [OLOG], deck: PLACES }, act: [announce("enemyDestroyed", OLOG, { seat: 0 }), announce("locationExplored", "50920", { seat: 0 }), END_OF_ROUND], expect: [resourcesOn("50907", 5)] },
];

if (ROWS.length > 0) cardSpecs("attack-on-dol-guldur", ROWS);
