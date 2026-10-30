// The skip catcher over the top bar and the dock while the combat spotlight plays (docs/design-system.md, Table, Spotlight; phase 24,
// reduced by docs/plans/done/combat-spotlight-redesign.md). The dark is drawn by the spotlight's own layer; these transparent React Native
// views only catch the skip tap: a touch anywhere on them skips every attack of the moment on press (not on release; a click too
// quick to report a press skips on release), and reaches nothing under it. They exist only while the gate is open (spotlight-gate.ts),
// so they are absent under reduced motion, with the spotlight switched off and on the web, and a tray's outside-tap fold, the
// popovers' outside tap and Android Back are untouched once the gate ends.
import { Pressable, View } from "react-native";

import type { TableStore } from "./store.ts";
import { useScrim } from "./use-spotlight.ts";

type Box = { top?: number; bottom?: number; left?: number; right?: number; width?: number; height?: number };

/** The catcher's views: the top bar, the command column (with the right inset) and the left inset. `catches` is whether they take touches, which a press turns into `onSkip`. */
function ScrimView({ catches, onSkip, insets, barBottom, commandWidth }: { catches: boolean; onSkip: () => void; insets: { left: number; right: number }; barBottom: number; commandWidth: number }) {
  if (!catches) return null;
  const region = (id: string, box: Box) => (
    <View key={id} style={{ position: "absolute", ...box }}>
      <Pressable testID={id} accessible={false} importantForAccessibility="no" onPressIn={onSkip} onPress={onSkip} style={{ flex: 1 }} />
    </View>
  );
  return (
    <>
      {region("spotlight-scrim-bar", { top: 0, left: 0, right: 0, height: barBottom })}
      {region("spotlight-scrim-dock", { top: barBottom, bottom: 0, right: 0, width: commandWidth + insets.right })}
      {insets.left > 0 ? region("spotlight-scrim-edge", { top: barBottom, bottom: 0, left: 0, width: insets.left }) : null}
    </>
  );
}

/** The skip catcher of the table: present while the store's spotlight gate is open; a press ends the gate. */
export function SpotlightScrim({ store, insets, barBottom, commandWidth }: { store: TableStore; insets: { left: number; right: number }; barBottom: number; commandWidth: number }) {
  const catches = useScrim(store);
  return <ScrimView catches={catches} onSkip={() => store.getState().endSpotlight("skipped")} insets={insets} barBottom={barBottom} commandWidth={commandWidth} />;
}
