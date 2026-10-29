// The token pop and the floating number (docs/design-system.md, Table, Motion; phase 23): when a damage, resource or progress count
// changes, its token pops (1 to 1.4 and back on a spring) and a number rises 20 pt from it and fades ("+2" in accent for a gain,
// "-1" in danger red for damage or a loss, Cinzel Bold 13 pt with a night outline). Progress placed on a quest card or a location
// pops its strip's count the same way. The numbers are the reducer's (token-deltas.ts); this only draws them, from the clock of
// card-motion.native.tsx, on a layer over the cards. The pop is a copy of the token drawn over the real one, shown only while it
// pops, so the table has nothing extra to redraw when it is over.
import { Circle, Group, Image, useFont, vec, type SkFont, type SkImage } from "@shopify/react-native-skia";
import { useDerivedValue } from "react-native-reanimated";

import { Outlined, type Fonts, type TokenImages } from "./canvas-pieces.native.tsx";
import type { Clock } from "./card-motion.native.tsx";
import { slotBounds, type CardSlot, type Rect, type TableLayout } from "./layout.ts";
import { floatWords, type TokenKind } from "./token-deltas.ts";
import { FLOAT_MS, floatAt, POP_MS, popShows, tokenPopScale, type Fx } from "./token-fx.ts";
import { TOKEN, tokenSpot } from "./token-spots.ts";
import type { TableTokens } from "./tokens.ts";

const MARCELLUS = require("../../assets/fonts/MarcellusSC-Regular.ttf") as number;
// Medium's size of the floating number, in points; drawn times the UI scale.
const FLOAT_SIZE = 13;

const IMAGE_OF: Readonly<Record<TokenKind, keyof TokenImages>> = { resources: "resource", damage: "damage", progress: "progress" };
// The disc drawn while a token's art decodes.
const fallbackOf = (t: TableTokens): Readonly<Record<TokenKind, string>> => ({ resources: t.accent, damage: t.threat, progress: t.bone });

function countOf(slot: CardSlot, token: TokenKind): number {
  return token === "resources" ? slot.resources : token === "damage" ? slot.damage : slot.progress;
}

// The clock of one change, in ms since it began (negative until it does).
function useSince(clock: Clock, start: number): { get: () => number } {
  const { progress, epoch, at, k, span } = clock;
  return useDerivedValue(() => (epoch.get() === at ? progress.get() * span - start * k : -1), [at, k, span, start]);
}

function Pop({ fx, slot, rect, clock, images, fonts, t, s, ring, contrast, strip }: { fx: Fx; slot: CardSlot; rect: Rect; clock: Clock; images: TokenImages; fonts: Fonts; t: TableTokens; s: number; ring: string | null; contrast: boolean; strip: string | null }) {
  const since = useSince(clock, fx.start);
  const { k } = clock;
  const { token } = fx.delta;
  // A quest card or a location pops its strip's count; any other card pops the token itself.
  const spot = strip ? { cx: rect.x + rect.w / 2, cy: rect.y + rect.h - 9 * s } : tokenSpot(rect, token, s);
  const size = TOKEN * s;
  const transform = useDerivedValue(() => [{ scale: tokenPopScale(since.get(), k) }]);
  const opacity = useDerivedValue(() => (since.get() >= 0 && since.get() < POP_MS * k ? 1 : 0));
  const image = images[IMAGE_OF[token]];
  return (
    <Group transform={transform} origin={vec(spot.cx, spot.cy)} opacity={opacity}>
      {strip ? (
        <Outlined x={spot.cx} y={rect.y + rect.h - 3 * s} text={strip} font={fonts.numbers} t={t} s={s} />
      ) : (
        <Group>
          {image ? <Image image={image as SkImage} x={spot.cx - size / 2} y={spot.cy - size / 2} width={size} height={size} fit="contain" /> : <Circle cx={spot.cx} cy={spot.cy} r={size / 2} color={fallbackOf(t)[token]} />}
          {ring ? <Circle cx={spot.cx} cy={spot.cy} r={size / 2 + 0.5 * s} color={ring} style="stroke" strokeWidth={1.75 * s} /> : null}
          <Outlined x={spot.cx} y={spot.cy + 4 * s} text={String(countOf(slot, token))} font={contrast ? fonts.badge : fonts.numbers} t={t} s={s} heavy={contrast} />
        </Group>
      )}
    </Group>
  );
}

function Float({ fx, rect, clock, font, t, s }: { fx: Fx; rect: Rect; clock: Clock; font: SkFont; t: TableTokens; s: number }) {
  const since = useSince(clock, fx.start);
  const { k } = clock;
  const words = floatWords(fx.delta);
  const spot = tokenSpot(rect, fx.delta.token, s);
  const frame = useDerivedValue(() => floatAt(since.get(), k));
  // The number rises 20 pt at Medium; the rise is scaled with it.
  const transform = useDerivedValue(() => [{ translateY: frame.get().dy * s }]);
  const opacity = useDerivedValue(() => (since.get() < 0 || since.get() > FLOAT_MS * k ? 0 : frame.get().opacity));
  return (
    <Group transform={transform} opacity={opacity}>
      <Outlined x={spot.cx} y={spot.cy - (TOKEN * s) / 2} text={words.text} font={font} t={t} s={s} color={words.gain ? t.accent : t.danger} heavy />
    </Group>
  );
}

/** The pops and floating numbers of the state on the canvas, over the cards. `info` says which cards have a strip (quest points). */
export function TokenFx({
  fx,
  layout,
  clock,
  images,
  fonts,
  t,
  s,
  ringOf,
  stripOf,
  contrast,
}: {
  fx: readonly Fx[];
  layout: TableLayout;
  clock: Clock;
  images: TokenImages;
  fonts: Fonts;
  t: TableTokens;
  // The UI scale (ui-scale.ts), from the canvas root.
  s: number;
  // The sphere colour a card's resource token is ringed with.
  ringOf: (code: string) => string | null;
  // The quest card or location's "progress / quest points" strip text, or null for a card without one.
  stripOf: (slot: CardSlot) => string | null;
  contrast: boolean;
}) {
  const font = useFont(MARCELLUS, FLOAT_SIZE * s);
  if (fx.length === 0) return null;
  return (
    <Group>
      {fx.map((item) => {
        const slot = layout.slots.find((candidate) => candidate.id === item.delta.cardId && candidate.kind !== "pile");
        if (!slot || slot.faceDown) return null;
        const rect = slotBounds(slot);
        const key = `${item.delta.cardId}:${item.delta.token}:${clock.at}`;
        const strip = item.delta.token === "progress" ? stripOf(slot) : null;
        return (
          <Group key={key}>
            {popShows(countOf(slot, item.delta.token), strip != null) ? <Pop fx={item} slot={slot} rect={rect} clock={clock} images={images} fonts={fonts} t={t} s={s} ring={item.delta.token === "resources" ? ringOf(slot.code) : null} contrast={contrast} strip={strip} /> : null}
            {font ? <Float fx={item} rect={rect} clock={clock} font={font} t={t} s={s} /> : null}
          </Group>
        );
      })}
    </Group>
  );
}
