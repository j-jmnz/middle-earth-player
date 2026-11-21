// Fog on a phone (src/ui/fog/fog.ts; docs/design-system.md, Backdrops): each texture baked once into a tile, a layer as one draw of
// that tile cut by its elliptical mask, and the drift clock. The screens' backdrop (src/screens/art/backdrop.native.tsx) and the combat
// spotlight's black fog (src/play/spotlight/fog.native.tsx) draw with these.
import { Blend, ImageShader, RadialGradient, Rect, Skia, vec, type SkImage } from "@shopify/react-native-skia";
import { useEffect } from "react";
import { useDerivedValue, useFrameCallback, useSharedValue, type SharedValue } from "react-native-reanimated";

import { fogMatrix, layerBox, maskStops, type FogLayer, type FogTexture } from "./fog.ts";

/** An ellipse as a radial gradient: a circle of radius rx × width, squashed to ry × height about its centre. */
export function EllipseGradient({ cx, cy, rx, ry, positions, colors }: { cx: number; cy: number; rx: number; ry: number; positions: number[]; colors: string[] }) {
  const center = vec(cx, cy);
  return <RadialGradient c={center} r={Math.max(rx, 1)} origin={center} transform={[{ scaleY: ry / Math.max(rx, 1) }]} positions={positions} colors={colors} />;
}

// Each texture is drawn once into a tile of its own (its noise stitched, so the tile repeats without a seam) and kept for every
// screen after. A frame then only slides the tiles, instead of working the noise out again for every pixel. The tile is drawn on
// the GPU and read back, since the canvas draws on another thread than the one that made it.
const tiles = new Map<FogTexture, SkImage | null>();

/** A texture's tile at `scale` pixels per point, drawn the first time it is asked for. */
export function tileOf(texture: FogTexture, scale: number): SkImage | null {
  if (tiles.has(texture)) return tiles.get(texture) ?? null;
  const [w, h] = texture.tile;
  const surface = Skia.Surface.MakeOffscreen(Math.round(w * scale), Math.round(h * scale)) ?? Skia.Surface.Make(Math.round(w * scale), Math.round(h * scale));
  let image: SkImage | null = null;
  if (surface) {
    const canvas = surface.getCanvas();
    canvas.scale(scale, scale);
    const paint = Skia.Paint();
    paint.setShader(Skia.Shader.MakeFractalNoise(texture.freq[0], texture.freq[1], texture.octaves, texture.seed, w, h));
    paint.setColorFilter(Skia.ColorFilter.MakeMatrix(fogMatrix(texture)));
    canvas.drawRect(Skia.XYWHRect(0, 0, w, h), paint);
    surface.flush();
    image = surface.makeImageSnapshot().makeNonTextureImage();
  }
  tiles.set(texture, image);
  return image;
}

/** Bakes the layers' tiles ahead of their first draw, so a canvas that mounts later does not pay for the noise on its first frame. */
export function warmFog(layers: readonly FogLayer[]): void {
  for (const layer of layers) tileOf(layer.texture, layer.texture.bake ?? 1);
}

// The clock moves the fog about 30 times a second: at its 5 points a second that is about half a pixel a step, and the canvas
// redraws only when it moves.
const STEP = 1 / 30;

/** Seconds of drift (at `rate`), counted only while the fog runs, so it picks up where it stopped. */
export function useDriftClock(rate: number, running: boolean): SharedValue<number> {
  const seconds = useSharedValue(0);
  const pending = useSharedValue(0);
  const tick = useFrameCallback((frame) => {
    pending.value += ((frame.timeSincePreviousFrame ?? 0) / 1000) * rate;
    if (pending.value >= STEP * rate) {
      seconds.value += pending.value;
      pending.value = 0;
    }
  }, false);
  const active = running && rate > 0;
  useEffect(() => {
    tick.setActive(active);
  }, [active, tick]);
  return seconds;
}

/** A texture's tile, repeated over the box and moved by its offset and its drift. */
export function Tile({ texture, scale, seconds }: { texture: FogTexture; scale: number; seconds: SharedValue<number> }) {
  const image = tileOf(texture, scale);
  const [dx, dy] = texture.offset ?? [0, 0];
  const width = texture.tile[0];
  const { drift } = texture;
  const transform = useDerivedValue(() => {
    const x = (((dx + drift * seconds.value) % width) + width) % width;
    return [{ translateX: x }, { translateY: dy }, { scale: 1 / scale }];
  });
  return <ImageShader image={image} tx="repeat" ty="repeat" transform={transform} />;
}

/**
 * One fog layer, one draw: the tile, cut by its elliptical mask (or its inverse) in the same shader, at its opacity. No offscreen layer, so it is cheap to redraw.
 * A mask that fades out draws only in its ellipse's bounds (`layerBox`), not over the whole box.
 */
export function Fog({ layer, width, height, seconds }: { layer: FogLayer; width: number; height: number; seconds: SharedValue<number> }) {
  const { mask } = layer;
  const tile = <Tile texture={layer.texture} scale={layer.texture.bake ?? 1} seconds={seconds} />;
  const stops = maskStops(layer.invert);
  const colors = stops.alphas.map((alpha) => `rgba(0,0,0,${alpha})`);
  const box = layerBox(layer, width, height);
  return (
    <Rect x={box.x} y={box.y} width={box.width} height={box.height} opacity={layer.opacity} blendMode={layer.blend ?? "srcOver"}>
      {mask ? (
        <Blend mode="dstIn">
          {tile}
          <EllipseGradient cx={mask.cx * width} cy={mask.cy * height} rx={mask.rx * width} ry={mask.ry * height} positions={stops.positions} colors={colors} />
        </Blend>
      ) : (
        tile
      )}
    </Rect>
  );
}
