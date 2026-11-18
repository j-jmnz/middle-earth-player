// The "Collapse all / Expand all" button over a list of folds (the Cards tab's Encounter cards list). `ids` are the folds the list holds, each with
// its default; the label offers what the next tap does (kit/fold-state.ts, foldAllOffer).
import { View } from "react-native";

import { type useFolds } from "../kit/fold-section";
import { foldAllOffer } from "../kit/fold-state";
import { TextButton } from "../kit/chrome";

export function FoldAllBar({ folds, ids, noun }: { folds: ReturnType<typeof useFolds>; ids: readonly { id: string; defaultFolded: boolean }[]; noun: string }) {
  const offer = foldAllOffer(ids.map(({ id, defaultFolded }) => folds.folded(id, defaultFolded)));
  return (
    <View className="-mx-3 flex-row justify-end">
      <TextButton label={offer.label} tone="accent" small testID="cards-fold-all" accessibilityHint={offer.folds ? `Folds every ${noun}` : `Opens every ${noun}`} onPress={() => folds.setAll(ids, offer.folds)} />
    </View>
  );
}
