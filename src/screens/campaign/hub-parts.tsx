// The parts the two hubs share (docs/design-system.md, Campaigns (campaign list) and Scenarios): the hero over the current run's
// scene, a row for each other run, a tile for each catalog entry, the locked tiles, and the page frame that sets them in order.
import { Children, useState, type ComponentRef, type ReactNode, type RefObject } from "react";
import { Pressable, View, type ScrollView } from "react-native";

import { dropShadowOf, lapShadowOf, rowSurface, tileSurface } from "../../ui/surfaces";
import { withAlphaHex } from "../../ui/tokens";
import { useTheme } from "../../ui/theme";
import { useTableTokens } from "../../ui/use-table-tokens";
import { useUiScale } from "../../ui/ui-scale";
import { useSizeClass } from "../../ui/use-size-class";
import { HeroArt, SceneArt } from "../art/art";
import { COVER } from "../art/crop";
import { Chevron, Eyebrow, HubHeader, RingMark, Screen, ScreenScroll, useTitleShadow } from "../kit/chrome";
import { FoldSection } from "../kit/fold-section";
import { HeroTile, type HeroFace } from "../art/hero-tile";
import { HeroTrio } from "../art/hero-trio";
import { usePalette } from "../kit/palette-hook";
import { useSplitColumns } from "../nav/use-split-columns";
import { Text } from "../../ui/text";

// How far a fellowship painting laps over the one before it.
const OVERLAP = 10;

/**
 * The words over the current run's scene: the run's name large, with no overline (user request, 2026-11-08), an optional muted line under it, and
 * the fellowship as their paintings (`HeroTile`: the card's painting with its name and sphere, no ring), one row per seat, each
 * lapping a little over the right edge of the one before it and shadowing it. Hero titles carry a dark shadow on Dark; on Light the
 * words sit in a soft glow of the ground, so they read over a dark scene. `testID` is the title's.
 */
