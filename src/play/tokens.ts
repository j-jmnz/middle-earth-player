// The Lamplight tokens the table canvas draws with, copied from src/screens/palette.js (docs/design-system.md: src/play cannot
// import src/screens). src/screens/play-tokens.test.ts fails when a value here drifts from the palette.
export const tableTokens = {
  night: "#07080B",
  dusk: "#0F1116",
  raised: "#14171D",
  hairline: "#24272F",
  bone: "#EEE7D7",
  muted: "#A39B8C",
  faint: "#8A857C",
  gold: "#D9B66C",
  goldHigh: "#F3DA9A",
  goldLine: "#5E4C2C",
  onGold: "#1A1309",
  pressed: "#1E222B",
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
  leadership: "#B06098",
  tactics: "#E03848",
  lore: "#62B02A",
  spirit: "#54A8C0",
  fellowship: "#C9A961",
  raisedTop: "#1A1E26",
  moon: "#9DB0CC",
  ok: "#8FBF7A",
} as const;

export type TableToken = keyof typeof tableTokens;

/** A token at some opacity, so the palette drift test covers tints too (`#RRGGBB` in, `rgba(...)` out). */
export function withAlphaHex(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}
