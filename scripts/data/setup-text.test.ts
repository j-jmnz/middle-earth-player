import { describe, expect, it } from "vitest";

import type { Card } from "../../src/catalog/card-facts.ts";
import { nameIndex, parseSetup } from "./normalize/setup-text.ts";

// Each sentence is quoted from data/printed/mirkwood-paths.json (the scan-read ledger), not from Hall of Beorn.
const card = (code: string, name: string, type = "enemy"): Card => ({ code, name, type }) as Card;
const CARDS = [
  card("a1", "The Eaves of Mirkwood", "location"),
  card("a2", "Goblin Troop"),
  card("a3", "Goblin Chieftain"),
  card("a4", "Cracked Pillar", "location"),
  card("a5", "Cave Torch", "attachment"),
  card("a6", "Forest Spider"),
  card("a7", "Old Forest Road", "location"),
  card("a8", "Nazgûl of Dol Guldur"),
  card("a9", "Mendor", "attachment"),
  card("b1", "Appointed by Fate", "attachment"),
  card("b2", "Valor", "attachment"),
  card("b3", "Scarred", "attachment"),
  card("b4", "No Time to Waste!", "attachment"),
  card("b5", "Shiny Distraction", "treachery"),
  card("b6", "Stalking Goblin"),
];
const names = nameIndex(CARDS, new Set());
const parse = (text: string) => parseSetup(text, names);