export function RunHero({ title, detail, seats, testID }: { title: string; detail?: string; seats: readonly (readonly HeroFace[])[]; testID: string }) {
  const t = useTableTokens();
  const palette = usePalette();
  const theme = useTheme();
  const { size, s, short } = useSizeClass();
  const shadow = useTitleShadow();
  const big = size === "compact" ? 38 : 60;
  const rows = seats.filter((seat) => seat.length > 0);
  // Two seats take two shorter, denser rows; a tight window (Large or Extra large scale, a short phone) shorter tiles still, so the hero's primary
  // stays on the first screen.
  const two = rows.length > 1;
  const tight = short || s > 1;
  const tile = (size === "compact" ? (two ? (tight ? 80 : 92) : tight ? 112 : 140) : two ? 130 : 180) * s;
  const slots = Math.max(3, ...rows.map((row) => row.length));
  const names = (row: readonly HeroFace[]) => row.map((hero) => hero.name).join(", ");
  const spoken = two ? rows.map((row, seat) => `Player ${seat + 1}: ${names(row)}`).join("; ") : names(rows[0] ?? []);
  return (
    <View>
      <View>
        {/* The glow is centred and reaches nothing at its box's edges, which stay inside the scroll's 8 pt bleed, so it has no edge. */}
        {theme === "light" ? (
          <View
            pointerEvents="none"
            style={{ position: "absolute", left: -8 * s, right: -8 * s, top: -28 * s, bottom: -24 * s, backgroundImage: `radial-gradient(50% 50% at 50% 50%, ${withAlphaHex(palette.night, 0.78)} 0%, ${withAlphaHex(palette.night, 0.5)} 55%, ${withAlphaHex(palette.night, 0)} 100%)` }}
          />
        ) : null}
        <Text testID={testID} accessibilityRole="header" className="font-display text-bone" style={{ fontSize: big * s, lineHeight: big * 1.06 * s, ...shadow }}>
          {title}
        </Text>
        {detail ? (
          <Text className="mt-1 text-label text-muted" style={shadow}>
            {detail}
          </Text>
        ) : null}
      </View>
      {rows.length > 0 ? (
        <View className="mt-4" style={{ gap: 14 * s }} accessible accessibilityLabel={`Fellowship: ${spoken}`}>
          {rows.map((row, index) => (
            <View key={index} className="flex-row">
              {/* Each painting laps a little over the right edge of the one before it, so no hero's name (on its left) is covered, and
                  casts a shadow on it, so the row reads as cards laid one on another. */}
              {row.map((hero, at) => (
                <View key={`${hero.code}:${at}`} className="flex-1 flex-row" style={{ marginLeft: at === 0 ? 0 : -OVERLAP * s }}>
                  <HeroTile hero={hero} height={tile} crop={COVER} dense={two} shadow={at === 0 ? dropShadowOf(t, 10, 22, 0.8) : lapShadowOf(t)} />
                  {/* The lapping edge is lit, the way a panel's top is, so the stack reads apart over two dark paintings. */}
                  {at === 0 ? null : <View pointerEvents="none" className="absolute bottom-0 left-0 top-0 rounded-l-item" style={{ width: 1.5 * s, backgroundColor: withAlphaHex(t.lit, 0.55) }} />}
                </View>
              ))}
              {/* A short row keeps its tiles the width of a full one. */}
              {Array.from({ length: slots - row.length }, (_, gap) => (
                <View key={`gap${gap}`} className="flex-1" style={{ marginLeft: -OVERLAP * s }} />
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Another open run: one 62 pt row that opens it, with the first seat's three heroes (`HeroTrio`), its title and a line under it. */
export function RunRow({ testID, title, line, heroes, accessibilityLabel, accessibilityHint, onPress }: { testID: string; title: string; line: string; heroes: readonly HeroFace[]; accessibilityLabel: string; accessibilityHint?: string; onPress: () => void }) {
  const palette = usePalette();
  const t = useTableTokens();
  const { s } = useSizeClass();
  return (
    <Pressable testID={testID} collapsable={false} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint} onPress={onPress}>
      {({ pressed }) => (
        <View className="flex-row items-center gap-3 rounded-item px-3" style={{ minHeight: 62 * s, ...rowSurface(pressed, t) }}>
          <HeroTrio heroes={heroes} />
          <View className="min-w-0 flex-1">
            <Text className="font-display text-heading text-bone" numberOfLines={1}>
              {title}
            </Text>
            <Text className="text-label text-muted" numberOfLines={1}>{line}</Text>
          </View>
          <Chevron direction="right" color={palette.faint} size={8} />
        </View>
      )}
    </Pressable>
  );
}

/**
 * The other open runs under their heading: rows on a phone, two across on a medium tablet. `title` is the heading ("Other journeys").
 * With `fold` the heading is a FoldSection header (the Campaigns hub); without it, a plain eyebrow.
 */
export function OtherRuns({ testID, title, fold, children }: { testID: string; title: string; fold?: { id: string; folded: boolean; onFold: (folded: boolean) => void }; children: ReactNode }) {
  const s = useUiScale();
  const { size } = useSizeClass();
  const grid = size === "medium";
  const rows = (
    <View className={grid ? "flex-row flex-wrap" : undefined} style={grid ? { rowGap: 8 * s, marginHorizontal: -4 * s } : { gap: 8 * s }}>
      {Children.map(children, (child) => (
        <View style={grid ? { width: "50%", paddingHorizontal: 4 * s } : undefined}>{child}</View>
      ))}
    </View>
  );
  if (fold) {
    return (
      <View testID={testID}>
        <FoldSection id={fold.id} title={title} count={Children.count(children)} folded={fold.folded} onFold={fold.onFold}>
          {rows}
        </FoldSection>
      </View>
    );
  }
  return (
    <View testID={testID} style={{ gap: 10 * s }}>
      <Eyebrow header>{title}</Eyebrow>
      {rows}
    </View>
  );
}

/** The hero's primary: full width on a phone, a 320 pt plate on its left outside one. */
export function PrimaryPlate({ children }: { children: ReactNode }) {
  const { size, s } = useSizeClass();
  return size === "compact" ? children : <View style={{ alignSelf: "flex-start", width: 320 * s }}>{children}</View>;
}

// The number in a small capsule on a scenario's art: the pool's count badge (`pool/cards.tsx`, h-6 min-w-6, rounded-control, a drop
// shadow, the accent number) on the surface the diamond had, so it reads over a bright sky on both themes. The number is its row's label.
function NumberBadge({ number }: { number: number }) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <View
      importantForAccessibility="no"
      className="items-center justify-center rounded-control"
      style={{ minWidth: 24 * s, height: 24 * s, paddingHorizontal: 6 * s, backgroundColor: t.depth === "light" ? palette.raisedTop : withAlphaHex(palette.night, 0.82), boxShadow: dropShadowOf(t, 2, 6, 0.8) }}
    >
      <Text className="font-display" style={{ fontSize: 12 * s, lineHeight: 15 * s, color: palette.accentHigh }}>
        {String(number)}
      </Text>
    </View>
  );
}

/**
 * The catalog's tiles, wrapped. `posters` is how many poster tiles sit across a tablet's row (0 for a phone's rows); posters keep one
 * width on every row (a short last row does not stretch): each cell is a column's share, the gutter its padding.
 */
export function CatalogGrid({ posters, children }: { posters: number; children: ReactNode }) {
  const s = useUiScale();
  return (
    <View className={posters ? "flex-row flex-wrap" : undefined} style={posters ? { rowGap: 12 * s, marginHorizontal: -6 * s } : { gap: 8 * s }}>
      {children}
    </View>
  );
}

/**
 * One catalog entry on its scene: a 64 pt row on a phone (`posters` 0), a poster on a tablet. `number` is the book number in a small
 * capsule on the art. `tone` is the colour of `line`, which is left out when empty.
 */
export function CatalogTile({
  testID,
  sceneId,
  number,
  name,
  line,
  tone,
  accessibilityLabel,
  accessibilityHint,
  posters,
  onPress,
}: {
  testID: string;
  sceneId: string;
  number?: number;
  name: string;
  line: string;
  tone: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  posters: number;
  onPress: () => void;
}) {
  const palette = usePalette();
  const t = useTableTokens();
  const { size, s } = useSizeClass();
  const badge = number == null ? null : <NumberBadge number={number} />;
  // The row grows with its words (no line cap, so a larger text size is never cut); the art stops growing at 100 pt so the words keep the room.
  const artWidth = Math.min(86 * s, 100);
  const artHeight = (artWidth * 64) / 86;
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={posters ? { width: `${100 / posters}%`, paddingHorizontal: 6 * s } : undefined}
    >
      {({ pressed }) =>
        posters ? (
          <View className="overflow-hidden rounded-item" style={tileSurface(pressed, t)}>
            <SceneArt scenarioId={sceneId} height={(size === "expanded" ? 270 : 300) * s} fade={0.55} fadeTo={palette.dusk}>
              {badge ? (
                <View className="absolute" style={{ left: 12 * s, top: 12 * s }}>
                  {badge}
                </View>
              ) : null}
              <View className="absolute bottom-0 left-0 right-0" style={{ padding: 12 * s }}>
                <Text className="font-display text-heading text-bone" numberOfLines={3}>
                  {name}
                </Text>
                {line ? (
                  <Text className="text-label" style={{ color: tone }} numberOfLines={2}>
                    {line}
                  </Text>
                ) : null}
              </View>
            </SceneArt>
          </View>
        ) : (
          <View className="flex-row items-center gap-3.5 overflow-hidden rounded-item pr-3" style={rowSurface(pressed, t)}>
            <View style={{ width: artWidth, height: artHeight }}>
              <SceneArt scenarioId={sceneId} width={artWidth} height={artHeight} vivid>
                <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: withAlphaHex(palette.night, 0.15) }} />
              </SceneArt>
              {badge ? (
                <View className="absolute" style={{ left: 6 * s, bottom: 6 * s }}>
                  {badge}
                </View>
              ) : null}
            </View>
            <View className="min-w-0 flex-1 py-2">
              <Text className="font-display text-heading text-bone">{name}</Text>
              {line ? (
                <Text className="text-label" style={{ color: tone }}>
                  {line}
                </Text>
              ) : null}
            </View>
            <Chevron direction="right" color={palette.faint} size={8} />
          </View>
        )
      }
    </Pressable>
  );
}

/** What is not playable yet, as tiles that wrap (two to a row at phone width, so a name never breaks inside a word): faint, a locked ring, not pressable and read as one label. */
export function LockedTiles({ tiles, testID }: { tiles: readonly { id: string; name: string; caption: string }[]; testID?: string }) {
  const t = useTableTokens();
  return (
    <View className="flex-row flex-wrap gap-3 pt-1" testID={testID ?? "locked-tiles"}>
      {tiles.map((tile) => (
        <View
          key={tile.id}
          testID={`locked-${tile.id}`}
          accessible
          accessibilityLabel={`${tile.name}, ${tile.caption}`}
          className="min-h-32 min-w-[45%] flex-1 justify-end gap-1 rounded-item px-4 py-4"
          style={{ ...rowSurface(false, t), opacity: 0.78 }}
        >
          <RingMark size={14} state="locked" />
          <Text className="mt-2 font-display text-heading text-faint">{tile.name}</Text>
          <Text className="text-label text-faint">{tile.caption}</Text>
        </View>
      ))}
    </View>
  );
}

// The right column of the two-column hub (docs/design-system.md, Tablets).
const SIDE_RANGE = { min: 360, max: 440 };

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/**
 * The hub's page: the head, then the hero over its scene, the other runs, the catalog and Coming later, in that order. On a tablet in
 * landscape with room for two columns (docs/design-system.md, Tablets) and both a hero and other runs, the hero is on the left over
 * its scene and the other runs on the right; the catalog and Coming later go full width below. Else one column. The hero's scene is
 * `sceneId`; with no hero the page takes the moon backdrop and no art. `hero` is the run's words and fellowship, `heroAction` the
 * primary under them: a tablet keeps the action (and, in one column, the whole hero) to a readable measure. `onCatalogLayout` gives
 * the y of the catalog in the scroll's content, so a screen can scroll it into view.
 */
export function HubPage({
  testID,
  title,
  actions,
  hero,
  heroAction,
  heroTestID,
  sceneId,
  others,
  catalog,
  coming,
  scrollRef,
  onCatalogLayout,
}: {
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
  catalog: ReactNode;
  coming?: ReactNode;
  scrollRef?: RefObject<ComponentRef<typeof ScrollView> | null>;
  onCatalogLayout?: (y: number) => void;
}) {
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
  const header = (
    <HubHeader title={title}>
      {actions}
    </HubHeader>
  );
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
  // The catalog and Coming later are the page's last block, a direct child of the scroll's content so its y is the content's.
  const lower = (
    <View style={{ gap: 18 * s, paddingTop: hero || others ? 18 * s : 0 }} onLayout={(event) => onCatalogLayout?.(event.nativeEvent.layout.y)}>
      {catalog}
      {coming}
    </View>
  );
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
      {lower}
    </>
  ) : (
    <>
      {header}
      <View style={{ gap: 18 * s, paddingTop: heroDrop, ...measure }}>
        {heroBlock}
        {others}
      </View>
      {lower}
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

  return (
    // Over its scene the page takes the hero backdrop, whose fog stays below the picture (HeroArt draws its own over it).
    <Screen testID={testID} scene={art ? "hero" : "moon"} art={art}>
      {/* An expanded window scrolls in a wide column; the measurer (outside the columns) decides whether it splits, else one readable column. */}
      <ScreenScroll scrollRef={scrollRef} max={size === "expanded" ? "wide" : "readable"}>
        {size === "expanded" ? <View style={{ height: 0 }} onLayout={columns.measure} /> : null}
        {page}
      </ScreenScroll>
    </Screen>
  );
}
