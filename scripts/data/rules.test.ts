import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { hashColumns, parseColumns, parseDoc, type ExtractedDoc } from "./rules/extract.ts";
import { buildEntries, extractSpan, indexSchema, type RuleEntry, type Span } from "./rules/spans.ts";
import { DATA_DIR, ROOT } from "./paths.ts";

// data/rules/index.json is the hand-checked list of rule spans, each bounded by two exact quotes. entries.json is
// written from it. These tests read the committed markdown, so they run without the PDFs.
const rulesDir = path.join(DATA_DIR, "rules");
const index = indexSchema.parse(JSON.parse(readFileSync(path.join(rulesDir, "index.json"), "utf8")));
const entries = JSON.parse(readFileSync(path.join(rulesDir, "entries.json"), "utf8")) as RuleEntry[];
const steps = JSON.parse(readFileSync(path.join(rulesDir, "steps.json"), "utf8")) as { id: string; phase: string; entries: string[] }[];
const columns = parseColumns(readFileSync(path.join(rulesDir, "columns.json"), "utf8"));
const docs = new Map(
  readdirSync(rulesDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => parseDoc(readFileSync(path.join(rulesDir, name), "utf8")))
    .map((doc) => [doc.doc, doc]),
);
const byId = new Map(entries.map((entry) => [entry.id, entry]));

function listFiles(dir: string, extension: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full, extension) : full.endsWith(extension) ? [full] : [];
  });
}

describe("rule columns", () => {
  it("records the column boxes per document, and the markdown was extracted with them", () => {
    for (const [name, doc] of docs) {
      expect(columns[name], `${name} has column boxes`).toBeDefined();
      // A rulesheet with no text layer is read by eye: its markdown names who read it and has no boxes to be extracted with.
      if (columns[name]?.handRead !== undefined) {
        expect(readFileSync(path.join(rulesDir, `${name}.md`), "utf8"), `${name} names who read it`).toMatch(/^readBy: .+$/m);
        expect(doc.sha256, `${name} names the PDF it was read from`).toMatch(/^[0-9a-f]{64}$/);
        continue;
      }
      expect(doc.columnsSha256, `${name} was extracted with the recorded boxes`).toBe(hashColumns(columns[name] as never));
      for (const page of doc.pages) expect(page.columns.length, `${name} p${page.number}`).toBe((columns[name]?.pages?.[String(page.number)] ?? columns[name]?.default ?? []).length);
    }
  });
});

describe("rule spans", () => {
  it("have unique ids and a page and column in their document", () => {
    expect(new Set(index.map((span) => span.id)).size).toBe(index.length);
    for (const span of index) {
      const page = docs.get(span.doc)?.pages.find((candidate) => candidate.number === span.page);
      expect(page?.columns[span.column - 1], `${span.id} is on ${span.doc} p${span.page} c${span.column}`).toBeDefined();
    }
  });

  it("open at their from-quote and close at the first to-quote after it, with no icon artifacts", () => {
    for (const span of index) {
      const flat = extractSpan(span, docs.get(span.doc) as ExtractedDoc).replace(/\s+/g, " ");
      const from = span.from.replace(/\s+/g, " ");
      const to = span.to.replace(/\s+/g, " ");
      expect(flat.startsWith(from), `${span.id} opens with its from-quote`).toBe(true);
      // The span stops at the first place the to-quote can close it: nothing earlier, past the from-quote, ends the same way.
      // (A span that runs into later columns closes in its last column, so only single-column spans are measured here.)
      if (!span.through) {
        const early = flat.indexOf(to, Math.max(0, from.length - to.length));
        expect(early + to.length, `${span.id} closes at the first to-quote after its from-quote`).toBe(flat.length);
      }
      expect(flat, `${span.id} holds a stray icon glyph`).not.toMatch(/[ÚÛÒ$‰]/);
    }
  });

  it("fail when a quote is missing, repeated, or out of order", () => {
    const doc = docs.get("rr") as ExtractedDoc;
    const base: Span = { id: "rr.surge", doc: "rr", page: 17, column: 1, from: "Surge Surge is a keyword ability", to: "the staging of the encounter card.", title: "Surge" };
    expect(extractSpan(base, doc)).toContain("reveal 1 additional encounter card");
    expect(() => extractSpan({ ...base, from: "Surge is a keyword ability that is not printed" }, doc)).toThrow(/found 0 times/);
    expect(() => extractSpan({ ...base, from: "Surge" }, doc)).toThrow(/found [2-9] times/);
    expect(() => extractSpan({ ...base, to: "Staging is the term used" }, doc)).toThrow(/not found after/);
  });

  it("are what entries.json holds", () => {
    expect(buildEntries(index, [...docs.values()])).toEqual(entries);
  });
});

