import type { Card } from "../../../src/catalog/card-facts.ts";
import type { ScanSide } from "../printed/scope.ts";
import { fetchText } from "./fetch.ts";
import { lettersOf } from "./names.ts";
import type { Log } from "../../log.ts";

// JvZijp's enhanced proxies on Google Drive, the pictures the app prefers above every other source (user decision,
// 2026-10-29): u/LepcisMagna's 600 DPI scans cleaned up, about 1568×2140 with the art carried into a print bleed and a
// rebuilt footer. The folders are <cycle>/<pack>/Player|Encounter/<set>|Quest; a file is "NNN - Name.jpg", a quest side
// "NNN - 1A - Name.jpg", and a card with errata has a second file "NNN - Name (errata).jpg". The Revised Core Set's campaign
// cards are pages of FFG's PDF, "core_set_campaign_cards-<page>.jpg". The set has no Dark of Mirkwood, no MEC109 printing,
// and none of the campaign expansions' own cards.
export const JVZIJP_FOLDER = "1jEy_yvRaPXGylPfilxhweQjffo9AZQsQ";
export const JVZIJP_SITE = `https://drive.google.com/drive/folders/${JVZIJP_FOLDER}`;

export const driveFileUrl = (id: string): string => `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;

export type DriveFile = { path: string; id: string };

type DriveEntry = { name: string; kind: "folder" | "file"; id: string };

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// The entries of Drive's embedded folder view: each is a link to a folder or a file, with its title.
export function parseDriveFolder(html: string): DriveEntry[] {
  const out: DriveEntry[] = [];
  for (const match of html.matchAll(/<a href="([^"]+)"[^>]*>[\s\S]*?flip-entry-title">([^<]+)</g)) {
    const href = match[1] ?? "";
    const name = decodeEntities(match[2] ?? "");
    const folder = /folders\/([\w-]+)/.exec(href)?.[1];
    const file = /file\/d\/([\w-]+)/.exec(href)?.[1];
    if (folder) out.push({ name, kind: "folder", id: folder });
    else if (file) out.push({ name, kind: "file", id: file });
  }
  return out;
}

/** Every file under a public Drive folder, by path, a few folders at a time. */
export async function listDriveTree(root: string, log: Log): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  const queue: { id: string; path: string[] }[] = [{ id: root, path: [] }];
  let active = 0;
  await new Promise<void>((resolve, reject) => {
    const pump = () => {
      if (queue.length === 0 && active === 0) return resolve();
      while (active < 8 && queue.length > 0) {
        const folder = queue.shift();
        if (!folder) break;
        active += 1;
        fetchText(`https://drive.google.com/embeddedfolderview?id=${folder.id}`, 60_000, log)
          .then((html) => {
            for (const entry of parseDriveFolder(html)) {
              const at = [...folder.path, entry.name];
              if (entry.kind === "folder") queue.push({ id: entry.id, path: at });
              else files.push({ path: at.join("/"), id: entry.id });
            }
            active -= 1;
            pump();
          })
          .catch(reject);
      }
    };
    pump();
  });
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

export type JvzijpPicture =
  | { kind: "card"; pack: string; number: number; side: ScanSide; name: string; errata: boolean; id: string; path: string }
  | { kind: "pdfPage"; page: number; id: string; path: string };

// "NNN - Name.jpg", with the set's variations: no space at the dash ("017 -Mr. Underhill"), a quest side ("119 - 1A - "),
// a double-sided player card ("047a - A Perilous Voyage (Side A)"), "(errata)", and a "_1" copy.
const CARD_FILE = /^(\d{3})[ab]?\s*-\s*(?:\d+([AB])\s+-\s+)?(.+?)(\s+\(errata\))?(?:\s+\(Side ([AB])\))?(?:_\d+)?\.(jpe?g|png)$/i;
const CORE_CAMPAIGN_PAGE = /^core_set_campaign_cards-(\d+)\.(jpe?g|png)$/i;

// A file's pack is the RingsDB pack the deepest folder of its path is named after ("01 - Core Set", "03 - The Watcher in
// the Water"). Working files (headings, "sharpen-" copies, text lists) match no pattern and are left out.
export function jvzijpPictures(files: readonly DriveFile[], packs: readonly { code: string; name: string }[]): JvzijpPicture[] {
  const packOfName = new Map(packs.map((pack) => [lettersOf(pack.name), pack.code]));
  const out: JvzijpPicture[] = [];
  for (const file of files) {
    const parts = file.path.split("/");
    const name = parts.at(-1) ?? "";
    const page = CORE_CAMPAIGN_PAGE.exec(name);
    if (page && parts[0]?.endsWith("Core Set")) {
      out.push({ kind: "pdfPage", page: Number(page[1]), id: file.id, path: file.path });
      continue;
    }
    const card = CARD_FILE.exec(name);
    if (!card) continue;
    let pack: string | undefined;
    for (const folder of parts.slice(0, -1)) pack = packOfName.get(lettersOf(folder.replace(/^\d+ - /, ""))) ?? pack;
    if (!pack) continue;
    out.push({
      kind: "card",
      pack,
      number: Number(card[1]),
      side: card[2] === "B" || card[5] === "B" ? "B" : "A",
      name: card[3] ?? "",
      errata: card[4] !== undefined,
      id: file.id,
      path: file.path,
    });
  }
  return out;
}

// Edit distance between two letter strings, for the set's typos ("Sticken Dumb", "Gwahir_s Debt", "Bill Fenry").
function distance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= right.length; j += 1) {
      row[j] = Math.min((previous[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + (left[i - 1] === right[j - 1] ? 0 : 1));
    }
    previous = row;
  }
  return previous[right.length] ?? 0;
}

export function namesMatch(cardName: string, fileName: string): boolean {
  const card = lettersOf(cardName);
  const file = lettersOf(fileName);
  if (card.length === 0 || file.length === 0) return false;
  if (card === file) return true;
  // Only files of the card's own pack and number are compared, so the bar can allow a swapped pair ("Fenry").
  return distance(card, file) <= Math.max(2, Math.floor(Math.max(card.length, file.length) / 5));
}

// The Revised Core Set reprints the Core Set's cards under the same numbers.
const PACK_ALIASES: Readonly<Record<string, readonly string[]>> = { RevCore: ["Core"] };

/**
 * The Drive file of one side: the first printing whose pack and number name a file of that card. Side A needs the file's
 * title to name the card; side B is the back of a side A that does (a quest's back carries another title). A card with
 * errata takes the "(errata)" file, any other card the plain one. A page of FFG's PDF is matched by its page number.
 */
export function jvzijpFile(
  pictures: readonly JvzijpPicture[],
  card: Pick<Card, "name" | "printings" | "hasErrata">,
  side: ScanSide,
  pdfPage: number | null,
): JvzijpPicture | null {
  if (pdfPage !== null) return pictures.find((picture) => picture.kind === "pdfPage" && picture.page === pdfPage) ?? null;
  for (const printing of card.printings) {
    for (const pack of [printing.pack, ...(PACK_ALIASES[printing.pack] ?? [])]) {
      const here = pictures.filter((picture) => picture.kind === "card" && picture.pack === pack && picture.number === printing.number);
      const named = here.some((picture) => picture.kind === "card" && picture.side === "A" && namesMatch(card.name, picture.name));
      if (!named) continue;
      const sided = here.filter((picture) => picture.kind === "card" && picture.side === side && (side === "B" || namesMatch(card.name, picture.name)));
      const preferred = sided.find((picture) => picture.kind === "card" && picture.errata === card.hasErrata) ?? sided[0];
      if (preferred) return preferred;
    }
  }
  return null;
}
