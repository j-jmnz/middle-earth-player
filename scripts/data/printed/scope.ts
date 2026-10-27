import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { PRODUCT_PACKS } from "../campaign-defs.ts";
import { loadCards } from "../load-cards.ts";
import { dealtCodes, loadCampaign, loadCampaigns, loadScenarios } from "../load-scenarios.ts";
import { RAW_DIR } from "../paths.ts";

// The cards whose printed text the ledger holds: everything every built scenario deals (the six of the Fellowship box, the
// three Revised Core scenarios, The Oath and The Caves of Nibin-Dûm), The One Ring, the campaign cards, the boons and
// burdens of each box, and both starter lists. The player's requests add cards of their own decks.
export type ScanSide = "A" | "B";
export type ScanTarget = { code: string; side: ScanSide; printing: string; urls: string[] };

// Cards the MEC109 printing words differently from the 2013 and 2014 printings that RingsDB carries (phase 8b found nine).
// Burdens and the Phial belong to later scenarios, but their printed text is settled here from the MEC109 scan.
export const MEC109_CHANGED = ["141078", "141080", "141081", "141082", "141083", "141084", "142015", "142085", "142086"];

// Quest cards whose Hall of Beorn text has a known error the ledger corrects (typos, a duplicated line). They belong
// to scenarios 2 to 6; phase 8d ledgers the rest of those scenarios.
export const KNOWN_ERRORS = ["141025", "141026", "141029", "142062"];

// Hall of Beorn's own image path for these has a typo ("Striken-Dumb.jpg", "The-Argonauth.jpg") that 403s. The corrected
// spelling exists.
const SCAN_URL_FIXES: Readonly<Record<string, readonly string[]>> = {
  "142075": ["https://s3.amazonaws.com/hallofbeorn-resources/Images/Cards/The-Fellowship-of-the-Ring/The-Argonath.jpg"],
  "141064": ["https://s3.amazonaws.com/hallofbeorn-resources/Images/Cards/The-Fellowship-of-the-Ring/Stricken-Dumb.jpg"],
};

// Player cards outside the box that the player's own decks play and reported doing nothing (user request, 2026-10-25):
// The Shirefolk lowers its player's threat. Then every card of the four core-set Learn to Play decks (core-leadership,
// core-tactics, core-spirit, core-lore in data/decks/prebuilt.json) whose text had no record (user request, 2026-10-26).
export const PLAYER_REQUESTS = [
  "19121",
  // The four core Learn to Play decks (user request, 2026-10-26).
  ...["01001", "01003", "01004", "01005", "01006", "01008", "01009", "01010", "01011", "01012"],
  ...["01015", "01018", "01019", "01022", "01029", "01032", "01033", "01036", "01037", "01038", "01039", "01040", "01041"],
  ...["01044", "01047", "01049", "01052", "01054", "01055", "01056"],
  ...["01058", "01061", "01063", "01064", "01065", "01066", "01067", "01068", "01069", "01070", "01071", "01072"],
  // Core cards the Mirkwood Paths plan (docs/plans/mirkwood-paths.md, phase 27) ledgers beside its boxes: Guard of the Citadel,
  // Silverlode Archer and Horseback Archer, the three core player cards the four Learn to Play decks hold that no record read.
  "01013",
  "01017",
  "01030",
];

// The codes of both starter lists, from the campaign file (data/starter-decks.json).
export function starterCodes(): string[] {
  return [...new Set(loadCampaign().starterDecks.flatMap((deck) => deck.rows.map((row) => row.code)))].sort();
}

// Every built campaign's campaign cards, one per scenario.
function campaignCards(): string[] {
  return loadCampaigns().flatMap((campaign) => Object.values(campaign.campaignCards));
}

// Every card Hall of Beorn lists for a built scenario (Normal or Easy), the quest cards, and the boons and burdens of
// each box.
function boxCodes(): string[] {
  const cards = loadCards();
  const bySlug = new Map(cards.flatMap((card) => card.printings.flatMap((printing) => (printing.hobSlug ? [[printing.hobSlug, card.code] as const] : []))));
  const codes = new Set<string>();
  const dir = path.join(RAW_DIR, "hallofbeorn", "Scenarios");
  for (const name of readdirSync(dir).sort()) {
    const scenario = JSON.parse(readFileSync(path.join(dir, name), "utf8")) as { QuestCards: { Slug: string }[]; ScenarioCards: { Slug: string; EncounterSet: string | null }[] };
    for (const entry of [...scenario.QuestCards, ...scenario.ScenarioCards.filter((card) => !/Nightmare$/.test(card.EncounterSet ?? ""))]) {
      const code = bySlug.get(entry.Slug);
      if (code) codes.add(code);
    }
  }
  for (const card of cards) if (card.campaignKind && card.printings.some((printing) => PRODUCT_PACKS.has(printing.pack))) codes.add(card.code);
  // The box's Ring-bearer: every scenario starts with a Fellowship-sphere Ring-bearer hero in play (mec109.setting-up-the-game),
  // so his text is part of every game.
  for (const card of cards) {
    if (card.sphere === "fellowship" && card.type === "hero" && card.traits.includes("Ring-bearer") && card.printings.some((printing) => printing.pack === "TFotR")) codes.add(card.code);
  }
  return [...codes];
}

