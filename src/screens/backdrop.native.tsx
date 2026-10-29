import { Canvas, ColorMatrix, FractalNoise, Group, Mask, Paint, RadialGradient, Rect, vec } from "@shopify/react-native-skia";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { useTheme } from "../play/theme";
import { fogMatrix, gritTexture, scenesByTheme, type FogLayer, type FogTexture, type SceneName } from "./backdrop-scenes";

/** An ellipse as a radial gradient: a circle of radius rx × width, squashed to ry × height about its centre. */
function Ellipse({ cx, cy, rx, ry, positions, colors }: { cx: number; cy: number; rx: number; ry: number; positions: number[]; colors: string[] }) {
  const center = vec(cx, cy);
  return <RadialGradient c={center} r={Math.max(rx, 1)} origin={center} transform={[{ scaleY: ry / Math.max(rx, 1) }]} positions={positions} colors={colors} />;
}

function Noise({ texture, width, height }: { texture: FogTexture; width: number; height: number }) {
  return (
    <Rect x={0} y={0} width={width} height={height}>
      <FractalNoise freqX={texture.freq[0]} freqY={texture.freq[1]} octaves={texture.octaves} seed={texture.seed} tileWidth={0} tileHeight={0} />
      <ColorMatrix matrix={fogMatrix(texture)} />
    </Rect>
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

/**
 * One static Skia canvas behind the screen, drawn once per size and never inside a list row (docs/design-system.md, Backdrops): the
 * ground, the fog layers each faded at its edges, the vignette falling to the ground, and the grit over all of it.
 */
export function Backdrop({ scene }: { scene: SceneName }) {
  const { width, height } = useWindowDimensions();
  const s = scenesByTheme[useTheme()][scene];
  const { ground, vignette, grit } = s;
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
        {s.fog.map((layer, index) => (
          <Fog key={index} layer={layer} width={width} height={height} />
        ))}
        <Rect x={0} y={0} width={width} height={height}>
          <Ellipse cx={width / 2} cy={height * 0.45} rx={width * 1.2} ry={height} positions={[vignette.from, 1]} colors={[`rgba(${vignette.rgb},0)`, `rgba(${vignette.rgb},${vignette.alpha})`]} />
        </Rect>
        <Group layer={<Paint opacity={grit.opacity} blendMode={grit.blend} />}>
          <Noise texture={gritTexture} width={width} height={height} />
        </Group>
      </Canvas>
    </View>
  );
}
