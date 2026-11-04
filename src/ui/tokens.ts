// The tokens the table canvas draws with, copied from src/screens/kit/palette.js (docs/design-system.md: src/play cannot import
// src/screens): Ringwraiths (Dark) and Rivendell (Light; the Carved Stone handoff, 2026-10-29). src/screens/kit/play-tokens.test.ts fails when a value
// here drifts from its palette. `tableTokens` is Dark, for the code that is not theme-aware yet; useTableTokens picks the theme's.
export const tableTokens = {
  night: "#030405",
  dusk: "#0C0E11",
  raised: "#111417",
  hairline: "#2A3036",
  bone: "#EEF2EC",
  muted: "#A6ADB5",
  faint: "#8D949B",
  accent: "#C4D3C0",
  accentHigh: "#D8E6D2",
  accentLine: "#5A6E5C",
  onAccent: "#0C1014",
  pressed: "#2A3036",
  paper: "#E6DCC6",
  paperPressed: "#D2C4A6",
  paperEdge: "#A8977A",
  ink: "#221E17",
  inkMuted: "#5C4F3D",
  inkLabel: "#6B4E1C",
  inkLine: "#4A3A24",
  accentDeep: "#6C7F69",
  felt: "#030405",
  feltLight: "#0C0F12",
  threat: "#D35537",
  danger: "#E8917B",
  onThreat: "#FBD9CC",
  threatEdge: "#7A2214",
  glow: "#BED6BA",
  leadership: "#B06098",
  tactics: "#E03848",
  lore: "#62B02A",
  spirit: "#54A8C0",
  fellowship: "#C9A961",
  raisedTop: "#1E2328",
  moon: "#8FA894",
  ok: "#8FBF7A",
  // The lit top edge of a raised surface (surfaces.ts): bone on Dark, paper on Light, where bone is ink. Not a palette key.
  lit: "#EEF2EC",
  // Not palette keys either: how surfaces.ts builds depth, which differs in kind between the themes (a dark ground lifts a panel with
  // black shadow and a green haze, a light one with a warm brown shade), and the primary's lit top and middle (its foot is accentDeep).
  depth: "dark",
  shade: "#000000",
  primaryTop: "#EEF5EA",
  primaryMid: "#B2C3AD",
  // Not a palette key: the victory pile's gold coin, under ink numbers (canvas/pieces.native.tsx). Light's is paler than its bronze
  // fellowship, so the ink number keeps 4.5:1 (5.9:1 here, 7.4:1 on Dark).
  coin: "#C9A961",
} as const;

export type TableToken = keyof typeof tableTokens;
export type TableTokens = { readonly [Token in TableToken]: string };

const lightTableTokens: TableTokens = {
  night: "#E4DCCB",
  dusk: "#EBE3D0",
  raised: "#F2ECDE",
  hairline: "#CFC3A8",
  bone: "#1A1D17",
  muted: "#46473B",
  faint: "#5E5D52",
  accent: "#3E5A48",
  accentHigh: "#2C4636",
  accentLine: "#637A69",
  onAccent: "#F7F1E3",
  pressed: "#DED4BF",
  paper: "#E6DCC6",
  paperPressed: "#D2C4A6",
  paperEdge: "#A8977A",
  ink: "#221E17",
  inkMuted: "#5C4F3D",
  inkLabel: "#6B4E1C",
  inkLine: "#4A3A24",
  accentDeep: "#18271F",
  felt: "#E4DCCB",
  feltLight: "#F2EBDC",
  threat: "#B8432C",
  danger: "#9A3220",
  onThreat: "#FFF4EC",
  threatEdge: "#8F2A17",
  glow: "#FFFFFF",
  leadership: "#9A4A82",
  tactics: "#B82A38",
  lore: "#4A8A1C",
  spirit: "#2F7F96",
  fellowship: "#8F7434",
  raisedTop: "#FDFAF2",
  moon: "#725219",
  ok: "#3B6B2C",
  lit: "#E6DCC6",
  depth: "light",
  shade: "#3C3228",
  primaryTop: "#3F5A4B",
  primaryMid: "#253A2F",
  coin: "#B8964E",
};

export const tableTokensByTheme: { readonly dark: TableTokens; readonly light: TableTokens } = { dark: tableTokens, light: lightTableTokens };

/** A token at some opacity, so the palette drift test covers tints too (`#RRGGBB` in, `rgba(...)` out). */
export function withAlphaHex(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}
