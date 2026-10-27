// The Lamplight surfaces (docs/design-system.md, Surfaces): a panel lit from above, the gold of the one primary action, the slate of
// the other buttons, and the fades that lay text over a picture. Each is a style object from the tokens: a solid fill for a
// platform that draws no gradient, and the gradient over it (`backgroundImage`, which React Native draws natively and
// react-native-web hands to the browser). No hex is written here; screens and the table both read these, so src/play keeps them.
import { tableTokens as t, withAlphaHex } from "./tokens.ts";

type Surface = { backgroundColor: string; backgroundImage?: string };

const linear = (stops: string) => `linear-gradient(180deg, ${stops})`;

/** A panel or a card at rest: lit at the top edge, falling to the raised night. `pressed` is the flat pressed fill. */
export function panelSurface(pressed = false): Surface {
  if (pressed) return { backgroundColor: t.pressed };
  return { backgroundColor: t.raised, backgroundImage: linear(`${t.raisedTop} 0%, ${t.raised} 55%, ${t.dusk} 100%`) };
}

/** The one primary action: worked gold, bright at the top and deep at the foot. Pressed, it is the flat deep gold. */
export function goldSurface(pressed = false): Surface {
  if (pressed) return { backgroundColor: t.goldDeep };
  return { backgroundColor: t.gold, backgroundImage: linear(`${t.goldHigh} 0%, ${t.gold} 48%, ${t.goldDeep} 100%`) };
}

/** A secondary button, a selected segment, a filled chip at rest: slate lit from above. */
export function slateSurface(pressed = false): Surface {
  if (pressed) return { backgroundColor: t.pressed };
  return { backgroundColor: t.raised, backgroundImage: linear(`${t.pressed} 0%, ${t.raised} 100%`) };
}

/** Night rising over a picture from `from` (a fraction of the height) to solid at `to`, so words can sit on it. */
export function nightFade(from: number, to: number, base: string = t.night): Surface {
  const at = (value: number) => `${Math.round(value * 100)}%`;
  return { backgroundColor: "transparent", backgroundImage: linear(`${withAlphaHex(base, 0)} ${at(from)}, ${withAlphaHex(base, 0.72)} ${at((from + to) / 2)}, ${base} ${at(to)}`) };
}

/** A soft night at the top of a picture, so a back button and a status bar read over a bright sky. */
export function topShade(to = 0.3): Surface {
  return { backgroundColor: "transparent", backgroundImage: linear(`${withAlphaHex(t.night, 0.55)} 0%, ${withAlphaHex(t.night, 0)} ${Math.round(to * 100)}%`) };
}

/** The glow under the one primary action, and under a picked tile. */
export const goldGlow = `0 6px 20px ${withAlphaHex(t.gold, 0.22)}`;
/** The lit top edge of a raised surface, and its dark foot, drawn as inset shadows so they cost no extra view. */
export const raisedEdge = `inset 0 1px 0 ${withAlphaHex(t.bone, 0.06)}`;
export const goldEdge = `inset 0 1px 0 ${withAlphaHex(t.bone, 0.5)}, inset 0 -2px 0 ${withAlphaHex(t.night, 0.18)}`;

/** The primary's plate: worked gold with a goldDeep edge, a lit top and foot, and at rest a soft glow under it. */
export function goldPlate(pressed = false): Surface & { borderWidth: number; borderColor: string; boxShadow: string } {
  return { ...goldSurface(pressed), borderWidth: 1, borderColor: t.goldDeep, boxShadow: pressed ? goldEdge : `${goldEdge}, ${goldGlow}` };
}

/** A lit tile on a hairline: a stat tile, a card standing for a row (a save, a scenario, a book), a panel's plate. */
export function tileSurface(pressed = false): Surface & { borderWidth: number; borderColor: string; boxShadow?: string } {
  return { ...panelSurface(pressed), borderWidth: 1, borderColor: t.hairline, ...(pressed ? {} : { boxShadow: raisedEdge }) };
}
