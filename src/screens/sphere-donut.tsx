// The deck's sphere donut on the web: a conic gradient ringed by a radial mask, the same shares as the Skia one on a phone
// (sphere-donut.native.tsx). react-native-web forwards these CSS properties to the DOM.
import type { ReactNode } from "react";
import { View } from "react-native";

export type DonutPart = { key: string; share: number; color: string };

export function SphereDonut({ size, parts, track, children }: { size: number; parts: readonly DonutPart[]; track: string; children?: ReactNode }) {
  const stroke = Math.max(5, size * 0.12);
  let at = 0;
  const stops = parts.map((part) => {
    const from = at;
    at += part.share * 100;
    return `${part.color} ${from}% ${at}%`;
  });
  const fill = stops.length > 0 ? `conic-gradient(${[...stops, `${track} ${at}% 100%`].join(", ")})` : `conic-gradient(${track} 0 100%)`;
  const inner = size / 2 - stroke;
  const mask = `radial-gradient(circle, transparent ${inner}px, #000 ${inner + 0.5}px)`;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundImage: fill, maskImage: mask, WebkitMaskImage: mask } as object} />
      {children}
    </View>
  );
}
