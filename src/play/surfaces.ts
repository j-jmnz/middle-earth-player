// The Carved Stone surfaces (docs/design-system.md, Surfaces): floating panels lifted by shadow and a lit top edge rather than an outline,
// the wraith-light primary, the slate secondary plate, the round glass button, the sunk track of a field or a segmented switch, the
// silver ring and wash of what is selected, parchment, and the fades that lay text over a picture. Each is a style object from the
// tokens: a fill for a platform that draws no gradient, the gradient over it (`backgroundImage`, which React Native draws natively and
// react-native-web hands to the browser), and its depth as a `boxShadow`. Colours come from the tokens (white for Light's lit edge
// and the parchment's burnt rim are the only literals); screens and the table both read these, so src/play keeps them. Each takes the tokens of the theme in force as its last parameter (useTableTokens, or the palette's
// twin) and draws Dark without it. Depth differs in kind between the themes: Dark lifts a panel with black shadow and a faint green
// haze, Light with a warm brown shade (`t.depth`).
import { tableTokens, withAlphaHex, type TableTokens } from "./tokens.ts";

type Surface = { backgroundColor: string; backgroundImage?: string };
type Lifted = Surface & { boxShadow: string };

const dark: TableTokens = tableTokens;

const linear = (stops: string, angle = 180) => `linear-gradient(${angle}deg, ${stops})`;
const isLight = (t: TableTokens) => t.depth === "light";
const shade = (t: TableTokens, alpha: number) => withAlphaHex(t.shade, alpha);

/** The 1 pt lit top edge of a raised surface, drawn as an inset shadow so it costs no extra view. */
export const raisedEdgeOf = (t: TableTokens = dark) => (isLight(t) ? "inset 0 1px 0 #FFFFFF" : `inset 0 1px 0 ${withAlphaHex(t.accentHigh, 0.16)}`);

/** A drop shadow `y` down and `blur` soft under a card, a coin or a stepper: black at `alpha` on Dark, the warm shade at a third of it on Light. */
export const dropShadowOf = (t: TableTokens, y: number, blur: number, alpha: number) => `0 ${y}px ${blur}px ${shade(t, isLight(t) ? alpha / 3 : alpha)}`;

/**
 * The depth of a picture lapping over the one before it (the Campaigns fellowship): a hard dark edge along its left side and a soft
 * shadow cast leftward onto the picture under it, with the drop under both.
 */
export function lapShadowOf(t: TableTokens = dark): string {
  const light = isLight(t);
  return `-2px 0 0 ${shade(t, light ? 0.45 : 1)}, -12px 0 18px ${shade(t, light ? 0.4 : 1)}, -4px 0 6px ${shade(t, light ? 0.35 : 0.9)}, ${dropShadowOf(t, 10, 22, 0.8)}`;
}

/** The depth under a floating panel: the lit edge, a hard 1 pt foot, a long soft shadow, and on Dark a faint green haze. */
export function panelDepthOf(t: TableTokens = dark): string {
  if (isLight(t)) return `${raisedEdgeOf(t)}, 0 1px 0 ${shade(t, 0.15)}, 0 22px 44px ${shade(t, 0.3)}`;
  return `${raisedEdgeOf(t)}, 0 2px 0 ${t.shade}, 0 24px 50px ${shade(t, 0.95)}, 0 0 80px ${withAlphaHex(t.accentDeep, 0.14)}`;
}

/**
 * A floating panel at rest (the Continue card, the path's and the briefing's panels, the table's action panel, a stat tile): lit at the
 * top, falling to the foot, slightly see-through so the fog reads behind it. `pressed` is the flat pressed fill.
 */
export function panelSurface(pressed = false, t: TableTokens = dark): Lifted {
  if (pressed) return { backgroundColor: t.pressed, boxShadow: panelDepthOf(t) };
  const top = withAlphaHex(t.raisedTop, isLight(t) ? 0.92 : 0.82);
  const foot = withAlphaHex(isLight(t) ? t.raised : t.dusk, isLight(t) ? 0.95 : 0.92);
  return { backgroundColor: foot, backgroundImage: linear(`${top} 0%, ${foot} 100%`), boxShadow: panelDepthOf(t) };
}

