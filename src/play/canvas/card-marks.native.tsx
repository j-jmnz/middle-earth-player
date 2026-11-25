// The marks of the open moment on a card. The ones in the card's shape (the halo, the accent edge, the picked edge, the veil,
// the beat ring) are drawn on its unturned rectangle inside its turned group, so they follow its quarter turn or fan tilt
// (`Moving`'s `frame`, `cardFrame`). The picked card's check ring is upright, at the center of the card's bounds, clear of the
// tokens (docs/design-system-table.md).
import { BlurMask, Circle, Group, Line, RoundedRect, Text, vec } from "@shopify/react-native-skia";

import { type Fonts } from "./pieces.native.tsx";
import { cardCorner } from "../../ui/card-corner.ts";
import { cardFrame, halo } from "./frame.ts";
import type { CardSlot, Rect } from "../layout/layout.ts";
import { SHAPE } from "../../ui/motion-tokens.ts";
import { withAlphaHex, type TableTokens } from "../../ui/tokens.ts";

/**
 * Gold light around a card a tap does something with, so it reads at arm's length on the felt (user request, 2026-10-25:
 * the edge alone was too faint). It is drawn behind the card, which covers its middle: an "outer" blur mask on a rounded
 * rectangle filled a block inside the card in Skia's renderer, so the glow is a plain blur under the body instead. Its
 * wider halo of a picked card is pulled in a little so it does not light the next card (`halo`).
 */
export function Glow({ slot, picked, t, s }: { slot: CardSlot; picked: boolean; t: TableTokens; s: number }) {
  const { cx, cy, w, h } = cardFrame(slot);
  const halos = halo(picked);
  const inset = halos.inset * s;
  return (
    <RoundedRect x={cx - w / 2 + inset} y={cy - h / 2 + inset} width={w - 2 * inset} height={h - 2 * inset} r={Math.max(0, cardCorner(w, h) - inset)} color={withAlphaHex(t.accent, 0.9)}>
      <BlurMask blur={halos.sigma * s} style="normal" />
    </RoundedRect>
  );
}

/**
 * The marks in the card's shape, on its unturned rectangle, drawn in its turned group: a solid accent edge on a card a tap
 * does something with, a thicker one on a picked card, a night veil over a card the open pick does not ask about, and the
 * bone ring while the banner's current beat names the card. `veiled` is the hand of the seat being peeked at: a lighter, fixed
 * night over every card of it (phase 26), under which nothing glows because nothing is marked.
 */
export function CardMarks({ slot, tappable, picked, dimmed, beat, t, s, veiled = false }: { slot: CardSlot; tappable: boolean; picked: number; dimmed: boolean; beat: boolean; t: TableTokens; s: number; veiled?: boolean }) {
  const { cx, cy, w, h } = cardFrame(slot);
  const x = cx - w / 2;
  const y = cy - h / 2;
  const r = cardCorner(w, h);
  return (
    <Group>
      {dimmed ? <RoundedRect x={x} y={y} width={w} height={h} r={r} color={withAlphaHex(t.night, 0.45)} /> : null}
      {veiled && !dimmed ? <RoundedRect x={x} y={y} width={w} height={h} r={r} color={withAlphaHex(t.night, SHAPE.peekVeil)} /> : null}
      {!dimmed && picked === 0 && tappable ? <RoundedRect x={x + 1.25 * s} y={y + 1.25 * s} width={w - 2.5 * s} height={h - 2.5 * s} r={r} color={t.accent} style="stroke" strokeWidth={2.5 * s} /> : null}
      {!dimmed && picked > 0 ? <RoundedRect x={x - 1 * s} y={y - 1 * s} width={w + 2 * s} height={h + 2 * s} r={r + 1 * s} color={t.accent} style="stroke" strokeWidth={3 * s} /> : null}
      {beat ? <RoundedRect x={x - 2 * s} y={y - 2 * s} width={w + 4 * s} height={h + 4 * s} r={r + 2 * s} color={t.bone} style="stroke" strokeWidth={2 * s} /> : null}
    </Group>
  );
}

/**
 * The ring at the center of a picked card, upright whatever the card's turn: the share a payment or archery gives it ("-1",
 * "+2" in a threat-red ring), or a check.
 */
export function PickRing({ rect, picked, share, dimmed, fonts, t, s }: { rect: Rect; picked: number; share: "pay" | "damage" | null; dimmed: boolean; fonts: Fonts; t: TableTokens; s: number }) {
  if (dimmed || picked === 0) return null;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const text = share ? `${share === "pay" ? "-" : "+"}${picked}` : "";
  return (
    <Group>
      <Circle cx={cx} cy={cy} r={11 * s} color={share === "damage" ? t.threat : t.accent} />
      {share ? (
        <Text x={cx - fonts.badge.getTextWidth(text) / 2} y={cy + 4 * s} text={text} font={fonts.badge} color={share === "damage" ? t.onThreatPill : t.onAccent} />
      ) : (
        // A check, drawn: the system face may not have the glyph.
        <Group>
          <Line p1={vec(cx - 5 * s, cy)} p2={vec(cx - 1 * s, cy + 4 * s)} color={t.onAccent} strokeWidth={2.5 * s} />
          <Line p1={vec(cx - 1 * s, cy + 4 * s)} p2={vec(cx + 6 * s, cy - 4 * s)} color={t.onAccent} strokeWidth={2.5 * s} />
        </Group>
      )}
    </Group>
  );
}
