import { describe, expect, it } from "vitest";

import { definePrinted, type PrintedCard } from "../rules/core/printed.ts";
import type { DeckSaveCard } from "../catalog/deck-save.ts";
import { loadCampaign } from "../../scripts/data/load-scenarios.ts";

import { loadoutProblems } from "./briefing.ts";
import { heroBansOf, validateLoadout, type HeroBan } from "./loadout.ts";
import type { World } from "./world.ts";

// Rules: emce.haldan, emce.treasure, dcce.naasiyah, rr.deckbuilding (data/rules/entries.json). What the Ered Mithrin campaign asks of a loadout: Haldan outside part 3, a treasure
// only once the log records it, one copy by title, and none of it counted in the 50 card minimum.
const HALDAN = "19026";
const FILLERS = Array.from({ length: 17 }, (_, index) => `c${index}`);
const cards = new Map<string, PrintedCard>([
  [HALDAN, definePrinted({ code: HALDAN, name: "Haldan", type: "hero", sphere: "leadership", threat: 8, willpower: 1, attack: 1, defense: 1, health: 3 })],
  ["h1", definePrinted({ code: "h1", name: "Hero One", type: "hero", sphere: "tactics", threat: 8, willpower: 1, attack: 1, defense: 1, health: 3 })],
  ["h2", definePrinted({ code: "h2", name: "Hero Two", type: "hero", sphere: "lore", threat: 8, willpower: 1, attack: 1, defense: 1, health: 3 })],
  ["t1", definePrinted({ code: "t1", name: "Anvil of Gundabad", type: "treasure", campaignKind: "treasure" })],
  ["t2", definePrinted({ code: "t2", name: "Axe of the Edain", type: "treasure", campaignKind: "treasure" })],
  ["t1b", definePrinted({ code: "t1b", name: "Anvil of Gundabad", type: "treasure", campaignKind: "treasure" })],
  ...FILLERS.map((code): [string, PrintedCard] => [code, definePrinted({ code, name: `Filler ${code}`, type: "event", sphere: "neutral", cost: 0 })]),
]);
const deckFacts = new Map<string, DeckSaveCard>([
  ...FILLERS.map((code): [string, DeckSaveCard] => [code, { name: `Filler ${code}`, typeCode: "event", sphereCode: "neutral", deckLimit: null, deckLegal: true, traits: null }]),
  ...["h1", "h2", HALDAN].map((code): [string, DeckSaveCard] => [code, { name: cards.get(code)?.name ?? code, typeCode: "hero", sphereCode: "lore", deckLimit: 1, deckLegal: true, traits: null }]),
  ...["t1", "t2", "t1b"].map((code): [string, DeckSaveCard] => [code, { name: cards.get(code)?.name ?? code, typeCode: "treasure", sphereCode: "neutral", deckLimit: null, deckLegal: false, traits: null }]),
]);
const FIFTY = FILLERS.flatMap((code) => [code, code, code]);
const world = { cards, deckFacts, effects: [], campaign: { saga: false }, scenario: {} } as unknown as World;

const campaign = loadCampaign("ered-mithrin");
const seat = (deck: readonly string[], heroes: readonly string[] = ["h1"]) => ({ deckId: "d", heroes, deck });

describe("Haldan (emce.haldan)", () => {
  it("is refused in every part of Ered Mithrin but the third, The King's Quest", () => {
    const refused = campaign.scenarios.map((id) => heroBansOf(campaign, id).map((ban) => ban.code));
    expect(refused).toEqual([[HALDAN], [HALDAN], [], [HALDAN], [HALDAN], [HALDAN], [HALDAN], [HALDAN], [HALDAN]]);
    expect(heroBansOf(campaign, "the-kings-quest")).toEqual([]);
    expect(heroBansOf(campaign, "not-a-scenario")).toEqual([]);
  });

  it("names the card and the rule when a deck starts with him", () => {
    const [ban] = heroBansOf(campaign, "journey-up-the-anduin");
    const errors = validateLoadout([{ heroes: [HALDAN, "h1"], deck: [] }], cards, false, ban ? [ban] : []);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ rule: "bannedHero", code: HALDAN });
    expect(errors[0]?.message).toContain("emce.haldan");
    expect(validateLoadout([{ heroes: [HALDAN, "h1"], deck: [] }], cards, false, heroBansOf(campaign, "the-kings-quest"))).toEqual([]);
  });

  it("leaves Dream-chaser's ban as it was: Na'asiyah in parts 1 to 7", () => {
    const dream = { id: "dream-chaser", scenarios: ["a", "b", "c", "d", "e", "f", "g", "h", "i"] };
    expect(dream.scenarios.map((id) => heroBansOf(dream, id).map((ban: HeroBan) => ban.rule))).toEqual([["dcce.naasiyah"], ["dcce.naasiyah"], ["dcce.naasiyah"], ["dcce.naasiyah"], ["dcce.naasiyah"], ["dcce.naasiyah"], ["dcce.naasiyah"], [], []]);
  });
});

describe("treasures in a deck (emce.treasure)", () => {
  const input = (deck: readonly string[]) => ({ world, seatCount: 1 as const, seats: [seat(deck)], ringBearer: null });

  it("admits a discovered treasure outside the 50 card minimum", () => {
    expect(loadoutProblems(input(FIFTY), [], [], []).problems).toEqual([]);
    expect(loadoutProblems(input([...FIFTY, "t1"]), [], [], ["t1"]).problems).toEqual([]);
    expect(loadoutProblems(input([...FIFTY.slice(3), "t1"]), [], [], ["t1"]).problems.map((problem) => problem.rule)).toEqual(["The deck is ready to play"]);
  });

  it("refuses an undiscovered treasure and says why", () => {
    const { problems } = loadoutProblems(input([...FIFTY, "t2"]), [], [], ["t1"]);
    expect(problems.map((problem) => problem.rule)).toEqual(["A treasure must be discovered first"]);
    expect(problems[0]?.message).toContain("Axe of the Edain");
    expect(problems[0]?.message).toContain("emce.treasure");
  });

  it("refuses a treasure in a game with no log (a standalone game lists none)", () => {
    expect(loadoutProblems(input([...FIFTY, "t1"]), []).problems.map((problem) => problem.rule)).toEqual(["A treasure must be discovered first"]);
  });

  it("allows 1 copy of a treasure by title", () => {
    const twice = loadoutProblems(input([...FIFTY, "t1", "t1"]), [], [], ["t1"]).problems;
    expect(twice.map((problem) => problem.rule)).toEqual(["One copy of a treasure"]);
    const sameTitle = loadoutProblems(input([...FIFTY, "t1", "t1b"]), [], [], ["t1", "t1b"]).problems;
    expect(sameTitle.map((problem) => problem.rule)).toEqual(["One copy of a treasure"]);
    expect(loadoutProblems(input([...FIFTY, "t1", "t2"]), [], [], ["t1", "t2"]).problems).toEqual([]);
  });
});
