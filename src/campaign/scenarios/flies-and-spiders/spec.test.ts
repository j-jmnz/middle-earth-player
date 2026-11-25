// Rules: hob.venom-poison, hob.staging-area-creating, hob.setup-flies-and-spiders, rr.forced, rr.reveal, rr.surge, rr.setup, rr.then (data/rules/entries.json).
import { cardSpecs, announce, count, deckCount, flag, reveal, resolve, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Flies and Spiders (the-hobbit part 4): the rows of the lines whose moment needs no poison, no unconscious character and no second area, one row for each record (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests). The poison, the unconscious state, the split areas and the stage Actions need
// states the layout cannot place, so their tests are `lineSpec` ones in this folder (location-lines, enemy-lines, treachery-lines, stage-lines, stage-actions): each runs again without its line's records as a row does.
const RINGS = ["132019", "132019", "132019", "132019"];
const ROWS: readonly Row[] = [
  { line: "132025:A:3", name: "Forced: at the start of the quest phase a Spider enemy is searched from the encounter deck and added to the staging area", layout: { staging: ["132025"], deck: ["132033", "132031"] }, act: announce("beginningOfPhase", undefined, { phase: "Quest", seat: null }), expect: [zone("132031", "staging"), zone("132033", "encounterDeck")] },
  { line: "132033:A:1", name: "When Revealed: with no hero committed to the quest the card gains surge", layout: { deck: ["f0", "f0"] }, act: reveal("132033"), expect: [deckCount(1)] },
  { line: "132034:A:1", name: "When Revealed: with no poisoned character no damage is dealt and the card gains surge", layout: { deck: ["f0", "f0"] }, act: reveal("132034"), expect: [deckCount(1)] },
  { line: "132067:A:1", name: "Setup: a player shuffles 1 copy of Bilbo's Magic Ring into his deck and 1 encounter card is revealed", layout: { setAside: RINGS, deck: ["f0", "f0"] }, act: resolve("132067", "setup"), expect: [count("132019", "deck", 1), count("132019", "setAside", 3), deckCount(1)] },
  { line: "132070:A:1", name: "When Revealed: The Spider's Glade is added to the staging area", layout: { stage: "132070", side: "A", setAside: ["132025"] }, act: resolve("132070", "whenRevealed"), expect: [zone("132025", "staging")] },
  { line: "132070:B:2", name: "progress cannot be placed on stage 4 while The Spider's Glade is in play", layout: { stage: "132070", staging: ["132025"] }, act: resolve("132070", "constant"), expect: [flag("132070", "noProgressPlaced")] },
];

cardSpecs("flies-and-spiders", ROWS);
