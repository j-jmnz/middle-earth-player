import { BlurMask, Canvas, Group, LinearGradient, Paint, Path, RadialGradient, Rect, vec } from "@shopify/react-native-skia";
import { PixelRatio, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import { gritTexture, rgbOf, type FogLayer } from "../../ui/fog/fog";
import { EllipseGradient as Ellipse, Fog, Tile, useDriftClock } from "../../ui/fog/fog.native";
import { useTheme } from "../../ui/theme";
import { useDriftRunning } from "./backdrop-drift";
import { scenesByTheme, type SceneLight, type SceneName, type Wash } from "./backdrop-scenes";

// The grit is finer than a point, so its tile is drawn at the screen's own pixels.
const gritScale = () => Math.min(PixelRatio.get(), 3);

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
