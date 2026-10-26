// The marks of the open moment on a card. The ones in the card's shape (the halo, the gold edge, the picked edge, the veil,
// the beat ring) are drawn on its unturned rectangle inside its turned group, so they follow its quarter turn or fan tilt
// (`Moving`'s `frame`, `cardFrame`). The picked card's check ring is upright, at the center of the card's bounds, clear of the
// tokens (docs/design-system.md, Table).
import { BlurMask, Circle, Group, Line, RoundedRect, Text, vec } from "@shopify/react-native-skia";

import { RADIUS, withAlpha, type Fonts } from "./canvas-pieces.native.tsx";
import { cardFrame, haloInset } from "./frame.ts";
import type { CardSlot, Rect } from "./layout.ts";
import { tableTokens as t } from "./tokens.ts";

const dim = withAlpha(t.night, 0.45);
const glow = withAlpha(t.gold, 0.9);

// The halo's blur, in points: wider on a picked card.
const SIGMA = 3;
const SIGMA_PICKED = 4.5;

/**
 * Gold light around a card a tap does something with, so it reads at arm's length on the felt (user request, 2026-10-25:
 * the edge alone was too faint). It is drawn behind the card, which covers its middle: an "outer" blur mask on a rounded
 * rectangle filled a block inside the card in Skia's renderer, so the glow is a plain blur under the body instead. Its
 * rectangle is pulled in so only about 3 pt of blur shows past the edge and the next card is not lit (`haloInset`).
 */
export function Glow({ slot, picked }: { slot: Rect; picked: boolean }) {
  const sigma = picked ? SIGMA_PICKED : SIGMA;
  const inset = haloInset(sigma);
  return (
    <RoundedRect x={slot.x + inset} y={slot.y + inset} width={slot.w - 2 * inset} height={slot.h - 2 * inset} r={Math.max(0, RADIUS - inset)} color={glow}>
      <BlurMask blur={sigma} style="normal" />
    </RoundedRect>
  );
}

/**
 * The marks in the card's shape, on its unturned rectangle, drawn in its turned group: a solid gold edge on a card a tap
 * does something with, a thicker one on a picked card, a night veil over a card the open pick does not ask about, and the
 * bone ring while the banner's current beat names the card.
 */
export function CardMarks({ slot, tappable, picked, dimmed, beat }: { slot: CardSlot; tappable: boolean; picked: number; dimmed: boolean; beat: boolean }) {
  const { cx, cy, w, h } = cardFrame(slot);
  const x = cx - w / 2;
  const y = cy - h / 2;
  return (
    <Group>
      {dimmed ? <RoundedRect x={x} y={y} width={w} height={h} r={RADIUS} color={dim} /> : null}
      {!dimmed && picked === 0 && tappable ? <RoundedRect x={x + 1.25} y={y + 1.25} width={w - 2.5} height={h - 2.5} r={RADIUS} color={t.gold} style="stroke" strokeWidth={2.5} /> : null}
      {!dimmed && picked > 0 ? <RoundedRect x={x - 1} y={y - 1} width={w + 2} height={h + 2} r={RADIUS + 1} color={t.gold} style="stroke" strokeWidth={3} /> : null}
      {beat ? <RoundedRect x={x - 2} y={y - 2} width={w + 4} height={h + 4} r={RADIUS + 2} color={t.bone} style="stroke" strokeWidth={2} /> : null}
    </Group>
  );
}

/**
 * The ring at the center of a picked card, upright whatever the card's turn: the share a payment or archery gives it ("-1",
 * "+2" in a threat-red ring), or a check.
 */
export function PickRing({ rect, picked, share, dimmed, fonts }: { rect: Rect; picked: number; share: "pay" | "damage" | null; dimmed: boolean; fonts: Fonts }) {
  if (dimmed || picked === 0) return null;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const text = share ? `${share === "pay" ? "-" : "+"}${picked}` : "";
  return (
    <Group>
      <Circle cx={cx} cy={cy} r={11} color={share === "damage" ? t.threat : t.gold} />
      {share ? (
        <Text x={cx - fonts.badge.getTextWidth(text) / 2} y={cy + 4} text={text} font={fonts.badge} color={share === "damage" ? t.bone : t.onGold} />
      ) : (
        // A check, drawn: the system face may not have the glyph.
        <Group>
          <Line p1={vec(cx - 5, cy)} p2={vec(cx - 1, cy + 4)} color={t.onGold} strokeWidth={2.5} />
          <Line p1={vec(cx - 1, cy + 4)} p2={vec(cx + 6, cy - 4)} color={t.onGold} strokeWidth={2.5} />
        </Group>
      )}
    </Group>
  );
}