/** A tile that stands for a row or a stat: the panel's look with a shorter shadow, so a grid of them does not darken the page. */
export function tileSurface(pressed = false, t: TableTokens = dark): Lifted {
  const look = panelSurface(pressed, t);
  return { ...look, boxShadow: isLight(t) ? `${raisedEdgeOf(t)}, 0 10px 24px ${shade(t, 0.2)}` : `${raisedEdgeOf(t)}, 0 14px 30px ${shade(t, 0.85)}` };
}

/**
 * A list row or a light tile: a dark wash with no edge (rows are told apart by the space between them). The shadow is separate
 * (`rowDepthOf`), because a row in a FlashList casts none (docs/design-system.md, Performance).
 */
export function rowSurface(pressed = false, t: TableTokens = dark): Surface {
  if (pressed) return { backgroundColor: withAlphaHex(t.pressed, isLight(t) ? 0.9 : 0.85) };
  return { backgroundColor: isLight(t) ? withAlphaHex(t.raisedTop, 0.75) : withAlphaHex(t.dusk, 0.72) };
}

export const rowDepthOf = (t: TableTokens = dark) => (isLight(t) ? `0 10px 24px ${shade(t, 0.2)}` : `0 14px 30px ${shade(t, 0.85)}`);

/** The sunk track of a search field, an input or a segmented switch. */
export function sunkSurface(t: TableTokens = dark): Lifted {
  if (isLight(t)) return { backgroundColor: withAlphaHex(t.raisedTop, 0.8), boxShadow: `inset 0 1px 3px ${shade(t, 0.25)}` };
  return { backgroundColor: withAlphaHex(t.night, 0.82), boxShadow: `inset 0 1px 3px ${shade(t, 0.9)}` };
}

/** The selected segment in a sunk track: a small plate lit from above. */
export function segmentSurface(t: TableTokens = dark): Lifted {
  if (isLight(t)) return { backgroundColor: t.raised, backgroundImage: linear(`#FFFFFF 0%, ${t.raised} 100%`), boxShadow: `0 2px 6px ${shade(t, 0.25)}` };
  return { backgroundColor: t.raised, backgroundImage: linear(`${t.pressed} 0%, ${t.raised} 100%`), boxShadow: `0 2px 6px ${t.shade}` };
}

/**
 * The one primary action: wraith-light silver on Dark (bright at the top, falling to a green-grey foot) and elven green on Light.
 * Pressed, the press darkens it about 8% (the caller sinks it 1 pt), so the gradient is kept.
 */
export function accentSurface(pressed = false, t: TableTokens = dark): Surface & { filter?: string } {
  const look = { backgroundColor: t.primaryMid, backgroundImage: linear(`${t.primaryTop} 0%, ${t.primaryMid} ${isLight(t) ? 55 : 50}%, ${t.accentDeep} 100%`) };
  return pressed ? { ...look, filter: "brightness(0.92)" } : look;
}

/** The glow under the one primary action, and under a picked tile. */
export const accentGlowOf = (t: TableTokens = dark) => (isLight(t) ? `0 8px 18px ${shade(t, 0.35)}` : `0 8px 18px ${shade(t, 0.8)}, 0 0 28px ${withAlphaHex(t.glow, 0.22)}`);
/** The primary's lit top and dark foot, as inset shadows. */
export const accentEdgeOf = (t: TableTokens = dark) => (isLight(t) ? "inset 0 1px 0 rgba(255,255,255,0.25)" : `inset 0 1px 0 #FFFFFF, inset 0 -2px 0 ${shade(t, 0.25)}, 0 0 0 1px ${t.night}`);

/** The primary's plate: the accent surface with its lit edges and, at rest and pressed alike, its shadow and glow. Square corners. */
export function accentPlate(pressed = false, t: TableTokens = dark): Surface & { boxShadow: string; filter?: string } {
  return { ...accentSurface(pressed, t), boxShadow: `${accentEdgeOf(t)}, ${accentGlowOf(t)}` };
}

