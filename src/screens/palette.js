/**
 * Chrome colors for the Lamplight theme. See docs/design-system.md.
 * app.json splash and adaptive-icon backgrounds must match `paper`.
 * Backdrop gradient stops are scene art and live only in backdrop-scenes.ts; the gradients of a surface or a button are
 * built from these tokens in surfaces.ts.
 */
const palette = {
  // Night surfaces: the page, a panel's base and its lit top edge, the pressed fill, the rules between rows
  night: "#0B0A08",
  dusk: "#12110E",
  raised: "#1A1814",
  raisedTop: "#221F1A",
  pressed: "#2A2620",
  hairline: "#2C2923",
  // Text on night
  bone: "#EEE7D7",
  muted: "#A39B8C",
  faint: "#8A857C",
  danger: "#E8917B",
  // Gold: the Ring. The one primary action, the current step, what is selected.
  gold: "#D9B66C",
  goldHigh: "#F3DA9A",
  goldDeep: "#A9813F",
  goldLine: "#5E4C2C",
  onGold: "#1A1309",
  // Moonlight: section headings and quiet information, so gold stays for the one thing to do
  moon: "#9DB0CC",
  // A deck or a loadout that is ready to play
  ok: "#8FBF7A",
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
  threat: "#C8432F",
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
