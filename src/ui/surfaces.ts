// The Carved Stone surfaces (docs/design-system.md, Surfaces): floating panels lifted by shadow and a lit top edge rather than an outline,
// the quiet fills of a control (the wraith-light primary, the tonal secondary, the glass capsule, the tonal track of a field or a
// segmented switch and its lighter thumb, a chip's tint), the silver ring and wash of what is selected, parchment, and the fades that lay
// text over a picture. Each is a style object from the
// tokens: a fill for a platform that draws no gradient, the gradient over it (`backgroundImage`, which React Native draws natively and
// react-native-web hands to the browser), and its depth as a `boxShadow`. Colours come from the tokens (white for Light's lit edge
// and the parchment's burnt rim are the only literals); screens and the table both read these, so src/play keeps them. Each takes the tokens of the theme in force as its last parameter (useTableTokens, or the palette's
// twin) and draws Dark without it. Depth differs in kind between the themes: Dark lifts a panel with black shadow and a faint green
// haze, Light with a warm brown shade (`t.depth`).
import { fillAlpha, tableTokens, withAlphaHex, type TableTokens } from "./tokens.ts";

type Surface = { backgroundColor: string; backgroundImage?: string; filter?: string };
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
  const top = withAlphaHex(t.raisedTop, fillAlpha(t, isLight(t) ? 0.92 : 0.82));
  const foot = withAlphaHex(isLight(t) ? t.raised : t.dusk, fillAlpha(t, isLight(t) ? 0.95 : 0.92));
  return { backgroundColor: foot, backgroundImage: linear(`${top} 0%, ${foot} 100%`), boxShadow: panelDepthOf(t) };
}

/** The least alpha of a surface that floats over the dock's words (a popover, the menu, a reading panel, the carousel): the words under it do not show. */
export const FLOATING_ALPHA = 0.98;

/** The fill of a container that floats over the table (a popover, the menu, the night reading panel, the carousel): the panel's lit look, opaque. */
export function floatingSurface(t: TableTokens = dark): Lifted {
  const top = withAlphaHex(t.raisedTop, FLOATING_ALPHA);
  const foot = withAlphaHex(isLight(t) ? t.raised : t.dusk, FLOATING_ALPHA);
  return { backgroundColor: foot, backgroundImage: linear(`${top} 0%, ${foot} 100%`), boxShadow: panelDepthOf(t) };
}

/**
 * The banner's plain fill (docs/design-system-table.md, Banner), shared by the table menu and a discard pile's list (user request,
 * 2026-11-08): night on Dark, the pale `raisedTop` on Light, with no gradient and no lit edge, and a soft drop shadow. `alpha` is the
 * fill's share: the banner's 0.9, or FLOATING_ALPHA for a panel over the dock's words. Under Reduce Transparency it is opaque (fillAlpha).
 */
export function noticeSurface(alpha: number, t: TableTokens = dark): Lifted {
  if (isLight(t)) return { backgroundColor: withAlphaHex(t.raisedTop, fillAlpha(t, alpha)), boxShadow: `0 10px 28px ${shade(t, 0.35)}` };
  return { backgroundColor: withAlphaHex(t.night, fillAlpha(t, alpha)), boxShadow: `0 10px 28px ${shade(t, 0.7)}` };
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
  if (pressed) return { backgroundColor: withAlphaHex(t.pressed, fillAlpha(t, isLight(t) ? 0.9 : 0.85)) };
  return { backgroundColor: isLight(t) ? withAlphaHex(t.raisedTop, fillAlpha(t, 0.75)) : withAlphaHex(t.dusk, fillAlpha(t, 0.72)) };
}

export const rowDepthOf = (t: TableTokens = dark) => (isLight(t) ? `0 10px 24px ${shade(t, 0.2)}` : `0 14px 30px ${shade(t, 0.85)}`);

