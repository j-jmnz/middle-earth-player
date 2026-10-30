import { BlurMask, Canvas, ColorMatrix, drawAsImage, FractalNoise, Group, Image, LinearGradient, Mask, Paint, Path, RadialGradient, Rect, vec, type SkImage } from "@shopify/react-native-skia";
import { useEffect, useEffectEvent, useState, type ReactElement } from "react";
import { PixelRatio, StyleSheet, useWindowDimensions, View } from "react-native";

import { useTheme, type ThemeName } from "../play/theme";
import { createImageCache } from "./backdrop-image";
import { fogMatrix, gritTexture, rgbOf, scenesByTheme, type FogLayer, type FogTexture, type Scene, type SceneLight, type SceneName, type Wash } from "./backdrop-scenes";

/** An ellipse as a radial gradient: a circle of radius rx × width, squashed to ry × height about its centre. */
function Ellipse({ cx, cy, rx, ry, positions, colors }: { cx: number; cy: number; rx: number; ry: number; positions: number[]; colors: string[] }) {
  const center = vec(cx, cy);
  return <RadialGradient c={center} r={Math.max(rx, 1)} origin={center} transform={[{ scaleY: ry / Math.max(rx, 1) }]} positions={positions} colors={colors} />;
}

function Noise({ texture, width, height }: { texture: FogTexture; width: number; height: number }) {
  const [dx, dy] = texture.offset ?? [0, 0];
  // A moved noise is drawn a little larger than the box, so its edge never shows.
  return (
    <Group transform={[{ translateX: dx }, { translateY: dy }]}>
      <Rect x={-Math.abs(dx)} y={-Math.abs(dy)} width={width + 2 * Math.abs(dx)} height={height + 2 * Math.abs(dy)}>
        <FractalNoise freqX={texture.freq[0]} freqY={texture.freq[1]} octaves={texture.octaves} seed={texture.seed} tileWidth={0} tileHeight={0} />
        <ColorMatrix matrix={fogMatrix(texture)} />
      </Rect>
    </Group>
  );
}

function Fog({ layer, width, height }: { layer: FogLayer; width: number; height: number }) {
  const noise = <Noise texture={layer.texture} width={width} height={height} />;
  const { mask } = layer;
  return (
    <Group layer={<Paint opacity={layer.opacity} blendMode={layer.blend ?? "srcOver"} />}>
      {mask ? (
        <Mask
          mode="alpha"
          mask={
            <Rect x={0} y={0} width={width} height={height}>
              <Ellipse cx={mask.cx * width} cy={mask.cy * height} rx={mask.rx * width} ry={mask.ry * height} positions={[0.1, 0.85]} colors={["#000000", "rgba(0,0,0,0)"]} />
            </Rect>
          }
        >
          {noise}
        </Mask>
      ) : (
        noise
      )}
    </Group>
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

// The scene's layers in a box of `width` × `height` points: the same tree is drawn live in a Canvas (while its image is not ready) and
// recorded once into an image (drawAsImage), so the two cannot differ.
function SceneLayers({ s, width, height }: { s: Scene; width: number; height: number }) {
  const { ground, vignette, grit } = s;
  return (
    <>
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
        <Fog key={index} layer={layer} width={width} height={height} />
      ))}
      {s.light ? <Light light={s.light} width={width} height={height} /> : null}
      <Rect x={0} y={0} width={width} height={height}>
        <Ellipse cx={width / 2} cy={height * 0.45} rx={width * 1.2} ry={height} positions={[vignette.from, 1]} colors={[`rgba(${vignette.rgb},0)`, `rgba(${vignette.rgb},${vignette.alpha})`]} />
      </Rect>
      <Group layer={<Paint opacity={grit.opacity} blendMode={grit.blend} />}>
        <Noise texture={gritTexture} width={width} height={height} />
      </Group>
    </>
  );
}

// The images. A key names what is drawn (theme, scene, size in pixels); the group is what makes an image obsolete (the theme and the
// size). The elements to record are parked under their key for the render; the cache calls it once per key.
const elements = new Map<string, { element: ReactElement; width: number; height: number }>();

async function renderKept(key: string): Promise<SkImage | null> {
  const wanted = elements.get(key);
  elements.delete(key);
  if (!wanted) return null;
  return drawAsImage(wanted.element, { width: wanted.width, height: wanted.height });
}

