// The burn of a destroyed target (docs/plans/combat-spotlight-redesign.md, §5; the field and the shader are spotlight-burn.ts): the target's
// layer runs through a noise-threshold dissolve with an ember rim (a runtime shader used as an image filter). If the SkSL does not
// compile (`Skia.RuntimeEffect.Make` returns null) there is no burn layer, and the target fades, drops and darkens instead
// (spotlight-pieces.native.tsx, FlyingCard and Veil).
import { Group, Paint, RuntimeShader, Skia, type SkRuntimeEffect } from "@shopify/react-native-skia";
import type { ReactNode } from "react";
import { PixelRatio } from "react-native";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { Rect } from "./layout.ts";
import type { Frame } from "./spotlight-beats.ts";
import { BURN, BURN_SKSL, burnSeed, burnThreshold } from "./spotlight-burn.ts";
import { burnRect } from "./spotlight-card.ts";

let effect: SkRuntimeEffect | null | undefined;

/** The compiled burn shader, compiled once; null when this device's Skia cannot compile it (the target then fades and drops). */
export function burnEffect(): SkRuntimeEffect | null {
  if (effect === undefined) effect = Skia.RuntimeEffect.Make(BURN_SKSL);
  return effect;
}

// A threshold under which no pixel is touched: the target is drawn as it is until the burn begins.
const UNTOUCHED = -(1 + 2 * BURN.rim);

/**
 * The target's layer with the burn on it. `rect` is the target's rectangle on the stage (screen points), `pivot` the camera's pivot
 * (the screen's center) and `seed` the plan's seed. The shader reads pixels, so the rectangle goes in through the camera's punch-in
 * and the screen's pixel density (spotlight-card.ts, burnRect).
 */
export function BurnLayer({ source, rect, pivot, seed, frame, children }: { source: SkRuntimeEffect; rect: Rect; pivot: { x: number; y: number }; seed: number; frame: SharedValue<Frame>; children: ReactNode }) {
  const density = PixelRatio.get();
  const shaderSeed = burnSeed(seed);
  const uniforms = useDerivedValue(() => {
    const f = frame.get();
    return { rect: burnRect(rect, pivot, f.punch, density), threshold: f.dissolve > 0 ? burnThreshold(f.dissolve) : UNTOUCHED, seed: shaderSeed };
  });
  return (
    <Group
      layer={
        <Paint>
          <RuntimeShader source={source} uniforms={uniforms} />
        </Paint>
      }
    >
      {children}
    </Group>
  );
}