describe("parseSetup: Mirkwood Paths and The Dark of Mirkwood Setup sentences", () => {
  it("01119.A: searches for 1 copy of each and adds them to the staging area", () => {
    const parsed = parse("Setup: Search the encounter deck for 1 copy of the Forest Spider and 1 copy of the Old Forest Road, and add them to the staging area. Then, shuffle the encounter deck.");
    expect(parsed.unread).toEqual([]);
    expect(parsed.clauses).toEqual([{ kind: "stage", codes: ["a6", "a7"], perPlayer: null, count: 1 }, { kind: "shuffleEncounterDeck" }]);
  });

  it("01123.A: the 3 objective cards, the Nazgûl alongside the quest deck, 1 encounter card attached to each objective", () => {
    const parsed = parse(
      "Setup: Search the encounter deck for the 3 objective cards, reveal and place them in the staging area. Also, place the Nazgûl of Dol Guldur face up but out of play, alongside the quest deck. Then, shuffle the encounter deck, and attach 1 encounter to each objective card.",
    );
    expect(parsed.unread).toEqual([]);
    expect(parsed.clauses).toEqual([
      { kind: "searchObjectives", count: 3 },
      { kind: "aside", codes: ["a8"], allCopies: false },
      { kind: "shuffleEncounterDeck" },
      { kind: "attachEncounterToObjectives", count: 1 },
    ]);
  });

  it("01126.A: each player reveals 1 card from the top of the encounter deck", () => {
    const parsed = parse("Setup: Each player reveals 1 card from the top of the encounter deck, and adds it to the staging area.");
    expect(parsed).toEqual({ clauses: [{ kind: "eachPlayerReveals", count: 1 }], unread: [] });
  });

  it("01129.A and 01131.A: Put Mendor into play, and Appointed by Fate goes to a hero of the first player's choice", () => {
    expect(parse("Setup: Put Mendor into play.")).toEqual({ clauses: [{ kind: "putIntoPlay", codes: ["a9"] }], unread: [] });
    expect(parse("Setup: Put Mendor into play. Attach Appointed by Fate to a hero of the first player's choice.").clauses).toEqual([
      { kind: "putIntoPlay", codes: ["a9"] },
      { kind: "attachChosen", codes: ["b1"], who: "firstPlayer" },
    ]);
  });

  it("01130.A: Set each copy of Valor and Scarred aside, out of play", () => {
    expect(parse("Setup: Put Mendor into play. Set each copy of Valor and Scarred aside, out of play.").clauses).toEqual([
      { kind: "putIntoPlay", codes: ["a9"] },
      { kind: "aside", codes: ["b2", "b3"], allCopies: true },
    ]);
  });

  it("41001.A: searches for 1 copy of two cards, stages one and sets the other aside", () => {
    const parsed = parse(
      "Setup: Search the encounter deck for 1 copy of The Eaves of Mirkwood and Goblin Troop. Add The Eaves of Mirkwood to the staging area and set Goblin Troop aside, out of play. Shuffle the encounter deck.",
    );
    expect(parsed.unread).toEqual([]);
    expect(parsed.clauses).toEqual([
      { kind: "search", codes: ["a1", "a2"] },
      { kind: "stage", codes: ["a1"], perPlayer: null, count: 1 },
      { kind: "aside", codes: ["a2"], allCopies: false },
      { kind: "shuffleEncounterDeck" },
    ]);
  });

  it("41004.A: searches for three cards, two go aside and the first player attaches the third", () => {
    const parsed = parse(
      "Setup: Search the encounter deck for Goblin Chieftain, Cracked Pillar, and Cave Torch. Set Goblin Chieftain and Cracked Pillar aside, out of play. The first player attaches Cave Torch to one of his heroes. Shuffle the encounter deck.",
    );
    expect(parsed.unread).toEqual([]);
    expect(parsed.clauses).toEqual([
      { kind: "search", codes: ["a3", "a4", "a5"] },
      { kind: "aside", codes: ["a3", "a4"], allCopies: false },
      { kind: "attachChosen", codes: ["a5"], who: "firstPlayer" },
      { kind: "shuffleEncounterDeck" },
    ]);
  });

  it("41050.A: each player chooses 1 Adaptation boon; the burden is shuffled in and both go to the Campaign Pool", () => {
    const parsed = parse(
      "Setup: Each player chooses 1 Adaptation boon attachment and attaches it to one of their heroes. Shuffle the Stalking Goblin burden enemy into the encounter deck. Add Stalking Goblin and each attached Adaptation to the Campaign Pool.",
    );
    expect(parsed.unread).toEqual([]);
    expect(parsed.clauses[0]).toEqual({ kind: "eachPlayerChoosesBoon", trait: "Adaptation" });
    expect(parsed.clauses).toContainEqual({ kind: "shuffleInto", codes: ["b6"], into: "encounter deck", set: null });
    expect(parsed.clauses).toContainEqual({ kind: "addToCampaignPool", codes: ["b6"] });
  });

  it("41051.A: each player adds 1 copy of a boon to their hand after the mulligan", () => {
    const parsed = parse(
      'Setup: Each player adds 1 copy of the "No Time to Waste!" boon to their hand after drawing their starting hand (including taking a mulligan). Add each copy of "No Time to Waste!" in a player\'s hand to the Campaign Pool. Shuffle the Shiny Distraction burden into the encounter deck and add it to the Campaign Pool.',
    );
    expect(parsed.unread).toEqual([]);
    expect(parsed.clauses[0]).toEqual({ kind: "addToHandAfterMulligan", codes: ["b4"], count: 1 });
    expect(parsed.clauses).toContainEqual({ kind: "addToCampaignPool", codes: ["b4"] });
    expect(parsed.clauses).toContainEqual({ kind: "shuffleInto", codes: ["b5"], into: "encounter deck", set: null });
  });

  it("reports a search sentence that is not a bare list of names, or that places nothing, as unread", () => {
    expect(parse("Setup: Search the encounter deck for Goblin Troop and discard every other card.").unread).toHaveLength(1);
    // A found card no later clause places.
    expect(parse("Setup: Search the encounter deck for Goblin Troop. Shuffle the encounter deck.").unread).toEqual(["Search the encounter deck for Goblin Troop"]);
  });
});

