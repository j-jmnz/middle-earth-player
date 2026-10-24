import { readFileSync } from "node:fs";
import path from "node:path";

import type { Card } from "../../../src/catalog/card-facts.ts";
import { loadCards } from "../load-cards.ts";
import { loadCampaign, loadScenarios } from "../load-scenarios.ts";
import { RAW_DIR, ROOT } from "../paths.ts";

// The cards whose printed text the ledger holds in this phase: everything A Shadow of the Past deals, The One
// Ring, the six campaign cards, and both starter lists. Phase 8d adds the cards of scenarios 2 to 6.
export type ScanSide = "A" | "B";
export type ScanTarget = { code: string; side: ScanSide; printing: string; urls: string[] };

// Cards the MEC109 printing words differently from the 2013 and 2014 printings that RingsDB carries (phase 8b found nine).
// Burdens and the Phial belong to later scenarios, but their printed text is settled here from the MEC109 scan.
export const MEC109_CHANGED = ["141078", "141080", "141081", "141082", "141083", "141084", "142015", "142085", "142086"];

// Quest cards whose Hall of Beorn text has a known error the ledger corrects (typos, a duplicated line). They belong
// to scenarios 2 to 6; phase 8d ledgers the rest of those scenarios.
export const KNOWN_ERRORS = ["141025", "141026", "141029", "142062"];

const CAMPAIGN_CARDS = ["141030", "141044", "141056", "142019", "142039", "142060"];

// src/screens/starter-decks.ts imports the Drizzle schema, which Node cannot load without a bundler. The two
// lists are literal rows there (`code: "01002" }`), so the codes are read from the text.
export function starterCodes(): string[] {
  const source = readFileSync(path.join(ROOT, "src", "screens", "starter-decks.ts"), "utf8");
  return [...new Set([...source.matchAll(/code: "(\w+)" \}/g)].map((match) => match[1] ?? ""))].sort();
}

export function scopeCodes(): string[] {
  const codes = new Set<string>([...CAMPAIGN_CARDS, ...MEC109_CHANGED, ...KNOWN_ERRORS]);
  const campaign = loadCampaign();
  for (const card of campaign.prelude) codes.add(card.code);
  for (const scenario of loadScenarios()) {
    for (const card of scenario.cards) codes.add(card.code);
    for (const group of campaign.authored.resolution[scenario.id] ?? []) for (const choice of group.choices) codes.add(choice.code);
  }
  for (const code of starterCodes()) codes.add(code);
  return [...codes].sort();
}

type HobImages = { CardSet: string; RingsDbCardId: string | null; Front: { ImagePath: string | null }; Back: { ImagePath: string | null } | null };

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
    const card = cards.get(code) as Card | undefined;
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
      const rows = hob.filter((row) => row.RingsDbCardId === code && row.Front.ImagePath);
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
    out.push({ code, side: "A", printing: first.printing, urls: [front, ...sources.slice(1).flatMap((source) => source.urls.slice(0, 1)), ...(fromDragn ? [fromDragn] : [])] });
    if (back) out.push({ code, side: "B", printing: first.printing, urls: [back] });
  }
  return out;
}
