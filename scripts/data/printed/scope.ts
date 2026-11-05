import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { Card } from "../../../src/catalog/card-facts.ts";
import { PRODUCT_PACKS, PRODUCTS } from "../campaign-defs.ts";

import { loadCards } from "../load-cards.ts";
import { dealtCodes, loadCampaign, loadCampaigns, loadScenarios } from "../load-scenarios.ts";
import { RAW_DIR } from "../paths.ts";
import { isNightmareCard, NIGHTMARE_DECKS, NIGHTMARE_PACK, nightmareDeckOfCode } from "../nightmare-defs.ts";
import { deckFiles, nightmareFiles } from "../sources/nightmare.ts";
import { driveFileUrl, type DriveFile } from "../sources/jvzijp.ts";
import type { HobCard } from "../sources/hallofbeorn.ts";
import { foldTwoSided } from "../normalize/product-cards.ts";
import { titleKey } from "../normalize/names.ts";

// The packs the Campaign Expansions' cards are printed in (ProductDef.campaignExpansion, scripts/data/campaign-defs.ts).
const CAMPAIGN_EXPANSION_PACKS: ReadonlySet<string> = new Set(PRODUCTS.filter((product) => product.campaignExpansion).flatMap((product) => product.packs));

// The cards whose printed text the ledger holds: everything every built scenario deals (the six of the Fellowship box, the
// three Revised Core scenarios, The Oath and The Caves of Nibin-Dûm), on every difficulty (the Nightmare decks of the nine that
// have one, read from the Nightmare proxies' pictures), The One Ring, the campaign cards, the boons and
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
// spelling exists. A key is a code (side A) or "<code>.B". The Dream-chaser Campaign Expansion's scans keep the accent out of the
// file name that Hall of Beorn's record keeps in (Nárelenya, Círdan's Blessing).
const DREAM_CHASER_SCANS = "https://s3.amazonaws.com/hallofbeorn-resources/Images/Cards/Dream-chaser-Campaign-Expansion";
const SCAN_URL_FIXES: Readonly<Record<string, readonly string[]>> = {
  "110139": [`${DREAM_CHASER_SCANS}/Glorinaith.jpg`],
  "110140": [`${DREAM_CHASER_SCANS}/Narelenya.jpg`],
  "110140.B": [`${DREAM_CHASER_SCANS}/Narelenya-Upgraded.jpg`],
  "11205": [`${DREAM_CHASER_SCANS}/Cirdan's-Blessing-Leadership.jpg`],
  "11206": [`${DREAM_CHASER_SCANS}/Cirdan's-Blessing-Tactics.jpg`],
  "11207": [`${DREAM_CHASER_SCANS}/Cirdan's-Blessing-Spirit.jpg`],
  "11208": [`${DREAM_CHASER_SCANS}/Cirdan's-Blessing-Lore.jpg`],
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
  const nightmareCodes = new Set(cards.filter(isNightmareCard).map((card) => card.code));
  const dir = path.join(RAW_DIR, "hallofbeorn", "Scenarios");
  for (const name of readdirSync(dir).sort()) {
    const scenario = JSON.parse(readFileSync(path.join(dir, name), "utf8")) as { QuestCards: { Slug: string }[]; ScenarioCards: { Slug: string; EncounterSet: string | null }[] };
    // A scenario file also lists the quest cards of its Nightmare deck (Dream-chaser's); a Nightmare card is read from its own proxy picture.
    for (const entry of [...scenario.QuestCards, ...scenario.ScenarioCards.filter((card) => !/Nightmare$/.test(card.EncounterSet ?? ""))]) {
      const code = bySlug.get(entry.Slug);
      if (code && !nightmareCodes.has(code)) codes.add(code);
    }
  }
  for (const card of cards) if (card.campaignKind && card.printings.some((printing) => PRODUCT_PACKS.has(printing.pack))) codes.add(card.code);
  // Everything a Campaign Expansion prints: the nine campaign cards, the Dream-chaser's Hard and Expert Mode card (in no scenario's list), its
  // 2023 reprints with their Campaign Mode only and Upgraded sides, its ships, every boon and burden, and Ered Mithrin's treasures.
  for (const card of cards) if (card.printings.some((printing) => CAMPAIGN_EXPANSION_PACKS.has(printing.pack))) codes.add(card.code);
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

// The rows are folded as the build folds them (foldTwoSided): a Dream-chaser Campaign Expansion card with an Upgraded or Campaign Mode
// only side has that side's picture as its back.
function hobImages(): HobImages[] {
  const rows = ["EncounterCards", "QuestCards", "PlayerCards"].flatMap((kind) => JSON.parse(readFileSync(path.join(RAW_DIR, "hallofbeorn", `${kind}.json`), "utf8")) as HobCard[]);
  return foldTwoSided(rows).cards as unknown as HobImages[];
}

// DragnCards' card database, read once: the picture prefix and every row.
let dragnTable: { prefix: string; rows: Record<string, string>[] } | null = null;
function dragnRows(): { prefix: string; rows: Record<string, string>[] } {
  if (dragnTable) return dragnTable;
  const prefix = (JSON.parse(readFileSync(path.join(RAW_DIR, "dragncards", "imageUrlPrefix.json"), "utf8")) as { imageUrlPrefix: { English: string } }).imageUrlPrefix.English;
  const lines = readFileSync(path.join(RAW_DIR, "dragncards", "cardDb.tsv"), "utf8").split("\n");
  const header = (lines[0] ?? "").split("\t");
  const rows = lines.slice(1).filter((line) => line !== "").map((line) => {
    const cells = line.split("\t");
    return Object.fromEntries(header.map((key, at) => [key, cells[at] ?? ""]));
  });
  dragnTable = { prefix, rows };
  return dragnTable;
}

// DragnCards' full-size picture for an OCTGN guid, the last resort when Hall of Beorn only has a thumbnail.
function dragnImages(): ReadonlyMap<string, string> {
  const { prefix, rows } = dragnRows();
  const out = new Map<string, string>();
  for (const row of rows) if (row.databaseId && row.imageUrl) out.set(row.databaseId, `${prefix}${row.imageUrl}`);
  return out;
}

// Hall of Beorn has no picture for the second side of some Dream-chaser cards. DragnCards files the facedown side of an Uncharted
// location ("Lost Island") as a row of its own, and the second side of a multi-sided card as "<id>.B.jpg": that picture is the side's scan.
// The card is the row of its pack and collector number that bears its name (accents and punctuation aside) or, for a card DragnCards names
// otherwise (the Heading card Navigation), the one second-side row of its type.
function dragnOtherSide(card: Card): string | null {
  const printing = card.printings.find((item) => item.hobSlug !== undefined);
  const product = PRODUCTS.find((item) => item.packs.some((pack) => pack === printing?.pack));
  if (!printing || !product) return null;
  const { prefix, rows: all } = dragnRows();
  const typeKey = (value: string) => value.toLowerCase().replace(/[\s-]/g, "");
  const rows = all.filter((row) => row.packName === product.name && row.numberInPack === String(printing.number));
  const sameType = rows.filter((row) => typeKey(row.type ?? "") === typeKey(card.typeName));
  // A location's facedown side is a row of its own under another name ("Lost Island"); any other multi-sided card keeps its second side
  // in "<id>.B.jpg".
  const other = rows.find((row) => row.type === card.typeName && row.name !== card.name && row.imageUrl);
  if (card.type === "location" && other) return `${prefix}${other.imageUrl}`;
  const seconds = sameType.filter((row) => (row.imageUrl ?? "").endsWith(".B.jpg"));
  const second = seconds.find((row) => titleKey(row.name ?? "") === titleKey(card.name)) ?? (seconds.length === 1 ? seconds[0] : undefined);
  if (second) return `${prefix}${second.imageUrl}`;
  return other ? `${prefix}${other.imageUrl}` : null;
}

const CORE_ORDER = ["Revised Core Set", "Core Set"];

// The Nightmare proxies' picture of each side (sources/nightmare.ts), from the listing `pnpm data:sync nightmare` keeps. A deck's
// files are matched against the whole deck, as the sync matches them, so a fallback match (a near title, a collector number)
// lands on the same file; then only the codes in scope are kept.
function nightmarePictures(cards: readonly Card[], scope: ReadonlySet<string>): Map<string, string> {
  const listing = JSON.parse(readFileSync(path.join(RAW_DIR, "nightmare", "drive.json"), "utf8")) as DriveFile[];
  const out = new Map<string, string>();
  for (const deck of NIGHTMARE_DECKS) {
    const mine = cards.filter((card) => isNightmareCard(card) && nightmareDeckOfCode(card.code) === deck);
    if (!mine.some((card) => scope.has(card.code))) continue;
    for (const [key, drive] of nightmareFiles(deckFiles(listing, deck), mine)) if (scope.has(key.split(".")[0] ?? "")) out.set(key, driveFileUrl(drive.id));
  }
  return out;
}

// Hall of Beorn's MEC109 scan first (its TFotR printing), then the other printings, DragnCards last. A card the box
// does not reprint (the core-set cards of the starter lists) takes the Revised Core Set scan. A Nightmare card takes its proxy picture.
export function scanTargets(codes: readonly string[] = scopeCodes()): ScanTarget[] {
  const all = loadCards();
  const cards = new Map(all.map((card) => [card.code, card]));
  const hob = hobImages();
  const dragn = dragnImages();
  const out: ScanTarget[] = [];
  const nightmare = nightmarePictures(all, new Set(codes));
  for (const code of codes) {
    const card = cards.get(code);
    if (!card) throw new Error(`Scan scope names ${code}, which is not in data/cards`);
    // A Nightmare card is read from its proxy picture (about 2348 px), then from Hall of Beorn's scan.
    if (isNightmareCard(card)) {
      const hobUrls = card.printings.flatMap((printing) => printing.imageUrls ?? []).filter((url) => !url.includes("dragncards"));
      for (const side of card.back ? (["A", "B"] as const) : (["A"] as const)) {
        const proxy = nightmare.get(`${code}.${side}`);
        const fallback = side === "A" ? hobUrls[0] : hobUrls[1];
        const urls = [...(proxy ? [proxy] : []), ...(fallback ? [fallback] : [])];
        if (urls.length === 0) throw new Error(`No scan URL for ${code}.${side} ${card.name}`);
        out.push({ code, side, printing: NIGHTMARE_PACK, urls });
      }
      continue;
    }
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
    // A card Hall of Beorn has no picture of (the Campaign Expansion's #129) is read from its DragnCards pictures: front, then back.
    const own = first.urls.filter((url) => !url.includes("dragncards"));
    const sideA = own.length > 0 ? own : first.urls;
    const front = sideA[0];
    const back = isCampaign && front ? front.replace("SetupA", "SetupB") : (sideA[1] ?? (card.back ? dragnOtherSide(card) : null) ?? undefined);
    if (!front) throw new Error(`No scan for ${code}`);
    const guid = card.printings.map((printing) => printing.octgnGuid).find((value) => value !== undefined);
    const fromDragn = guid ? dragn.get(guid) : undefined;
    out.push({ code, side: "A", printing: first.printing, urls: [...(SCAN_URL_FIXES[code] ?? []), front, ...sources.slice(1).flatMap((source) => source.urls.slice(0, 1)), ...(fromDragn ? [fromDragn] : [])] });
    if (back) out.push({ code, side: "B", printing: first.printing, urls: [...(SCAN_URL_FIXES[`${code}.B`] ?? []), back] });
  }
  return out;
}