// Dream-chaser (phase 37): each sentence is quoted from data/printed/dream-chaser.json (the scan-read ledger).
describe("parseSetup: Dream-chaser Setup sentences", () => {
  const cardsOf = [
    card("d1", "Calphon", "objective"),
    card("d2", "Spyglass", "attachment"),
    card("d3", "Black Key", "attachment"),
    card("d4", "Black Key", "objective"),
    card("d5", "Captain Sahír", "enemy"),
    card("d6", "Crowley", "enemy"),
    card("d7", "Rolling Seas", "location"),
    card("d8", "Stormcaller", "ship-enemy"),
    card("d9", "Armor Plating", "attachment"),
    card("e1", "Galdor's Counsel", "event"),
    card("e2", "Galdor's Counsel", "event"),
    card("f1", "Calaerion", "objective"),
    card("f2", "Cirdan's Blessing", "attachment"),
    card("f3", "Gavin", "objective"),
  ].map((entry, at) => ({ ...entry, campaignKind: at === 2 || at === 8 || at === 9 || at === 10 || at === 12 ? "boon" : at === 3 || at === 5 ? "burden" : null, traits: at === 8 ? ["Modification"] : [] }) as Card);
  const dream = nameIndex(cardsOf, new Set());
  const read = (text: string) => parseSetup(text, dream);

  it("reads the deck and fleet preparation of Voyage Across Belegaer (11016.A)", () => {
    const parsed = read("Setup: Prepare the Corsair deck. Players prepare their fleet. Shuffle each stage 2 card in the quest deck so that their order is random, leaving stage 3 on the bottom. Shuffle the encounter deck.");
    expect(parsed.unread).toEqual([]);
    expect(parsed.clauses.map((clause) => (clause.kind === "step" ? clause.step : clause.kind))).toEqual(["prepareCorsairDeck", "prepareFleet", "shuffleStageTwos", "shuffleEncounterDeck"]);
  });

  it("reads a count that depends on the players (12012.A: 1 copy of Rolling Seas, 2 from 3 players)", () => {
    const parsed = read("Setup: Search the encounter deck for 1 copy of Rolling Seas, and add it to the staging area (2 copies instead if there are 3 or more players in the game).");
    expect(parsed).toEqual({ clauses: [{ kind: "stage", codes: ["d7"], perPlayer: null, count: 1, many: { count: 2, from: 3 } }], unread: [] });
  });

  it("reads the campaign cards' Setup (11171.A, 11182.A, 11191.A)", () => {
    expect(read("Setup: Each player chooses a Modification boon for each of their ship-objectives and attaches it to that ship-objective. Shuffle Crowley into the Corsair deck.")).toEqual({
      clauses: [{ kind: "eachPlayerChoosesBoon", trait: "Modification" }, { kind: "shuffleInto", codes: ["d6"], into: "Corsair deck", set: null }],
      unread: [],
    });
    const raid = read("Setup: The first player takes control of Calphon and attaches Spyglass and Black Key (boon) to him. Each player may choose one copy of Galdor's Counsel and add it to their hand. For this game, X is plus 1 for each of those copies.");
    expect(raid.unread).toEqual([]);
    expect(raid.clauses).toEqual([
      { kind: "step", step: "takeControl", codes: ["d1"] },
      { kind: "step", step: "attach", codes: ["d2", "d3"], to: ["d1"] },
      { kind: "step", step: "chooseCopies", codes: ["e1", "e2"] },
      { kind: "step", step: "plusOneX", codes: [] },
    ]);
    const stormcaller = read(`Setup: Flip the Stormcaller to its "Campaign Mode only" side, then attach Black Key (burden) to it. Put Calaerion into play under the control of the player with the Dream-chaser.`);
    expect(stormcaller.clauses.map((clause) => (clause.kind === "step" ? clause.step : clause.kind))).toEqual(["flipToCampaignSide", "attach", "putIntoPlay"]);
    expect(stormcaller.clauses[1]).toMatchObject({ codes: ["d4"], to: ["d8"] });
  });

  it("matches a name through its accents and curly apostrophes (Círdan's Blessing is Cirdan's Blessing in the data)", () => {
    const parsed = read("Setup: One player may choose one copy of Círdan’s Blessing and add it to their hand.");
    expect(parsed.unread).toEqual([]);
    expect(parsed.clauses).toEqual([{ kind: "step", step: "chooseCopies", codes: ["f2"] }]);
  });

  it("names the boon, not the burden, for 'Black Key (boon)' and both for the bare name", () => {
    expect(dream.allCodesOf("Black Key (boon)")).toEqual(["d3"]);
    expect(dream.allCodesOf("Black Key (burden)")).toEqual(["d4"]);
    expect(dream.allCodesOf("Black Key").sort()).toEqual(["d3", "d4"]);
  });

  it("leaves a sentence unread when a name it must hold finds no card, instead of dropping the step", () => {
    expect(read("Setup: The first player takes control of Aldarion and attaches Spyglass to him.").unread).toEqual(["The first player takes control of Aldarion and attaches Spyglass to him"]);
    expect(read("Setup: Attach Black Key (boon) to Aldarion.").unread).toEqual(["Attach Black Key (boon) to Aldarion"]);
    expect(read("Setup: Shuffle Aldarion into the Corsair deck.").unread).toEqual(["Shuffle Aldarion into the Corsair deck"]);
    expect(read("Setup: Put Aldarion into play under the control of the player with the Dream-chaser.").unread).toEqual(["Put Aldarion into play under the control of the player with the Dream-chaser"]);
    expect(read("Setup: Attach Black Key (boon) to Captain Sahír.").clauses).toEqual([{ kind: "step", step: "attach", codes: ["d3"], to: ["d5"] }]);
  });

  it("reads the Setup lines of the campaign cards of The Fate of Númenor to The City of Corsairs that name a campaign log fact or turn the card over", () => {
    const parsed = read(`Setup: If "Gavin returned," put him into play under any player's control. Flip this card over.`);
    expect(parsed.unread).toEqual([]);
    expect(parsed.clauses).toEqual([
      { kind: "step", step: "putIntoPlayIfLogged", codes: ["f3"] },
      { kind: "step", step: "flipCampaignCard", codes: [] },
    ]);
  });

  it("reads the set steps of The Thing in the Depths and The City of Corsairs (12039.A, 12147.A)", () => {
    expect(read("Setup: Build the encounter deck using only The Stormcaller and Corsair Raiders encounter sets, setting The Thing in the Depths and The Stormcaller Elite encounter sets aside, out of play (enemy side faceup).").clauses).toEqual([
      { kind: "step", step: "buildDeck", codes: [], sets: ["The Stormcaller", "Corsair Raiders"], asideSets: ["The Thing in the Depths", "The Stormcaller Elite"] },
    ]);
    expect(read("Setup: Set The City of Corsairs encounter set aside, as an inactive second encounter deck.").clauses).toEqual([{ kind: "step", step: "secondDeck", codes: [], asideSets: ["The City of Corsairs"] }]);
  });

  it("leaves a sentence no pattern reads unread", () => {
    expect(read("Setup: Sail to Umbar.").unread).toEqual(["Sail to Umbar"]);
  });
});

