// The game's icons, from the highest-resolution sources found (docs/design-system.md, Icons):
// - RingsDB's icon font, an SVG font: vector glyphs for willpower, attack, defense, hit points, threat, shadow, unique, cost,
//   the seven spheres and the player card types. app.css names the unnamed glyphs through its `.icon-*:before` codepoints.
// - DragnCards' token PNGs for quest points and engagement cost, 256 px (the resource, progress and damage tokens there
//   are 146 px, under the 256 px bar, and are not taken).
// Every file is kept verbatim under data/raw/icons and pinned by sha256; `pnpm data:build` cuts the icons out offline.
import { combinedPin, fetchBytes, writeRaw, writeRawBytes, type SourceFile, type SourceRecord } from "./fetch.ts";

export const RINGSDB_FONT_URL = "https://ringsdb.com/bundles/app/fonts/ringsdb.svg?h6hjpma";
export const RINGSDB_CSS_URL = "https://ringsdb.com/css/app.css";
const DRAGNCARDS_TOKENS = "https://dragncards-lotrlcg.s3.amazonaws.com/tokens";
export const DRAGNCARDS_TOKEN_FILES = ["questPoints", "engagementCost"] as const;

export async function syncIcons(): Promise<SourceRecord> {
  const files: SourceFile[] = [];
  const decoder = new TextDecoder();
  files.push(writeRaw("icons/ringsdb.svg", RINGSDB_FONT_URL, decoder.decode(await fetchBytes(RINGSDB_FONT_URL))));
  files.push(writeRaw("icons/ringsdb-app.css", RINGSDB_CSS_URL, decoder.decode(await fetchBytes(RINGSDB_CSS_URL))));
  for (const name of DRAGNCARDS_TOKEN_FILES) {
    const url = `${DRAGNCARDS_TOKENS}/${name}.png`;
    files.push(writeRawBytes(`icons/dragncards/${name}.png`, url, await fetchBytes(url)));
  }
  return { id: "icons", site: "https://ringsdb.com and https://dragncards-lotrlcg.s3.amazonaws.com", pin: { kind: "sha256", value: combinedPin(files) }, fetchedAt: new Date().toISOString(), files };
}
