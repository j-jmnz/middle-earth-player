// The three heroes a run row leads with (docs/design-system.md, Campaigns (campaign list) and History): the first seat's heroes as
// three small cards side by side, each lapping a little over the one before it, with no sphere ring. Seat 2 and on are not shown.
import { View } from "react-native";

import { cardCorner } from "../play/card-corner";
import { dropShadowOf } from "../play/surfaces";
import { useTableTokens } from "../play/use-table-tokens";
import { useUiScale } from "../play/ui-scale";
import type { HeroFace } from "./hero-tile";
import { CardThumb } from "./images/picture";

const THUMB = { width: 30, height: 42 };
const LAP = 8;

/** How many heroes the trio shows. */
export const TRIO_HEROES = 3;

/** The width the trio takes for `count` heroes in Medium's points: a card each, less the lap between neighbours. */
export function trioWidth(count: number): number {
  const shown = Math.min(count, TRIO_HEROES);
  return shown === 0 ? 0 : THUMB.width * shown - LAP * (shown - 1);
}

/**
 * The first three heroes of a seat as small cards, lapping left to right. Decorative: the row's own label names the fellowship, so it
 * is hidden from a screen reader. Renders nothing for an empty seat.
 */
export function HeroTrio({ heroes }: { heroes: readonly HeroFace[] }) {
  const t = useTableTokens();
  const s = useUiScale();
  const shown = heroes.slice(0, TRIO_HEROES);
  if (shown.length === 0) return null;
  const width = THUMB.width * s;
  const height = THUMB.height * s;
  return (
    <View className="flex-row" style={{ width: trioWidth(shown.length) * s }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      {shown.map((hero, at) => (
        <View key={`${hero.code}:${at}`} style={{ marginLeft: at === 0 ? 0 : -LAP * s, borderRadius: cardCorner(width, height), overflow: "hidden", boxShadow: dropShadowOf(t, 2, 6, 0.8) }}>
          <CardThumb code={hero.code} imagesrc={hero.imagesrc} width={width} height={height} />
        </View>
      ))}
    </View>
  );
}
