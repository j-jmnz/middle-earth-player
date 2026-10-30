import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Card } from "../../../src/catalog/card-facts.ts";
import { loadCards } from "../load-cards.ts";
import { isNightmareCard, NIGHTMARE_DECKS, nightmareDeckOfCode, type NightmareDeckDef } from "../nightmare-defs.ts";
import { PICTURE_CACHE_DIR } from "../paths.ts";
import type { ScanSide } from "../printed/scope.ts";
import { bytes, createLog, type Log } from "../../log.ts";
import { combinedPin, fetchBytes, sha256, writeRaw, type SourceFile, type SourceRecord } from "./fetch.ts";
import { driveFileUrl, listDriveTree, namesMatch, type DriveFile } from "./jvzijp.ts";
import { lettersOf } from "./names.ts";
import { extensionOf, widthOf } from "./scans.ts";

// The Nightmare decks' pictures and card lists, from the Google Drive folder the user named (2026-10-30): one folder per deck,
// <cycle>/<pack>/<scenario>, each holding the deck's cards as "NNN - Name Q.jpg" (Q the copies), a quest side as
// "NNN - 2A - Name.jpg", the setup card as "NNN - <Scenario>.jpg" (side A, "You are playing Nightmare mode") and "NNN - Setup.jpg"
// (side B, the recipe), the pack's insert as "000 - Introduction.jpg" and "000 - <Pack>.jpg" (not a card), and a cardlist.txt
// ("3 Forest Flies" a line). About 2348×3200 each. The listing and the card lists are kept under data/raw/nightmare; the pictures
// are cached in .cache/pictures and pinned like the `pictures` source's, so `pnpm scans:pack` bundles them.
export const NIGHTMARE_FOLDER = "10pz9RF2e1QrJXqsmmLWPkO1Hu1auQuxB";
export const NIGHTMARE_SITE = `https://drive.google.com/drive/folders/${NIGHTMARE_FOLDER}`;

// "002 - Ungoliant's Spawn 1.jpg", with the set's variations: no dash ("002 Ambushing Orcs 3"), no space after it ("004 -Prison
// Cell 4"), no number ("- - 2A - Search for an Exit", "Lost Island"), a quest side ("011 - 3A - Grimbeorn's Folly"), no copies.
const FILE = /^(?:(\d{3}|-)\s*-?\s*)?(?:(\d+)([AB])\s+-\s+)?(.+?)(?:\s+(\d+))?\.(jpe?g|png)$/i;

export type NightmareFile = { number: string | null; stage: string | null; side: ScanSide | null; name: string; copies: number | null; file: DriveFile };

export function parseNightmareFile(file: DriveFile): NightmareFile | null {
  const match = FILE.exec(path.basename(file.path));
  if (!match) return null;
  const number = match[1] && match[1] !== "-" ? match[1] : null;
  return { number, stage: match[2] ?? null, side: (match[3]?.toUpperCase() as ScanSide | undefined) ?? null, name: match[4] ?? "", copies: match[5] ? Number(match[5]) : null, file };
}

/** The files of one deck's folder (not its subfolders), parsed. */
export function deckFiles(listing: readonly DriveFile[], deck: Pick<NightmareDeckDef, "folder">): NightmareFile[] {
  return listing
    .filter((file) => path.dirname(file.path) === deck.folder)
    .flatMap((file) => {
      const parsed = parseNightmareFile(file);
      return parsed ? [parsed] : [];
    });
}

const sameTitle = (card: string, file: string) => lettersOf(card.replaceAll("&", "and")) === lettersOf(file.replaceAll("&", "and"));
const collector = (card: Pick<Card, "printings">) => String(card.printings[0]?.number ?? 0).padStart(3, "0");

/**
 * The file of each side of a deck's cards in its folder, keyed `<code>.<side>`. The setup card's side B is the file named "Setup"
 * and its side A the other file of that number (or, with no Setup file, the file named as the scenario). A quest side is the file
 * of its stage and letter: named as the card, else the only one at that stage, else (several stages share a side A, Flight from
 * Moria's Search for an Exit) the one of its collector number. Any other card is the file of its title: an exact title first, so
 * Eastern Shore does not take Western Shore's file, then a near one (the folder's typos), then the unused file of its collector
 * number (a file named for another printing). A double-sided location's side B is the folder's one unnumbered file no card is
 * named after (Lost Island, Edge of the Temple).
 */
export function nightmareFiles(files: readonly NightmareFile[], cards: readonly Pick<Card, "code" | "name" | "type" | "stage" | "back" | "printings">[]): Map<string, DriveFile> {
  const out = new Map<string, DriveFile>();
  const used = new Set<NightmareFile>();
  const take = (key: string, file: NightmareFile | undefined) => {
    if (!file) return;
    out.set(key, file.file);
    used.add(file);
  };
  const plain = files.filter((file) => file.stage === null && file.number !== "000" && !/^(setup|introduction)$/i.test(file.name));
  for (const card of cards.filter((item) => item.type === "nightmare")) {
    const setup = files.find((file) => /^setup$/i.test(file.name));
    take(`${card.code}.B`, setup);
    const scenario = card.name.replace(/ Nightmare$/, "");
    take(`${card.code}.A`, setup ? plain.find((file) => file.number === setup.number) : plain.find((file) => sameTitle(scenario, file.name)));
  }
  for (const card of cards.filter((item) => item.type === "quest")) {
    for (const [side, stage, name] of [["A", card.stage, card.name], ["B", card.back?.stage ?? null, card.back?.name ?? ""]] as const) {
      const atStage = files.filter((file) => file.stage !== null && `${file.stage}${file.side}` === stage);
      take(`${card.code}.${side}`, atStage.find((file) => name !== "" && namesMatch(name, file.name)) ?? (atStage.length === 1 ? atStage[0] : atStage.find((file) => file.number === collector(card))));
    }
  }
  const others = cards.filter((item) => item.type !== "nightmare" && item.type !== "quest");
  const free = () => plain.filter((file) => !used.has(file));
  for (const card of others) take(`${card.code}.A`, free().find((file) => sameTitle(card.name, file.name)));
  for (const card of others) if (!out.has(`${card.code}.A`)) take(`${card.code}.A`, free().find((file) => namesMatch(card.name, file.name)));
  for (const card of others) if (!out.has(`${card.code}.A`)) take(`${card.code}.A`, free().find((file) => file.number === collector(card)));
  const backs = free().filter((file) => file.number === null);
  for (const card of others) if (card.back && backs.length === 1) out.set(`${card.code}.B`, (backs[0] as NightmareFile).file);
  return out;
}