// Four idle backdrops stay (a screen pushed and popped again shows its own at once); the rest are released.
const backdrops = createImageCache<SkImage>(renderKept, (image) => image.dispose(), 4);
const veils = createImageCache<SkImage>(renderKept, (image) => image.dispose(), 2);

// What the live canvas draws is points; the image is pixels, so the recorded tree is scaled by the pixel ratio, as a Canvas scales its own.
function scaled(element: ReactElement, ratio: number): ReactElement {
  return <Group transform={[{ scale: ratio }]}>{element}</Group>;
}

/**
 * The image of `element` (a box of `width` × `height` points) for `key`, once it is rendered: null until then, and when it could not be
 * rendered. The image is shared by every screen that asks for the same key and released with the last of them (backdrop-image.ts);
 * it is returned only while this screen holds its lease.
 */
function useSceneImage(cache: typeof backdrops, key: string, group: string, width: number, height: number, element: ReactElement): SkImage | null {
  const [ready, setReady] = useState<{ key: string; image: SkImage } | null>(null);
  // Parks the element under its key for the cache's render (which asks for it once, inside `lease`), then leases the image.
  const start = useEffectEvent(() => {
    const ratio = PixelRatio.get();
    elements.set(key, { element: scaled(element, ratio), width: Math.round(width * ratio), height: Math.round(height * ratio) });
    const lease = cache.lease(key, group);
    elements.delete(key);
    return lease;
  });
  useEffect(() => {
    if (width <= 0 || height <= 0) return undefined;
    const lease = start();
    let live = true;
    void lease.image.then((image) => {
      if (live && image) setReady({ key, image });
    });
    return () => {
      live = false;
      // The lease is let go, so the cache may release the image while the screen is hidden (Activity): drawn again, the live layers
      // stand in until the lease below resolves.
      setReady(null);
      lease.release();
    };
  }, [cache, key, group, width, height]);
  return ready?.key === key ? ready.image : null;
}

/**
 * One static Skia canvas behind the screen, drawn once per size and never inside a list row (docs/design-system.md, Backdrops): the
 * ground, the fog layers each faded at its edges (or Light's wash and morning light), the vignette falling to the ground, and the grit
 * over all of it. The scene is rendered once into an image and every screen draws that image; until it is ready, the screen draws the
 * layers live, as it did before.
 */
export function Backdrop({ scene }: { scene: SceneName }) {
  const { width, height } = useWindowDimensions();
  const theme = useTheme();
  const s = scenesByTheme[theme][scene];
  const group = `${theme}|${width}x${height}|${PixelRatio.get()}`;
  const image = useSceneImage(backdrops, `${group}|${scene}`, group, width, height, <SceneLayers s={s} width={width} height={height} />);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={StyleSheet.absoluteFill}>{image ? <Image image={image} x={0} y={0} width={width} height={height} fit="fill" /> : <SceneLayers s={s} width={width} height={height} />}</Canvas>
    </View>
  );
}

// An id for each list of fog layers (the scenes' constants), to name an image by.
const layerIds = new WeakMap<readonly FogLayer[], number>();
let lastLayerId = 0;

function layersId(layers: readonly FogLayer[]): number {
  const known = layerIds.get(layers);
  if (known !== undefined) return known;
  lastLayerId += 1;
  layerIds.set(layers, lastLayerId);
  return lastLayerId;
}

/** Fog layers in a box of their own, over a picture (HeroArt): rendered once per size into an image, like the backdrop; its masks in the box's fractions. */
export function FogVeil({ layers, width, height }: { layers: readonly FogLayer[]; width: number; height: number }) {
  const theme: ThemeName = useTheme();
  const group = theme;
  const image = useSceneImage(
    veils,
    `${theme}|fog${layersId(layers)}|${width}x${height}|${PixelRatio.get()}`,
    group,
    width,
    height,
    <>
      {layers.map((layer, index) => (
        <Fog key={index} layer={layer} width={width} height={height} />
      ))}
    </>,
  );
  return (
    <Canvas pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width, height }}>
      {image ? (
        <Image image={image} x={0} y={0} width={width} height={height} fit="fill" />
      ) : (
        layers.map((layer, index) => <Fog key={index} layer={layer} width={width} height={height} />)
      )}
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
