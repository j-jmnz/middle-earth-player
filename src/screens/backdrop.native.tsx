import { Blend, BlurMask, Canvas, Group, ImageShader, LinearGradient, Paint, Path, RadialGradient, Rect, Skia, vec, type SkImage } from "@shopify/react-native-skia";
import { useEffect } from "react";
import { PixelRatio, StyleSheet, useWindowDimensions, View } from "react-native";
import { useDerivedValue, useFrameCallback, useSharedValue, type SharedValue } from "react-native-reanimated";

import { useTheme } from "../ui/theme";
import { useDriftRunning } from "./backdrop-drift";
import { fogMatrix, gritTexture, rgbOf, scenesByTheme, type FogLayer, type FogTexture, type SceneLight, type SceneName, type Wash } from "./backdrop-scenes";

/** An ellipse as a radial gradient: a circle of radius rx × width, squashed to ry × height about its centre. */
function Ellipse({ cx, cy, rx, ry, positions, colors }: { cx: number; cy: number; rx: number; ry: number; positions: number[]; colors: string[] }) {
  const center = vec(cx, cy);
  return <RadialGradient c={center} r={Math.max(rx, 1)} origin={center} transform={[{ scaleY: ry / Math.max(rx, 1) }]} positions={positions} colors={colors} />;
}

// Each texture is drawn once into a tile of its own (its noise stitched, so the tile repeats without a seam) and kept for every
// screen after. A frame then only slides the tiles, instead of working the noise out again for every pixel. The tile is drawn on
// the GPU and read back, since the canvas draws on another thread than the one that made it.
const tiles = new Map<FogTexture, SkImage | null>();