/** A secondary button, an icon plate, a filled chip at rest: slate lit from above with a short shadow. */
export function slateSurface(pressed = false, t: TableTokens = dark): Lifted {
  const depth = isLight(t) ? `${raisedEdgeOf(t)}, 0 6px 14px ${shade(t, 0.22)}` : `inset 0 1px 0 ${withAlphaHex(t.accentHigh, 0.1)}, 0 6px 14px ${shade(t, 0.8)}`;
  if (pressed) return { backgroundColor: t.pressed, boxShadow: depth };
  return { backgroundColor: t.raised, backgroundImage: linear(`${t.raisedTop} 0%, ${isLight(t) ? t.dusk : t.raised} 100%`), boxShadow: depth };
}

/** The round glass button (Back, the gear, the menu): a dark or a pale disc over whatever lies under it, with a soft shadow. */
export function glassSurface(pressed = false, t: TableTokens = dark): Lifted {
  if (isLight(t)) return { backgroundColor: pressed ? t.pressed : withAlphaHex(t.raisedTop, 0.7), boxShadow: `0 6px 16px ${shade(t, 0.25)}` };
  return { backgroundColor: pressed ? t.pressed : withAlphaHex(t.dusk, 0.62), boxShadow: `0 6px 16px ${t.shade}` };
}

/** The silver ring and glow of the selected item (a tile, a card, a cover), as a shadow so it moves nothing. */
export function selectedRingOf(t: TableTokens = dark, width = 2): string {
  if (isLight(t)) return `0 0 0 ${width}px ${t.accent}, 0 0 24px ${withAlphaHex(t.accent, 0.3)}`;
  return `0 0 0 ${width}px ${t.accentHigh}, 0 0 28px ${withAlphaHex(t.glow, 0.45)}`;
}

/** The wash behind a selected row; the caller draws a 2 pt accentHigh bar at its leading edge. */
export function selectedWash(t: TableTokens = dark): Surface {
  const tint = isLight(t) ? t.accent : t.glow;
  return { backgroundColor: withAlphaHex(tint, 0.1), backgroundImage: linear(`${withAlphaHex(tint, 0.16)} 0%, ${withAlphaHex(tint, 0.05)} 100%`, 90) };
}

/** Weathered parchment (the campaign log, the table's paper sheets): the same on both themes, lit in the middle and dark at the rim. */
export function parchmentSurface(t: TableTokens = dark): Lifted {
  return {
    backgroundColor: t.paper,
    backgroundImage: `radial-gradient(120% 90% at 50% 40%, ${t.paper} 0%, ${t.paperPressed} 70%, ${t.paperEdge} 100%)`,
    boxShadow: isLight(t) ? `inset 0 0 44px rgba(80,55,25,0.38), 0 2px 0 ${shade(t, 0.3)}, 0 30px 60px ${shade(t, 0.45)}` : `inset 0 0 44px rgba(80,55,25,0.45), 0 2px 0 ${t.shade}, 0 32px 64px ${t.shade}`,
  };
}

/** Night rising over a picture from `from` (a fraction of the height) to solid at `to`, so words can sit on it. */
export function nightFade(from: number, to: number, base?: string, t: TableTokens = dark): Surface {
  const edge = base ?? t.night;
  const at = (value: number) => `${Math.round(value * 100)}%`;
  return { backgroundColor: "transparent", backgroundImage: linear(`${withAlphaHex(edge, 0)} ${at(from)}, ${withAlphaHex(edge, 0.72)} ${at((from + to) / 2)}, ${edge} ${at(to)}`) };
}

/** A soft night at the top of a picture, so a back button and a status bar read over a bright sky. */
export function topShade(to = 0.3, t: TableTokens = dark): Surface {
  return { backgroundColor: "transparent", backgroundImage: linear(`${withAlphaHex(t.night, 0.55)} 0%, ${withAlphaHex(t.night, 0)} ${Math.round(to * 100)}%`) };
}