export function scopeCodes(): string[] {
  return [...new Set<string>([...campaignCards(), ...MEC109_CHANGED, ...KNOWN_ERRORS, ...dealtCodes(loadCampaigns(), loadScenarios()), ...boxCodes(), ...starterCodes(), ...PLAYER_REQUESTS])].sort();
}

type HobImages = { CardSet: string; Slug: string; RingsDbCardId: string | null; Front: { ImagePath: string | null }; Back: { ImagePath: string | null } | null };

function hobImages(): HobImages[] {
  return ["EncounterCards", "QuestCards", "PlayerCards"].flatMap((kind) => JSON.parse(readFileSync(path.join(RAW_DIR, "hallofbeorn", `${kind}.json`), "utf8")) as HobImages[]);
}

// DragnCards' full-size picture for an OCTGN guid, the last resort when Hall of Beorn only has a thumbnail.
function dragnImages(): ReadonlyMap<string, string> {
  const prefix = (JSON.parse(readFileSync(path.join(RAW_DIR, "dragncards", "imageUrlPrefix.json"), "utf8")) as { imageUrlPrefix: { English: string } }).imageUrlPrefix.English;
  const lines = readFileSync(path.join(RAW_DIR, "dragncards", "cardDb.tsv"), "utf8").split("\n");
  const header = (lines[0] ?? "").split("\t");
  const idAt = header.indexOf("databaseId");
  const imageAt = header.indexOf("imageUrl");
  const out = new Map<string, string>();
  for (const line of lines.slice(1)) {
    const cells = line.split("\t");
    if (cells[idAt] && cells[imageAt]) out.set(cells[idAt] ?? "", `${prefix}${cells[imageAt] ?? ""}`);
  }
  return out;
}

const CORE_ORDER = ["Revised Core Set", "Core Set"];

// Hall of Beorn's MEC109 scan first (its TFotR printing), then the other printings, DragnCards last. A card the box
// does not reprint (the core-set cards of the starter lists) takes the Revised Core Set scan.
export function scanTargets(codes: readonly string[] = scopeCodes()): ScanTarget[] {
  const cards = new Map(loadCards().map((card) => [card.code, card]));
  const hob = hobImages();
  const dragn = dragnImages();
  const out: ScanTarget[] = [];
  for (const code of codes) {
    const card = cards.get(code);
    if (!card) throw new Error(`Scan scope names ${code}, which is not in data/cards`);
    const mec = card.printings.find((printing) => printing.pack === "TFotR" && printing.imageUrls);
    const sources: { printing: string; urls: string[] }[] = [];
    if (mec?.imageUrls) sources.push({ printing: "MEC109", urls: mec.imageUrls });
    for (const printing of card.printings) {
      if (printing !== mec && printing.imageUrls) {
        sources.push({ printing: printing.pack, urls: [...printing.imageUrls].sort((a, b) => Number(a.includes("dragncards")) - Number(b.includes("dragncards"))) });
      }
    }
    if (sources.length === 0) {
      // A card RingsDB carries with no picture: Hall of Beorn's record is found by the slug the build matched it by (The Dark of
      // Mirkwood's 41041 is Hall of Beorn's 02041, a code that is another card's), else by code.
      const slugs = new Set(card.printings.flatMap((printing) => (printing.hobSlug ? [printing.hobSlug] : [])));
      const bySlug = hob.filter((row) => slugs.has(row.Slug) && row.Front.ImagePath);
      const rows = bySlug.length > 0 ? bySlug : hob.filter((row) => row.RingsDbCardId === code && row.Front.ImagePath);
      rows.sort((a, b) => (CORE_ORDER.indexOf(a.CardSet) + 1 || 99) - (CORE_ORDER.indexOf(b.CardSet) + 1 || 99));
      const best = rows[0];
      if (best?.Front.ImagePath) sources.push({ printing: best.CardSet, urls: [best.Front.ImagePath, ...(best.Back?.ImagePath ? [best.Back.ImagePath] : [])] });
    }
    const first = sources[0];
    if (!first) throw new Error(`No scan URL for ${code} ${card.name}`);
    const isCampaign = card.type === "campaign";
    const sideA = first.urls.filter((url) => !url.includes("dragncards"));
    const front = sideA[0];
    const back = isCampaign && front ? front.replace("SetupA", "SetupB") : sideA[1];
    if (!front) throw new Error(`No Hall of Beorn scan for ${code}`);
    const guid = card.printings.map((printing) => printing.octgnGuid).find((value) => value !== undefined);
    const fromDragn = guid ? dragn.get(guid) : undefined;
    out.push({ code, side: "A", printing: first.printing, urls: [...(SCAN_URL_FIXES[code] ?? []), front, ...sources.slice(1).flatMap((source) => source.urls.slice(0, 1)), ...(fromDragn ? [fromDragn] : [])] });
    if (back) out.push({ code, side: "B", printing: first.printing, urls: [back] });
  }
  return out;
}
