// Rules: mec108.setup-intruders-in-chetwood, mec108.setup-the-weather-hills, mec108.setup-deadmens-dike, mec108.setup-the-wastes-of-eriador, mec108.setup-escape-from-mount-gram,
// mec108.setup-across-the-ettenmoors, mec108.setup-the-treachery-of-rhudaur, mec108.setup-the-battle-of-carn-dum, mec108.setup-the-dread-realm, mec108.orc-deck,
// mec108.captured-deck, mec108.campaign-mode (data/rules/entries.json).
// The Angmar Awakened campaign built from The Lost Realm, the six Adventure Packs and the Angmar Awakened Campaign Expansion (MEC108): its codes, scenarios, piles, rules spans and
// scan-read ledger. Playable from its first scenario (src/campaign/playable.ts).
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { encounterCodes } from "../../src/catalog/scenario-data.ts";

import { loadCards } from "./load-cards.ts";
import { loadCampaign, loadScenario, loadScenarioDefinitions } from "./load-scenarios.ts";
import { DATA_DIR } from "./paths.ts";
import { keyOf, loadLedger } from "./printed/ledger.ts";

const cards = loadCards();
const byCode = new Map(cards.map((card) => [card.code, card]));
const campaign = loadCampaign("angmar-awakened");
const ledger = loadLedger();
const rules = new Map((JSON.parse(readFileSync(path.join(DATA_DIR, "rules", "entries.json"), "utf8")) as { id: string; text: string }[]).map((entry) => [entry.id, entry.text.replace(/\s+/g, " ")]));

// The Normal and Easy encounter decks, the booklet's encounter sets and the cards each scenario stages, sets aside, makes active or deals as a deck of its own.
const DECK = {
  "intruders-in-chetwood": { normal: 36, easy: 24, sets: ["Intruders in Chetwood", "Iârion", "Eriador Wilds", "Angmar Orcs"], staging: ["09017"], setAside: ["09016"], active: [] },
  "the-weather-hills": { normal: 31, easy: 24, sets: ["The Weather Hills", "Angmar Orcs", "Foul Weather", "Ruins of Arnor"], staging: ["09027", "09071"], setAside: ["09026", "09046"], active: ["09028"] },
  "deadmens-dike": { normal: 41, easy: 28, sets: ["Deadmen's Dike", "Iârion", "Dark Sorcery", "Cursed Dead"], staging: ["09038"], setAside: ["09016", "09033"], active: [] },
  "the-wastes-of-eriador": { normal: 44, easy: 30, sets: ["The Wastes of Eriador", "Eriador Wilds", "Foul Weather"], staging: ["10011"], setAside: ["10016", "10017"], active: ["09048"] },
  "escape-from-mount-gram": { normal: 24, easy: 20, sets: ["Escape from Mount Gram", "Angmar Orcs"], staging: [], setAside: ["10041", "10042"], active: [] },
  "across-the-ettenmoors": { normal: 36, easy: 23, sets: ["Across the Ettenmoors", "Eriador Wilds", "Foul Weather"], staging: ["10072"], setAside: ["10067", "10068", "10069", "10070", "10071", "10081", "10082", "10083"], active: [] },
  "the-treachery-of-rhudaur": { normal: 41, easy: 30, sets: ["The Treachery of Rhudaur", "Cursed Dead", "Ruins of Arnor"], staging: ["09057", "10109", "10111", "10113"], setAside: ["10096", "10098"], active: ["10097"] },
  "the-battle-of-carn-dum": { normal: 42, easy: 27, sets: ["The Battle of Carn Dûm", "Angmar Orcs", "Dark Sorcery"], staging: ["10127", "10129"], setAside: [], active: ["10132"] },
  "the-dread-realm": { normal: 46, easy: 29, sets: ["The Dread Realm", "Cursed Dead", "Dark Sorcery"], staging: [], setAside: ["10153", "10154"], active: [] },
} as const;

describe("Angmar Awakened codes", () => {
  it("gives the Campaign Expansion's 38 numbered cards and Arnor Ravaged the codes RingsDB and Hall of Beorn share (10156 to 10193, 100158), moves the nine Dread Realm cards that collided with them and Arnor Ravaged off them", () => {
    const box = cards.filter((card) => card.printings.some((printing) => printing.pack === "AACE"));
    expect(box).toHaveLength(39);
    expect(box.map((card) => card.code)).toContain("100158");
    expect(byCode.get("10158")).toMatchObject({ name: "Protect the Innocent", type: "encounter-side-quest" });
    expect(byCode.get("100158")).toMatchObject({ name: "Arnor Ravaged", type: "objective", campaignKind: "burden" });
    for (const [code, name] of [["10156", "Intruders in Chetwood"], ["10193", "The Dread Realm"]] as const) expect(byCode.get(code), code).toMatchObject({ name, type: "campaign" });
    for (let at = 156; at <= 164; at += 1) expect(byCode.get(`101${at}`)?.printings[0]?.pack, `101${at}`).toBe("TDR");
    expect(byCode.get("10150")?.printings[0]?.pack).toBe("TDR");
  });
});

