// The page frame of the two hubs (docs/design-system.md, Campaigns (campaign list) and Scenarios): the head, then the hero over its scene and
// the other runs, then the catalog and Coming later. `HubPage` scrolls them in a ScrollView (Campaigns, whose catalog is a few tiles);
// `HubListPage` holds the head as the header of a FlashList whose items are the catalog (Scenarios, whose boxes hold a picture row for
// every playable scenario: docs/design-system.md, Performance).
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { useState, type ComponentRef, type ReactNode, type RefObject } from "react";
import { View, type ScrollView } from "react-native";

import { capWidth } from "../../ui/size-class";
import { useUiScale } from "../../ui/ui-scale";
import { useSizeClass } from "../../ui/use-size-class";
import { HeroArt } from "../art/art";
import { HubHeader, Screen, ScreenScroll } from "../kit/chrome";
import { seedWidth } from "../nav/split-columns";
import { useSplitColumns } from "../nav/use-split-columns";

// The right column of the two-column hub (docs/design-system.md, Tablets).
const SIDE_RANGE = { min: 360, max: 440 };

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

type HeadProps = {
  testID: string;
  // The head's title and its own controls (History); the gear follows them.
  title: string;
  actions?: ReactNode;
  hero?: ReactNode;
  heroAction?: ReactNode;
  // The block holding the hero and its action.
  heroTestID?: string;
  sceneId?: string | null;
  others?: ReactNode;
};

/**
 * The head of a hub and its scene. On a tablet in landscape with room for two columns (docs/design-system.md, Tablets) and both a hero and
 * other runs, the hero is on the left over its scene and the other runs on the right. Else one column. The hero's scene is `sceneId`; with
 * no hero the page takes the moon backdrop and no art. `hero` is the run's words and fellowship, `heroAction` the primary under them: a
 * tablet keeps the action (and, in one column, the whole hero) to a readable measure. `head` starts with the measurer of the columns, so
 * it goes at the top of the scroll's content.
 */
function useHubHead({ testID, title, actions, hero, heroAction, heroTestID, sceneId, others }: HeadProps): { head: ReactNode; art: ReactNode; wide: boolean } {
  const s = useUiScale();
  const { width, height } = useSizeClass();
  const columns = useSplitColumns(SIDE_RANGE);
  const { size } = columns;
  const [pageWidth, setPageWidth] = useState(0);
  const split = size === "expanded" && hero && others ? columns.side : null;
  const twoColumns = split != null;
  // The hero words sit low over the scene: the scene's art fills the top of the page and they start where it begins to fade. A short
  // or scaled window (its height in points over the UI scale) drops them less, so the hero's primary stays on the first screen.
  const tall = height / s;
  const heroDrop = hero ? (size === "compact" ? clamp(tall - 700, 60, 170) : clamp(tall * 0.2, 96, 330)) * s : 0;
  const header = <HubHeader title={title}>{actions}</HubHeader>;
  // On a tablet the hero keeps a readable measure rather than spanning its column.
  const measure = size === "expanded" ? { maxWidth: 620 * s } : undefined;
  const action = heroAction ? <View style={measure}>{heroAction}</View> : null;
  // In two columns the hero spans its column and only its action keeps the measure; in one column the whole hero is capped (below).
  const heroBlock = hero ? (
    <View testID={heroTestID} style={{ gap: 18 * s }}>
      {hero}
      {action}
    </View>
  ) : null;
  const page = twoColumns ? (
    <>
      {header}
      {/* The hero on the left over its scene, the other runs on the right; the catalog and Coming later under both. */}
      <View className="flex-row items-start" style={{ gap: split.gap }} testID={`${testID}-columns`}>
        <View className="min-w-0 flex-1" style={{ paddingTop: heroDrop }}>
          {heroBlock}
        </View>
        <View style={{ width: split.side, paddingTop: 24 * s }}>{others}</View>
      </View>
    </>
  ) : (
    <>
      {header}
      <View style={{ gap: 18 * s, paddingTop: heroDrop, ...measure }}>
        {heroBlock}
        {others}
      </View>
    </>
  );
  // An expanded window scrolls in a wide column; the measurer (outside the columns) decides whether it splits.
  const head = (
    <>
      {size === "expanded" ? <View style={{ height: 0 }} onLayout={columns.measure} /> : null}
      {page}
    </>
  );

  // The scene of the hero: wider than a phone and centred on it; on a tablet in landscape with two columns, behind the hero's column.
  // In two columns the scene stops at the hero column's right edge, so it never runs under the right column. The scroll's content
  // is centred in the page, so that edge is the page's middle less half the content's width, plus the hero column's width.
  const art = hero ? (
    size === "expanded" && twoColumns ? (
      <>
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 0 }} onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)} />
        {pageWidth > 0 ? <HeroArt scenarioId={sceneId} width={900 * s} height={760 * s} left={-90 * s} right={pageWidth / 2 - columns.width / 2 + split.main} /> : null}
      </>
    ) : (
      <HeroArt scenarioId={sceneId} width={Math.max(520 * s, width + 120 * s)} height={(size === "compact" ? 540 : 820) * s} />
    )
  ) : null;
  return { head, art, wide: size === "expanded" };
}

