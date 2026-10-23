/**
 * Chrome colors for the Night theme. See docs/design-system.md.
 * app.json splash and adaptive-icon backgrounds must match `paper`.
 * Backdrop gradient stops are scene art and live only in backdrop-scenes.ts.
 */
const palette = {
  // Night surfaces
  night: "#0A0B0E",
  dusk: "#14171D",
  raised: "#16181D",
  pressed: "#1E2026",
  hairline: "#24262B",
  // Text on night
  bone: "#F1EADB",
  muted: "#A39C8E",
  faint: "#8A857C",
  danger: "#E39A80",
  // Gold: the Ring. Current, primary, focus.
  gold: "#D9B86C",
  goldHigh: "#EBD08E",
  goldDeep: "#B8924A",
  goldLine: "#5E5032",
  onGold: "#1A140A",
  // Parchment: splash, log, choice sheets
  paper: "#F2EBDB",
  paperPressed: "#E5DBC4",
  paperEdge: "#D6C9AB",
  ink: "#221E17",
  inkMuted: "#6E6250",
  inkLabel: "#7A5C22",
  inkLine: "#CFC3A6",
  // Table felt (Skia clear color and vignette)
  felt: "#121613",
  feltLight: "#1F2620",
  // Encounter marks
  threat: "#B9483A",
  treachery: "#3A221C",
  quest: "#8F877E",
  location: "#7A5840",
  objective: "#A68448",
  // Sphere pips, sampled from the printed icons
  leadership: "#B06098",
  tactics: "#E03848",
  lore: "#62B02A",
  spirit: "#54A8C0",
  fellowship: "#C9A961",
};

module.exports = { palette };
