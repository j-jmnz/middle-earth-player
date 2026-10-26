// The table's top bar, 44 pt, three zones and nothing else (docs/design-system.md, Table): the threat dials at the left (then
// Life and the Burden deck), the phase rail centered on the bar, and the menu button at the right. Back, Log, Rules, Booklet
// and Table settings are in the menu (src/play/table-menu.tsx). The bar holds no state of its own beyond measurements; the
// table view passes the numbers and the handlers.
import { useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";

import type { Rail } from "../play/rail";
import type { SeatThreat } from "../play/selectors";
import { PhaseRail, ThreatRing } from "../play/table-chrome";
import { MenuButton } from "../play/table-menu";
import { barZones, railWide } from "../play/top-bar-layout";

export const TOP_BAR = 44;

export type TopBarProps = {
  threats: readonly SeatThreat[];
  // The shown seat, whose label is gold in two-handed play.
  seat: number;
  life: number | null;
  burdenDeck: number | null;
  rail: Rail;
  // A small phone in landscape (under 760 pt inside the insets).
  narrow: boolean;
  ticks: readonly number[];
  menuOpen: boolean;
  onThreat: (seat: number) => void;
  onRail: () => void;
  onMenu: () => void;
};

export function TableTopBar({ threats, seat, life, burdenDeck, rail, narrow, ticks, menuOpen, onThreat, onRail, onMenu }: TopBarProps) {
  const [bar, setBar] = useState(0);
  const [dials, setDials] = useState(0);
  const onBar = (event: LayoutChangeEvent) => setBar(Math.round(event.nativeEvent.layout.width));
  const onDials = (event: LayoutChangeEvent) => setDials(Math.round(event.nativeEvent.layout.width));
  const zones = bar > 0 ? barZones(bar - 16, dials) : null;
  return (
    <View testID="table-top-bar" className="flex-row items-center px-2" style={{ height: TOP_BAR }} onLayout={onBar}>
      <View testID="top-bar-left" style={{ width: zones?.left ?? "30%", overflow: "hidden", flexDirection: "row", alignItems: "center" }}>
        <View style={{ flexDirection: "row", flexShrink: 0 }} onLayout={onDials}>
          {threats.map((threat) => (
            <ThreatRing
              key={threat.seat}
              threat={threat}
              label={threats.length > 1 ? `P${threat.seat + 1}` : "Threat"}
              accessibilityName={threats.length > 1 ? `Player ${threat.seat + 1} threat` : "Threat"}
              active={threats.length > 1 && threat.seat === seat}
              compact
              ticks={ticks}
              onPress={() => onThreat(threat.seat)}
            />
          ))}
          {life != null ? <ThreatRing threat={{ seat: 0, threat: life, eliminated: false }} label="Life" testID="life" icon={null} elimination={false} compact /> : null}
          {burdenDeck != null ? <ThreatRing threat={{ seat: 0, threat: burdenDeck, eliminated: false }} label="Burden deck" testID="burden-deck" icon={null} elimination={false} compact /> : null}
        </View>
      </View>
      <View testID="top-bar-middle" style={{ width: zones?.rail ?? "40%" }}>
        <PhaseRail rail={rail} narrow={!zones || !railWide(zones.rail, narrow)} onPress={onRail} />
      </View>
      <View testID="top-bar-right" style={{ width: zones?.right ?? "30%", alignItems: "flex-end" }}>
        <MenuButton open={menuOpen} onPress={onMenu} />
      </View>
    </View>
  );
}
