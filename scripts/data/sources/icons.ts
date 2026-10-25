// The game's icons, from the highest-resolution sources found (docs/design-system.md, Icons):
// - RingsDB's icon font, an SVG font: vector glyphs for willpower, attack, defense, hit points, threat, shadow, unique, cost,
//   the seven spheres and the player card types. app.css names the unnamed glyphs through its `.icon-*:before` codepoints.
// - DragnCards' token PNGs: quest points and engagement cost (256 px), and the resource, damage and progress tokens
//   (146 px), which the table draws on cards at 32 pt or less (user request, 2026-10-25: the real token art, not drawn coins).
// Every file is kept verbatim under data/raw/icons and pinned by sha256; `pnpm data:build` cuts the icons out offline.
import { bytes, createLog, type Log } from "../../log.ts";
import { combinedPin, fetchBytes, writeRaw, writeRawBytes, type SourceFile, type SourceRecord } from "./fetch.ts";

export const RINGSDB_FONT_URL = "https://ringsdb.com/bundles/app/fonts/ringsdb.svg?h6hjpma";
export const RINGSDB_CSS_URL = "https://ringsdb.com/css/app.css";
const DRAGNCARDS_TOKENS = "https://dragncards-lotrlcg.s3.amazonaws.com/tokens";
export const DRAGNCARDS_TOKEN_FILES = ["questPoints", "engagementCost", "resource", "damage", "progress"] as const;

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
  return { id: "icons", site: "https://ringsdb.com and https://dragncards-lotrlcg.s3.amazonaws.com", pin: { kind: "sha256", value: combinedPin(files) }, fetchedAt: new Date().toISOString(), files };
}
