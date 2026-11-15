// A card's thumbnail at a briefing row's size (the campaign card, the quest cards, a Setup choice's cards): its downloaded file, its bundled
// scan, or its remote picture.
import { View } from "react-native";

import { cardCorner } from "../../ui/card-corner";
import { useUiScale } from "../../ui/ui-scale";
import { RowCardImage } from "../images/picture";
import { shownCardImage } from "../images/policy";
import { remotePictureUrl } from "../images/remote";
import { scanAssets } from "../images/scan-map";
import { useCachedImage } from "../images/store";

export function CardThumb({ code, imagesrc }: { code: string; imagesrc: string | null }) {
  const s = useUiScale();
  const cached = useCachedImage(code);
  const { source } = shownCardImage({ cached, imagesrc, bundled: scanAssets[code] ?? null });
  const remote = !source && imagesrc ? remotePictureUrl(imagesrc) : null;
  const picture = source ?? (remote ? { uri: remote } : null);
  return (
    <View className="overflow-hidden bg-raised" style={{ width: 32 * s, height: 44 * s, borderRadius: cardCorner(32 * s, 44 * s) }}>
      {picture ? <RowCardImage code={code} source={picture} width={32 * s} height={44 * s} /> : null}
    </View>
  );
}
