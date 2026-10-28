import { Canvas, Circle, LinearGradient, Path, RadialGradient, Rect, Skia, vec } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { useTheme } from "../play/theme";
import { scenesByTheme, type Ridge, type SceneName } from "./backdrop-scenes";
import { usePalette } from "./palette-hook";

function ridgePath(ridge: Ridge, width: number, height: number) {
  const floor = ridge.bottom * height;
  return Skia.Path.Polygon(
    [vec(0, floor), ...ridge.points.map(([x, y]) => vec(x * width, y * height)), vec(width, floor)],
    true,
  );
}

/** One static Skia canvas behind the screen. Drawn once per size. Never inside a list row. */
export function Backdrop({ scene }: { scene: SceneName }) {
  const { width, height } = useWindowDimensions();
  const s = scenesByTheme[useTheme()][scene];
  const palette = usePalette();
  const ridges = useMemo(
    () => s.ridges.map((ridge) => ({ ridge, path: ridgePath(ridge, width, height) })),
    [s, width, height],
  );
  const base = s.base;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={width} height={height}>
          {base.kind === "linear" ? (
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, height)}
              positions={base.stops.map((stop) => stop[0])}
              colors={base.stops.map((stop) => stop[1])}
            />
          ) : (
            <RadialGradient
              c={vec(base.cx * width, base.cy * height)}
              r={base.r * height}
              positions={base.stops.map((stop) => stop[0])}
              colors={base.stops.map((stop) => stop[1])}
            />
          )}
        </Rect>
        {s.glows.map((glow, index) => (
          <Circle key={`g${index}`} cx={glow.cx * width} cy={glow.cy * height} r={glow.r * width}>
            <RadialGradient
              c={vec(glow.cx * width, glow.cy * height)}
              r={glow.r * width}
              colors={[`rgba(${glow.rgb},${glow.alpha})`, `rgba(${glow.rgb},0)`]}
            />
          </Circle>
        ))}
        {ridges.map(({ ridge, path }, index) => (
          <Path key={`r${index}`} path={path} opacity={ridge.opacity}>
            <LinearGradient
              start={vec(0, Math.min(...ridge.points.map((p) => p[1])) * height)}
              end={vec(0, ridge.bottom * height)}
              colors={[ridge.from, ridge.to]}
            />
          </Path>
        ))}
        {s.vignette > 0 ? (
          <Rect x={0} y={0} width={width} height={height}>
            <RadialGradient
              c={vec(width / 2, height * 0.42)}
              r={Math.max(width, height) * 0.75}
              positions={[0.45, 1]}
              colors={[`rgba(0,0,0,0)`, `rgba(0,0,0,${s.vignette})`]}
            />
          </Rect>
        ) : null}
        {s.ring ? (
          <Circle
            cx={s.ring.cx * width}
            cy={s.ring.cy * height}
            r={s.ring.r * width}
            style="stroke"
            strokeWidth={3}
            color={palette.gold}
          />
        ) : null}
      </Canvas>
    </View>
  );
}
