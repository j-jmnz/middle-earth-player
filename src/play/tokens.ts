// The Night tokens the table canvas draws with, copied from src/screens/palette.js (docs/design-system.md: src/play cannot
// import src/screens). src/screens/play-tokens.test.ts fails when a value here drifts from the palette.
export const tableTokens = {
  night: "#0A0B0E",
  raised: "#16181D",
  hairline: "#24262B",
  bone: "#F1EADB",
  muted: "#A39C8E",
  faint: "#8A857C",
  gold: "#D9B86C",
  goldLine: "#5E5032",
  onGold: "#1A140A",
  pressed: "#1E2026",
  paper: "#F2EBDB",
  paperPressed: "#E5DBC4",
  ink: "#221E17",
  inkMuted: "#6E6250",
  inkLabel: "#7A5C22",
  inkLine: "#CFC3A6",
  goldDeep: "#B8924A",
  felt: "#121613",
  feltLight: "#1F2620",
  threat: "#B9483A",
  danger: "#E39A80",
  leadership: "#B06098",
  tactics: "#E03848",
  lore: "#62B02A",
  spirit: "#54A8C0",
  fellowship: "#C9A961",
} as const;

export type TableToken = keyof typeof tableTokens;
