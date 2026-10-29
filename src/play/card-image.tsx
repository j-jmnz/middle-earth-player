// A whole card's picture in a box, its corners rounded like the card screen's (card-corner.ts). The picture keeps its own shape
// (contained, as before), and the rounding is clipped to the picture itself rather than the box, so a picture whose shape differs from
// the box (a sideways quest card, a scan with a different trim) still shows rounded corners. Until the file has loaded the box is the
// picture's guess and the picture is contained in it, never cropped.
import { Image, type ImageLoadEventData, type ImageSource } from "expo-image";
import { useState } from "react";
import { View } from "react-native";

import { cardCorner, containIn } from "./card-corner.ts";

type Props = {
  source: ImageSource | number | string;
  recyclingKey: string;
  width: number;
  height: number;
  accessibilityLabel?: string;
  cachePolicy?: "memory-disk" | "disk" | "memory" | "none";
};

export function CardImage({ source, recyclingKey, width, height, accessibilityLabel, cachePolicy }: Props) {
  // The loaded picture's own size, for the code it was loaded for (a recycled row shows another card).
  const [loaded, setLoaded] = useState<{ key: string; width: number; height: number } | null>(null);
  const shape = loaded && loaded.key === recyclingKey ? loaded : null;
  const fit = containIn(shape, width, height);
  const onLoad = (event: ImageLoadEventData) => {
    const { width: w, height: h } = event.source;
    if (!shape || shape.width !== w || shape.height !== h) setLoaded({ key: recyclingKey, width: w, height: h });
  };
  return (
    <View style={{ width, height }}>
      <View style={{ position: "absolute", left: fit.x, top: fit.y, width: fit.w, height: fit.h, borderRadius: cardCorner(fit.w, fit.h), overflow: "hidden" }}>
        <Image
          recyclingKey={recyclingKey}
          contentFit={shape ? "cover" : "contain"}
          cachePolicy={cachePolicy}
          accessible={accessibilityLabel != null}
          accessibilityLabel={accessibilityLabel}
          source={source}
          onLoad={onLoad}
          style={{ width: fit.w, height: fit.h }}
        />
      </View>
    </View>
  );
}