describe("The Angmar Awakened campaign", () => {
  it("is a campaign of nine scenarios in play order, each with its campaign card, opening the MEC108 booklet", () => {
    expect(campaign.scenarios).toEqual(Object.keys(DECK));
    expect(campaign.saga).toBe(false);
    expect(campaign.bookletId).toBe("angmar-awakened");
    expect(campaign.starterDecks).toEqual([]);
    expect(campaign.prelude).toEqual([]);
    expect(campaign.campaignCards).toEqual({
      "intruders-in-chetwood": "10156",
      "the-weather-hills": "10159",
      "deadmens-dike": "10166",
      "the-wastes-of-eriador": "10171",
      "escape-from-mount-gram": "10174",
      "across-the-ettenmoors": "10182",
      "the-treachery-of-rhudaur": "10184",
      "the-battle-of-carn-dum": "10188",
      "the-dread-realm": "10193",
    });
    expect(campaign.bookletPages).toEqual({ "intruders-in-chetwood": 5, "the-weather-hills": 6, "deadmens-dike": 9, "the-wastes-of-eriador": 11, "escape-from-mount-gram": 13, "across-the-ettenmoors": 16, "the-treachery-of-rhudaur": 19, "the-battle-of-carn-dum": 21, "the-dread-realm": 22 });
    expect(() => loadScenarioDefinitions(new URL("../../data/", import.meta.url).pathname, byCode, [], "angmar-awakened")).not.toThrow();
    for (const id of campaign.scenarios) {
      const scenario = loadScenario(id);
      expect(campaign.campaignCards[id], id).toBe(scenario.campaignCard);
      expect(byCode.get(scenario.campaignCard)?.type, id).toBe("campaign");
      expect(byCode.get(scenario.campaignCard)?.name, id).toBe(scenario.name);
      expect(scenario.source.dragnNormal, id).toMatch(/^Q05\.\d$/);
      expect(scenario.source.dragnEasy, id).toMatch(/^E05\.\d$/);
    }
  });

  it.each(Object.entries(DECK))("%s deals the encounter deck, the encounter sets and the Setup piles the load list and the printed Setup leave", (id, pin) => {
    const scenario = loadScenario(id);
    expect(encounterCodes(scenario)).toHaveLength(pin.normal);
    expect(encounterCodes(scenario, "Easy")).toHaveLength(pin.easy);
    expect(scenario.encounterSets.map((set) => set.name)).toEqual([...pin.sets]);
    expect(scenario.cards.filter((card) => card.pile === "staging").map((card) => card.code).sort()).toEqual([...pin.staging]);
    expect(scenario.cards.filter((card) => card.pile === "setAside").map((card) => card.code).sort()).toEqual([...pin.setAside]);
    expect(scenario.cards.filter((card) => card.pile === "activeLocation").map((card) => card.code)).toEqual([...pin.active]);
  });

  it("deals the Orc deck, the second encounter deck and the Campaign Expansion's cards as the Setups name them", () => {
    expect(loadScenario("the-weather-hills").cards.filter((card) => card.pile === "angmarOrcDeck").map((card) => byCode.get(card.code)?.name).sort()).toEqual(["Angmar Captain", "Angmar Marauder", "Angmar Orc", "Concealed Orc-camp"]);
    expect(loadScenario("escape-from-mount-gram").cards.filter((card) => card.pile === "encounterDeck2").map((card) => byCode.get(card.code)?.name).sort()).toEqual(["Angmar Captain", "Angmar Marauder", "Angmar Orc", "Orc Ambush"]);
    expect(loadScenario("intruders-in-chetwood").campaignPlaced).toEqual(["10157", "10158"]);
    expect(loadScenario("deadmens-dike").campaignPlaced).toEqual(expect.arrayContaining(["100158", "10157", "10167", "10168", "10169", "10170"]));
    // Mysterious Omens' five boons are dealt set aside with every later scenario, which can shuffle Omens in (overrides.scenarioCampaignPlaced).
    expect(loadScenario("the-treachery-of-rhudaur").campaignPlaced).toEqual(["10161", "10162", "10163", "10164", "10165", "10172", "10173", "10185", "10186", "10187"]);
    expect(loadScenario("deadmens-dike").campaignPlaced).toEqual(expect.arrayContaining(["10161", "10162", "10163", "10164", "10165"]));
    expect(loadScenario("intruders-in-chetwood").campaignPlaced).not.toContain("10161");
    // Determination and Fend Off Despair stay in the pool after The Wastes of Eriador, so every later scenario loads them (overrides.scenarioCampaignPlaced); the scenarios before it never deal them.
    for (const id of ["escape-from-mount-gram", "across-the-ettenmoors", "the-treachery-of-rhudaur", "the-battle-of-carn-dum", "the-dread-realm"]) expect(loadScenario(id).campaignPlaced, id).toEqual(expect.arrayContaining(["10172", "10173"]));
    for (const id of ["intruders-in-chetwood", "deadmens-dike"]) expect(loadScenario(id).campaignPlaced, id).not.toContain("10172");
    expect(loadScenario("the-wastes-of-eriador").campaignPlaced).toEqual(expect.arrayContaining(["10172", "10173"]));
  });

  it("takes the Easy counts the printed set icons give where DragnCards' Easy decks differ (data/overrides.json, scenarioEasy)", () => {
    const easy = (id: string, code: string) => loadScenario(id).cards.filter((card) => card.code === code).reduce((sum, card) => sum + card.easy, 0);
    expect(easy("escape-from-mount-gram", "09045")).toBe(1);
    expect(easy("escape-from-mount-gram", "09044")).toBe(2);
    expect(easy("the-treachery-of-rhudaur", "09056")).toBe(2);
  });
});

