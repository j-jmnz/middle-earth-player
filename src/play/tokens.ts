// The tokens the table canvas draws with, copied from src/screens/palette.js (docs/design-system.md: src/play cannot import
// src/screens): Lamplight (Dark) and Daylight (Light; user request, 2026-10-28). src/screens/play-tokens.test.ts fails when a value
// here drifts from its palette. `tableTokens` is Dark, for the code that is not theme-aware yet; useTableTokens picks the theme's.
export const tableTokens = {
  night: "#0B0A08",
  dusk: "#12110E",
  raised: "#1A1814",
  hairline: "#2C2923",
  bone: "#EEE7D7",
  muted: "#A39B8C",
  faint: "#8A857C",
  gold: "#D9B66C",
  goldHigh: "#F3DA9A",
  goldLine: "#5E4C2C",
  onGold: "#1A1309",
  pressed: "#2A2620",
  paper: "#F2EBDB",
  paperPressed: "#E5DBC4",
  ink: "#221E17",
  inkMuted: "#6E6250",
  inkLabel: "#7A5C22",
  inkLine: "#CFC3A6",
  goldDeep: "#A9813F",
  felt: "#121613",
  feltLight: "#1F2620",
  threat: "#C8432F",
  danger: "#E8917B",
  onThreat: "#EEE7D7",
  threatEdge: "#E8917B",
  glow: "#D9B66C",
  leadership: "#B06098",
  tactics: "#E03848",
  lore: "#62B02A",
  spirit: "#54A8C0",
  fellowship: "#C9A961",
  raisedTop: "#221F1A",
  moon: "#9DB0CC",
  ok: "#8FBF7A",
  // The lit top edge of a raised surface (surfaces.ts): bone on Night, paper on Daylight, where bone is ink. Not a palette key.
  lit: "#EEE7D7",
} as const;

export type TableToken = keyof typeof tableTokens;
export type TableTokens = { readonly [Token in TableToken]: string };

const lightTableTokens: TableTokens = {
  night: "#E8DFCA",
  dusk: "#EEE6D3",
  raised: "#F5EFE0",
  hairline: "#CFC3A6",
  bone: "#221E17",
  muted: "#554B3B",
  faint: "#655A47",
  gold: "#6F5114",
  goldHigh: "#7C5B17",
  goldLine: "#8F7637",
  onGold: "#FBF5E4",
  pressed: "#DDD2BB",
  paper: "#F2EBDB",
  paperPressed: "#E5DBC4",
  ink: "#221E17",
  inkMuted: "#6E6250",
  inkLabel: "#7A5C22",
  inkLine: "#CFC3A6",
  goldDeep: "#54400F",
  felt: "#DDD4BF",
  feltLight: "#E9E1CE",
  threat: "#C8432F",
  danger: "#9C3521",
  onThreat: "#FFF9E8",
  threatEdge: "#7A2616",
  glow: "#FBF5E4",
  leadership: "#B06098",
  tactics: "#E03848",
  lore: "#62B02A",
  spirit: "#54A8C0",
  fellowship: "#C9A961",
  raisedTop: "#FAF6EA",
  moon: "#3F5A82",
  ok: "#3E6B2C",
  lit: "#F2EBDB",
};

export const tableTokensByTheme: { readonly dark: TableTokens; readonly light: TableTokens } = { dark: tableTokens, light: lightTableTokens };

/** A token at some opacity, so the palette drift test covers tints too (`#RRGGBB` in, `rgba(...)` out). */
export function withAlphaHex(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}
