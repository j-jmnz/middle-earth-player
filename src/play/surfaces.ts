// The Lamplight surfaces (docs/design-system.md, Surfaces): a panel lit from above, the accent of the one primary action, the slate of
// the other buttons, and the fades that lay text over a picture. Each is a style object from the tokens: a solid fill for a
// platform that draws no gradient, and the gradient over it (`backgroundImage`, which React Native draws natively and
// react-native-web hands to the browser). No hex is written here; screens and the table both read these, so src/play keeps them.
// Each takes the tokens of the theme in force as its last parameter (useTableTokens, or the palette's twin) and draws Dark without it
// (user request, 2026-10-28).
import { tableTokens, withAlphaHex, type TableTokens } from "./tokens.ts";

type Surface = { backgroundColor: string; backgroundImage?: string };

const dark: TableTokens = tableTokens;

const linear = (stops: string) => `linear-gradient(180deg, ${stops})`;

/** A panel or a card at rest: lit at the top edge, falling to the raised night. `pressed` is the flat pressed fill. */
export function panelSurface(pressed = false, t: TableTokens = dark): Surface {
  if (pressed) return { backgroundColor: t.pressed };
  return { backgroundColor: t.raised, backgroundImage: linear(`${t.raisedTop} 0%, ${t.raised} 55%, ${t.dusk} 100%`) };
}

/** The one primary action: worked accent, bright at the top and deep at the foot. Pressed, it is the flat deep accent. */
export function accentSurface(pressed = false, t: TableTokens = dark): Surface {
  if (pressed) return { backgroundColor: t.accentDeep };
  return { backgroundColor: t.accent, backgroundImage: linear(`${t.accentHigh} 0%, ${t.accent} 48%, ${t.accentDeep} 100%`) };
}

/** A secondary button, a selected segment, a filled chip at rest: slate lit from above. */
export function slateSurface(pressed = false, t: TableTokens = dark): Surface {
  if (pressed) return { backgroundColor: t.pressed };
  return { backgroundColor: t.raised, backgroundImage: linear(`${t.pressed} 0%, ${t.raised} 100%`) };
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

/** The glow under the one primary action, and under a picked tile. */
export const accentGlowOf = (t: TableTokens = dark) => `0 6px 20px ${withAlphaHex(t.accent, 0.22)}`;
/** The lit top edge of a raised surface, and its dark foot, drawn as inset shadows so they cost no extra view. */
export const raisedEdgeOf = (t: TableTokens = dark) => `inset 0 1px 0 ${withAlphaHex(t.lit, 0.06)}`;
export const accentEdgeOf = (t: TableTokens = dark) => `inset 0 1px 0 ${withAlphaHex(t.lit, 0.5)}, inset 0 -2px 0 ${withAlphaHex(t.night, 0.18)}`;

/** The primary's plate: worked accent with an accentDeep edge, a lit top and foot, and at rest a soft glow under it. */
export function accentPlate(pressed = false, t: TableTokens = dark): Surface & { borderWidth: number; borderColor: string; boxShadow: string } {
  const edge = accentEdgeOf(t);
  return { ...accentSurface(pressed, t), borderWidth: 1, borderColor: t.accentDeep, boxShadow: pressed ? edge : `${edge}, ${accentGlowOf(t)}` };
}

/**
 * A lit tile: a stat tile, a card standing for a row (a save, a scenario, a book), a panel's plate. No drawn edge: the fill and the
 * lit top set it off the night (user request, 2026-10-27: fewer borders). The 1 pt edge is kept transparent, so a selected tile
 * that draws its accent edge over it does not move.
 */
export function tileSurface(pressed = false, t: TableTokens = dark): Surface & { borderWidth: number; borderColor: string; boxShadow?: string } {
  return { ...panelSurface(pressed, t), borderWidth: 1, borderColor: "transparent", ...(pressed ? {} : { boxShadow: raisedEdgeOf(t) }) };
}
