// The quest scale at the table's left edge (docs/design-system.md, Table): THREAT over the staging area's threat on a red dial, a line
// down to the willpower committed on a silver dial over WILLPOWER, and on the line how far apart they are, "+2 Ahead" in green or
// "−1 Short" in red. No panel: it floats on a soft dark radial. It moves live as characters are committed (quest-scale.ts); the
// numbers are the engine's.
import { View } from "react-native";

import { scaleMarker, type QuestScale } from "./quest-scale.ts";
import { withAlphaHex } from "./tokens.ts";
import { useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { Text } from "./text.tsx";

/** The scale's width at Medium on a phone, and on a tablet, whose dials are larger. */
export const QUEST_SCALE = 86;
export const QUEST_SCALE_WIDE = 110;

function Caps({ children, color, size = 9 }: { children: string; color: string; size?: number }) {
  const s = useUiScale();
  return (
    <Text className="font-bold uppercase" style={{ fontSize: size * s, lineHeight: (size + 3) * s, letterSpacing: 1.6 * s, color }}>
      {children}
    </Text>
  );
}

function Dial({ value, kind, size, testID }: { value: number; kind: "threat" | "willpower"; size: number; testID: string }) {
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
        {String(value)}
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
  return (
    <View
      testID="quest-scale"
      accessible
      accessibilityLabel={`Threat in staging ${scale.threat}, willpower committed ${scale.willpower}, ${marker.word === "Even" ? "even" : `${Math.abs(scale.delta)} ${marker.word.toLowerCase()}`}`}
      className="flex-1 items-center"
      style={{ width: (wide ? QUEST_SCALE_WIDE : QUEST_SCALE) * s, paddingVertical: 4 * s, backgroundImage: `radial-gradient(60% 50% at 50% 50%, ${withAlphaHex(t.night, 0.75)}, ${withAlphaHex(t.night, 0)})` }}
    >
      <Caps color={t.danger}>Threat</Caps>
      <View style={{ marginTop: 4 * s }}>
        <Dial value={scale.threat} kind="threat" size={dial} testID="quest-scale-threat" />
      </View>
      <Text className="mt-1 text-micro" style={{ color: t.muted }}>
        in staging
      </Text>
      {/* The line from the threat down to the willpower, with the difference at its middle. */}
      <View className="min-h-0 flex-1 items-center justify-center" style={{ marginVertical: 4 * s }}>
        <View style={{ position: "absolute", top: 0, bottom: 0, width: 2, backgroundImage: `linear-gradient(180deg, ${t.threat}, ${withAlphaHex(t.night, 0.6)} 50%, ${t.accent})`, backgroundColor: withAlphaHex(t.bone, 0.15) }} />
        <View testID="quest-scale-marker" className="items-center" style={{ paddingHorizontal: 8 * s, paddingVertical: 4 * s, backgroundImage: `radial-gradient(circle, ${withAlphaHex(t.night, 0.95)} 40%, ${withAlphaHex(t.night, 0)} 75%)` }}>
          <Text className="font-display" style={{ fontSize: 15 * s, lineHeight: 18 * s, color: markerColor }}>
            {marker.value}
          </Text>
          <Caps color={markerColor} size={8}>
            {marker.word}
          </Caps>
        </View>
      </View>
      <Text className="mb-1 text-micro" style={{ color: t.muted }}>
        committed
      </Text>
      <Dial value={scale.willpower} kind="willpower" size={dial} testID="quest-scale-willpower" />
      <View style={{ marginTop: 4 * s }}>
        <Caps color={t.bone}>Willpower</Caps>
      </View>
    </View>
  );
}
