// Web dev loop. Skia web needs CanvasKit, so the browser masks the scene with CSS instead (GroundedScene, cssMask) and never draws this.
import type { Crop } from "./art-crop";
import type { MaskRamp } from "./scene-mask";

export function SceneCanvas(_props: {
  source: { uri: string } | number;
  crop: Crop;
  width: number;
  height: number;
  band: number;
  matrix: number[];
  shade: { colors: [string, string]; to: number } | null;
  ramps: readonly MaskRamp[];
}) {
  return null;
}