// Ered Mithrin (phase 49): each sentence is quoted from data/printed/ered-mithrin.json (the scan-read ledger).
describe("parseSetup: Ered Mithrin Setup sentences", () => {
  const list = [
    card("g1", "Turayn", "ally"),
    card("g2", "A Growing Threat", "treachery"),
    card("g3", "Haldan", "objective"),
    card("g4", "Searching for a Way Out", "objective"),
    card("g5", "Forest Spider"),
    card("g6", "Twilight Hall", "location"),
    card("g7", "Dagnir's Spawn"),
    card("g8", "Abandoned Ruin", "location"),
    card("g9", "The Threat to Wilderland", "objective"),
    card("h1", "Urdug", "objective"),
    card("h2", "Urdug", "enemy"),
    card("h3", "Urdug's Cunning", "treachery"),
    card("h4", "Wormsbane", "objective"),
    card("h5", "Wormsbane", "objective"),
    card("h6", "Dragon Sign", "objective"),
    card("h7", "Fire-drake"),
    card("h8", "Dragon Hoard", "location"),
    card("h9", "Dagnir"),
    card("i1", "Dragon-sickness", "treachery"),
  ];
  const em = nameIndex(list, new Set(["g3"]));
  const read = (text: string) => parseSetup(text, em);
  const steps = (text: string) => read(text).clauses.map((clause) => (clause.kind === "step" ? clause.step : clause.kind));

  it("reads the deck steps of the stage 1A cards (18066.A, 18078.A, 19134.A, 19083.A)", () => {
    expect(steps("Setup: Set Haldan aside, out of play. Create the Evil Creatures deck (see insert) and place it next to the quest deck.")).toEqual(["aside", "buildEvilCreaturesDeck"]);
    expect(steps("Setup: Build the Caves deck (see insert) and set it next to the quest deck.")).toEqual(["buildCavesDeck"]);
    expect(steps("Setup: Create the Caves deck and the quest deck (see insert).")).toEqual(["buildCavesDeck", "prepareQuestDeck"]);
    const side = read("Setup: Search the encounter deck for all 8 encounter side quests, shuffle them together, and place them facedown next to the quest deck. This is the side quest deck. The first player adds Dagnir to the staging area and shuffles the encounter deck. Each other player reveals an encounter card.");
    expect(side.unread).toEqual([]);
    expect(side.clauses).toEqual([
      { kind: "step", step: "buildSideQuestDeck", codes: [], count: 8 },
      { kind: "stage", codes: ["h9"], perPlayer: null, count: 1 },
      { kind: "shuffleEncounterDeck" },
      { kind: "step", step: "eachOtherPlayerReveals", codes: [], count: 1 },
    ]);
  });

  it("reads the cards discarded for the staging area, and the sets set aside by name (18071.A, 18078.A, 19134.A, 19168.A)", () => {
    expect(read("Setup: Shuffle the encounter deck and discard cards from the top until X locations are discarded, where X is the number of players. Add each discarded location to the staging area.")).toEqual({
      clauses: [{ kind: "discardToStaging", types: ["location"], amount: "players", eachPlayer: false, shuffleFirst: true }],
      unread: [],
    });
    expect(read("Setup: Shuffle the encounter deck and discard cards from the top until X locations have been discarded, where X is 1 less than the number of players in the game. Add those locations to the staging area.").clauses).toEqual([
      { kind: "discardToStaging", types: ["location"], amount: "playersLessOne", eachPlayer: false, shuffleFirst: true },
    ]);
    expect(read("Setup: Each player discards cards from the top of the encounter deck until he discards an enemy or location and adds that card to the staging area.").clauses).toEqual([
      { kind: "discardToStaging", types: ["enemy", "location"], amount: "players", eachPlayer: true, shuffleFirst: false },
    ]);
    expect(read("Setup: Set the Spiders of Mirkwood and Dol Guldur Orcs encounter sets aside, out of play.").clauses).toEqual([{ kind: "step", step: "setSetsAside", codes: [], asideSets: ["Spiders of Mirkwood", "Dol Guldur Orcs"] }]);
    expect(read("Setup: Set Fire-drake, Dragon Hoard, and the Dragon Might encounter sets aside, out of play.").clauses).toEqual([
      { kind: "aside", codes: ["h7", "h8"], allCopies: false },
      { kind: "step", step: "setSetsAside", codes: [], asideSets: ["Dragon Might"] },
    ]);
  });

  it("reads who takes control of a card, and a card with an objective and an enemy side (12168.A, 12170.A, 19047.A, 18071.A)", () => {
    expect(read("Setup: Any player gains control of Turayn.").clauses).toEqual([{ kind: "step", step: "takeControl", codes: ["g1"] }]);
    expect(read("Setup: The first player takes control of Urdug, objective side face-up.").clauses).toEqual([{ kind: "step", step: "takeControl", codes: ["h1", "h2"] }]);
    expect(read("Setup: The first player takes control of Haldan and adds Searching for a Way Out to the staging area. Each player adds 1 Forest Spider to the staging area.").clauses).toEqual([
      { kind: "step", step: "takeControl", codes: ["g3"] },
      { kind: "stage", codes: ["g4"], perPlayer: null, count: 1 },
      { kind: "stage", codes: ["g5"], perPlayer: 1, count: 0 },
    ]);
  });

  it("reads the treasure steps of Lost in Mirkwood and the campaign cards (12168.A, 12170.A, 12184.A)", () => {
    const hall = read("Setup: The first player may search the encounter deck for a copy of Twilight Hall and add it to the staging area. If they do, the players look at 3 random undiscovered treasures and attach 1 of them to Twilight Hall as a guarded objective. When free of encounters, the players claim the treasure and attach it to any character.");
    expect(hall.unread).toEqual([]);
    expect(hall.clauses).toEqual([
      { kind: "step", step: "searchAndStage", codes: [], to: ["g6"] },
      { kind: "step", step: "attachTreasure", codes: [], to: ["g6"], count: 3 },
      { kind: "step", step: "claimTreasure", codes: [] },
    ]);
    const king = read("Setup: Each player may change hero cards without incurring the +1 threat penalty, and Haldan may be included among a player's heroes. Add The Threat to Wilderland to the staging area, shuffle Dagnir's Spawn into the encounter deck, and shuffle Abandoned Ruin into the Caves deck. If \"Turayn has taken an oath of vigilance,\" search the encounter deck for 3 treacheries and remove them from the game.");
    expect(king.unread).toEqual([]);
    expect(king.clauses).toEqual([
      { kind: "waivePenalty" },
      { kind: "step", step: "haldanMayBeHero", codes: [], to: ["g3"] },
      { kind: "stage", codes: ["g9"], perPlayer: null, count: 1 },
      { kind: "shuffleInto", codes: ["g7"], into: "encounter deck", set: null },
      { kind: "shuffleInto", codes: ["g8"], into: "Caves deck", set: null },
      { kind: "removeCards", ifLogged: "Turayn has taken an oath of vigilance", count: 3, what: "treachery", nonUnique: false, except: null, alsoCaves: null },
    ]);
    const roam = read("Setup: The first player may put their trust in Urdug by placing a resource on him (from the token pool). If they don't, shuffle a copy of the Urdug's Cunning burden into the encounter deck. Flip this card over.");
    expect(roam.unread).toEqual([]);
    expect(roam.clauses.map((clause) => (clause.kind === "step" ? clause.step : clause.kind))).toEqual(["trustInUrdug", "cunningUnlessTrusted", "flipCampaignCard"]);
    expect(read("Setup: If they don't, shuffle a copy of the Urdug's Cunning burden into the encounter deck.").unread).toHaveLength(1);
  });

  it("reads the log conditions, the boon search and the ignored keywords (12175.A, 12184.A, 12187.A, 12193.A, 12195.A)", () => {
    expect(read("Setup: A player may search their deck for a unique boon ally and add it to their hand. If \"Melanwar has given you guidance on traversing Wilderland,\" search the encounter deck for 2 non-unique locations and the Caves deck for 1 location and remove them from the game.").clauses).toEqual([
      { kind: "searchDeckForBoon", who: "aPlayer", unique: true, cards: "boon ally" },
      { kind: "removeCards", ifLogged: "Melanwar has given you guidance on traversing Wilderland", count: 2, what: "location", nonUnique: true, except: null, alsoCaves: 1 },
    ]);
    expect(read("Setup: If \"Melanwar has given you guidance on traversing Wilderland,\" search the encounter deck for 3 non-unique enemies not named Grey Mountain Giant and remove them from the game.").clauses).toEqual([
      { kind: "removeCards", ifLogged: "Melanwar has given you guidance on traversing Wilderland", count: 3, what: "enemy", nonUnique: true, except: "Grey Mountain Giant", alsoCaves: null },
    ]);
    expect(read("Setup: Each player may search their deck for a boon or treasure card and add it to their hand.").clauses).toEqual([{ kind: "searchDeckForBoon", who: "eachPlayer", unique: false, cards: "boon or treasure" }]);
    expect(read("Setup: If there are 6 or more treasures recorded in the campaign log, shuffle Dragon-sickness into the encounter deck. Flip this card.").clauses).toEqual([
      { kind: "shuffleInto", codes: ["i1"], into: "encounter deck", set: null, ifTreasures: 6 },
      { kind: "step", step: "flipCampaignCard", codes: [] },
    ]);
    expect(read("Setup: Ignore the deep and discover keywords.").clauses).toEqual([{ kind: "step", step: "ignoreKeywords", codes: [], sets: ["deep", "discover"] }]);
    expect(read("Setup: Ignore the deep keyword. (Note: If you make 5 or more progress on the main quest, you will earn a treasure during quest resolution.)").unread).toEqual([]);
    expect(read("Setup: Attach Wormsbane to a hero, Broken side face-up.").clauses).toEqual([{ kind: "attachChosen", codes: ["h4", "h5"], who: "anyPlayer" }]);
  });

  it("leaves a sentence unread when a name it must hold finds no card", () => {
    expect(read("Setup: The first player takes control of Thranduil and adds Searching for a Way Out to the staging area.").unread).toHaveLength(1);
    expect(read("Setup: Shuffle 2 set aside Dragon Sign objectives into the Caves deck.").clauses).toEqual([{ kind: "step", step: "shuffleAsideIntoCaves", codes: ["h6"], count: 2 }]);
    expect(read("Setup: Shuffle 2 set aside Spiders objectives into the Caves deck.").unread).toHaveLength(1);
  });
});