describe("rules store", () => {
  it("joins every DragnCards framework step to Rules Reference entries that exist", () => {
    expect(steps.length).toBeGreaterThan(20);
    for (const step of steps) for (const id of step.entries) expect(byId.has(id), `${step.id} -> ${id}`).toBe(true);
    expect(steps.find((step) => step.id === "6.E")?.entries).toEqual(["rr.step-6-3", "rr.step-6-4-1", "rr.step-6-4-2", "rr.step-6-4-3", "rr.step-6-4-4", "rr.step-6-4a", "rr.step-6-4b", "rr.step-6-5", "rr.step-6-6"]);
  });

  it("knows every rule id that src, docs and the tests name", () => {
    const found = new Set<string>();
    // Every prefix entries.json holds (rr, ltp, mec109, faq, dcce, ...), so a new document's ids are checked without editing this test.
    const prefixes = [...new Set(entries.map((entry) => entry.id.split(".")[0] ?? ""))].map((prefix) => prefix.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&"));
    const ids = new RegExp(`\\b((?:${prefixes.join("|")})\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\\b(?![-<*])`, "g");
    const scan = (file: string): void => {
      for (const match of readFileSync(file, "utf8").matchAll(ids)) found.add(match[1] ?? "");
    };
    for (const file of listFiles(path.join(ROOT, "src"), ".ts")) scan(file);
    // The plan and the 8c phase file name the old wrong ids on purpose, as findings.
    for (const file of listFiles(path.join(ROOT, "docs"), ".md")) if (!/plans|phase-08c/.test(file)) scan(file);
    const unresolved = [...found].filter((id) => !byId.has(id)).sort();
    // A wildcard in prose ("mec109.setup-*", "dcce.setup-<id>") names a family of ids: the pattern above skips an id followed by -, < or *.
    expect(unresolved).toEqual([]);
    expect(found.size).toBeGreaterThan(15);
  });

  it("covers the rules the brief and the phases rely on", () => {
    for (const id of [
      "mec109.archery",
      "mec109.toughness",
      "mec109.indestructible",
      "mec109.permanent",
      "rr.restricted",
      "rr.scoring",
      "ltp.scoring",
      "rr.campaign-cards",
      "ltp.campaign-cards",
      "rr.campaign-pool",
      "ltp.campaign-pool",
      "rr.campaign-setup-checklist",
      "ltp.campaign-setup-checklist",
      "mec109.setup-a-shadow-of-the-past",
      "mec109.setup-a-knife-in-the-dark",
      "mec109.setup-flight-to-the-ford",
      "mec109.setup-the-ring-goes-south",
      "mec109.setup-journey-in-the-dark",
      "mec109.setup-breaking-of-the-fellowship",
      "mec109.burden-deck",
      "mec109.ringbearers-life",
    ]) {
      expect(byId.has(id), id).toBe(true);
    }
  });

  it("holds the rule each of the formerly wrong ids named", () => {
    const text = (id: string) => (byId.get(id)?.text ?? "").replace(/\s+/g, " ");
    expect(text("mec109.archery")).toContain("[defense] does not block archery damage.");
    expect(text("mec109.toughness")).toContain("reduces the amount of damage it takes by X");
    expect(text("rr.scoring")).toContain("Add 10 for each completed round");
    expect(text("rr.scoring")).toContain("Subtract any victory points");
    expect(text("ltp.scoring")).toContain("Subtract Victory Points");
    for (const id of ["rr.campaign-setup-checklist", "ltp.campaign-setup-checklist"]) {
      for (const step of ["1. Check that each player", "4. Apply threat penalty", "8. Set encounter deck"]) expect(text(id), `${id} ${step}`).toContain(step);
    }
    for (const id of ["rr.campaign-pool", "ltp.campaign-pool"]) expect(text(id)).toContain("removed from the Campaign Pool");
    expect(text("mec109.ringbearers-life")).toContain("set the Ring-bearer’s life at 15");
  });
});

// Mirkwood Paths and The Dark of Mirkwood (phase 27): the hand-checked spans their scenario data reads.
describe("Mirkwood spans", () => {
  const text = (id: string) => (byId.get(id)?.text ?? "").replace(/\s+/g, " ");

  it("pin The Dark of Mirkwood rulebook as a document of 8 pages with its campaign-mode page", () => {
    expect(docs.get("tdom")?.pages.length).toBe(8);
    expect(text("tdom.campaign-mode")).toContain("pages 30");
    expect(text("tdom.mirkwood-paths")).toContain("The Oath is part 4");
    expect(text("tdom.mirkwood-paths")).toContain("is part 5");
    expect(text("tdom.mini-campaign")).toContain("blank Campaign Log");
  });

  it("print each scenario's encounter-deck paragraph, the set lists the build checks Hall of Beorn against", () => {
    expect(text("ltp.setup-passage-through-mirkwood")).toContain("Passage Through Mirkwood, Spiders of Mirkwood, and Dol Guldur Orcs");
    expect(text("ltp.setup-journey-along-the-anduin")).toContain("Journey Down the Anduin, Sauron’s Reach, Dol Guldur Orcs, and Wilderlands");
    expect(text("ltp.setup-escape-from-dol-guldur")).toContain("Escape from Dol Guldur, Spiders of Mirkwood, and Dol Guldur Orcs");
    expect(text("tdom.setup-the-oath")).toContain("The Oath and The Goblins");
    expect(text("tdom.setup-the-caves-of-nibin-dum")).toContain("The Caves of Nibin-dûm and The Goblins");
  });

  it("list what Easy Mode removes from each Core Set encounter set (easy-mode.core-set)", () => {
    const sheet = text("easy-mode.core-set");
    expect(sheet).toContain("Dol Guldur Orcs 1x Chieftain Ufthak 1x Dol Guldur Beastmaster");
    expect(sheet).toContain("Passage Through Mirkwood None");
    expect(sheet).toContain("2x Dungeon Jailor");
  });
});

// Dream-chaser (phase 37): the Dream-chaser Campaign Expansion rulebook (MEC111) is the document `dcce`.
describe("Dream-chaser spans", () => {
  const text = (id: string) => (byId.get(id)?.text ?? "").replace(/\s+/g, " ");
  const SCENARIOS = ["voyage-across-belegaer", "the-fate-of-numenor", "raid-on-the-grey-havens", "flight-of-the-stormcaller", "the-thing-in-the-depths", "temple-of-the-deceived", "the-drowned-ruins", "a-storm-on-cobas-haven", "the-city-of-corsairs"];

  it("pin the rulebook as a document of 32 pages with a span for each rule the plan names", () => {
    expect(docs.get("dcce")?.pages.length).toBe(32);
    for (const id of [
      ...SCENARIOS.map((scenario) => `dcce.setup-${scenario}`),
      ...["ships", "ship-enemies", "ship-objectives", "corsair-deck", "boarding", "prepare-your-fleet", "heading", "sailing", "sailing-tests", "stormcaller-elite", "campaign-mode", "uncharted", "uncharted-deck", "aflame", "stormcallers-area", "grapple", "island-map", "exploration", "grotto-deck", "from-sea-to-land", "indestructible", "archery", "last-player", "gaining-xp", "scalable-upgradable", "hard-expert"].map((rule) => `dcce.${rule}`),
    ]) {
      expect(byId.has(id), id).toBe(true);
    }
  });

  it("print each scenario's encounter-deck paragraph, the set lists the build checks the cards against", () => {
    expect(text("dcce.setup-voyage-across-belegaer")).toContain("Voyage Across Belegaer, Vast Oceans, Stormy Weather, Umbar Fleet, Corsair Pirates, and The Dream-chaser’s Fleet");
    expect(text("dcce.setup-the-city-of-corsairs")).toContain("The City of Corsairs, Coast of Umbar, Stormy Weather, Umbar Fleet, Voyage Across Belegaer, Corsair Raiders, and The Dream-chaser’s Fleet");
    expect(text("dcce.setup-the-thing-in-the-depths")).toContain("The Thing in the Depths, The Stormcaller, Corsair Raiders, and The Stormcaller Elite");
  });

  it("hold the sea rules as the rulebook words them", () => {
    expect(text("dcce.sailing-tests")).toContain("symbol found on the looked at cards, you may shift your heading on-course");
    expect(text("dcce.corsair-deck")).toContain("removing all non-ship enemies from the encounter deck");
    expect(text("dcce.boarding")).toContain("reveal the top X cards from the Corsair deck");
    expect(text("dcce.prepare-your-fleet")).toContain("One of the players must choose the Dream-chaser");
    expect(text("dcce.gaining-xp")).toContain("Record this amount in the Campaign Log");
    expect(text("dcce.scalable-upgradable")).toContain("Spending 1 XP allows the players to mark any one checkbox");
    expect(text("dcce.naasiyah")).toContain("cannot be used in scenarios 1 through 7");
    expect(text("dcce.from-sea-to-land")).toContain("shuffle the Corsair Deck and Corsair discard pile into the second encounter deck");
  });
});

// Ered Mithrin (phase 49): the Ered Mithrin Campaign Expansion rulebook (MEC115) is the document `emce`.
describe("Ered Mithrin spans", () => {
  const text = (id: string) => (byId.get(id)?.text ?? "").replace(/\s+/g, " ");
  const SCENARIOS = ["journey-up-the-anduin", "lost-in-mirkwood", "the-kings-quest", "the-withered-heath", "roam-across-rhovanion", "fire-in-the-night", "the-ghost-of-framsburg", "mount-gundabad", "the-fate-of-wilderland"];

  it("pin the rulebook as a document of 28 pages with a span for each rule the plan names", () => {
    expect(docs.get("emce")?.pages.length).toBe(28);
    for (const id of [
      ...SCENARIOS.map((scenario) => `emce.setup-${scenario}`),
      ...["caves-deck", "deep", "guarded-x", "immune", "treasure", "campaign-pool-encounter", "evil-creatures-deck", "dragon-signs", "indestructible", "side-quests", "loot", "discover", "gundabad-quest-deck", "bypassing", "boon-allies", "haldan", "campaign-log"].map((rule) => `emce.${rule}`),
    ]) {
      expect(byId.has(id), id).toBe(true);
    }
  });

  it("print each scenario's encounter-deck paragraph, the set lists the build checks the cards against", () => {
    expect(text("emce.setup-journey-up-the-anduin")).toContain("Journey Up the Anduin, Grey Mountain Goblins, Hills of Wilderland, Lost in Wilderland, Journey Along the Anduin, and Wilderlands");
    expect(text("emce.setup-lost-in-mirkwood")).toContain("Lost in Mirkwood, Dark Woods, Gathering Gloom, Passage Through Mirkwood, Spiders of Mirkwood and Dol Guldur Orcs");
    expect(text("emce.setup-mount-gundabad")).toContain("Mount Gundabad, Fell Beasts, Deep Underground, Afraid of the Dark, Lost Caves, and Dragon Might");
  });

  it("hold the keyword and deck rules as the rulebook words them", () => {
    expect(text("emce.caves-deck")).toContain("take each card from the Lost Caves encounter set");
    expect(text("emce.deep")).toContain("If there are no cards remaining in the Caves deck, the Deep keyword is ignored.");
    expect(text("emce.guarded-x")).toContain("X is a card type: enemy or location");
    expect(text("emce.treasure")).toContain("Treasure cards added to a deck do not count towards that deck’s 50 card minimum.");
    expect(text("emce.campaign-pool-encounter")).toContain("add the noted number of copies of each card listed in the campaign log to the encounter deck, regardless of encounter set");
    expect(text("emce.evil-creatures-deck")).toContain("Remove each location and treachery card from the Wilderlands encounter set from the game.");
    expect(text("emce.gundabad-quest-deck")).toContain("shuffle all stage 2 quest cards together randomly");
    expect(text("emce.haldan")).toContain("Haldan cannot be used as a hero in this campaign.");
    expect(text("emce.boon-allies")).toContain("Isolde is on the hunt");
  });
});

// Angmar Awakened (phase 77): the Angmar Awakened Campaign Expansion rulebook (MEC108) is the document `mec108`.
describe("Angmar Awakened spans", () => {
  const text = (id: string) => (byId.get(id)?.text ?? "").replace(/\s+/g, " ");
  const SCENARIOS = ["intruders-in-chetwood", "the-weather-hills", "deadmens-dike", "the-wastes-of-eriador", "escape-from-mount-gram", "across-the-ettenmoors", "the-treachery-of-rhudaur", "the-battle-of-carn-dum", "the-dread-realm"];

  it("pin the rulebook as a document of 28 pages with a span for each rule the plan names", () => {
    expect(docs.get("mec108")?.pages.length).toBe(28);
    for (const id of [
      ...SCENARIOS.map((scenario) => `mec108.setup-${scenario}`),
      ...SCENARIOS.map((scenario) => `mec108.campaign-setup-${scenario}`),
      ...["campaign-mode", "battle", "immune", "indestructible", "objective-allies", "time-x", "side-quests", "side-quests-in-play", "orc-deck", "day-and-night", "captured-deck", "capture-x", "captured-cards", "create-staging-area", "joining-another-player", "objective-locations", "safe", "the-investigation", "thaurdir", "reanimated-dead", "campaign-log", "campaign-log-tracking"].map((rule) => `mec108.${rule}`),
    ]) {
      expect(byId.has(id), id).toBe(true);
    }
  });

  it("print each scenario's encounter-deck paragraph, the set lists the build checks the cards against", () => {
    expect(text("mec108.setup-intruders-in-chetwood")).toContain("Intruders in Chetwood, Iârion, Eriador Wilds, and Angmar Orcs");
    expect(text("mec108.setup-the-weather-hills")).toContain("The Weather Hills, Angmar Orcs, Foul Weather, and Ruins of Arnor");
    expect(text("mec108.setup-deadmens-dike")).toContain("Deadmen’s Dike, Iârion, Dark Sorcery, and Cursed Dead");
    expect(text("mec108.setup-the-wastes-of-eriador")).toContain("Amarthiúl, The Wastes of Eriador, Eriador Wilds, and Foul Weather");
    expect(text("mec108.setup-escape-from-mount-gram")).toContain("Escape from Mount Gram and Angmar Orcs");
    expect(text("mec108.setup-across-the-ettenmoors")).toContain("Amarthiúl, Across the Ettenmoors, Eriador Wilds, and Foul Weather");
    expect(text("mec108.setup-the-treachery-of-rhudaur")).toContain("Amarthiúl, The Treachery of Rhudaur, Cursed Dead, and Ruins of Arnor");
    expect(text("mec108.setup-the-battle-of-carn-dum")).toContain("The Battle of Carn Dûm, Angmar Orcs, and Dark Sorcery");
    expect(text("mec108.setup-the-dread-realm")).toContain("The Dread Realm, Cursed Dead, and Dark Sorcery");
  });

  it("hold the keyword and scenario rules as the rulebook words them", () => {
    expect(text("mec108.campaign-mode")).toContain("the Amarthiúl hero cannot be used until indicated by a campaign card.");
    expect(text("mec108.battle")).toContain("those characters count their total [attack] instead of their total [willpower]");
    expect(text("mec108.time-x")).toContain("At the end of each refresh phase, remove one time counter from each card with the Time X keyword");
    expect(text("mec108.objective-allies")).toContain("If this character leaves play, the players lose the game.");
    expect(text("mec108.side-quests-in-play")).toContain("Progress must still be placed on the active location before it can be placed on a side quest.");
    expect(text("mec108.orc-deck")).toContain("remove each enemy card with the Angmar Orcs encounter set icon, as well as all copies of Concealed Orc-camp");
    expect(text("mec108.captured-deck")).toContain("remove all allies, Item attachments, Mount attachments, and Artifact attachments from a player’s deck");
    expect(text("mec108.capture-x")).toContain("each player takes the top X cards of their captured deck");
    expect(text("mec108.joining-another-player")).toContain("If there is no player to join, then players must continue to stage 3.");
    expect(text("mec108.safe")).toContain("immediately return all engaged enemies to the staging area");
    expect(text("mec108.thaurdir")).toContain("Thaurdir cannot be placed or shuffled into the encounter deck for any reason.");
    expect(text("mec108.reanimated-dead")).toContain("act as if they are Undead enemy cards with 0 engagement cost");
    expect(text("mec108.campaign-log")).toContain("The Dread Realm");
  });
});

// The Two Towers (MEC112): the hand-checked spans its scenario data reads (data/rules/columns.json: the rulebook's art-overlaid pages 3 to 5 are read in boxes that skip the card pictures' captions).
describe("The Two Towers spans", () => {
  const text = (id: string) => (byId.get(id)?.text ?? "").replace(/\s+/g, " ");
  const SETUPS = ["the-uruk-hai", "helms-deep", "the-road-to-isengard", "the-passage-of-the-marshes", "journey-to-the-cross-roads", "shelobs-lair"];

  it("pin the rulebook's pages 1 to 11 (the decklist page keeps its four boxes) with a span for each rule the plan names", () => {
    expect(docs.get("mec112")?.pages.map((page) => page.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(docs.get("mec112")?.pages.find((page) => page.number === 11)?.columns).toHaveLength(4);
    for (const id of [
      ...SETUPS.map((scenario) => `mec112.setup-${scenario}`),
      ...["setting-up-the-game", "saga-staging-rules", "saruman-grima-smeagol", "the-fellowship-sphere", "fellowship-sphere-heroes", "aragorn", "the-one-ring", "multiplayer-the-one-ring", "campaign-mode", "campaign-mode-aragorn", "gollum-smeagol", "poisoned-counsels-searching-eye", "pursuit", "defense", "wizardry", "mire", "saga-expansion-rules", "saga-expansion-player-cards", "archery", "immune-to-player-card-effects", "indestructible", "peril", "permanent", "setup", "toughness"].map((rule) => `mec112.${rule}`),
    ]) {
      expect(byId.has(id), id).toBe(true);
    }
    expect(byId.get("decklist.mec112-ents-and-friends")?.text).toContain("Treebeard");
    expect(byId.get("decklist.mec112-king-of-rohan")?.text).toContain("2x Dwarven Tomb");
  });

  it("print each scenario's encounter-deck paragraph, the set lists the build checks the cards against", () => {
    expect(text("mec112.setup-the-uruk-hai")).toContain("The Uruk-hai, Orcs of the White Hand, and Snaga Orcs");
    expect(text("mec112.setup-helms-deep")).toContain("Helm’s Deep and Orcs of the White Hand");
    expect(text("mec112.setup-the-road-to-isengard")).toContain("The Road to Isengard and Snaga Orcs");
    expect(text("mec112.setup-the-passage-of-the-marshes")).toContain("The Passage of the Marshes, Gollum, and Morgul Nazgûl");
    expect(text("mec112.setup-journey-to-the-cross-roads")).toContain("Journey to the Cross-roads and Men of Harad");
    expect(text("mec112.setup-shelobs-lair")).toContain("Shelob’s Lair, The Great Spider, Gollum, and Morgul Nazgûl");
  });

  it("hold the saga rules as the rulebook words them", () => {
    expect(text("mec112.setting-up-the-game")).toContain("the first player takes control of ☺ Aragorn");
    expect(text("mec112.saga-staging-rules")).toContain("each player reveals 1 encounter card and resolves its staging before the next player reveals a card");
    expect(text("mec112.saruman-grima-smeagol")).toContain("the players cannot use any ally or hero card with the title “Saruman,” “Gríma,” or “Sméagol.”");
    expect(text("mec112.the-fellowship-sphere")).toContain("only one hero from the Fellowship sphere can be played at a time");
    expect(text("mec112.fellowship-sphere-heroes")).toContain("players cannot start with any other version(s) of that hero as a starting hero or include any other version(s) of them in their decks");
    expect(text("mec112.aragorn")).toContain("☺ Aragorn does not count against the hero limit.");
    expect(text("mec112.the-one-ring")).toContain("“Attached hero does not count against the hero limit.”");
    expect(text("mec112.multiplayer-the-one-ring")).toContain("“The first player gains control of attached hero.”");
    expect(text("mec112.saga-expansion-rules")).toContain("the scenarios in this expansion have additional rules");
    expect(text("mec112.saga-expansion-player-cards")).toContain("a select few are only intended for use when playing the scenarios presented in saga expansions");
  });

  it("hold the campaign rules, the Gollum / Sméagol card and the scenarios' own keywords", () => {
    expect(text("mec112.campaign-mode")).toContain("play the six scenarios included in this box in campaign mode as part of The Lord of the Rings campaign they began in The Fellowship of the Ring Saga Expansion");
    expect(text("mec112.campaign-mode-aragorn")).toContain("That player may choose a different hero to replace Aragorn without incurring the +1 threat penalty.");
    expect(text("mec112.campaign-mode-aragorn")).toContain("remove his name from the list and each player incurs a permanent +1 threat penalty.");
    expect(text("mec112.gollum-smeagol")).toContain("Gollum is an enemy, and Sméagol is an objective-ally.");
    expect(text("mec112.gollum-smeagol")).toContain("When Gollum is defeated, discard all damage from him, flip him over to his Sméagol side, and exhaust him.");
    expect(text("mec112.gollum-smeagol")).toContain("The Sméagol objective-ally leaves play, and the Gollum enemy enters play.");
    expect(text("mec112.poisoned-counsels-searching-eye")).toContain("These cards cannot be played.");
    expect(text("mec112.pursuit")).toContain("When setting up The Uruk-hai, players are instructed to set the pursuit value to 10.");
    expect(text("mec112.defense")).toContain("While the current quest has the defense keyword, players cannot place progress on the quest (or active location) by questing successfully.");
    expect(text("mec112.wizardry")).toContain("When a location with Wizardry leaves play as an explored location, trigger its Wizardry effect (even if it is not the active location).");
    expect(text("mec112.mire")).toContain("When a location with the mire keyword has mire tokens equal to its mire X value, it is immediately discarded.");
    expect(text("mec112.archery")).toContain("[defense] does not block archery damage.");
    expect(text("mec112.indestructible")).toContain("cannot be destroyed by damage, even when it has damage on it equal to its hit points.");
    expect(text("mec112.peril")).toContain("they must resolve the staging of that card on their own without conferring with the other players");
    expect(text("mec112.permanent")).toContain("A card with the permanent keyword can only be attached to one hero for the duration of a campaign.");
    expect(text("mec112.setup")).toContain("search the encounter deck for that card and follow its instructions before resolving the Setup instructions on the quest");
    expect(text("mec112.toughness")).toContain("reduces the amount of damage it takes by X each time it is assigned any amount of damage.");
    expect(text("mec112.immune-to-player-card-effects")).toContain("cannot be chosen as targets of player card effects");
  });
});
