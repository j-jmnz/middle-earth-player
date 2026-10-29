// The combat spotlight's particles as Skia Atlas draws (docs/plans/combat-spotlight-redesign.md, §4 and §5): the glow (embers, then
// the charge's converging embers), the streaks (sparks, or a block's silver deflection) and the ash of a burn. Three draws of one
// sprite texture, added to the picture with the "plus" blend. The UI thread fills each draw's buffers from the attack's frame
// (useRSXformBuffer, useColorBuffer; the layout of a slot is spotlight-atlas.ts), so nothing here renders again while the spotlight plays.
import { Atlas, Circle, Group, LinearGradient, RadialGradient, RoundedRect, Skia, vec, type SkImage } from "@shopify/react-native-skia";
import { useRSXformBuffer, useColorBuffer, useTexture } from "@shopify/react-native-skia";
import { useMemo } from "react";
import type { SharedValue } from "react-native-reanimated";

import type { Frame } from "./spotlight-beats.ts";
import { ATLAS_CELL, ATLAS_SLOTS, CELL, spriteAt, TEXTURE, type Emitters } from "./spotlight-atlas.ts";

const WHITE = "#FFFFFF";

/** The one sprite texture, built once by the layer: a soft dot in the left cell and a streak with a bright head in the right one. */
export function useSpriteTexture(): SharedValue<SkImage | null> {
  const half = CELL / 2;
  return useTexture(
    <Group>
      <Circle cx={half} cy={half} r={half}>
        <RadialGradient c={vec(half, half)} r={half} colors={[`${WHITE}FF`, `${WHITE}66`, `${WHITE}00`]} positions={[0, 0.35, 1]} />
      </Circle>
      <RoundedRect x={CELL + 2} y={half - 4} width={CELL - 4} height={8} r={4}>
        <LinearGradient start={vec(CELL + 2, 0)} end={vec(2 * CELL - 2, 0)} colors={[`${WHITE}00`, `${WHITE}FF`]} />
      </RoundedRect>
    </Group>,
    TEXTURE,
  );
}

// One draw: `ATLAS_SLOTS[draw]` slots of the texture's dot or streak cell, placed and colored by the frame on the UI thread.
function Draw({ draw, texture, frame, emitters }: { draw: 0 | 1 | 2; texture: SharedValue<SkImage | null>; frame: SharedValue<Frame>; emitters: Emitters }) {
  const size = ATLAS_SLOTS[draw];
  const cell = ATLAS_CELL[draw];
  const sprites = useMemo(() => Array.from({ length: size }, () => Skia.XYWHRect(cell * CELL, 0, CELL, CELL)), [size, cell]);
  const transforms = useRSXformBuffer(size, (xform, i) => {
    "worklet";
    const f = frame.get();
    const slot = spriteAt(draw, i, f, emitters);
    xform.set(slot.scos, slot.ssin, slot.tx, slot.ty);
  });
  const colors = useColorBuffer(size, (color, i) => {
    "worklet";
    const f = frame.get();
    const slot = spriteAt(draw, i, f, emitters);
    color[0] = slot.r;
    color[1] = slot.g;
    color[2] = slot.b;
    color[3] = slot.a;
  });
  return <Atlas image={texture} sprites={sprites} transforms={transforms} colors={colors} colorBlendMode="modulate" blendMode="plus" />;
}

/** The particles of one attack: three Atlas draws (`ATLAS_DRAWS`), at most the budget of sprites alive at once (spotlight-particles.ts). */
export function Particles({ texture, frame, emitters }: { texture: SharedValue<SkImage | null>; frame: SharedValue<Frame>; emitters: Emitters }) {
  return (
    <>
      <Draw draw={0} texture={texture} frame={frame} emitters={emitters} />
      <Draw draw={1} texture={texture} frame={frame} emitters={emitters} />
      <Draw draw={2} texture={texture} frame={frame} emitters={emitters} />
    </>
  );
}
