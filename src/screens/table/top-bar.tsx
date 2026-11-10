// The table's top bar, 52 pt (TOP_BAR), three zones and nothing else (docs/design-system-table.md): the threat dials at the left (then
// Life and the Burden deck), the phase rail centered on the screen, and the menu button at the right. Back, Log, Rules, Booklet
// and Table settings are in the menu (src/play/chrome/table-menu.tsx). The bar holds no state of its own beyond measurements; the
// table view passes the numbers and the handlers.
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";

import { setDialsEdge } from "../../play/chrome/bar-edge";
import { GameIcon } from "../../ui/game-icon";
import { Text } from "../../ui/text";
import { seatDial } from "../../play/store/peek";
import type { Rail } from "../../play/phases/rail";
import type { SeatThreat } from "../../play/store/selectors";
import type { HeldDial } from "../../play/readouts/widgets";
import { PhaseRail } from "../../play/phases/phase-rail";
import { HeadingDial, ThreatRing } from "../../play/chrome/table-chrome";
import { IslandChip } from "../../play/dream-chaser/island-chip";
import type { IslandReadout } from "../../play/dream-chaser/island-table";
import type { HeadingStep } from "../../play/dream-chaser/heading";
import { MenuButton } from "../../play/chrome/table-menu";
import { useTableTokens } from "../../ui/use-table-tokens";
import { withAlphaHex } from "../../ui/tokens";
import { BAR_PAD, barZones, chipCompact, DIAL_GAP, dialScale, EDGE_FADE, HEADING_BADGE_OVER, headingCompact, headingOffset, railWide, TOP_BAR } from "../../play/chrome/top-bar-layout";
import { UiScaleContext, useUiScale } from "../../ui/ui-scale";

export { TOP_BAR };
// The scroll fade: this many bands of this width (EDGE_FADE in all), rising to nearly the felt.
const FADE_BANDS = 7;
const FADE_BAND = EDGE_FADE / FADE_BANDS;
const NO_TICKS: readonly number[] = [];
const NO_HELD: readonly HeldDial[] = [];

export type TopBarProps = {
  threats: readonly SeatThreat[];
  // The seat the engine is asking, whose label is accent in two-handed play, and the seat peeked at (never the acting one) or null: that
  // dial gets a bone ring and an eye mark. A dial that is not shown peeks when tapped (src/play/store/peek.ts).
  acting: number;
  viewed: number | null;
  life: number | null;
  burdenDeck: number | null;
  // The resource tokens on the campaign card (The Oath, 41050:A:3) or on the current stage (Journey in the Dark, 142041:B:3) and the card's name, or null
  // when its scenario has none.
  tokens?: { name: string; tokens: number } | null;
  // The Heading dial, after the seat dials, while the Heading card is in play (dcce.heading): the current step, and what a tap does (the Heading card's preview). Absent: no dial.
  heading?: { step: HeadingStep; onPress: () => void } | null;
  // The Island Map chip, right after the seat dials, while the game has a map (dcce.island-map): the map as the table reads it, and what a tap does (the map panel).
  island?: IslandReadout | null;
  onIsland?: () => void;
  // On Nightmare: opens the setup card next to the quest deck (the Eye of Sauron after the dials). Absent on Easy and Normal.
  onNightmare?: (() => void) | null;
  rail: Rail;
  // Stops are on and one of the player's stops lies ahead in this phase: an accent S by the next phase.
  stopAhead: boolean;
  // The phase carousel is open.
  carouselOpen: boolean;
  // A small phone in landscape (under 760 pt inside the insets).
  narrow: boolean;
  // Stage 2B has split the table: a peek shows the other seat's staging area and stage as well as its cards.
  areas?: boolean;
  // The engagement costs marked on each dial, by seat.
  ticks: readonly (readonly number[])[];
  // The pursuit value of The Uruk-hai and the value at which the players lose (mec112.pursuit), or null: a dial after Life that warms toward the limit.
  pursuit?: { value: number; limit: number } | null;
  // The seats that hold something facedown or as a Captive and what to say of each (a mark on its dial): the Ring-bearer under the Watcher, a prisoner, a hero an enemy holds, a Captive.
  held?: readonly HeldDial[];
  menuOpen: boolean;
  onThreat: (seat: number) => void;
  onRail: () => void;
  onMenu: () => void;
};