function tileOf(texture: FogTexture, scale: number): SkImage | null {
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

// The grit is finer than a point, so its tile is drawn at the screen's own pixels.
const gritScale = () => Math.min(PixelRatio.get(), 3);

// The clock moves the fog about 30 times a second: at its 5 points a second that is about half a pixel a step, and the canvas
// redraws only when it moves.
const STEP = 1 / 30;

/** Seconds of drift (at `rate`), counted only while the fog runs, so it picks up where it stopped. */
function useDriftClock(rate: number, running: boolean): SharedValue<number> {
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
function Tile({ texture, scale, seconds }: { texture: FogTexture; scale: number; seconds: SharedValue<number> }) {
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

/** One fog layer, one draw: the tile, cut by its elliptical mask in the same shader, at its opacity. No offscreen layer, so it is cheap to redraw. */
function Fog({ layer, width, height, seconds }: { layer: FogLayer; width: number; height: number; seconds: SharedValue<number> }) {
  const { mask } = layer;
  const tile = <Tile texture={layer.texture} scale={layer.texture.bake ?? 1} seconds={seconds} />;
  return (
    <Rect x={0} y={0} width={width} height={height} opacity={layer.opacity} blendMode={layer.blend ?? "srcOver"}>
      {mask ? (
        <Blend mode="dstIn">
          {tile}
          <Ellipse cx={mask.cx * width} cy={mask.cy * height} rx={mask.rx * width} ry={mask.ry * height} positions={[0.1, 0.85]} colors={["#000000", "rgba(0,0,0,0)"]} />
        </Blend>
      ) : (
        tile
      )}
    </Rect>
  );
}

/** The morning light: the sun's glow and its beams, each beam lit at its top and gone at its foot, blurred soft, all screened. */
function Light({ light, width, height }: { light: SceneLight; width: number; height: number }) {
  const rgb = rgbOf(light.rgb);
  const { sun } = light;
  return (
    <Group layer={<Paint blendMode="screen" />}>
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient c={vec(sun.cx * width, sun.cy * height)} r={sun.r * width} positions={[0, 0.5, 1]} colors={[`rgba(${rgb},0.95)`, `rgba(${rgb},0.35)`, `rgba(${rgb},0)`]} />
      </Rect>
      {light.beams.map((beam, index) => {
        const points = beam.points.map(([x, y]) => [x * width, y * height] as const);
        const ys = points.map(([, y]) => y);
        const path = `M ${points.map(([x, y]) => `${x} ${y}`).join(" L ")} Z`;
        return (
          <Path key={index} path={path} opacity={beam.opacity}>
            <LinearGradient start={vec(0, Math.min(...ys))} end={vec(0, Math.max(...ys))} positions={[0, 0.7, 1]} colors={[`rgba(${rgb},0.9)`, `rgba(${rgb},0.35)`, `rgba(${rgb},0)`]} />
            <BlurMask blur={light.blur} style="normal" />
          </Path>
        );
      })}
    </Group>
  );
}

/** A colour multiplied into the ground inside an ellipse (Light's rust where the enemy is). */
function WashLayer({ wash, width, height }: { wash: Wash; width: number; height: number }) {
  const rgb = rgbOf(wash.rgb);
  return (
    <Group layer={<Paint blendMode="multiply" />}>
      <Rect x={0} y={0} width={width} height={height}>
        <Ellipse cx={wash.cx * width} cy={wash.cy * height} rx={wash.rx * width} ry={wash.ry * height} positions={[0.1, 0.85]} colors={[`rgba(${rgb},${wash.alpha})`, `rgba(${rgb},0)`]} />
      </Rect>
    </Group>
  );
}

/**
 * One Skia canvas behind the screen, never inside a list row (docs/design-system.md, Backdrops): the ground, the fog layers each
 * faded at its edges and drifting (or Light's wash and morning light, still), the vignette falling to the ground, and the grit over
 * all of it. Only the fog moves, and only Dark has any, so a Light canvas is drawn once per size.
 */
export function Backdrop({ scene }: { scene: SceneName }) {
  const { width, height } = useWindowDimensions();
  const s = scenesByTheme[useTheme()][scene];
  const { ground, vignette, grit } = s;
  const seconds = useDriftClock(s.fog.length > 0 ? (s.drift ?? 1) : 0, useDriftRunning());
  const still = useSharedValue(0);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={StyleSheet.absoluteFill}>
        {ground.kind === "solid" ? (
          <Rect x={0} y={0} width={width} height={height} color={ground.color} />
        ) : (
          <Rect x={0} y={0} width={width} height={height}>
            <Ellipse
              cx={ground.cx * width}
              cy={ground.cy * height}
              rx={ground.rx * width}
              ry={ground.ry * height}
              positions={ground.stops.map((stop) => stop[0])}
              colors={ground.stops.map((stop) => stop[1])}
            />
          </Rect>
        )}
        {s.wash ? <WashLayer wash={s.wash} width={width} height={height} /> : null}
        {s.fog.map((layer, index) => (
          <Fog key={index} layer={layer} width={width} height={height} seconds={seconds} />
        ))}
        {s.light ? <Light light={s.light} width={width} height={height} /> : null}
        <Rect x={0} y={0} width={width} height={height}>
          <Ellipse cx={width / 2} cy={height * 0.45} rx={width * 1.2} ry={height} positions={[vignette.from, 1]} colors={[`rgba(${vignette.rgb},0)`, `rgba(${vignette.rgb},${vignette.alpha})`]} />
        </Rect>
        <Rect x={0} y={0} width={width} height={height} opacity={grit.opacity} blendMode={grit.blend}>
          <Tile texture={gritTexture} scale={gritScale()} seconds={still} />
        </Rect>
      </Canvas>
    </View>
  );
}

/** Fog layers in a box of their own, over a picture (HeroArt): one more canvas, drifting as the backdrop's does, its masks in the box's fractions. */
export function FogVeil({ layers, width, height }: { layers: readonly FogLayer[]; width: number; height: number }) {
  const seconds = useDriftClock(1, useDriftRunning());
  return (
    <Canvas pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width, height }}>
      {layers.map((layer, index) => (
        <Fog key={index} layer={layer} width={width} height={height} seconds={seconds} />
      ))}
    </Canvas>
  );
}

/** The morning light in a box of its own, over a picture (HeroArt, Light): the glow and the beams, in the box's fractions. */
export function LightVeil({ light, width, height }: { light: SceneLight; width: number; height: number }) {
  return (
    <Canvas pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width, height }}>
      <Light light={light} width={width} height={height} />
    </Canvas>
  );
}
