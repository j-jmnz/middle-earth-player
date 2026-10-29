import { StyleSheet, View } from "react-native";

import { useTheme } from "../play/theme";
import { fogMatrix, gritTexture, scenesByTheme, type FogTexture, type SceneName } from "./backdrop-scenes";

// Web dev loop. Skia web needs CanvasKit, so the browser draws the same scene with CSS: each fog texture is an SVG feTurbulence tile
// (stitched, so it repeats without a seam) drawn as a repeating background, faded out by a CSS mask. react-native-web forwards these
// CSS properties to the DOM.
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

export function Backdrop({ scene }: { scene: SceneName }) {
  const s = scenesByTheme[useTheme()][scene];
  const { ground, vignette, grit } = s;
  const groundStyle: WebStyle =
    ground.kind === "solid"
      ? { backgroundColor: ground.color }
      : { backgroundImage: `radial-gradient(${pct(ground.rx)} ${pct(ground.ry)} at ${pct(ground.cx)} ${pct(ground.cy)}, ${ground.stops.map(([at, color]) => `${color} ${pct(at)}`).join(", ")})` };
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
      <View style={[StyleSheet.absoluteFill, groundStyle as object]} />
      {s.fog.map((layer, index) => {
        const mask = layer.mask ? `radial-gradient(${pct(layer.mask.rx)} ${pct(layer.mask.ry)} at ${pct(layer.mask.cx)} ${pct(layer.mask.cy)}, #000 10%, rgba(0,0,0,0) 85%)` : undefined;
        const style: WebStyle = {
          backgroundImage: tileUrl(layer.texture),
          backgroundSize: `${layer.texture.tile[0]}px ${layer.texture.tile[1]}px`,
          backgroundRepeat: "repeat",
          opacity: layer.opacity,
          ...(layer.blend ? { mixBlendMode: layer.blend } : {}),
          ...(mask ? { maskImage: mask, WebkitMaskImage: mask } : {}),
        };
        return <View key={index} style={[StyleSheet.absoluteFill, style as object]} />;
      })}
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