export function TableTopBar({ threats, acting, viewed, life, burdenDeck, tokens = null, heading = null, island = null, onIsland, onNightmare = null, rail, stopAhead, carouselOpen, narrow, areas, ticks, pursuit = null, held, menuOpen, onThreat, onRail, onMenu }: TopBarProps) {
  const t = useTableTokens();
  const s = useUiScale();
  const screen = useWindowDimensions();
  // The bar's width and its left edge on the screen: the table lays it out from the screen's left edge, after the left inset.
  const [bar, setBar] = useState({ width: 0, x: 0 });
  const [dials, setDials] = useState(0);
  // The Heading dial's place in the dials row, measured, so the row can scroll to it and the other dials' width can be told from it.
  const [headingBox, setHeadingBox] = useState({ x: 0, w: 0 });
  const onHeading = (event: LayoutChangeEvent) => setHeadingBox({ x: Math.round(event.nativeEvent.layout.x), w: Math.round(event.nativeEvent.layout.width) });
  // The Map chip's width in the row, measured: the chip drops its word "Map" when the dials would scroll with it (chipCompact).
  const [chipW, setChipW] = useState(0);
  const onChip = (event: LayoutChangeEvent) => setChipW(Math.round(event.nativeEvent.layout.width));
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const onBar = (event: LayoutChangeEvent) => setBar({ width: Math.round(event.nativeEvent.layout.width), x: Math.round(event.nativeEvent.layout.x) });
  const onDials = (event: LayoutChangeEvent) => setDials(Math.round(event.nativeEvent.layout.width));
  // The zones need the bar and the dials measured. Until both are, the rail is held invisible rather than drawn at a guess, so it
  // never jumps when the table opens.
  // If the dials never report a width, the rail still shows after a moment, on a dial width of 0.
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), 400);
    return () => clearTimeout(timer);
  }, []);
  // The zones are worked out inside the bar's side padding (px-2, 8 pt at every scale), so the screen's middle is counted from there.
  const center = screen.width / 2 - bar.x - BAR_PAD;
  const zones = bar.width > 0 && (dials > 0 || waited) ? barZones(bar.width - 2 * BAR_PAD, dials, s, center) : null;
  // The Heading dial drops its word and lays its badge under the disc when the dial at its full width would make the dials scroll; that is told from the other dials' width, not the dial's own.
  const others = heading ? dials - headingBox.w - DIAL_GAP * s : dials;
  const compact = heading != null && bar.width > 0 && dials > 0 && headingCompact(bar.width - 2 * BAR_PAD, others, s, center, narrow);
  const chipHere = island != null && onIsland != null;
  const mapCompact = chipHere && bar.width > 0 && dials > 0 && chipCompact(bar.width - 2 * BAR_PAD, dials - chipW - DIAL_GAP * s, s, center);
  // While the dials scroll, the row keeps the Heading dial whole in the zone, clear of the fade (headingOffset).
  const offset = zones && heading ? headingOffset(zones, { x: headingBox.x, w: headingBox.w }, dials, s) : 0;
  useEffect(() => {
    scroller.current?.scrollTo({ x: offset, animated: false });
  }, [offset]);
  // The tray's outside-tap layer over the bar stops where the dials end, so a dial tap reaches the dial (src/play/chrome/bar-edge.ts).
  const edge = zones ? BAR_PAD + Math.min(dials, zones.left) : 0;
  useEffect(() => setDialsEdge(edge), [edge]);
  return (
    <View testID="table-top-bar" className="flex-row items-center px-2" style={{ height: TOP_BAR * s }} onLayout={onBar}>
      <View testID="top-bar-left" style={{ width: zones?.left ?? "30%" }}>
        {/* The scroll view is taller than the bar so a dial's pop (scale 1.22) is not clipped; it scrolls only when the dials
            are wider than the room the rail leaves, so none is cut. */}
        <ScrollView
          ref={scroller}
          testID="top-bar-scroll"
          horizontal
          scrollEnabled={zones?.scroll ?? false}
          showsHorizontalScrollIndicator={false}
          style={{ height: (TOP_BAR + 20) * s, marginVertical: -10 * s }}
          contentContainerStyle={{ alignItems: "center", paddingVertical: 10 * s, paddingRight: zones?.scroll ? EDGE_FADE * s : 0 }}
        >
          {/* A gap between the dials, so a seat's label (P1) never runs into the next seat's dial. */}
          <View style={{ flexDirection: "row", flexShrink: 0, gap: DIAL_GAP * s }} onLayout={onDials}>
            {threats.map((threat) => {
              const dial = seatDial(threats.length, acting, viewed, threat.seat, areas);
              const holding = (held ?? NO_HELD).find((entry) => entry.seat === threat.seat);
              return (
                <UiScaleContext.Provider key={threat.seat} value={dialScale(s)}>
                  <ThreatRing
                    threat={threat}
                    label={threats.length > 1 ? `P${threat.seat + 1}` : "Threat"}
                    accessibilityName={threats.length > 1 ? `Player ${threat.seat + 1} threat` : "Threat"}
                    spokenWord="Threat"
                    role={dial.role}
                    hint={dial.hint}
                    compact
                    ticks={ticks[threat.seat] ?? NO_TICKS}
                    ring={holding?.words ?? null}
                    ringMark={holding?.mark}
                    onPress={() => onThreat(threat.seat)}
                  />
                </UiScaleContext.Provider>
              );
            })}
            {/* The Map chip follows the seat dials; it drops its word when the row would scroll with it. */}
            {island && onIsland ? (
              <View onLayout={onChip}>
                <IslandChip readout={island} compact={mapCompact} onPress={onIsland} />
              </View>
            ) : null}
            {heading ? (
              // The compact dial's badge reaches past it; the room it needs is part of the dial's place in the row, so the zones count it.
              <View onLayout={onHeading} style={{ paddingRight: compact ? HEADING_BADGE_OVER * s : 0 }}>
                <HeadingDial step={heading.step} compact={compact} onPress={heading.onPress} />
              </View>
            ) : null}
            {life != null ? <ThreatRing threat={{ seat: 0, threat: life, eliminated: false }} label="Life" testID="life" icon={null} elimination={false} compact /> : null}
            {pursuit != null ? <ThreatRing threat={{ seat: 0, threat: pursuit.value, eliminated: false }} label="Pursuit" accessibilityName="Pursuit value" testID="pursuit" icon={null} limit={pursuit.limit} compact /> : null}
            {tokens != null ? <ThreatRing threat={{ seat: 0, threat: tokens.tokens, eliminated: false }} label="Tokens" accessibilityName={`Resource tokens on ${tokens.name}`} testID="campaign-tokens" icon="resource" elimination={false} compact /> : null}
            {burdenDeck != null ? <ThreatRing threat={{ seat: 0, threat: burdenDeck, eliminated: false }} label="Burden" accessibilityName="Burden deck" testID="burden-deck" icon={null} elimination={false} compact /> : null}
            {onNightmare ? (
              // Laid out as Life, Tokens and Burden are (the mark, then its word), with the dials' pressed fill. The word stays at every
              // width: the peeked seat's eye mark is another eye.
              <Pressable
                testID="nightmare-card"
                accessibilityRole="button"
                accessibilityLabel="Nightmare setup card"
                accessibilityHint="Shows the Nightmare setup card"
                onPress={onNightmare}
                style={({ pressed }) => ({ minHeight: 44 * s, flexDirection: "row", alignItems: "center", gap: 6 * s, paddingHorizontal: 4 * s, borderRadius: 999, backgroundColor: pressed ? withAlphaHex(t.bone, 0.12) : "transparent" })}
              >
                <GameIcon name="nightmare" size={22 * s} tint="threat" />
                <Text className="text-label text-muted">Nightmare</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
        {/* The dials scroll: a fade at the right edge so a cut dial reads as more to scroll to (bands, no gradient library). */}
        {zones?.scroll ? (
          <View testID="top-bar-fade" pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: FADE_BANDS * FADE_BAND * s, flexDirection: "row" }}>
            {Array.from({ length: FADE_BANDS }, (_, band) => (
              <View key={band} style={{ width: FADE_BAND * s, backgroundColor: withAlphaHex(t.felt, ((band + 1) / FADE_BANDS) * 0.9) }} />
            ))}
          </View>
        ) : null}
      </View>
      <View testID="top-bar-middle" collapsable={false} style={{ width: zones?.rail ?? "40%", opacity: zones ? 1 : 0 }} pointerEvents={zones ? "auto" : "none"} importantForAccessibility={zones ? "auto" : "no-hide-descendants"}>
        <PhaseRail rail={rail} wide={zones != null && railWide(zones.rail, narrow, s)} stopAhead={stopAhead} open={carouselOpen} onPress={onRail} />
      </View>
      <View testID="top-bar-right" style={{ width: zones?.right ?? "30%", alignItems: "flex-end" }}>
        <MenuButton open={menuOpen} onPress={onMenu} />
      </View>
    </View>
  );
}
