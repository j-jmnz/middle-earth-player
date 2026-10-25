// Offline: cuts the game's icons out of the snapshots `pnpm data:sync icons` keeps under data/raw/icons, and writes
// assets/icons (one standalone SVG per vector glyph, the PNG tokens and the JPEG card backs copied as they are) and two
// modules under src/play/icons: `generated.ts` (each icon's and card back's source, size and, for a vector, its path for the
// Skia canvas) and `files.generated.ts` (the asset requires for expo-image and Skia images). Deterministic: the same
// snapshots write the same bytes. docs/design-system.md, Icons, lists them.
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { RAW_DIR } from "./paths.ts";

// The RingsDB font glyphs the app uses, by the app's name. A glyph is found by its name in the font, or by the codepoint
// app.css gives the `.icon-<css>:before` rule.
export const VECTOR_ICONS: readonly { name: string; glyph?: string; css?: string }[] = [
  { name: "willpower", glyph: "Willpower" },
  { name: "attack", glyph: "Attack" },
  { name: "defense", glyph: "Defense" },
  { name: "hitPoints", css: "health" },
  { name: "threat", glyph: "Threat" },
  { name: "shadow", glyph: "Shadow" },
  { name: "cost", css: "cost" },
  { name: "unique", glyph: "Unique" },
  { name: "leadership", glyph: "Leadership" },
  { name: "tactics", glyph: "Tactics" },
  { name: "spirit", glyph: "Spirit" },
  { name: "lore", glyph: "Lore" },
  { name: "fellowship", glyph: "Fellowship" },
  { name: "baggins", glyph: "Baggins" },
  { name: "neutral", css: "neutral" },
  { name: "hero", css: "hero" },
  { name: "ally", css: "ally" },
  { name: "attachment", css: "attachment" },
  { name: "event", css: "event" },
  { name: "treasure", css: "treasure" },
  { name: "playerSideQuest", css: "player-side-quest" },
  { name: "contract", css: "contract" },
  { name: "oneRing", css: "onering" },
];

// The token PNGs, by the app's name and the file under data/raw/icons/dragncards, each with the short side it must have.
// An icon in chrome needs 256 px. A token the table puts on a card is drawn at 32 pt or less, so three times that (96 px)
// is enough; DragnCards' resource, damage and progress tokens are 146 px (user request, 2026-10-25).
export const RASTER_ICONS: readonly { name: string; file: string; bar: number }[] = [
  { name: "questPoints", file: "questPoints", bar: 256 },
  { name: "engagementCost", file: "engagementCost", bar: 256 },
  { name: "resource", file: "resource", bar: 96 },
  { name: "damage", file: "damage", bar: 96 },
  { name: "progress", file: "progress", bar: 96 },
];

// The printed card backs, by side: drawn at a card's size on the table, so their bar is a card scan's, 600 px on the long
// side (docs/brief.md, Card images). The asset is `<side>Back.jpg`.
export const CARD_BACKS: readonly { name: "player" | "encounter"; bar: number }[] = [
  { name: "player", bar: 600 },
  { name: "encounter", bar: 600 },
];

const FONT_URL = "https://ringsdb.com/bundles/app/fonts/ringsdb.svg?h6hjpma";
const TOKEN_URL = "https://dragncards-lotrlcg.s3.amazonaws.com/tokens";
const CARDBACK_URL = "https://dragncards-lotrlcg.s3.amazonaws.com/cardbacks";

export type IconRecord =
  | { name: string; kind: "vector"; source: string; glyph: string; viewBox: readonly [number, number, number, number]; d: string }
  | { name: string; kind: "raster"; source: string; width: number; height: number };

export type CardBackRecord = { name: "player" | "encounter"; source: string; width: number; height: number };

type Glyph = { name: string; unicode: string; d: string };

function attr(tag: string, name: string): string | null {
  const match = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return match?.[1] ?? null;
}

function decodeEntity(value: string): string {
  return value.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)));
}

export function parseGlyphs(font: string): Glyph[] {
  const glyphs: Glyph[] = [];
  for (const match of font.matchAll(/<glyph\b[^>]*>/g)) {
    const tag = match[0];
    const d = attr(tag, "d");
    const unicode = attr(tag, "unicode");
    const name = attr(tag, "glyph-name");
    if (d && unicode && name) glyphs.push({ name, unicode: decodeEntity(unicode), d });
  }
  return glyphs;
}

