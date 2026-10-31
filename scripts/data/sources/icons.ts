// The game's icons, from the highest-resolution sources found (docs/design-system.md, Icons):
// - RingsDB's icon font, an SVG font: vector glyphs for willpower, attack, defense, hit points, threat, shadow, unique, cost,
//   the seven spheres and the player card types. app.css names the unnamed glyphs through its `.icon-*:before` codepoints.
// - DragnCards' token PNGs: quest points and engagement cost (256 px), and the resource, damage and progress tokens
//   (146 px), which the table draws on cards at 32 pt or less (user request, 2026-10-25: the real token art, not drawn coins).
// - DragnCards' card backs, the ones its plugin names in jsons/cardBacks.json: the player back (the One Ring) and the
//   encounter back (the Eye), 429x600 JPEGs, which the table draws on the decks and on face-down cards (user request,
//   2026-10-25: the printed backs, not drawn ones).
// - The Dream-chaser Campaign Expansion's rulebook (MEC111): the Heading's four steps and the Sailing success symbol are glyphs
//   of its embedded LOTRLCGIcons font, which no web icon font carries (mec111-font.ts). The TrueType program and its ToUnicode map
//   are kept, 6 KB; the PDF itself stays out of git.
// Every file is kept verbatim under data/raw/icons and pinned by sha256; `pnpm data:build` cuts the icons out offline.
import { bytes, createLog, type Log } from "../../log.ts";
import { mec111Font } from "./mec111-font.ts";
import { RULE_PDFS } from "./rules.ts";
import { combinedPin, fetchBytes, writeRaw, writeRawBytes, type SourceFile, type SourceRecord } from "./fetch.ts";

export const RINGSDB_FONT_URL = "https://ringsdb.com/bundles/app/fonts/ringsdb.svg?h6hjpma";
export const RINGSDB_CSS_URL = "https://ringsdb.com/css/app.css";
const DRAGNCARDS_TOKENS = "https://dragncards-lotrlcg.s3.amazonaws.com/tokens";
export const DRAGNCARDS_TOKEN_FILES = ["questPoints", "engagementCost", "resource", "damage", "progress"] as const;
export const DRAGNCARDS_CARDBACKS = "https://dragncards-lotrlcg.s3.amazonaws.com/cardbacks";
export const DRAGNCARDS_CARDBACK_FILES = ["player", "encounter"] as const;
export type CardBackName = (typeof DRAGNCARDS_CARDBACK_FILES)[number];

export async function syncIcons(log: Log = createLog("icons")): Promise<SourceRecord> {
  const files: SourceFile[] = [];
  const decoder = new TextDecoder();
  const keep = (file: SourceFile) => {
    files.push(file);
    log.info(`${file.path}, ${bytes(file.bytes)}`);
  };
  keep(writeRaw("icons/ringsdb.svg", RINGSDB_FONT_URL, decoder.decode(await fetchBytes(RINGSDB_FONT_URL, undefined, log))));
  keep(writeRaw("icons/ringsdb-app.css", RINGSDB_CSS_URL, decoder.decode(await fetchBytes(RINGSDB_CSS_URL, undefined, log))));
  for (const name of DRAGNCARDS_TOKEN_FILES) {
    const url = `${DRAGNCARDS_TOKENS}/${name}.png`;
    keep(writeRawBytes(`icons/dragncards/${name}.png`, url, await fetchBytes(url, undefined, log)));
  }
  for (const name of DRAGNCARDS_CARDBACK_FILES) {
    const url = `${DRAGNCARDS_CARDBACKS}/${name}.jpg`;
    keep(writeRawBytes(`icons/dragncards/cardbacks/${name}.jpg`, url, await fetchBytes(url, undefined, log)));
  }
  const mec111 = RULE_PDFS.find((pdf) => pdf.doc === "dcce");
  if (!mec111) throw new Error("RULE_PDFS has no dcce");
  const font = mec111Font(await fetchBytes(mec111.url, 300_000, log));
  keep(writeRawBytes("icons/mec111-icons.ttf", mec111.url, font.ttf));
  keep(writeRaw("icons/mec111-icons.unicode.txt", mec111.url, font.unicode));
  return { id: "icons", site: "https://ringsdb.com, https://dragncards-lotrlcg.s3.amazonaws.com and the MEC111 rulebook", pin: { kind: "sha256", value: combinedPin(files) }, fetchedAt: new Date().toISOString(), files };
}
