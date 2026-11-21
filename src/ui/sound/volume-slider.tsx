// The volume row (docs/design-system.md, Settings): its name and what it sets over a track with a round knob and the volume as a
// figure, in the switch's Carved Stone look. A touch on the track sets the volume there; a sideways drag moves it and sets it on release,
// so a drag writes the setting once; an upright move leaves the page to scroll. A screen reader adjusts it 10% at a time. `onChange`
// gets the new volume once, when the finger lifts.
import { useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { touch, useUiScale } from "../ui-scale.ts";
import { useTableTokens } from "../use-table-tokens.ts";
import { withAlphaHex } from "../tokens.ts";
import { Text } from "../text.tsx";
import { stepVolume, volumeAt, volumeWords } from "./volume.ts";

// The 44 pt target, as the switch row's.
const ROW = 44;

export function VolumeSlider({ label, detail, value, onChange, testID, dim = false }: { label: string; detail?: string; value: number; onChange: (next: number) => void; testID: string; dim?: boolean }) {
  const t = useTableTokens();
  const s = useUiScale();
  const light = t.depth === "light";
  const [width, setWidth] = useState(0);
  // The volume under the finger while a drag is under way; the stored one otherwise.
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? value;
  const knob = 20 * s;
  const bar = 6 * s;
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const pick = (x: number) => volumeAt(x - knob / 2, width - knob);
  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((event) => onChange(pick(event.x)));
  const drag = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-6 * s, 6 * s])
    .failOffsetY([-10 * s, 10 * s])
    .onUpdate((event) => setDraft(pick(event.x)))
    .onEnd((event) => onChange(pick(event.x)))
    .onFinalize(() => setDraft(null));
  const at = (width - knob) * shown;
  return (
    <View testID={testID} style={{ paddingVertical: 6 * s, gap: 2 * s, opacity: dim ? 0.75 : 1 }}>
      <View importantForAccessibility="no-hide-descendants">
        <Text className="text-body font-semibold" style={{ color: t.bone }}>
          {label}
        </Text>
        {detail ? (
          <Text className="text-label" style={{ color: t.muted, marginTop: 2 * s }}>
            {detail}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 * s }}>
        <GestureDetector gesture={Gesture.Race(drag, tap)}>
          <View
            testID={`${testID}-track`}
            onLayout={onLayout}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={label}
            accessibilityHint={detail}
            accessibilityValue={{ min: 0, max: 100, now: Math.round(shown * 100), text: volumeWords(shown) }}
            accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
            onAccessibilityAction={(event) => onChange(stepVolume(value, event.nativeEvent.actionName === "increment"))}
            style={{ flex: 1, minHeight: touch(s, ROW), justifyContent: "center" }}
          >
            <View style={{ height: bar, borderRadius: bar / 2, marginHorizontal: knob / 2, backgroundColor: light ? t.pressed : t.dusk, boxShadow: `inset 0 1px 3px ${withAlphaHex(t.shade, light ? 0.3 : 0.9)}` }}>
              <View style={{ width: `${shown * 100}%`, height: bar, borderRadius: bar / 2, backgroundColor: t.accent, backgroundImage: `linear-gradient(180deg, ${light ? t.primaryTop : t.accentHigh} 0%, ${t.accentDeep} 100%)` }} />
            </View>
            <View
              style={{
                position: "absolute",
                left: at,
                width: knob,
                height: knob,
                borderRadius: knob / 2,
                backgroundColor: t.onAccent,
                boxShadow: light ? `0 1px 3px ${withAlphaHex(t.shade, 0.5)}` : `0 0 10px ${withAlphaHex(t.glow, 0.35)}`,
              }}
            />
          </View>
        </GestureDetector>
        <Text className="text-label font-semibold" importantForAccessibility="no" style={{ color: t.bone, minWidth: 40 * s, textAlign: "right", fontVariant: ["tabular-nums"] }}>
          {volumeWords(shown)}
        </Text>
      </View>
    </View>
  );
}
