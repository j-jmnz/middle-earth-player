/**
 * Chrome colors for Carved Stone (docs/design-system.md): Ringwraiths, the Dark default, and its Light twin Rivendell (user request,
 * 2026-10-29, the Carved Stone handoff). app.json splash and adaptive-icon backgrounds must match `paper`.
 * Backdrop fog and grit are scene art and live only in backdrop-scenes.ts; the gradients of a surface or a button are built from these
 * tokens in surfaces.ts.
 * Both palettes have the same keys, and a key is a role, not a hue: `night` is the page and `bone` is the main text in either one.
 * `palette` is Dark, for the code that runs at build time; the screens read the active one through usePalette (palette-hook.ts).
 */
const dark = {
  // The ground and the floating surfaces: the page, a panel's foot, its base and its lit top, the pressed fill, the dashed rules
  night: "#030405",
  dusk: "#0C0E11",
  raised: "#111417",
  raisedTop: "#1E2328",
  pressed: "#2A3036",
  hairline: "#2A3036",
  // Text on the ground; faint is the floor for words on fog
  bone: "#EEF2EC",
  muted: "#A6ADB5",
  faint: "#8D949B",
  danger: "#E8917B",
  // Wraith-light: the one primary action, the current step, what is selected
  accent: "#C4D3C0",
  accentHigh: "#D8E6D2",
  accentDeep: "#6C7F69",
  accentLine: "#5A6E5C",
  onAccent: "#0C1014",
  // A section's name, so the accent stays for the one thing to do
  moon: "#8FA894",
  // A deck or a loadout that is ready to play, a won scenario
  ok: "#8FBF7A",
  // Parchment: splash, log, choice sheets
  paper: "#E6DCC6",
  paperPressed: "#D2C4A6",
  paperEdge: "#A8977A",
  ink: "#221E17",
  inkMuted: "#5C4F3D",
  inkLabel: "#6B4E1C",
  inkLine: "#4A3A24",
  // The table's ground (Skia clear color) and its lit middle
  felt: "#030405",
  feltLight: "#0C0F12",
  // The enemy: threat red as a fill, its deep foot, the text on it
  threat: "#D35537",
  onThreat: "#FBD9CC",
  threatEdge: "#7A2214",
  glow: "#BED6BA",
  treachery: "#3A221C",
  quest: "#4D545B",
  location: "#4D3A2D",
  objective: "#A68448",
  // Sphere pips, sampled from the printed icons
  leadership: "#B06098",
  tactics: "#E03848",
  lore: "#62B02A",
  spirit: "#54A8C0",
  fellowship: "#C9A961",
};

// Rivendell: warm stone and parchment surfaces, dark ink for text, elven green for the accent with cream words on it, amber section
// names, and the spheres darkened so a mark keeps its contrast on the light ground. Paper and ink are the same in both.
const light = {
  night: "#E4DCCB",
  dusk: "#EBE3D0",
  raised: "#F2ECDE",
  raisedTop: "#FDFAF2",
  pressed: "#DED4BF",
  hairline: "#CFC3A8",
  bone: "#1A1D17",
  muted: "#46473B",
  faint: "#5E5D52",
  danger: "#9A3220",
  accent: "#3E5A48",
  accentHigh: "#2C4636",
  accentDeep: "#18271F",
  accentLine: "#637A69",
  onAccent: "#F7F1E3",
  moon: "#725219",
  ok: "#3B6B2C",
  paper: "#E6DCC6",
  paperPressed: "#D2C4A6",
  paperEdge: "#A8977A",
  ink: "#221E17",
  inkMuted: "#5C4F3D",
  inkLabel: "#6B4E1C",
  inkLine: "#4A3A24",
  felt: "#E4DCCB",
  feltLight: "#F2EBDC",
  threat: "#B8432C",
  onThreat: "#FFF4EC",
  threatEdge: "#8F2A17",
  glow: "#FFFFFF",
  treachery: "#3A221C",
  quest: "#4D545B",
  location: "#4D3A2D",
  objective: "#A68448",
  leadership: "#9A4A82",
  tactics: "#B82A38",
  lore: "#4A8A1C",
  spirit: "#2F7F96",
  fellowship: "#8F7434",
};

const palettes = { dark, light };
const palette = dark;

/** "#RRGGBB" as the "r g b" channels a CSS variable holds, so `rgb(var(--night) / <alpha-value>)` takes an opacity. */
function channels(hex) {
  const value = parseInt(hex.slice(1), 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}

/** The CSS variables of one theme, { "--night": "11 10 8", ... }: NativeWind `vars()` in the root layout, and the :root block of global.css for Dark. */
function themeVars(name) {
  const vars = {};
  for (const [token, hex] of Object.entries(palettes[name])) vars[`--${token}`] = channels(hex);
  return vars;
}

/** Tailwind colors: every palette key, read from its variable, so one class paints both themes. */
function themeColors() {
  const colors = {};
  for (const token of Object.keys(dark)) colors[token] = `rgb(var(--${token}) / <alpha-value>)`;
  return colors;
}

module.exports = { palette, palettes, themeVars, themeColors };
