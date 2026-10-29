export type ThemeName = "dark" | "light";

export const palette: {
  readonly night: "#030405";
  readonly dusk: "#0C0E11";
  readonly raised: "#111417";
  readonly raisedTop: "#1E2328";
  readonly pressed: "#2A3036";
  readonly hairline: "#2A3036";
  readonly bone: "#EEF2EC";
  readonly muted: "#A6ADB5";
  readonly faint: "#8D949B";
  readonly danger: "#E8917B";
  readonly accent: "#C4D3C0";
  readonly accentHigh: "#D8E6D2";
  readonly accentDeep: "#6C7F69";
  readonly accentLine: "#5A6E5C";
  readonly onAccent: "#0C1014";
  readonly moon: "#8FA894";
  readonly ok: "#8FBF7A";
  readonly paper: "#E6DCC6";
  readonly paperPressed: "#D2C4A6";
  readonly paperEdge: "#A8977A";
  readonly ink: "#221E17";
  readonly inkMuted: "#5C4F3D";
  readonly inkLabel: "#6B4E1C";
  readonly inkLine: "#4A3A24";
  readonly felt: "#030405";
  readonly feltLight: "#0C0F12";
  readonly threat: "#D35537";
  readonly onThreat: "#FBD9CC";
  readonly threatEdge: "#7A2214";
  readonly glow: "#BED6BA";
  readonly treachery: "#3A221C";
  readonly quest: "#4D545B";
  readonly location: "#4D3A2D";
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
