import { StyleSheet, useWindowDimensions, View } from "react-native";

import { useTheme } from "../../ui/theme";
import { useDriftRunning } from "./backdrop-drift";
import { fogMatrix, gritTexture, rgbOf, scenesByTheme, type FogLayer, type FogTexture, type SceneLight, type SceneName, type Wash } from "./backdrop-scenes";

// Web dev loop. Skia web needs CanvasKit, so the browser draws the same scene with CSS: each fog texture is an SVG feTurbulence tile
// (stitched, so it repeats without a seam) drawn as a repeating background, faded out by a CSS mask; the morning light is gradients,
// each beam a clipped gradient inside a blurred box. react-native-web forwards these CSS properties to the DOM. The drift is a CSS
// animation of each tile's position, one tile's width per loop, so it repeats without a jump.
type WebStyle = Record<string, string | number>;

const tiles = new Map<FogTexture, string>();

/** A texture as a tileable SVG data URL, built once per texture. */
function tileUrl(texture: FogTexture): string {
  const cached = tiles.get(texture);
  if (cached) return cached;
  const [w, h] = texture.tile;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>` +
    `<filter id='f' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='${texture.freq[0]} ${texture.freq[1]}' numOctaves='${texture.octaves}' seed='${texture.seed}' stitchTiles='stitch'/>` +
    `<feColorMatrix type='matrix' values='${fogMatrix(texture).join(" ")}'/>` +
    `</filter><rect width='100%' height='100%' filter='url(#f)'/></svg>`;
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  tiles.set(texture, url);
  return url;
}

const pct = (value: number) => `${Math.round(value * 100)}%`;

const drifts = new Map<FogTexture, string>();

/** A texture's drift as a keyframes rule, added to the page once per texture: from its offset to one tile's width along. */
function driftName(texture: FogTexture): string {
  const cached = drifts.get(texture);
  if (cached) return cached;
  const name = `fog-drift-${drifts.size}`;
  const [dx, dy] = texture.offset ?? [0, 0];
  const to = dx + Math.sign(texture.drift) * texture.tile[0];
  const style = document.createElement("style");
  style.textContent = `@keyframes ${name} { from { background-position: ${dx}px ${dy}px; } to { background-position: ${to}px ${dy}px; } }`;
  document.head.appendChild(style);
  drifts.set(texture, name);
  return name;
}

/** One fog layer as CSS: its tile repeated (moved by its offset and drifting at `rate`), faded out by its elliptical mask (fractions of the box it fills). */
function fogStyle(layer: FogLayer, rate: number, running: boolean): WebStyle {
  const mask = layer.mask ? `radial-gradient(${pct(layer.mask.rx)} ${pct(layer.mask.ry)} at ${pct(layer.mask.cx)} ${pct(layer.mask.cy)}, #000 10%, rgba(0,0,0,0) 85%)` : undefined;
  const [dx, dy] = layer.texture.offset ?? [0, 0];
  return {
    backgroundImage: tileUrl(layer.texture),
    backgroundSize: `${layer.texture.tile[0]}px ${layer.texture.tile[1]}px`,
    backgroundRepeat: "repeat",
    backgroundPosition: `${dx}px ${dy}px`,
    opacity: layer.opacity,
    ...(layer.blend ? { mixBlendMode: layer.blend } : {}),
    ...(mask ? { maskImage: mask, WebkitMaskImage: mask } : {}),
    ...(layer.texture.drift !== 0 && rate > 0
      ? {
          animationName: driftName(layer.texture),
          animationDuration: `${layer.texture.tile[0] / Math.abs(layer.texture.drift) / rate}s`,
          animationTimingFunction: "linear",
          animationIterationCount: "infinite",
          animationPlayState: running ? "running" : "paused",
        }
      : {}),
  };
}

/** The morning light: the sun's glow, and each beam a gradient clipped to its shape inside a blurred box, all screened. */
function Light({ light, width }: { light: SceneLight; width: number }) {
  const rgb = rgbOf(light.rgb);
  const { sun } = light;
  // The glow is a circle whose radius is a share of the box's width, as on the native canvas.
  const glow: WebStyle = {
    backgroundImage: `radial-gradient(circle ${Math.round(sun.r * width)}px at ${pct(sun.cx)} ${pct(sun.cy)}, rgba(${rgb},0.95) 0%, rgba(${rgb},0.35) 50%, rgba(${rgb},0) 100%)`,
    mixBlendMode: "screen",
  };
  return (
    <>
      <View style={[StyleSheet.absoluteFill, glow as object]} />
      <View style={[StyleSheet.absoluteFill, { filter: `blur(${light.blur}px)`, mixBlendMode: "screen" } as object]}>
        {light.beams.map((beam, index) => {
          const ys = beam.points.map(([, y]) => y);
          const top = Math.min(...ys);
          const bottom = Math.max(...ys);
          const style: WebStyle = {
            clipPath: `polygon(${beam.points.map(([x, y]) => `${pct(x)} ${pct(y)}`).join(", ")})`,
            backgroundImage: `linear-gradient(180deg, rgba(${rgb},0.9) ${pct(top)}, rgba(${rgb},0.35) ${pct(top + (bottom - top) * 0.7)}, rgba(${rgb},0) ${pct(bottom)})`,
            opacity: beam.opacity,
          };
          return <View key={index} style={[StyleSheet.absoluteFill, style as object]} />;
        })}
      </View>
    </>
  );
}

/** A colour multiplied into the ground inside an ellipse (Light's rust where the enemy is). */
function washStyle(wash: Wash): WebStyle {
  const rgb = rgbOf(wash.rgb);
  return {
    backgroundImage: `radial-gradient(${pct(wash.rx)} ${pct(wash.ry)} at ${pct(wash.cx)} ${pct(wash.cy)}, rgba(${rgb},${wash.alpha}) 10%, rgba(${rgb},0) 85%)`,
    mixBlendMode: "multiply",
  };
}

export function Backdrop({ scene }: { scene: SceneName }) {
  const { width } = useWindowDimensions();
  const s = scenesByTheme[useTheme()][scene];
  const { ground, vignette, grit } = s;
  const running = useDriftRunning();
  const groundStyle: WebStyle =
    ground.kind === "solid"
      ? { backgroundColor: ground.color }
      : { backgroundImage: `radial-gradient(${pct(ground.rx)} ${pct(ground.ry)} at ${pct(ground.cx)} ${pct(ground.cy)}, ${ground.stops.map(([at, color]) => `${color} ${pct(at)}`).join(", ")})` };
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
      <View style={[StyleSheet.absoluteFill, groundStyle as object]} />
      {s.wash ? <View style={[StyleSheet.absoluteFill, washStyle(s.wash) as object]} /> : null}
      {s.fog.map((layer, index) => (
        <View key={index} style={[StyleSheet.absoluteFill, fogStyle(layer, s.drift ?? 1, running) as object]} />
      ))}
      {s.light ? <Light light={s.light} width={width} /> : null}
      <View style={[StyleSheet.absoluteFill, { backgroundImage: `radial-gradient(120% 100% at 50% 45%, rgba(${vignette.rgb},0) ${pct(vignette.from)}, rgba(${vignette.rgb},${vignette.alpha}) 100%)` } as object]} />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundImage: tileUrl(gritTexture), backgroundSize: `${gritTexture.tile[0]}px ${gritTexture.tile[1]}px`, opacity: grit.opacity, mixBlendMode: grit.blend } as object,
        ]}
      />
    </View>
  );
}

/** Fog layers in a box of their own, over a picture (HeroArt), as the native canvas draws them. */
export function FogVeil({ layers, width, height }: { layers: readonly FogLayer[]; width: number; height: number }) {
  const running = useDriftRunning();
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width, height }}>
      {layers.map((layer, index) => (
        <View key={index} style={[StyleSheet.absoluteFill, fogStyle(layer, 1, running) as object]} />
      ))}
    </View>
  );
}

/** The morning light in a box of its own, over a picture (HeroArt, Light). */
export function LightVeil({ light, width, height }: { light: SceneLight; width: number; height: number }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width, height, overflow: "hidden" }}>
      <Light light={light} width={width} />
    </View>
  );
}
