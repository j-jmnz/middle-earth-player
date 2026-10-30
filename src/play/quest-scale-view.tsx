// The quest scale at the table's left edge (docs/design-system.md, Table): the staging area's threat on a red dial with "threat" under
// it, how far apart the two are between them ("+2" in green, "−1" in red, or Even), and the willpower committed on a silver dial with
// "willpower" under it. No panel: it floats on a soft dark radial. It moves live as characters are committed (quest-scale.ts); the
// numbers are the engine's. Outside the Quest phase it rests at 40%, its dials showing a dash and no marker. A screen reader hears it
// as the threat in staging, so it is never read as the player's own threat dial.
import { View } from "react-native";

import { scaleMarker, type QuestScale } from "./quest-scale.ts";
import { withAlphaHex } from "./tokens.ts";
import { useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { Text } from "./text.tsx";

/** The scale's width at Medium on a phone, and on a tablet, whose dials are larger. */
export const QUEST_SCALE = 86;
export const QUEST_SCALE_WIDE = 110;

function Dial({ value, kind, size, testID }: { value: number | null; kind: "threat" | "willpower"; size: number; testID: string }) {
  const t = useTableTokens();
  const s = useUiScale();
  const threat = kind === "threat";
  const d = size * s;
  return (
    <View
      testID={testID}
      className="items-center justify-center"
      style={{
        width: d,
        height: d,
        borderRadius: d / 2,
        backgroundColor: threat ? t.threat : t.accent,
        backgroundImage: threat ? `radial-gradient(circle at 50% 38%, ${t.threat}, ${t.threatEdge})` : `radial-gradient(circle at 50% 38%, ${t.primaryTop}, ${t.accentDeep})`,
        boxShadow: threat
          ? `0 0 0 2px ${t.night}, 0 0 0 3px ${t.threatEdge}, 0 0 22px ${withAlphaHex(t.threat, 0.45)}`
          : `0 0 0 2px ${t.night}, 0 0 0 3px ${t.accentLine}, 0 0 22px ${withAlphaHex(t.glow, 0.35)}`,
      }}
    >
      <Text className="font-display" style={{ fontSize: (size >= 70 ? 36 : 26) * s, lineHeight: (size >= 70 ? 42 : 31) * s, color: threat ? t.onThreat : t.onAccent }}>
        {value == null ? "–" : String(value)}
      </Text>
    </View>
  );
}

export function QuestScaleView({ scale, wide = false }: { scale: QuestScale; wide?: boolean }) {
  const t = useTableTokens();
  const s = useUiScale();
  const marker = scaleMarker(scale.delta);
  const dial = wide ? 70 : 50;
  const markerColor = marker.tone === "ok" ? t.ok : marker.tone === "danger" ? t.danger : t.muted;
  const even = marker.word === "Even";
  const { live } = scale;
  return (
    <View
      testID="quest-scale"
      accessible
      accessibilityLabel={
        live
          ? `Threat in staging ${scale.threat}, willpower committed ${scale.willpower}, ${even ? "even" : `${Math.abs(scale.delta)} ${marker.word.toLowerCase()}`}`
          : `Quest scale, for the Quest phase. Threat in staging ${scale.threat}`
      }
      className="flex-1 items-center"
      style={{ width: (wide ? QUEST_SCALE_WIDE : QUEST_SCALE) * s, paddingVertical: 4 * s, opacity: live ? 1 : 0.4, backgroundImage: `radial-gradient(60% 50% at 50% 50%, ${withAlphaHex(t.night, 0.75)}, ${withAlphaHex(t.night, 0)})` }}
    >
      <Dial value={live ? scale.threat : null} kind="threat" size={dial} testID="quest-scale-threat" />
      <Text className="mt-1 text-micro" style={{ color: t.muted }}>
        threat
      </Text>
      {/* How far apart they are, between the dials: "+2" in green, "−1" in red, or Even. */}
      <View className="min-h-0 flex-1 items-center justify-center" style={{ marginVertical: 4 * s }}>
        {live ? (
          <Text testID="quest-scale-marker" className="font-display" style={{ fontSize: (even ? 15 : 22) * s, lineHeight: (even ? 18 : 26) * s, color: markerColor }}>
            {even ? marker.word : marker.value}
          </Text>
        ) : null}
      </View>
      <Dial value={live ? scale.willpower : null} kind="willpower" size={dial} testID="quest-scale-willpower" />
      <Text className="mt-1 text-micro" style={{ color: t.muted }}>
        willpower
      </Text>
    </View>
  );
}
