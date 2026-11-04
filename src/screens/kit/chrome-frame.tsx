// The chrome's frame (docs/design-system.md, Components): the page and its scrolling body, the top bar, rows, panels, stat tiles,
// the pinned action bar, the paper sheet and the outcome word. Re-exported by chrome.tsx.
import { useContext, type ComponentRef, type ReactNode, type RefObject } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop } from "../art/backdrop";
import { useBottomInset } from "../nav/use-bottom-inset";
import { useOverrun } from "../nav/use-overrun";
import type { SceneName } from "../art/backdrop-scenes";
import { IconButton } from "./chrome-buttons";
import { Chevron } from "./chrome-marks";
import { Eyebrow } from "./chrome-text";
import { usePalette } from "./palette-hook";
import { GameIcon } from "../../ui/game-icon";
import type { IconName } from "../../ui/icon-map";
import { SheetCornersContext, SheetFrame } from "../../play/choice/sheet-paper";
import { nightFade, panelSurface, rowSurface, selectedWash, tileSurface } from "../../ui/surfaces";
import { useTableTokens } from "../../ui/use-table-tokens";
import { withAlphaHex } from "../../ui/tokens";
import { ACTION_GROUP, MEDIUM_ACTION_GROUP, capWidth } from "../../ui/size-class";
import { touch, useUiScale } from "../../ui/ui-scale";
import { useSizeClass } from "../../ui/use-size-class";
import { Text } from "../../ui/text";

/**
 * The page: the ground and its fog (the scene), an optional art layer, then the content, inset 24 and starting under the status bar; in landscape (the card and booklet
 * screens can turn with the phone) it is inset past the side safe areas too. `bleed` drops both, for a screen that opens on a
 * picture running under the status bar (the briefing, the deck editor): it insets its own words.
 */
