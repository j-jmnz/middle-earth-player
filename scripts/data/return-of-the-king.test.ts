// Rules: mec113.setting-up-the-game, mec113.setup-the-passing-of-the-grey-company, mec113.setup-the-siege-of-gondor, mec113.setup-the-battle-of-the-pelennor-fields,
// mec113.setup-the-tower-of-cirith-ungol, mec113.setup-the-black-gate-opens, mec113.setup-mount-doom, mec113.epic-multiplayer-mode, mec113.fortitude-tests (data/rules/entries.json).
// The Return of the King campaign built from The Flame of the West and The Mountain of Fire (RingsDB twins of the MEC113 box): its codes, scenarios, piles, saga start, rules spans
// and scan-read ledger.
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
const campaign = loadCampaign("the-return-of-the-king");
const ledger = loadLedger();
const rules = new Map((JSON.parse(readFileSync(path.join(DATA_DIR, "rules", "entries.json"), "utf8")) as { id: string; text: string }[]).map((entry) => [entry.id, entry.text.replace(/\s+/g, " ")]));

// The Normal and Easy encounter decks (Mount Doom's include the four locations each player searches for), the booklet's encounter sets and the cards each scenario stages, sets aside, makes active or attaches.
const DECK = {
  "the-passing-of-the-grey-company": { normal: 32, easy: 25, sets: ["The Passing of the Grey Company"], staging: [], setAside: ["145016", "145017", "145067"], active: [] },
  "the-siege-of-gondor": { normal: 30, easy: 24, sets: ["The Siege of Gondor"], staging: ["145030", "145071"], setAside: [], active: [] },
  "the-battle-of-the-pelennor-fields": { normal: 40, easy: 30, sets: ["The Battle of the Pelennor Fields"], staging: [], setAside: ["145014", "145015", "145043", "145044", "145062", "145079"], active: ["145047"] },
  "the-tower-of-cirith-ungol": { normal: 36, easy: 30, sets: ["The Tower of Cirith Ungol", "Orcs of Mordor", "Deep Shadows"], staging: ["146015", "146070"], setAside: ["146020"], active: [] },
  "the-black-gate-opens": { normal: 47, easy: 38, sets: ["The Black Gate Opens", "Orcs of Mordor"], staging: ["146024", "146031"], setAside: ["146041"], active: [] },
  "mount-doom": { normal: 40, easy: 27, sets: ["Mount Doom", "Deep Shadows"], staging: ["146042", "146043", "146044", "146045", "146046", "146047", "146048"], setAside: [], active: ["146047"] },
} as const;

describe("The Return of the King codes", () => {
  const box = cards.filter((card) => card.printings.some((printing) => printing.pack === "TRotK"));

  it("gives each of the 162 MEC113 cards the code of its Flame of the West or Mountain of Fire twin, and no other card that code", () => {
    expect(box).toHaveLength(162);
    expect(new Set(box.map((card) => card.code)).size).toBe(162);
    for (const card of box) {
      expect(card.code, card.name).toMatch(/^14[56]\d{3}$/);
      expect(card.printings[0]?.pack, card.code).toBe(card.code.startsWith("145") ? "FotW" : "MoF");
    }
    expect(box.filter((card) => card.code.startsWith("145"))).toHaveLength(80);
    expect(box.filter((card) => card.code.startsWith("146"))).toHaveLength(82);
  });

  it("pairs a title the saga boxes both print with its own box's twin, and the three Mountain of Fire player cards Hall of Beorn numbers otherwise with RingsDB's", () => {
    expect(byCode.get("145001")).toMatchObject({ name: "Aragorn", sphere: "fellowship" });
    expect(byCode.get("146002")).toMatchObject({ name: "Aragorn", sphere: "fellowship" });
    expect(byCode.get("146001")).toMatchObject({ name: "Frodo Baggins", sphere: "fellowship" });
    expect(byCode.get("146065")).toMatchObject({ name: "The One Ring" });
    expect(byCode.get("146065")?.printings.map((printing) => printing.pack)).not.toContain("TTwT");
    for (const [code, name] of [["146009", "Orc Disguise"], ["146010", "Captains of the West"], ["146013", "Raise the Shire"]] as const) {
      expect(byCode.get(code)?.name, code).toBe(name);
      expect(byCode.get(code)?.printings.map((printing) => printing.hobSlug), code).toEqual([`${name.replaceAll(" ", "-")}-TMoF`, `${name.replaceAll(" ", "-")}-TRotK`]);
    }
  });
});

