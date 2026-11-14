// The top inset a screen's head starts under (top-inset.ts).
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useUiScale } from "../../ui/ui-scale";
import { topInsetOf } from "./top-inset";

export function useTopInset(): number {
  const insets = useSafeAreaInsets();
  const s = useUiScale();
  return topInsetOf(insets.top, s);
}
