export type ThemeName = "dark" | "light";

export const palette: {
  readonly night: "#0B0A08";
  readonly dusk: "#12110E";
  readonly raised: "#1A1814";
  readonly raisedTop: "#221F1A";
  readonly pressed: "#2A2620";
  readonly hairline: "#2C2923";
  readonly bone: "#EEE7D7";
  readonly muted: "#A39B8C";
  readonly faint: "#8A857C";
  readonly danger: "#E8917B";
  readonly accent: "#D9B66C";
  readonly accentHigh: "#F3DA9A";
  readonly accentDeep: "#A9813F";
  readonly accentLine: "#5E4C2C";
  readonly onAccent: "#1A1309";
  readonly moon: "#9DB0CC";
  readonly ok: "#8FBF7A";
  readonly paper: "#F2EBDB";
  readonly paperPressed: "#E5DBC4";
  readonly paperEdge: "#D6C9AB";
  readonly ink: "#221E17";
  readonly inkMuted: "#6E6250";
  readonly inkLabel: "#7A5C22";
  readonly inkLine: "#CFC3A6";
  readonly felt: "#121613";
  readonly feltLight: "#1F2620";
  readonly threat: "#C8432F";
  readonly onThreat: "#EEE7D7";
  readonly threatEdge: "#E8917B";
  readonly glow: "#D9B66C";
  readonly treachery: "#3A221C";
  readonly quest: "#8F877E";
  readonly location: "#7A5840";
  readonly objective: "#A68448";
  readonly leadership: "#B06098";
  readonly tactics: "#E03848";
  readonly lore: "#62B02A";
  readonly spirit: "#54A8C0";
  readonly fellowship: "#C9A961";
};

/** Every token as a plain string, so the Daylight palette and the Dark one share one type. */
export type Palette = { readonly [Token in keyof typeof palette]: string };
export const palettes: { readonly dark: Palette; readonly light: Palette };
/** One theme's CSS variables, { "--night": "11 10 8", ... }. */
export function themeVars(name: ThemeName): Record<string, string>;
/** Tailwind colors for every token: `rgb(var(--token) / <alpha-value>)`. */
export function themeColors(): Record<keyof Palette, string>;