/** Bone over the ground at this share: the tonal fill of the secondary button, a chip and a field or segmented track. Bone is ink on Light. */
export const TONAL_ALPHA = 0.08;
/** The accent tint of a chip that is on (the glow on Dark, the accent on Light) over the ground at this share. */
export const TINT_ALPHA = 0.16;
/** A disabled button keeps its shape and takes this opacity; the sentence beside it says why. */
export const DISABLED_OPACITY = 0.35;
/** The shade of the capsule a held text button draws. */
export const PRESSED_SHADE_ALPHA = 0.22;

/** What a press does to a button's rest fill: it darkens about 8%, on Dark and Light alike. */
export const PRESSED_FILTER = "brightness(0.92)";
const darkened = (look: Surface, pressed: boolean): Surface => (pressed ? { ...look, filter: PRESSED_FILTER } : look);

/** The tonal fill: a control that sits on the ground without a plate of its own. Pressed it is the same fill, darkened. */
function tonalSurface(pressed: boolean, t: TableTokens): Surface {
  return darkened({ backgroundColor: withAlphaHex(t.bone, TONAL_ALPHA) }, pressed);
}

/** The tonal track of a search field, an input or a segmented switch: flat, with no inset shadow. */
export function sunkSurface(t: TableTokens = dark): Surface {
  return tonalSurface(false, t);
}

/** The selected segment in a track: a flat thumb lighter than the track (the raised fill on Dark, the lit paper on Light). Pressed, it darkens. */
export function segmentSurface(t: TableTokens = dark, pressed = false): Surface {
  return darkened({ backgroundColor: isLight(t) ? t.raisedTop : t.pressed }, pressed);
}

/** A segment that is not selected: the track shows through; pressed, it takes the tonal fill darkened. */
export function segmentRestSurface(pressed: boolean, t: TableTokens = dark): Surface {
  return pressed ? tonalSurface(true, t) : { backgroundColor: "transparent" };
}

/** The accent tint of a toggle chip that is on. */
export function chipOnSurface(t: TableTokens = dark, pressed = false): Surface {
  return darkened({ backgroundColor: withAlphaHex(isLight(t) ? t.accent : t.glow, TINT_ALPHA) }, pressed);
}

/** A filter chip or toggle: the tonal fill off, the accent tint on. */
export function chipSurface(on: boolean, pressed: boolean, t: TableTokens = dark): Surface {
  return on ? chipOnSurface(t, pressed) : tonalSurface(pressed, t);
}

/**
 * The one primary action: wraith-light silver on Dark (bright at the top, falling to a green-grey foot) and elven green on Light. A flat
 * soft vertical fill with no glow, lit edge, shadow or ring. Pressed, the press darkens it about 8% (the caller sinks it 1 pt).
 */
export function accentSurface(pressed = false, t: TableTokens = dark): Surface {
  const look = { backgroundColor: t.primaryMid, backgroundImage: linear(`${t.primaryTop} 0%, ${t.primaryMid} ${isLight(t) ? 55 : 50}%, ${t.accentDeep} 100%`) };
  return darkened(look, pressed);
}

/** The primary's plate: the accent surface. Its corners are the capsule's (CONTROL_RADIUS). */
export const accentPlate = accentSurface;

/** The secondary button and the icon plate: the tonal fill, with no shadow. */
export function slateSurface(pressed = false, t: TableTokens = dark): Surface {
  return tonalSurface(pressed, t);
}

/** The glass button (Back, the gear, the menu) and its capsule (History, Manage): a dark or a pale fill over whatever lies under it, with no shadow. */
export function glassSurface(pressed = false, t: TableTokens = dark): Surface {
  return darkened({ backgroundColor: withAlphaHex(isLight(t) ? t.raisedTop : t.dusk, fillAlpha(t, isLight(t) ? 0.7 : 0.62)) }, pressed);
}

/** A text button: no fill; while it is held, a capsule of shade (a darker patch of the ground, on Dark and Light alike). */
export function textSurface(pressed = false, t: TableTokens = dark): Surface {
  return { backgroundColor: pressed ? shade(t, PRESSED_SHADE_ALPHA) : "transparent" };
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
