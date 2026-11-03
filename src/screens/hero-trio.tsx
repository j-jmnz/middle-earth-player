// The three heroes a run row leads with (docs/design-system.md, Campaigns (campaign list) and History): the first seat's heroes as
// three small cards side by side, each lapping a little over the one before it, with no sphere ring. Seat 2 and on are not shown.
import { View } from "react-native";

import { cardCorner } from "../ui/card-corner";
import { dropShadowOf } from "../ui/surfaces";
import { useTableTokens } from "../ui/use-table-tokens";
import { Text } from "../ui/text";
import { useUiScale } from "../ui/ui-scale";
import type { HeroFace } from "./hero-tile";
import { CardThumb } from "./images/picture";

const THUMB = { width: 30, height: 42 };
const LAP = 8;

/** How many heroes the trio shows. */
export const TRIO_HEROES = 3;

/** The width the trio always takes in Medium's points: three cards, less the lap between neighbours. A seat with fewer heroes keeps the slot, so the titles beside it line up. */
export const TRIO_WIDTH = THUMB.width * TRIO_HEROES - LAP * (TRIO_HEROES - 1);

/**
 * The first three heroes of a seat as small cards, lapping left to right. Decorative: the row's own label names the fellowship, so it
 * is hidden from a screen reader. It always takes `TRIO_WIDTH`; with no heroes the slot is empty, or holds a dash card with `placeholder`.
 * `dim` fades it (a disabled row).
 */
export function HeroTrio({ heroes, placeholder, dim }: { heroes: readonly HeroFace[]; placeholder?: boolean; dim?: boolean }) {
  const t = useTableTokens();
  const s = useUiScale();
  const shown = heroes.slice(0, TRIO_HEROES);
  const width = THUMB.width * s;
  const height = THUMB.height * s;
  return (
    <View className="flex-row" style={{ width: TRIO_WIDTH * s, opacity: dim ? 0.45 : 1 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      {shown.map((hero, at) => (
        <View key={`${hero.code}:${at}`} style={{ marginLeft: at === 0 ? 0 : -LAP * s, borderRadius: cardCorner(width, height), overflow: "hidden", boxShadow: dropShadowOf(t, 2, 6, 0.8) }}>
          <CardThumb code={hero.code} imagesrc={hero.imagesrc} width={width} height={height} />
        </View>
      ))}
      {shown.length === 0 && placeholder ? (
        <View className="items-center justify-center bg-dusk" style={{ width, height, borderRadius: cardCorner(width, height) }}>
          <Text className="text-label text-faint">—</Text>
        </View>
      ) : null}
    </View>
  );
}
