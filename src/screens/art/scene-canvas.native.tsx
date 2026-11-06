import { Canvas, ColorMatrix, Group, Image, LinearGradient, Rect, rect, useImage, vec } from "@shopify/react-native-skia";

import type { Crop } from "./crop";
import { rampPoints, type MaskRamp } from "./scene-mask";

/**
 * A page's scene on a phone (GroundedScene): the picture dimmed by `matrix`, `shade` laid over its top, then faded out by the mask's
 * ramps drawn `dstIn` in a layer of its own, so its edges are truly transparent and the backdrop's fog shows through them. A view's
 * blend mode does not reach the backdrop's canvas on a device, so a fade to the ground drew as a black line there.
 */
export function SceneCanvas({
  source,
  crop,
  width,
  height,
  band,
  matrix,
  shade,
  ramps,
}: {
  source: { uri: string } | number;
  crop: Crop;
  width: number;
  height: number;
  band: number;
  matrix: number[];
  // The top shade's colours (topShade) and how far down it reaches, in points; null for none.
  shade: { colors: [string, string]; to: number } | null;
  ramps: readonly MaskRamp[];
}) {
  const image = useImage(typeof source === "number" ? source : source.uri);
  if (!image) return null;
  return (
    <Canvas pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: "absolute", left: 0, top: 0, width, height }}>
      <Group layer>
        <Group clip={rect(0, 0, width, band)}>
          <Image image={image} x={crop.left} y={crop.top} width={crop.width} height={crop.height} fit="fill">
            <ColorMatrix matrix={matrix} />
          </Image>
          {shade ? (
            <Rect x={0} y={0} width={width} height={band}>
              <LinearGradient start={vec(0, 0)} end={vec(0, Math.max(1, shade.to))} colors={shade.colors} />
            </Rect>
          ) : null}
        </Group>
        {ramps.map((ramp, index) => {
          const points = rampPoints(ramp);
          const along = (at: number) => (ramp.axis === "y" ? vec(0, at) : vec(at, 0));
          return (
            <Rect key={index} x={0} y={0} width={width} height={height} blendMode="dstIn">
              <LinearGradient
                start={along(ramp.from)}
                end={along(Math.max(ramp.to, ramp.from + 1))}
                positions={ramp.stops.map(([offset]) => offset)}
                colors={points.map(({ alpha }) => `rgba(0,0,0,${alpha})`)}
              />
            </Rect>
          );
        })}
      </Group>
    </Canvas>
  );
}
