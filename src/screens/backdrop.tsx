import { StyleSheet, View } from "react-native";

import { useTheme } from "../play/theme";
import { scenesByTheme, type SceneName } from "./backdrop-scenes";
import { usePalette } from "./palette-hook";

// Web dev loop. Skia web needs CanvasKit, so the browser draws the same scene with CSS.
// react-native-web forwards these CSS properties to the DOM.
type WebStyle = Record<string, string | number>;

function stopsCss(stops: readonly (readonly [number, string])[]): string {
  return stops.map(([position, color]) => `${color} ${Math.round(position * 100)}%`).join(",");
}

export function Backdrop({ scene }: { scene: SceneName }) {
  const s = scenesByTheme[useTheme()][scene];
  const palette = usePalette();
  const layers = s.glows.map(
    (g) =>
      `radial-gradient(${Math.round(g.r * 100)}vw ${Math.round(g.r * 100)}vw at ${Math.round(g.cx * 100)}% ${Math.round(g.cy * 100)}%, rgba(${g.rgb},${g.alpha}), rgba(${g.rgb},0))`,
  );
  const base =
    s.base.kind === "linear"
      ? `linear-gradient(180deg,${stopsCss(s.base.stops)})`
      : `radial-gradient(${Math.round(s.base.r * 100)}% ${Math.round(s.base.r * 100)}% at ${Math.round(s.base.cx * 100)}% ${Math.round(s.base.cy * 100)}%,${stopsCss(s.base.stops)})`;
  const vignette = s.vignette > 0 ? `radial-gradient(75% 75% at 50% 42%, rgba(0,0,0,0) 45%, rgba(0,0,0,${s.vignette}))` : null;
  const fill: WebStyle = { backgroundImage: [...layers, base].join(",") };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, fill as object]} />
      {s.ridges.map((ridge, index) => {
        const poly = [
          `0% ${ridge.bottom * 100}%`,
          ...ridge.points.map(([x, y]) => `${x * 100}% ${y * 100}%`),
          `100% ${ridge.bottom * 100}%`,
        ].join(",");
        const style: WebStyle = {
          clipPath: `polygon(${poly})`,
          backgroundImage: `linear-gradient(180deg,${ridge.from},${ridge.to} ${ridge.bottom * 100}%)`,
          opacity: ridge.opacity,
        };
        return <View key={index} style={[StyleSheet.absoluteFill, style as object]} />;
      })}
      {vignette ? <View style={[StyleSheet.absoluteFill, { backgroundImage: vignette } as object]} /> : null}
      {s.ring ? (
        <View
          style={{
            position: "absolute",
            left: `${(s.ring.cx - s.ring.r) * 100}%`,
            top: `${s.ring.cy * 100}%`,
            width: `${s.ring.r * 200}%`,
            aspectRatio: 1,
            transform: [{ translateY: "-50%" }],
            borderRadius: 9999,
            borderWidth: 3,
            borderColor: palette.accent,
          }}
        />
      ) : null}
    </View>
  );
}
