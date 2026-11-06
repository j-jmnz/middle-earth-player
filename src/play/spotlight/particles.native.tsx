// The combat spotlight's particles as Skia Atlas draws (docs/design-system-table.md, Spotlight): the glow (the charge's
// converging embers), the streaks (sparks, or a block's silver deflection) and the ash of a burn. Three draws of one sprite texture,
// each added to the picture with the "plus" blend (ATLAS_BLEND). The UI thread fills each draw's buffers from the attack's frame
// (useRSXformBuffer, useColorBuffer; the layout of a slot is spotlight/atlas.ts), so nothing here renders again while the spotlight plays.
import {
  Atlas, Circle, Group, LinearGradient, RadialGradient, RoundedRect, Skia, vec, type SkImage, useRSXformBuffer, useColorBuffer, useTexture,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { Frame } from "./beats.ts";
import { ATLAS_BLEND, ATLAS_CELL, ATLAS_SLOTS, CELL, drawLive, spriteAt, TEXTURE, type Emitters, type Times } from "./atlas.ts";

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

// One draw: `ATLAS_SLOTS[draw]` slots of the texture's dot or streak cell, placed and colored by the clocks on the UI thread. A draw with
// nothing that can show (outside its attack's window, before the strike, after the last spark or ash) fills its slots with zeros and works
// no sprite out, so only the attack on stage pays for its particles.
function Draw({ draw, texture, times, emitters }: { draw: 0 | 1 | 2; texture: SharedValue<SkImage | null>; times: SharedValue<Times>; emitters: Emitters }) {
  const size = ATLAS_SLOTS[draw];
  const cell = ATLAS_CELL[draw];
  const sprites = useMemo(() => Array.from({ length: size }, () => Skia.XYWHRect(cell * CELL, 0, CELL, CELL)), [size, cell]);
  const transforms = useRSXformBuffer(size, (xform, i) => {
    "worklet";
    const clocks = times.get();
    if (!drawLive(draw, clocks, emitters)) {
      xform.set(0, 0, 0, 0);
      return;
    }
    const slot = spriteAt(draw, i, clocks, emitters);
    xform.set(slot.scos, slot.ssin, slot.tx, slot.ty);
  });
  const colors = useColorBuffer(size, (color, i) => {
    "worklet";
    const clocks = times.get();
    if (!drawLive(draw, clocks, emitters)) {
      color[3] = 0;
      return;
    }
    const slot = spriteAt(draw, i, clocks, emitters);
    color[0] = slot.r;
    color[1] = slot.g;
    color[2] = slot.b;
    color[3] = slot.a;
  });
  return <Atlas image={texture} sprites={sprites} transforms={transforms} colors={colors} colorBlendMode="modulate" blendMode={ATLAS_BLEND[draw]} />;
}

/**
 * The particles of one attack: three Atlas draws (`ATLAS_DRAWS`), at most the budget of sprites alive at once (spotlight/particles.ts).
 * `dark` is the run's dark ramp: the glow fades with it.
 */
export function Particles({ texture, frame, dark, emitters }: { texture: SharedValue<SkImage | null>; frame: SharedValue<Frame>; dark: SharedValue<number>; emitters: Emitters }) {
  const times = useDerivedValue((): Times => {
    const f = frame.get();
    return { convergeT: f.convergeT, sparkT: f.sparkT, ashT: f.ashT, dark: dark.get() };
  });
  return (
    <>
      <Draw draw={0} texture={texture} times={times} emitters={emitters} />
      <Draw draw={1} texture={texture} times={times} emitters={emitters} />
      <Draw draw={2} texture={texture} times={times} emitters={emitters} />
    </>
  );
}