/** `.icon-<name>:before { content: "\eXXX" }` in app.css, as name -> the character. */
export function parseIconCss(css: string): Map<string, string> {
  const map = new Map<string, string>();
  // The content is either an escape ("\\e603") or the private-use character itself.
  for (const match of css.matchAll(/\.icon-([\w-]+):{1,2}before[^{]*\{[^}]*content:\s*"(\\[0-9a-f]+|[^"\\])"/gi)) {
    const name = match[1];
    const value = match[2];
    if (!name || !value || map.has(name)) continue;
    map.set(name, value.startsWith("\\") ? String.fromCodePoint(Number.parseInt(value.slice(1), 16)) : value);
  }
  return map;
}

// The points a glyph path passes through or pulls toward (end and control points), in absolute font units. A font glyph has
// no arcs. The box of these points holds the outline.
export function pathPoints(d: string): [number, number][] {
  const tokens = d.match(/[MmLlHhVvCcSsQqTtZz]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  const points: [number, number][] = [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let command = "";
  let index = 0;
  const next = (): number => Number(tokens[index++]);
  const arity: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, Z: 0 };
  while (index < tokens.length) {
    const token = tokens[index] ?? "";
    if (/^[A-Za-z]$/.test(token)) {
      command = token;
      index += 1;
      if (command === "Z" || command === "z") {
        x = startX;
        y = startY;
        continue;
      }
    }
    const upper = command.toUpperCase();
    const relative = command !== upper;
    const count = arity[upper] ?? 0;
    if (count === 0) break;
    const values = Array.from({ length: count }, next);
    const ox = relative ? x : 0;
    const oy = relative ? y : 0;
    if (upper === "H") {
      x = (relative ? x : 0) + (values[0] ?? 0);
    } else if (upper === "V") {
      y = (relative ? y : 0) + (values[0] ?? 0);
    } else {
      for (let at = 0; at < values.length; at += 2) points.push([ox + (values[at] ?? 0), oy + (values[at + 1] ?? 0)]);
      x = ox + (values[values.length - 2] ?? 0);
      y = oy + (values[values.length - 1] ?? 0);
    }
    points.push([x, y]);
    if (upper === "M") {
      startX = x;
      startY = y;
      // Further pairs after a moveto are linetos.
      command = relative ? "l" : "L";
    }
  }
  return points;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The glyph's box with y pointing down, as an SVG viewBox: font glyphs are y-up, so the path is drawn flipped. */
export function flippedViewBox(d: string): [number, number, number, number] {
  const points = pathPoints(d);
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return [round(minX), round(-maxY), round(maxX - minX), round(maxY - minY)];
}

export function svgFile(record: Extract<IconRecord, { kind: "vector" }>): string {
  const [x, y, w, h] = record.viewBox;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}"><path fill="#000000" transform="scale(1 -1)" d="${record.d}"/></svg>\n`;
}

function pngSize(bytes: Buffer): { width: number; height: number } {
  if (bytes.readUInt32BE(0) !== 0x89504e47) throw new Error("Not a PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

// A baseline or progressive JPEG's size, from its start-of-frame marker.
function jpegSize(bytes: Buffer): { width: number; height: number } {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("Not a JPEG");
  let at = 2;
  while (at + 9 < bytes.length) {
    const marker = bytes[at + 1] ?? 0;
    if (marker === 0xc0 || marker === 0xc2) return { width: bytes.readUInt16BE(at + 7), height: bytes.readUInt16BE(at + 5) };
    at += 2 + bytes.readUInt16BE(at + 2);
  }
  throw new Error("A JPEG with no frame");
}

function backFile(rawDir: string, name: string): string {
  return path.join(rawDir, "icons", "dragncards", "cardbacks", `${name}.jpg`);
}

export function cardBackRecords(rawDir: string = RAW_DIR): CardBackRecord[] {
  return CARD_BACKS.map((back) => {
    const size = jpegSize(readFileSync(backFile(rawDir, back.name)));
    if (Math.max(size.width, size.height) < back.bar) throw new Error(`The ${back.name} back is ${size.width}x${size.height}, under its ${back.bar} px bar`);
    return { name: back.name, source: `${CARDBACK_URL}/${back.name}.jpg`, ...size };
  });
}

export function iconRecords(rawDir: string = RAW_DIR): IconRecord[] {
  const font = readFileSync(path.join(rawDir, "icons", "ringsdb.svg"), "utf8");
  const css = parseIconCss(readFileSync(path.join(rawDir, "icons", "ringsdb-app.css"), "utf8"));
  const glyphs = parseGlyphs(font);
  const records: IconRecord[] = [];
  for (const icon of VECTOR_ICONS) {
    const character = icon.css ? css.get(icon.css) : undefined;
    const glyph = glyphs.find((entry) => (icon.glyph ? entry.name === icon.glyph : entry.unicode === character));
    if (!glyph) throw new Error(`The RingsDB font has no glyph for ${icon.name}`);
    records.push({ name: icon.name, kind: "vector", source: FONT_URL, glyph: glyph.name, viewBox: flippedViewBox(glyph.d), d: glyph.d });
  }
  for (const icon of RASTER_ICONS) {
    const size = pngSize(readFileSync(path.join(rawDir, "icons", "dragncards", `${icon.file}.png`)));
    if (Math.min(size.width, size.height) < icon.bar) throw new Error(`${icon.name} is ${size.width}x${size.height}, under its ${icon.bar} px bar`);
    records.push({ name: icon.name, kind: "raster", source: `${TOKEN_URL}/${icon.file}.png`, ...size });
  }
  return records;
}

function renderData(records: readonly IconRecord[], backs: readonly CardBackRecord[]): string {
  const lines = records.map((record) => `  ${JSON.stringify(record.name)}: ${JSON.stringify(record)},`);
  const backLines = backs.map((back) => `  ${JSON.stringify(back.name)}: ${JSON.stringify(back)},`);
  return `// Written by pnpm data:build (scripts/data/icons.ts). Do not edit.
// Each game icon the app draws: its source, and its size (a vector's viewBox in font units, a raster's pixels).
export type IconRecord =
  | { name: string; kind: "vector"; source: string; glyph: string; viewBox: readonly [number, number, number, number]; d: string }
  | { name: string; kind: "raster"; source: string; width: number; height: number };

export const ICONS = {
${lines.join("\n")}
} as const satisfies Record<string, IconRecord>;

export type IconName = keyof typeof ICONS;

// The printed card backs, by side: the player back on the player's deck and cards, the encounter back on the encounter
// deck, shadow cards and face-down encounter cards.
export const CARD_BACKS = {
${backLines.join("\n")}
} as const satisfies Record<string, { name: string; source: string; width: number; height: number }>;

export type CardBackName = keyof typeof CARD_BACKS;
`;
}

function renderFiles(records: readonly IconRecord[], backs: readonly CardBackRecord[]): string {
  const lines = records.map((record) => `  ${JSON.stringify(record.name)}: require("../../../assets/icons/${record.name}.${record.kind === "vector" ? "svg" : "png"}") as number,`);
  const backLines = backs.map((back) => `  ${JSON.stringify(back.name)}: require("../../../assets/icons/${back.name}Back.jpg") as number,`);
  return `// Written by pnpm data:build (scripts/data/icons.ts). Do not edit.
// The asset of each icon, for expo-image (SVG and PNG) and Skia images. Imported by components only: Node tests read
// ./generated.ts.
import type { CardBackName, IconName } from "./generated";

export const ICON_FILES: Record<IconName, number> = {
${lines.join("\n")}
};

export const CARD_BACK_FILES: Record<CardBackName, number> = {
${backLines.join("\n")}
};
`;
}

/** Writes assets/icons and the two icon modules. `assetsDir` and `modulesDir` let data:check build into a scratch dir. */
export function buildIcons(assetsDir: string, modulesDir: string, rawDir: string = RAW_DIR): IconRecord[] {
  const records = iconRecords(rawDir);
  const backs = cardBackRecords(rawDir);
  rmSync(assetsDir, { recursive: true, force: true });
  mkdirSync(assetsDir, { recursive: true });
  mkdirSync(modulesDir, { recursive: true });
  for (const record of records) {
    if (record.kind === "vector") writeFileSync(path.join(assetsDir, `${record.name}.svg`), svgFile(record));
    else copyFileSync(path.join(rawDir, "icons", "dragncards", `${RASTER_ICONS.find((icon) => icon.name === record.name)?.file ?? record.name}.png`), path.join(assetsDir, `${record.name}.png`));
  }
  for (const back of backs) copyFileSync(backFile(rawDir, back.name), path.join(assetsDir, `${back.name}Back.jpg`));
  writeFileSync(path.join(modulesDir, "generated.ts"), renderData(records, backs));
  writeFileSync(path.join(modulesDir, "files.generated.ts"), renderFiles(records, backs));
  return records;
}