describe("The Return of the King campaign", () => {
  it("is a saga campaign of six scenarios in play order, each with its campaign card, opening the MEC113 booklet", () => {
    expect(campaign.scenarios).toEqual(Object.keys(DECK));
    expect(campaign.saga).toBe(true);
    expect(campaign.xp).toBeUndefined();
    expect(campaign.bookletId).toBe("the-return-of-the-king");
    expect(campaign.starterDecks).toEqual([]);
    expect(campaign.prelude).toEqual([]);
    expect(campaign.campaignCards).toEqual({
      "the-passing-of-the-grey-company": "145066",
      "the-siege-of-gondor": "145070",
      "the-battle-of-the-pelennor-fields": "145078",
      "the-tower-of-cirith-ungol": "146069",
      "the-black-gate-opens": "146074",
      "mount-doom": "146079",
    });
    expect(campaign.bookletPages).toEqual({ "the-passing-of-the-grey-company": 5, "the-siege-of-gondor": 6, "the-battle-of-the-pelennor-fields": 6, "the-tower-of-cirith-ungol": 7, "the-black-gate-opens": 8, "mount-doom": 8 });
    expect(() => loadScenarioDefinitions(new URL("../../data/", import.meta.url).pathname, byCode, [], "the-return-of-the-king")).not.toThrow();
    for (const [at, id] of campaign.scenarios.entries()) {
      const scenario = loadScenario(id);
      expect(scenario.number, id).toBe(at + 13);
      expect(campaign.campaignCards[id], id).toBe(scenario.campaignCard);
      expect(byCode.get(scenario.campaignCard)?.type, id).toBe("campaign");
      expect(byCode.get(scenario.campaignCard)?.name, id).toBe(scenario.name);
      expect(scenario.source.dragnNormal, id).toBe(`Q0C.${at + 13}`);
      expect(scenario.source.dragnEasy, id).toBe(`E0C.${at + 13}`);
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

  it("starts scenarios 13 to 15 with Aragorn (145001), scenario 17 with Aragorn (146002) and scenarios 16 and 18 with the Ring-bearer and The One Ring (146065)", () => {
    for (const id of campaign.scenarios.slice(0, 3)) expect(loadScenario(id).sagaStart, id).toEqual({ hero: "145001" });
    expect(loadScenario("the-black-gate-opens").sagaStart).toEqual({ hero: "146002" });
    for (const id of ["the-tower-of-cirith-ungol", "mount-doom"]) expect(loadScenario(id).sagaStart, id).toEqual({ ringBearer: true, attached: ["146065"] });
  });

  it("deals the double-sided cards as the Setup names their side, and leaves the boons, burdens and recorded Harad enemies to the campaign", () => {
    expect(loadScenario("the-tower-of-cirith-ungol").cards.find((card) => card.code === "146070")).toMatchObject({ pile: "staging", back: "146071" });
    expect(loadScenario("the-battle-of-the-pelennor-fields").cards.find((card) => card.code === "145079")).toMatchObject({ pile: "setAside", back: "145080" });
    expect(loadScenario("the-tower-of-cirith-ungol").cards.find((card) => card.code === "146014")?.pile).toBe("attachedChosen");
    const pelennor = loadScenario("the-battle-of-the-pelennor-fields").campaignPlaced;
    for (const name of ["Man of Harad", "Captain of Harad", "Oliphaunt", "Haradrim Soldier", "Haradrim Archer"]) expect(pelennor.some((code) => byCode.get(code)?.name === name), name).toBe(true);
    // The epic multiplayer cards are the Epic Multiplayer Mode campaign card's to deal.
    for (const id of ["the-black-gate-opens", "mount-doom"]) for (const code of ["146064", "146081", "146082"]) expect(loadScenario(id).cards.some((card) => card.code === code), `${id} ${code}`).toBe(false);
  });

  it("stages Mount Doom and Brake of Thorns as the Setup names them, and finds the other locations in the deck for each player", () => {
    const staging = loadScenario("mount-doom").cards.filter((card) => card.pile === "staging");
    expect(staging.filter((card) => card.searched === true).map((card) => byCode.get(card.code)?.name).sort()).toEqual(["Mordor Road", "Old Water-course", "Orc-hold", "Plain of Gorgoroth"]);
  });
});

describe("The Return of the King rules spans", () => {
  it("pin the booklet's setup paragraphs, the saga rules and the Fortitude test", () => {
    for (const id of [
      ...Object.keys(DECK).map((scenario) => `mec113.setup-${scenario}`),
      ...["setting-up-the-game", "saga-staging-rules", "the-fellowship-sphere", "fellowship-sphere-heroes", "aragorn", "the-one-ring", "campaign-mode", "campaign-mode-aragorn", "campaign-mode-ring-bearer", "archery", "dire", "phantom", "army-of-the-dead", "minas-tirith", "assault", "fortitude-tests", "player-actions-during-fortitude-tests", "epic-multiplayer-mode", "epic-multiplayer-campaign-mode"].map((rule) => `mec113.${rule}`),
    ]) {
      expect(rules.has(id), id).toBe(true);
    }
    expect(rules.get("decklist.mec113-foresight")).toContain("Beregond");
    expect(rules.get("decklist.mec113-valor")).toContain("3x Sneak Attack");
  });

  it("print each scenario's encounter-set paragraph, the set lists the build checks the cards against", () => {
    expect(rules.get("mec113.setup-the-passing-of-the-grey-company")).toContain("the following encounter set: The Passing of the Grey Company.");
    expect(rules.get("mec113.setup-the-tower-of-cirith-ungol")).toContain("The Tower of Cirith Ungol, Orcs of Mordor, and Deep Shadows");
    expect(rules.get("mec113.setup-the-black-gate-opens")).toContain("The Black Gate Opens and Orcs of Mordor");
    expect(rules.get("mec113.setup-mount-doom")).toContain("Mount Doom and Deep Shadows");
  });

  it("hold the saga, keyword and Fortitude rules as the booklet words them", () => {
    expect(rules.get("mec113.setting-up-the-game")).toContain("When setting up The Black Gate Opens, the first player takes control of ☺ Aragorn");
    expect(rules.get("mec113.dire")).toContain("each player’s threat elimination level is increased to 99");
    expect(rules.get("mec113.phantom")).toContain("the defending player raises their threat by an equal amount instead.");
    expect(rules.get("mec113.assault")).toContain("progress cannot be placed on that stage by player card effects or by questing successfully.");
    expect(rules.get("mec113.minas-tirith")).toContain("the White City has fallen and the players lose the game.");
    expect(rules.get("mec113.fortitude-tests")).toContain("that player fails the Fortitude test.");
    expect(rules.get("mec113.epic-multiplayer-mode")).toContain("can be played simultaneously by 2-8 players in epic multiplayer mode");
  });
});

describe("The Return of the King printed-text ledger", () => {
  it("holds both sides of each campaign card and each card the six scenarios deal, read by Claude from the pinned scans", () => {
    for (const id of campaign.scenarios) {
      const scenario = loadScenario(id);
      for (const code of [scenario.campaignCard, ...scenario.stages]) {
        expect(ledger.byKey.has(keyOf(code, "A")), `${code}.A`).toBe(true);
        if (byCode.get(code)?.back != null) expect(ledger.byKey.has(keyOf(code, "B")), `${code}.B`).toBe(true);
      }
      for (const card of scenario.cards) expect(ledger.byKey.has(keyOf(card.code, "A")), `${id} ${card.code}`).toBe(true);
    }
    const mine = ledger.entries.filter((entry) => /^14[56]\d{3}$/.test(entry.code));
    expect(mine.length).toBeGreaterThan(170);
    for (const entry of mine) expect(entry.readBy, `${entry.code}.${entry.side}`).toContain("read from the scan image");
  });

  it("reads the two campaign card backs Hall of Beorn's scan lacks from DragnCards' pictures of the backs", () => {
    for (const code of ["145070", "145078"]) expect(ledger.byKey.get(keyOf(code, "B"))?.scan.url, code).toContain("dragncards-lotrlcg.s3.amazonaws.com");
    expect(ledger.byKey.get(keyOf("145070", "B"))?.lines.join(" ")).toContain("Remove Army of the Dead from the campaign pool.");
    expect(ledger.byKey.get(keyOf("145078", "B"))?.lines.join(" ")).toContain("add each set aside Harad enemy to the staging area");
  });

  it("writes the printed wording where Hall of Beorn's candidate has a typo, and the Sauron's Eye icon as words with its count", () => {
    expect(ledger.byKey.get(keyOf("145073", "A"))?.lines.join(" ")).toContain("each copy of Wraith on Wings aside");
    expect(ledger.byKey.get(keyOf("145046", "A"))?.lines.join(" ")).toContain("When City Wall has damage");
    expect(ledger.byKey.get(keyOf("145066", "A"))?.lines.join(" ")).toContain("Each player may change heroes without incurring the +1 threat penalty.");
    expect(ledger.byKey.get(keyOf("146047", "A"))?.lines[0]).toBe("While Brake of Thorns is in the staging area, add Sauron's Eye to each Fortitude test.");
    const eyes = (code: string) => ledger.byKey.get(keyOf(code, "A"))?.eyeIcons;
    expect([eyes("146044"), eyes("146050"), eyes("146054"), eyes("146046"), eyes("146058")]).toEqual([1, 2, 3, 0, 0]);
    expect(ledger.byKey.get(keyOf("146044", "A"))?.lines.some((line) => line.includes("("))).toBe(false);
  });

  it("carries each card's Sauron's Eye icons into the catalog as keywords.eyeIcons, and Mount Doom's printed Immune", () => {
    for (const [key, entry] of ledger.byKey) {
      if (!key.endsWith(":A") || entry.eyeIcons == null) continue;
      expect(byCode.get(entry.code)?.keywords?.eyeIcons, `${entry.code} ${key}`).toBe(entry.eyeIcons || undefined);
    }
    expect([byCode.get("146044")?.keywords?.eyeIcons, byCode.get("146054")?.keywords?.eyeIcons, byCode.get("146046")?.keywords?.eyeIcons]).toEqual([1, 3, undefined]);
    expect(byCode.get("146043")?.keywords?.immune).toBe(true);
  });
});
