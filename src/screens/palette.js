/**
 * Chrome colors for the Lamplight theme (Dark, the default) and its Daylight twin (user request, 2026-10-28). See docs/design-system.md.
 * app.json splash and adaptive-icon backgrounds must match `paper`.
 * Backdrop gradient stops are scene art and live only in backdrop-scenes.ts; the gradients of a surface or a button are
 * built from these tokens in surfaces.ts.
 * Both palettes have the same keys, and a key is a role, not a hue: `night` is the page and `bone` is the main text in either one.
 * `palette` is Dark, for the code that runs at build time; the screens read the active one through usePalette (palette-hook.ts).
 */
const dark = {
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
  onThreat: "#EEE7D7",
  threatEdge: "#E8917B",
  glow: "#D9B66C",
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

// Daylight: warm parchment surfaces, dark ink for text, a deepened gold so gold text keeps 4.5:1 on them (contrast.test.ts). Gold is also
// the fill of the one primary action, and dark text cannot sit on a gold dark enough to read on parchment, so onGold turns cream here:
// the button is worked bronze with cream words. Paper, ink, encounter, sphere and threat colors are the same in both.
const light = {
  // Night surfaces: the page, a panel's base and its lit top edge, the pressed fill, the rules between rows
  night: "#E8DFCA",
  dusk: "#EEE6D3",
  raised: "#F5EFE0",
  raisedTop: "#FAF6EA",
  pressed: "#DDD2BB",
  hairline: "#CFC3A6",
  // Text on night
  bone: "#221E17",
  muted: "#554B3B",
  faint: "#655A47",
  danger: "#9C3521",
  // Gold: the Ring. The one primary action, the current step, what is selected.
  gold: "#6F5114",
  goldHigh: "#7C5B17",
  goldDeep: "#54400F",
  goldLine: "#8F7637",
  onGold: "#FBF5E4",
  // Moonlight: section headings and quiet information, so gold stays for the one thing to do
  moon: "#3F5A82",
  // A deck or a loadout that is ready to play
  ok: "#3E6B2C",
  // Parchment: splash, log, choice sheets
  paper: "#F2EBDB",
  paperPressed: "#E5DBC4",
  paperEdge: "#D6C9AB",
  ink: "#221E17",
  inkMuted: "#6E6250",
  inkLabel: "#7A5C22",
  inkLine: "#CFC3A6",
  // Table felt (Skia clear color and vignette)
  felt: "#DDD4BF",
  feltLight: "#E9E1CE",
  // Encounter marks
  threat: "#C8432F",
  onThreat: "#FFF9E8",
  threatEdge: "#7A2616",
  glow: "#FBF5E4",
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
