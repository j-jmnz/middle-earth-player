// The dock's part of a screen reader's table (docs/design-system-table.md, Screen reader): when the moment changes (a new sheet key) focus
// moves to the dock's title (which reads its note as a hint) once the announcer is quiet, unless the reader is on a card the new moment still
// asks about: then the title and note are announced once it settles (reader-moment.ts, momentSpeech). The table's first moment takes focus
// once when the table opens. Nothing runs without a phone screen reader.
import { type ComponentRef, type RefObject } from "react";
import type { View } from "react-native";

import { announce } from "../../../ui/announce.ts";
import { useOpenFocus } from "../../../ui/use-open-focus.ts";
import { useReaderFocus } from "../../../ui/use-reader-focus.ts";
import { momentSpeech } from "../reader-moment.ts";

export function useReaderMoment(titleRef: RefObject<ComponentRef<typeof View> | null>, a: { momentKey: string; title: string; note: string | null; stay: boolean }): void {
  useOpenFocus(titleRef, "table");
  useReaderFocus(titleRef, a.momentKey, a.stay, (moved) => announce(momentSpeech({ title: a.title, note: a.note, moved })));
}
