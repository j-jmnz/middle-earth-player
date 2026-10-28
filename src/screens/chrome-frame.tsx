// The chrome's frame (docs/design-system.md, Components): the page and its scrolling body, the top bar, rows, panels, stat tiles,
// the pinned action bar, the paper sheet and the outcome word. Re-exported by chrome.tsx.
import type { ComponentRef, ReactNode, RefObject } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop } from "./backdrop";
import type { SceneName } from "./backdrop-scenes";
import { IconButton, usePressedNight } from "./chrome-buttons";
import { Chevron, Corners } from "./chrome-marks";
import { Eyebrow } from "./chrome-text";
import { usePalette } from "./palette-hook";
import { GameIcon } from "../play/game-icon";
import type { IconName } from "../play/icon-map";
import { SheetFrame } from "../play/sheet-paper";
import { nightFade, panelSurface, raisedEdgeOf, tileSurface } from "../play/surfaces";
import { useTableTokens } from "../play/use-table-tokens";
import { withAlphaHex } from "../play/tokens";

/**
 * Night page with a scene backdrop. Content is inset 24 and starts under the status bar; in landscape (the card and booklet
 * screens can turn with the phone) it is inset past the side safe areas too. `bleed` drops both, for a screen that opens on a
 * picture running under the status bar (the briefing, the deck editor): it insets its own words.
 */
export function Screen({
  children,
  testID,
  scene = "plain",
  inset = true,
  bleed = false,
}: {
  children: ReactNode;
  testID?: string;
  scene?: SceneName;
  inset?: boolean;
  bleed?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View testID={testID} collapsable={false} className="flex-1 bg-night">
      <Backdrop scene={scene} />
      <View className={bleed ? "flex-1" : "flex-1 pt-safe"} style={inset && !bleed ? { paddingLeft: 24 + insets.left, paddingRight: 24 + insets.right } : undefined}>
        {children}
      </View>
    </View>
  );
}

/**
 * The scrolling body of a screen. It reaches 8 pt past the page inset on each side, with the same padding inside, so a framed
 * panel's corner ornaments (Corners) are not cut by the scroll edge.
 */