export function Screen({
  children,
  testID,
  scene = "calm",
  inset = true,
  bleed = false,
  art,
}: {
  children: ReactNode;
  testID?: string;
  scene?: SceneName;
  inset?: boolean;
  bleed?: boolean;
  // The art layer between the fog and the content (HeroArt): a scene behind the hero words, under the status bar.
  art?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const s = useUiScale();
  return (
    <View testID={testID} collapsable={false} className="flex-1 overflow-hidden bg-night">
      <Backdrop scene={scene} />
      {art}
      {/* The top inset is a style, not NativeWind's pt-safe: one source of insets for the whole screen. */}
      <View className="flex-1" style={bleed ? undefined : { paddingTop: insets.top, ...(inset ? { paddingLeft: 24 * s + insets.left, paddingRight: 24 * s + insets.right } : {}) }}>
        {children}
      </View>
    </View>
  );
}

/**
 * The scrolling body of a screen. It reaches 8 pt past the page inset on each side, with the same padding inside, so a floating
 * panel's shadow and a selected ring are not cut by the scroll edge. `max` caps and centres the content outside compact: a reading
 * column (640) or a wide one (1040), at the scale (docs/design-system.md, Tablets); a phone is never capped.
 */
export function ScreenScroll({
  children,
  top = 0,
  bottom = 32,
  testID,
  scrollRef,
  max,
  align = "center",
}: {
  children: ReactNode;
  top?: number;
  bottom?: number;
  testID?: string;
  scrollRef?: RefObject<ComponentRef<typeof ScrollView> | null>;
  max?: "readable" | "wide";
  // Where a capped column sits: centred (the default), or at the start of a pane the trail should stay at the edge of.
  align?: "center" | "start";
}) {
  const { size, s } = useSizeClass();
  const cap = max ? capWidth(size, max, s) : null;
  return (
    <ScrollView
      ref={scrollRef}
      testID={testID}
      className="min-h-0 flex-1"
      style={{ marginHorizontal: -8 * s }}
      contentContainerStyle={{ paddingHorizontal: 8 * s, paddingTop: top * s, paddingBottom: bottom * s, ...(cap == null ? {} : { width: "100%", maxWidth: cap + 16 * s, alignSelf: align === "start" ? "flex-start" : "center" }) }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/**
 * The dark band that appears behind a floating NavBar once the picture under it has scrolled away, so the round buttons never
 * sit on words. It switches at one threshold, with no motion on the scroll path.
 */
export function FloatingBarShade({ shown, top }: { shown: boolean; top: number }) {
  const palette = usePalette();
  const s = useUiScale();
  if (!shown) return null;
  // Solid behind the buttons, then falling to nothing below them: no hard edge where the shade stops (user request, 2026-10-30).
  const height = top + 104 * s;
  const solid = Math.round(((top + 56 * s) / height) * 100);
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: 0, right: 0, top: 0, height, backgroundImage: `linear-gradient(180deg, ${withAlphaHex(palette.night, 0.94)} ${solid}%, ${withAlphaHex(palette.night, 0)} 100%)` }}
    />
  );
}

/**
 * The top of a screen: a round glass Back on the left, an optional title in Marcellus SC (and a muted line under it) centred, and
 * one optional control on the right (the book, the gear). Back goes to the screen below; its label names that screen to a screen reader ("Back to Decks").
 */
export function NavBar({
  onBack,
  backTestID,
  backLabel = "Back",
  title,
  subtitle,
  right,
}: {
  onBack: () => void;
  backTestID: string;
  backLabel?: string;
  title?: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const s = useUiScale();
  return (
    // box-none: floating over a scrolling page, the bar takes only its buttons' touches, so the rows under its empty middle stay live.
    <View pointerEvents="box-none" className="min-h-14 flex-row items-center justify-between gap-3 py-1">
      <IconButton chevron testID={backTestID} label={backLabel === "Back" ? "Back" : `Back to ${backLabel}`} onPress={onBack} />
      {title ? (
        <View className="flex-1 items-center">
          <Text accessibilityRole="header" numberOfLines={1} className="font-display text-title text-bone">
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} className="text-label text-muted">
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : (
        <View className="flex-1" />
      )}
      {right ?? <View style={{ width: touch(s, 44) }} />}
    </View>
  );
}

/**
 * A row on a dark wash with no edge: rows are told apart by the space between them (6 pt), not by rules. Text, at most one small
 * picture, a title in Marcellus SC, a pressed fill, a drawn chevron. No shadow and no gradient, so a FlashList can hold it. In a
 * list-detail pane `selected` (true or false; undefined outside one) marks the row whose detail is open: the selected wash and a 3 pt
 * accent bar at the leading edge.
 */
export function ListRow({
  label,
  detail,
  onPress,
  onLongPress,
  testID,
  leading,
  trailing,
  detailIcons,
  selected,
}: {
  label: string;
  detail?: string;
  // A long press on a card row shows the card large (src/play/cards/card-preview.tsx).
  onLongPress?: () => void;
  // Small game icons before the detail line (a sphere, a cost). The detail stays words.
  detailIcons?: ReactNode;
  onPress: () => void;
  testID: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
}) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      accessibilityState={selected == null ? undefined : { selected }}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      className="mb-1.5"
    >
      {/* The surface is on a view inside: NativeWind drops a style function on a Pressable that also has a className. */}
      {({ pressed }) => (
        <View className="min-h-14 flex-row items-center overflow-hidden rounded-item py-2" style={{ paddingLeft: 14 * s, paddingRight: 10 * s, ...(selected ? selectedWash(t) : rowSurface(pressed, t)) }}>
          {selected ? <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3 * s, backgroundColor: palette.accentHigh }} /> : null}
          {leading ? <View className="mr-3">{leading}</View> : null}
          <View className="flex-1">
            <Text className={`font-display text-heading ${selected ? "text-accentHigh" : "text-bone"}`}>{label}</Text>
            {detail ? (
              <View className="mt-0.5 flex-row items-center gap-1.5">
                {detailIcons}
                <Text className="shrink text-label text-muted">{detail}</Text>
              </View>
            ) : null}
          </View>
          {trailing ?? (
            <View className="w-6 items-center">
              <Chevron direction="right" color={palette.faint} size={8} />
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

/**
 * A floating panel: lit along its top edge and lifted by its shadow, with no drawn edge (Carved Stone rings only what is selected).
 * `pressed` is the pressed fill. `unfilled` is a thing put away: no fill and no shadow, its contents dimmed by the caller.
 */
export function Panel({
  children,
  pressed = false,
  unfilled = false,
  className,
  padded = true,
}: {
  children: ReactNode;
  pressed?: boolean;
  unfilled?: boolean;
  className?: string;
  // False for a panel whose content runs to its edges (a picture on top).
  padded?: boolean;
}) {
  const t = useTableTokens();
  const look = panelSurface(pressed, t);
  return (
    <View
      className={`rounded-container ${padded ? "p-4" : "overflow-hidden"}${className ? ` ${className}` : ""}`}
      style={unfilled ? { backgroundColor: withAlphaHex(t.raised, 0.35) } : look}
    >
      {children}
    </View>
  );
}

/**
 * A number the player watches, on a small lit tile: its word in small capitals above, its icon and value in Marcellus SC under it.
 * `tone` colours the value (danger for the final threat).
 */
export function StatTile({
  label,
  value,
  icon,
  iconTint = "bone",
  detail,
  children,
  testID,
  tone = "bone",
}: {
  label: string;
  value: string;
  icon?: IconName;
  iconTint?: "bone" | "danger" | "accent";
  detail?: string;
  children?: ReactNode;
  testID?: string;
  tone?: "bone" | "danger";
}) {
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <View testID={testID} accessible accessibilityLabel={`${label} ${value}${detail ? ` ${detail}` : ""}`} className="flex-1 items-center rounded-item px-2 py-2.5" style={tileSurface(false, t)}>
      <Text className="font-bold uppercase text-faint" style={{ fontSize: 10 * s, lineHeight: 13 * s, letterSpacing: 1.4 * s }} numberOfLines={1}>
        {label}
      </Text>
      <View className="flex-row items-center gap-1.5">
        {icon ? <GameIcon name={icon} size={16 * s} tint={iconTint} /> : null}
        <Text className={`font-display ${tone === "danger" ? "text-danger" : "text-bone"}`} style={{ fontSize: 26 * s, lineHeight: 32 * s }}>
          {value}
        </Text>
        {detail ? <Text className="text-label text-muted">{detail}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/**
 * The bar pinned at the foot of a screen, in thumb reach: the screen's primary and what sits beside it. The content scrolls
 * under a fade to the ground above it. `safe` keeps it above the home indicator on a screen with no tab bar. The band stays full width;
 * outside compact its buttons sit in a group: 480 centred in medium (narrower than the 640 reading column), 420 at the trailing edge in expanded, where the thumb is; the primary is the last child, so it is the rightmost.
 * `align="fill"` keeps the buttons full width, for a bar inside a pane (docs/design-system.md, Tablets).
 */
export function ActionBar({ children, safe = true, testID, align = "auto" }: { children: ReactNode; safe?: boolean; testID?: string; align?: "auto" | "fill" }) {
  const palette = usePalette();
  const t = useTableTokens();
  const { size, s } = useSizeClass();
  const group = align === "fill" || size === "compact" ? null : size === "medium" ? { width: "100%" as const, maxWidth: MEDIUM_ACTION_GROUP * s, alignSelf: "center" as const } : { width: "100%" as const, maxWidth: ACTION_GROUP * s, alignSelf: "flex-end" as const };
  // The bottom inset is measured by the native view itself and, as well, never less than the portrait one seen before
  // (bottom-inset.ts): back from the landscape table, the provider's insets can still be the landscape ones (no bottom inset) and
  // the bar would sit under the phone's own buttons.
  const bottom = useBottomInset();
  // And it never runs past the app's root view: where a screen is laid out taller than the window (the campaign path on a phone,
  // user report, 2026-10-29), the overrun is added to the padding, so the buttons stay in view (use-overrun.ts).
  const { ref: barRef, onLayout: onBarLayout, overrun: past } = useOverrun();
  return (
    <SafeAreaView
      ref={barRef}
      onLayout={onBarLayout}
      testID={testID}
      collapsable={false}
      edges={safe ? { bottom: "maximum" } : []}
      style={{ paddingTop: 10.5 * s, paddingBottom: (safe ? Math.max(bottom, 12 * s) : 12 * s) + past }}
    >
      <View pointerEvents="none" style={{ position: "absolute", left: -24 * s, right: -24 * s, top: -24 * s, height: 24 * s, ...nightFade(0, 1, undefined, t) }} />
      <View pointerEvents="none" style={{ position: "absolute", left: -24 * s, right: -24 * s, top: 0, bottom: 0, backgroundColor: palette.night }} />
      {group ? <View style={group}>{children}</View> : children}
    </SafeAreaView>
  );
}

/** Parchment sheet over the rail or a list, on the table sheets' frame. Repeats the step in an eyebrow. */
export function PaperSheet({ step, title, children }: { step?: string; title: string; children: ReactNode }) {
  // A sheet floating centred (SheetModal outside compact) is not pulled down from its top edge, so it has no grabber.
  const floating = useContext(SheetCornersContext) === "all";
  return (
    <SheetFrame animated={false}>
      {floating ? null : <View className="mb-4 h-1 w-10 self-center rounded-control bg-inkLine" />}
      <View className="items-center">
        {step ? <Eyebrow tone="inkLabel">{step}</Eyebrow> : null}
        <Text className={`${step ? "mt-1 " : ""}text-center font-display text-title text-ink`}>{title}</Text>
      </View>
      <View className="mt-5">{children}</View>
    </SheetFrame>
  );
}

/**
 * Victory or Defeat: the outcome word in Marcellus SC 50 pt (72 on a tablet), tracked wide, inside a glowing ring with the One Ring
 * faint in it, and the scenario's name under it. Silver for a win, threat red for a loss. Resolution and the standalone outcome both
 * say it this way.
 */
export function OutcomeTitle({ won, scenario, testID }: { won: boolean; scenario: string; testID: string }) {
  const palette = usePalette();
  const t = useTableTokens();
  const { size, s } = useSizeClass();
  const big = size === "compact" ? 50 : 72;
  const ring = (size === "compact" ? 240 : 330) * s;
  const light = t.depth === "light";
  const tone = won ? (light ? palette.accent : palette.glow) : palette.threat;
  return (
    <View className="items-center justify-center" style={{ height: ring }}>
      <View
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        style={{
          position: "absolute",
          width: ring,
          height: ring,
          borderRadius: ring / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundImage: `radial-gradient(50% 50% at 50% 50%, ${withAlphaHex(tone, 0.12)} 0%, ${withAlphaHex(tone, 0.02)} 70%, ${withAlphaHex(tone, 0)} 100%)`,
          boxShadow: `0 0 40px ${withAlphaHex(tone, 0.3)}, inset 0 0 30px ${withAlphaHex(tone, 0.2)}`,
        }}
      >
        <View style={{ opacity: 0.12 }}>
          <GameIcon name="oneRing" size={ring * 0.62} tint={won ? "bone" : "danger"} />
        </View>
      </View>
      <Text
        testID={testID}
        accessibilityRole="header"
        className={`text-center font-display ${won ? "text-accentHigh" : "text-danger"}`}
        style={{
          fontSize: big * s,
          lineHeight: big * 1.2 * s,
          letterSpacing: (big >= 72 ? 8 : 6) * s,
          ...(light ? {} : { textShadowColor: won ? withAlphaHex(palette.glow, 0.7) : withAlphaHex(palette.threat, 0.7), textShadowRadius: 24, textShadowOffset: { width: 0, height: 0 } }),
        }}
      >
        {won ? "Victory" : "Defeat"}
      </Text>
      <Text className="mt-1 text-center font-display text-heading text-muted">{scenario}</Text>
    </View>
  );
}
