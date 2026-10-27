// The table's top bar, 52 pt (TOP_BAR), three zones and nothing else (docs/design-system.md, Table): the threat dials at the left (then
// Life and the Burden deck), the phase rail centered on the bar, and the menu button at the right. Back, Log, Rules, Booklet
// and Table settings are in the menu (src/play/table-menu.tsx). The bar holds no state of its own beyond measurements; the
// table view passes the numbers and the handlers.
import { useEffect, useState } from "react";
import { ScrollView, View, type LayoutChangeEvent } from "react-native";

import { setDialsEdge } from "../play/bar-edge";
import { seatDial } from "../play/peek";
import type { Rail } from "../play/rail";
import type { SeatThreat } from "../play/selectors";
import { PhaseRail } from "../play/phase-rail";
import { ThreatRing } from "../play/table-chrome";
import { MenuButton } from "../play/table-menu";
import { tableTokens as t, withAlphaHex } from "../play/tokens";
import { barZones, railWide, TOP_BAR } from "../play/top-bar-layout";

export { TOP_BAR };
// The scroll fade: this many bands of this width, rising to nearly the felt.
const FADE_BANDS = 7;
const FADE_BAND = 4;
const DIAL_GAP = 10;

export type TopBarProps = {
  threats: readonly SeatThreat[];
  // The seat the engine is asking, whose label is gold in two-handed play, and the seat peeked at (never the acting one) or null: that
  // dial gets a bone ring and an eye mark. A dial that is not shown peeks when tapped (src/play/peek.ts).
  acting: number;
  viewed: number | null;
  life: number | null;
  burdenDeck: number | null;
  rail: Rail;
  // Stops are on and one of the player's stops lies ahead in this phase: a gold S by the next phase.
  stopAhead: boolean;
  // The phase carousel is open.
  carouselOpen: boolean;
  // A small phone in landscape (under 760 pt inside the insets).
  narrow: boolean;
  ticks: readonly number[];
  // The seat holding the Ring-bearer facedown and what to say of it (a Ring mark on its dial), or null.
  ringSeat?: number | null;
  ringWords?: string | null;
  menuOpen: boolean;
  onThreat: (seat: number) => void;
  onRail: () => void;
  onMenu: () => void;
};

export function TableTopBar({ threats, acting, viewed, life, burdenDeck, rail, stopAhead, carouselOpen, narrow, ticks, ringSeat = null, ringWords = null, menuOpen, onThreat, onRail, onMenu }: TopBarProps) {
  const [bar, setBar] = useState(0);
  const [dials, setDials] = useState(0);
  const onBar = (event: LayoutChangeEvent) => setBar(Math.round(event.nativeEvent.layout.width));
  const onDials = (event: LayoutChangeEvent) => setDials(Math.round(event.nativeEvent.layout.width));
  // The zones need the bar and the dials measured. Until both are, the rail is held invisible rather than drawn at a guess, so it
  // never jumps when the table opens.
  // If the dials never report a width, the rail still shows after a moment, on a dial width of 0.
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), 400);
    return () => clearTimeout(timer);
  }, []);
  const zones = bar > 0 && (dials > 0 || waited) ? barZones(bar - 16, dials) : null;
  // The tray's outside-tap layer over the bar stops where the dials end, so a dial tap reaches the dial (src/play/bar-edge.ts).
  const edge = zones ? 8 + Math.min(dials, zones.left) : 0;
  useEffect(() => setDialsEdge(edge), [edge]);
  return (
    <View testID="table-top-bar" className="flex-row items-center px-2" style={{ height: TOP_BAR }} onLayout={onBar}>
      <View testID="top-bar-left" style={{ width: zones?.left ?? "30%" }}>
        {/* The scroll view is taller than the bar so a dial's pop (scale 1.22) is not clipped; it scrolls only when the dials
            are wider than the room the rail leaves, so none is cut. */}
        <ScrollView
          testID="top-bar-scroll"
          horizontal
          scrollEnabled={zones?.scroll ?? false}
          showsHorizontalScrollIndicator={false}
          style={{ height: TOP_BAR + 20, marginVertical: -10 }}
          contentContainerStyle={{ alignItems: "center", paddingVertical: 10 }}
        >
          {/* A gap between the dials, so a seat's label (P1) never runs into the next seat's dial. */}
          <View style={{ flexDirection: "row", flexShrink: 0, gap: DIAL_GAP }} onLayout={onDials}>
            {threats.map((threat) => {
              const dial = seatDial(threats.length, acting, viewed, threat.seat);
              return (
                <ThreatRing
                  key={threat.seat}
                  threat={threat}
                  label={threats.length > 1 ? `P${threat.seat + 1}` : "Threat"}
                  accessibilityName={threats.length > 1 ? `Player ${threat.seat + 1} threat` : "Threat"}
                  role={dial.role}
                  hint={dial.hint}
                  compact
                  ticks={ticks}
                  ring={ringSeat === threat.seat ? ringWords : null}
                  onPress={() => onThreat(threat.seat)}
                />
              );
            })}
            {life != null ? <ThreatRing threat={{ seat: 0, threat: life, eliminated: false }} label="Life" testID="life" icon={null} elimination={false} compact /> : null}
            {burdenDeck != null ? <ThreatRing threat={{ seat: 0, threat: burdenDeck, eliminated: false }} label="Burden" accessibilityName="Burden deck" testID="burden-deck" icon={null} elimination={false} compact /> : null}
          </View>
        </ScrollView>
        {/* The dials scroll: a fade at the right edge so a cut dial reads as more to scroll to (bands, no gradient library). */}
        {zones?.scroll ? (
          <View testID="top-bar-fade" pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: FADE_BANDS * FADE_BAND, flexDirection: "row" }}>
            {Array.from({ length: FADE_BANDS }, (_, band) => (
              <View key={band} style={{ width: FADE_BAND, backgroundColor: withAlphaHex(t.felt, ((band + 1) / FADE_BANDS) * 0.9) }} />
            ))}
          </View>
        ) : null}
      </View>
      <View testID="top-bar-middle" collapsable={false} style={{ width: zones?.rail ?? "40%", opacity: zones ? 1 : 0 }} pointerEvents={zones ? "auto" : "none"} importantForAccessibility={zones ? "auto" : "no-hide-descendants"}>
        <PhaseRail rail={rail} wide={zones != null && railWide(zones.rail, narrow)} shortRound={narrow} stopAhead={stopAhead} open={carouselOpen} onPress={onRail} />
      </View>
      <View testID="top-bar-right" style={{ width: zones?.right ?? "30%", alignItems: "flex-end" }}>
        <MenuButton open={menuOpen} onPress={onMenu} />
      </View>
    </View>
  );
}