describe("Angmar Awakened rules spans", () => {
  it("pin the booklet's setup paragraphs and the scenario rules", () => {
    for (const id of [...Object.keys(DECK).map((scenario) => `mec108.setup-${scenario}`), "mec108.orc-deck", "mec108.captured-deck", "mec108.capture-x", "mec108.campaign-mode", "mec108.thaurdir", "mec108.reanimated-dead"]) expect(rules.has(id), id).toBe(true);
    expect(rules.get("mec108.setup-the-weather-hills")).toContain("The Weather Hills, Angmar Orcs, Foul Weather, and Ruins of Arnor");
    expect(rules.get("mec108.campaign-mode")).toContain("the Amarthiúl hero cannot be used until indicated by a campaign card.");
  });
});

describe("Angmar Awakened printed-text ledger", () => {
  it("holds both sides of each of the nine campaign cards and every card of the Campaign Expansion", () => {
    for (const code of ["10156", "10159", "10166", "10171", "10174", "10182", "10184", "10188", "10193"]) {
      expect(ledger.byKey.has(keyOf(code, "A")), `${code}.A`).toBe(true);
      expect(ledger.byKey.has(keyOf(code, "B")), `${code}.B`).toBe(true);
    }
    for (let at = 156; at <= 193; at += 1) expect(ledger.byKey.has(keyOf(`10${at}`, "A")), `10${at}.A`).toBe(true);
    expect(ledger.byKey.has(keyOf("100158", "A"))).toBe(true);
  });

  it("holds every stage on both sides and the double-sided objectives the nine scenarios deal", () => {
    for (const code of ["09068", "09069", "09070", "09073", "09074", "10013", "10014", "10015", "10038", "10039", "10040", "10064", "10065", "10066", "10094", "10095", "10125", "10126", "10150", "10151", "10152"]) {
      expect(ledger.byKey.has(keyOf(code, "A")), `${code}.A`).toBe(true);
      expect(ledger.byKey.has(keyOf(code, "B")), `${code}.B`).toBe(true);
    }
  });

  it("reads the printed wording, keeping the card's own typos under misprints", () => {
    const text = (code: string, side: string) => ledger.byKey.get(keyOf(code, side))?.lines.join(" ") ?? "";
    expect(text("10156", "A")).toContain("Setup: Attach Iârion's Pendant to Iârion and add the Protect the Innocent side quest to the staging area.");
    expect(text("10193", "B")).toBe("Resolution: The players win the campaign!");
    expect(text("10184", "A")).toBe("You are playing campaign mode.");
    expect(text("10183", "A")).toBe("Surge. When Revealed: Each player must either raise their threat by 3 or exhaust a hero they control. Shadow: Attacking enemy either gets +3 Attack or +3 Defense until the end of the phase.");
    expect(text("10013", "A")).toContain("The first player takes control of Amarthiúl.");
    expect(ledger.byKey.get(keyOf("10185", "A"))?.misprints[0]?.printed).toContain("Daechnar's Brand");
  });

  it("names the scan each side was read from, and who read it", () => {
    const file = JSON.parse(readFileSync(new URL("../../data/printed/angmar-awakened.json", import.meta.url), "utf8")) as { entries: { code: string; side: string }[] };
    expect(file.entries.length).toBeGreaterThanOrEqual(232);
    for (const { code, side } of file.entries) {
      const entry = ledger.byKey.get(keyOf(code, side));
      expect(entry?.readBy, `${code}.${side}`).toMatch(/read from the scan image/);
      expect(entry?.scan.sha256, `${code}.${side}`).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