/**
 * The hub in a ScrollView: the head, then the catalog and Coming later. `onCatalogLayout` gives the y of the catalog in the scroll's
 * content, so a screen can scroll it into view.
 */
export function HubPage({
  catalog,
  coming,
  scrollRef,
  onCatalogLayout,
  ...headProps
}: HeadProps & {
  catalog: ReactNode;
  coming?: ReactNode;
  scrollRef?: RefObject<ComponentRef<typeof ScrollView> | null>;
  onCatalogLayout?: (y: number) => void;
}) {
  const s = useUiScale();
  const { head, art, wide } = useHubHead(headProps);
  const { hero, others, testID } = headProps;
  return (
    // Over its scene the page takes the hero backdrop, whose fog stays below the picture (HeroArt draws its own over it).
    <Screen testID={testID} scene={art ? "hero" : "moon"} art={art}>
      <ScreenScroll scrollRef={scrollRef} max={wide ? "wide" : "readable"}>
        {head}
        {/* The catalog and Coming later are the page's last block, a direct child of the scroll's content so its y is the content's. */}
        <View style={{ gap: 18 * s, paddingTop: hero || others ? 18 * s : 0 }} onLayout={(event) => onCatalogLayout?.(event.nativeEvent.layout.y)}>
          {catalog}
          {coming}
        </View>
      </ScreenScroll>
    </Screen>
  );
}

/**
 * The hub as one FlashList: the head is its header and `items` the catalog under it, so only the rows in view are mounted and a row
 * scrolled away is recycled. `renderItem` is handed `lead`, true for the first item, which sits 18 pt under the hero or the other runs
 * (none without either), as `HubPage`'s catalog does. The list keeps `ScreenScroll`'s frame: it reaches 8 pt past the page inset, and
 * outside compact its content is a centred column at the cap.
 */
export function HubListPage<T extends { id: string; type: string }>({
  items,
  renderItem,
  listTestID,
  ...headProps
}: HeadProps & {
  items: readonly T[];
  renderItem: (item: T, lead: boolean) => ReactNode;
  listTestID?: string;
}) {
  const { size, s, width: windowWidth } = useSizeClass();
  const { head, art, wide } = useHubHead(headProps);
  const { hero, others, testID } = headProps;
  // Outside compact the first frame takes the window less the page inset, plus the 8 the list reaches past it, so it opens in the column.
  const [listWidth, setListWidth] = useState(() => (size === "compact" ? 0 : seedWidth(size, windowWidth, s, 24) + 16 * s));
  const cap = capWidth(size, wide ? "wide" : "readable", s);
  // ScreenScroll's content is min(the list's width, the cap plus 16) wide and centred, padded 8 inside: the same inset here.
  const inset = 8 * s + (cap == null || listWidth === 0 ? 0 : Math.max(0, Math.floor((listWidth - 16 * s - cap) / 2)));
  const first = items[0]?.id;
  const render: ListRenderItem<T> = ({ item }) => {
    const lead = item.id === first;
    return <View style={lead && (hero || others) ? { paddingTop: 18 * s } : undefined}>{renderItem(item, lead)}</View>;
  };
  return (
    <Screen testID={testID} scene={art ? "hero" : "moon"} art={art}>
      <View className="min-h-0 flex-1" style={{ marginHorizontal: -8 * s }} onLayout={(event) => setListWidth(event.nativeEvent.layout.width)}>
        <FlashList
          testID={listTestID}
          data={items}
          keyExtractor={(item) => item.id}
          getItemType={(item) => item.type}
          renderItem={render}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: inset, paddingBottom: 32 * s }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={<View>{head}</View>}
        />
      </View>
    </Screen>
  );
}
