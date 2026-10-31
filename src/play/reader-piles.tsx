// With a screen reader on, the Skia canvas is no control for it: the choice is on paper (tray-logic.ts, tapRoute). The piles and a row's fold stack are not part of any choice, so each gets one
// transparent 44 pt button over its slot, with the name a reader says ("Corsair deck, 9 cards", "3 more cards in staging") and the tap the canvas gives it: a discard pile's list, a fold stack's row list.
import { Pressable, View } from "react-native";

import { hitBounds, type CardSlot } from "./layout.ts";
import { pileSpeech } from "./pile-speech.ts";

export function ReaderPiles({ slots, onTap }: { slots: readonly CardSlot[]; onTap: (id: string) => void }) {
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>
      {slots
        .filter((slot) => slot.kind === "pile")
        .map((slot) => {
          const hit = hitBounds(slot);
          const speech = pileSpeech(slot);
          return (
            <Pressable
              key={slot.id}
              testID={`reader-${slot.id}`}
              accessible
              accessibilityRole="button"
              accessibilityLabel={speech.label}
              accessibilityHint={speech.hint ?? undefined}
              onPress={() => onTap(slot.id)}
              style={{ position: "absolute", left: hit.x, top: hit.y, width: hit.w, height: hit.h }}
            />
          );
        })}
    </View>
  );
}
