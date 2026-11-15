// The pictures that lead a briefing row: a card's thumbnail (the campaign card, the quest cards, a Setup choice's cards) from its downloaded
// file, its bundled scan or its remote picture, and a hero's painting (the Ring-bearer rows, a choice's heroes).
import { View } from "react-native";

import { cardCorner } from "../../ui/card-corner";
import { useUiScale } from "../../ui/ui-scale";
import { CroppedArt } from "../art/art";
import { PAINTING } from "../art/crop";
import type { HeroFace } from "../art/hero-tile";
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

/** A hero's painting at a row's size, square-cornered like the party's hero tiles: no circle and no sphere ring. */
export function HeroPainting({ face }: { face: HeroFace }) {
  const s = useUiScale();
  return (
    <View className="overflow-hidden rounded-control" importantForAccessibility="no-hide-descendants">
      <CroppedArt card={face} region={PAINTING} width={56 * s} height={40 * s} />
    </View>
  );
}