/** A deck's cardlist.txt: "3 Forest Flies" a line. */
export function parseCardList(text: string): { copies: number; name: string }[] {
  return text
    .split(/\r?\n/)
    .map((line) => /^\s*(\d+)\s+(.+?)\s*$/.exec(line))
    .flatMap((match) => (match?.[1] && match[2] ? [{ copies: Number(match[1]), name: match[2] }] : []));
}

export const cardListPath = (deck: Pick<NightmareDeckDef, "prefix">): string => `nightmare/${deck.prefix}.txt`;

const SYNC_CONCURRENCY = 6;
const RETRIES = 4;

// Drive answers a burst of downloads with a 503 now and then: a file is tried again after 2, 4 and 8 seconds.
async function fetchWithRetry(url: string, log: Log): Promise<Uint8Array> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fetchBytes(url, 300_000, log);
    } catch (error) {
      if (attempt >= RETRIES) throw error;
      log.warn(`${url}: ${error instanceof Error ? error.message : String(error)}; trying again (${attempt + 1} of ${RETRIES})`);
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
}

export async function syncNightmare(log: Log = createLog("nightmare")): Promise<SourceRecord> {
  const files: SourceFile[] = [];
  const listing = await listDriveTree(NIGHTMARE_FOLDER, log);
  files.push(writeRaw("nightmare/drive.json", NIGHTMARE_SITE, `${JSON.stringify(listing, null, 1)}\n`));
  log.info(`the Drive folder holds ${listing.length} files`);
  for (const deck of NIGHTMARE_DECKS) {
    const list = listing.find((file) => file.path === `${deck.folder}/cardlist.txt`);
    if (!list) throw new Error(`${deck.set}: no cardlist.txt under "${deck.folder}" (scripts/data/nightmare-defs.ts names the folder)`);
    files.push(writeRaw(cardListPath(deck), driveFileUrl(list.id), new TextDecoder().decode(await fetchWithRetry(driveFileUrl(list.id), log))));
  }
  // Each side of each Nightmare card: side A always, side B of a setup or quest card.
  const cards = loadCards().filter(isNightmareCard);
  const targets = cards.flatMap((card) => {
    const deck = nightmareDeckOfCode(card.code);
    if (!deck) throw new Error(`${card.code} ${card.name} is in no Nightmare deck`);
    const sides: ScanSide[] = card.back ? ["A", "B"] : ["A"];
    return sides.map((side) => ({ card, deck, side }));
  });
  const byDeck = new Map(NIGHTMARE_DECKS.map((deck) => [deck.prefix, nightmareFiles(deckFiles(listing, deck), cards.filter((card) => nightmareDeckOfCode(card.code) === deck))]));
  mkdirSync(PICTURE_CACHE_DIR, { recursive: true });
  const missing: string[] = [];
  const tick = log.progress(targets.length, "picture");
  const one = async ({ card, deck, side }: (typeof targets)[number]) => {
    const key = `${card.code}.${side}`;
    const file = byDeck.get(deck.prefix)?.get(key);
    if (!file) {
      missing.push(`${key} ${card.name} (${deck.set})`);
      tick(`${key} has no file`);
      return;
    }
    const url = driveFileUrl(file.id);
    const body = await fetchWithRetry(url, log);
    // Drive answers a quota or sign-in page as HTML: that is not a picture.
    const extension = extensionOf(body);
    if (extension === null) throw new Error(`${key}: ${url} (${file.path}) is not a JPEG or PNG`);
    writeFileSync(path.join(PICTURE_CACHE_DIR, `${key}.${extension}`), body);
    files.push({ path: `pictures/${key}.${extension}`, url, sha256: sha256(body), bytes: body.byteLength });
    tick(`${key} ${widthOf(body)} px, ${bytes(body.byteLength)}`);
  };
  let next = 0;
  await Promise.all(
    Array.from({ length: SYNC_CONCURRENCY }, async () => {
      while (next < targets.length) {
        const target = targets[next++];
        if (target) await one(target);
      }
    }),
  );
  if (missing.length > 0) log.warn(`${missing.length} sides have no picture in the Drive folder: ${missing.sort().join(", ")}`);
  files.sort((left, right) => left.path.localeCompare(right.path));
  return { id: "nightmare", site: NIGHTMARE_SITE, pin: { kind: "sha256", value: combinedPin(files) }, fetchedAt: new Date().toISOString(), files };
}
