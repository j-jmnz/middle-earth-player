// The combat spotlight's black fog on the layer's canvas (spotlight/fog.ts; docs/design-system-table.md, Spotlight): the dark over the
// whole screen, and the bank along each attack's feet. Each layer is the backdrop's fog draw (src/ui/fog/fog.native.tsx); its tiles are
// baked once, so a frame only slides them. Both drift on the spotlight's own clocks, so the feet bank holds through the hit stop, and
// both hold still with the Moving fog setting off (`drift` false), as the backdrop's fog does.
import { Group, Rect, vec } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import { EllipseGradient, Fog } from "../../ui/fog/fog.native.tsx";
import type { ThemeName } from "../../ui/theme.ts";
import { withAlphaHex, type TableTokens } from "../../ui/tokens.ts";
import type { Frame } from "./beats.ts";
import { EDGE_FOG, feetFog, SPOT_FOG, type Feet } from "./fog.ts";
import { SPOT } from "./shape.ts";

/**
 * The dark: a flat night (by the screen's theme, `SPOT_FOG.flat`), the black fog dense at the edges and clear over the stage, and a rim
 * of night at the screen's edge, all at `dark` (0..1, the run's ramp). `now` is the run's clock in ms; the fog drifts on it while `drift`.
 */
export function FogDark({ width, height, dark, now, drift, theme, t }: { width: number; height: number; dark: SharedValue<number>; now: SharedValue<number>; drift: boolean; theme: ThemeName; t: TableTokens }) {
  const flat = useDerivedValue(() => SPOT_FOG.flat[theme] * dark.get());
  const seconds = useDerivedValue(() => (drift ? now.get() / 1000 : 0));
  return (
    <>
      <Rect x={0} y={0} width={width} height={height} color={t.night} opacity={flat} />
      <Group opacity={dark}>
        {EDGE_FOG.map((layer, index) => (
          <Fog key={index} layer={layer} width={width} height={height} seconds={seconds} />
        ))}
        <Rect x={0} y={0} width={width} height={height}>
          <EllipseGradient cx={width / 2} cy={height * SPOT.centerY} rx={width * SPOT_FOG.rimWidth} ry={height * SPOT_FOG.rimHeight} positions={[SPOT_FOG.rimFrom, 1]} colors={[withAlphaHex(t.night, 0), withAlphaHex(t.night, SPOT_FOG.rim)]} />
        </Rect>
      </Group>
    </>
  );
}

/**
 * The black bank along one attack's feet: it rises and swells as the dark comes in, fades with it, and drifts on the attack's fog clock
 * (`frame.fogT`, which holds through the hit stop) put back in real ms (times `k`) from the attack's `start` in the run, so it drifts as
 * fast as the edge fog at either speed and a later attack's bank takes up where the one before it was.
 */
export function FeetFog({ at, width, height, frame, dark, drift, start, k }: { at: Feet; width: number; height: number; frame: SharedValue<Frame>; dark: SharedValue<number>; drift: boolean; start: number; k: number }) {
  const layers = feetFog(at, width, height);
  const seconds = useDerivedValue(() => (drift ? (start + Math.max(0, frame.get().fogT) * k) / 1000 : 0));
  const transform = useDerivedValue(() => {
    const d = dark.get();
    return [{ translateY: -SPOT_FOG.feetRise * at.cardH * d }, { scaleY: 1 + SPOT_FOG.feetSwell * d }];
  });
  return (
    <Group opacity={dark} transform={transform} origin={vec(width / 2, at.feet)}>
      {layers.map((layer, index) => (
        <Fog key={index} layer={layer} width={width} height={height} seconds={seconds} />
      ))}
    </Group>
  );
}