export function ScreenScroll({ children, top = 0, bottom = 32, testID, scrollRef }: { children: ReactNode; top?: number; bottom?: number; testID?: string; scrollRef?: RefObject<ComponentRef<typeof ScrollView> | null> }) {
  return (
    <ScrollView
      ref={scrollRef}
      testID={testID}
      className="min-h-0 flex-1"
      style={{ marginHorizontal: -8 }}
      contentContainerStyle={{ paddingHorizontal: 8, paddingTop: top, paddingBottom: bottom }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/**
 * The night bar that appears behind a floating NavBar once the picture under it has scrolled away, so the round buttons never
 * sit on words. It switches at one threshold, with no motion on the scroll path.
 */
export function FloatingBarShade({ shown, top }: { shown: boolean; top: number }) {
  const palette = usePalette();
  if (!shown) return null;
  return <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: top + 60, backgroundColor: withAlphaHex(palette.night, 0.94), borderBottomWidth: 1, borderBottomColor: palette.hairline }} />;
}

/**
 * The top of a screen: a round Back on the left, an optional title (and a muted line under it) centred, and one optional
 * control on the right. Back goes to the screen below; its label names that screen to a screen reader ("Back to Decks").
 */
export function NavBar({
  onBack,
  backTestID,
  backLabel = "Back",
  title,
  subtitle,
  right,
  overlay = false,
}: {
  onBack: () => void;
  backTestID: string;
  backLabel?: string;
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  // Over a picture: the buttons take a night disc.
  overlay?: boolean;
}) {
  return (
    // box-none: floating over a scrolling page, the bar takes only its buttons' touches, so the rows under its empty middle stay live.
    <View pointerEvents="box-none" className="min-h-14 flex-row items-center justify-between gap-3 py-1">
      <IconButton chevron overlay={overlay} testID={backTestID} label={backLabel === "Back" ? "Back" : `Back to ${backLabel}`} onPress={onBack} />
      {title ? (
        <View className="flex-1 items-center">
          <Text accessibilityRole="header" numberOfLines={1} className="font-display text-heading text-bone">
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
      {right ?? <View style={{ width: 44 }} />}
    </View>
  );
}

/** Flat row on a hairline. Text, at most one small picture, a pressed fill. No shadow, no gradient. */
export function ListRow({
  label,
  detail,
  onPress,
  onLongPress,
  testID,
  leading,
  trailing,
  detailIcons,
}: {
  label: string;
  detail?: string;
  // A long press on a card row shows the card large (src/play/card-preview.tsx).
  onLongPress?: () => void;
  // Small game icons before the detail line (a sphere, a cost). The detail stays words.
  detailIcons?: ReactNode;
  onPress: () => void;
  testID: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  const palette = usePalette();
  const pressedNight = usePressedNight();
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      className="min-h-14 flex-row items-center border-b border-hairline py-2"
      style={({ pressed }) => (pressed ? pressedNight : undefined)}
    >
      {leading ? <View className="mr-3">{leading}</View> : null}
      <View className="flex-1">
        <Text className="text-body text-bone">{label}</Text>
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
    </Pressable>
  );
}

/**
 * Raised panel, lit from its top edge. `current` gets the gold frame (a goldLine edge and gold corners): the one thing the player
 * should look at. `pressed` is the pressed fill. `unfilled` is a hairline outline with no fill, for a thing put away.
 */
export function Panel({
  children,
  current = false,
  pressed = false,
  unfilled = false,
  className,
  padded = true,
}: {
  children: ReactNode;
  current?: boolean;
  pressed?: boolean;
  unfilled?: boolean;
  className?: string;
  // False for a panel whose content runs to its edges (a picture on top).
  padded?: boolean;
}) {
  const palette = usePalette();
  const t = useTableTokens();
  return (
    <View
      className={`rounded-card ${padded ? "p-5" : ""}${className ? ` ${className}` : ""}`}
      style={{
        ...(unfilled ? { backgroundColor: "transparent" } : panelSurface(pressed, t)),
        borderWidth: 1,
        // A filled panel draws no edge (its fill and lit top set it off); one put away keeps the hairline, its only outline.
        borderColor: current ? palette.goldLine : unfilled ? palette.hairline : "transparent",
        ...(unfilled ? {} : { boxShadow: raisedEdgeOf(t) }),
      }}
    >
      {children}
      {current ? <Corners /> : null}
    </View>
  );
}

/** A number the player watches, on a small lit tile: its word above, its icon and value in engraved figures. */
export function StatTile({ label, value, icon, iconTint = "bone", detail, children, testID }: { label: string; value: string; icon?: IconName; iconTint?: "bone" | "danger" | "gold"; detail?: string; children?: ReactNode; testID?: string }) {
  const t = useTableTokens();
  return (
    <View testID={testID} accessible accessibilityLabel={`${label} ${value}${detail ? ` ${detail}` : ""}`} className="flex-1 rounded-tile px-3 py-2.5" style={tileSurface(false, t)}>
      <Text className="text-label text-muted">{label}</Text>
      <View className="flex-row items-center gap-1.5">
        {icon ? <GameIcon name={icon} size={16} tint={iconTint} /> : null}
        <Text className="font-display-bold text-title text-bone">{value}</Text>
        {detail ? <Text className="text-label text-muted">{detail}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/**
 * The bar pinned at the foot of a screen, in thumb reach: the screen's primary and what sits beside it. The content scrolls
 * under a night fade above it. `safe` keeps it above the home indicator on a screen with no tab bar.
 */
export function ActionBar({ children, safe = true, testID }: { children: ReactNode; safe?: boolean; testID?: string }) {
  const palette = usePalette();
  const t = useTableTokens();
  const insets = useSafeAreaInsets();
  return (
    <View testID={testID} collapsable={false} className="pt-3" style={{ paddingBottom: safe ? Math.max(insets.bottom, 12) : 12 }}>
      <View pointerEvents="none" style={{ position: "absolute", left: -24, right: -24, top: -24, height: 24, ...nightFade(0, 1, undefined, t) }} />
      <View pointerEvents="none" style={{ position: "absolute", left: -24, right: -24, top: 0, bottom: 0, backgroundColor: palette.night }} />
      {children}
    </View>
  );
}

/** Parchment sheet over the rail or a list, on the table sheets' frame. Repeats the step in an eyebrow. */
export function PaperSheet({ step, title, children }: { step: string; title: string; children: ReactNode }) {
  return (
    <SheetFrame animated={false}>
      <View className="mb-4 h-1 w-10 self-center rounded-pill bg-inkLine" />
      <View className="items-center">
        <Eyebrow tone="inkLabel">{step}</Eyebrow>
        <Text className="mt-1 text-center font-display text-title text-ink">{title}</Text>
      </View>
      <View className="mt-5">{children}</View>
    </SheetFrame>
  );
}

/**
 * Victory or Defeat: the outcome word in Cinzel Bold 44 pt with its glow (gold, or threat red), and the scenario's name under it.
 * Resolution and the standalone outcome both say it this way.
 */
export function OutcomeTitle({ won, scenario, testID }: { won: boolean; scenario: string; testID: string }) {
  const palette = usePalette();
  return (
    <>
      <Text
        testID={testID}
        accessibilityRole="header"
        className={`text-center font-display-bold ${won ? "text-goldHigh" : "text-danger"}`}
        style={{ fontSize: 44, lineHeight: 52, letterSpacing: 4, textShadowColor: won ? palette.gold : withAlphaHex(palette.threat, 0.6), textShadowRadius: 18, textShadowOffset: { width: 0, height: 0 } }}
      >
        {won ? "Victory" : "Defeat"}
      </Text>
      <Text className={`mt-1 text-center font-display text-heading ${won ? "text-bone" : "text-muted"}`}>{scenario}</Text>
    </>
  );
}
