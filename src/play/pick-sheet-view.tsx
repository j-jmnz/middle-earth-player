// The pick sheet: one tile per choice and the primary that confirms it, with what the rules refuse now listed under the
// tiles as text (docs/design-system.md, Table).
import { useState } from "react";
import { Text, View } from "react-native";

import { ChromeButton, ChromePrimary, Paper, paperProps, Tile, Why, type SheetProps } from "./sheet-paper.tsx";
import type { PickSheet } from "./sheet-types.ts";
import { tableTokens as t } from "./tokens.ts";

export function PickView(props: SheetProps & { sheet: PickSheet }) {
  const { sheet, onIntent, onNext } = props;
  const [chosen, setChosen] = useState<string | null>(null);
  const picked = sheet.options.find((item) => item.id === chosen) ?? null;
  const confirm = () => {
    if (!picked) return;
    if ("intent" in picked) onIntent(picked.intent);
    else onNext(picked.next);
  };
  const alternative = sheet.alternative;
  const unavailable = sheet.unavailable ?? [];
  const actions = (
    <>
      {sheet.primary ? (
        <ChromePrimary label={sheet.primary.label} testID="sheet-primary" surface="paper" onPress={() => sheet.primary && onIntent(sheet.primary.intent)} />
      ) : sheet.options.length > 0 ? (
        <>
          <ChromePrimary label={sheet.confirm ?? (picked ? `${sheet.verb} ${picked.label.split(" · ")[0]}` : sheet.verb)} testID="sheet-primary" surface="paper" disabled={!picked} onPress={confirm} />
          {!picked ? <Why>Choose one above.</Why> : null}
        </>
      ) : null}
      {alternative ? (
        <ChromeButton label={alternative.label} testID="sheet-alternative" tone="ink" onPress={() => ("intent" in alternative ? onIntent(alternative.intent) : onNext(alternative.next))} />
      ) : null}
    </>
  );
  return (
    <Paper {...paperProps(props, sheet)} actions={actions}>
      {sheet.options.length > 0 || unavailable.length > 0 ? (
        <>
          {sheet.options.map((item) => (
            <Tile key={item.id} label={item.label} stats={item.stats} selected={item.id === chosen} testID={`sheet-option-${item.id}`} onPress={() => setChosen(item.id)} />
          ))}
          {/* What the rules refuse now, and why (Weathertop's Travel cost): text, not a choice. */}
          {unavailable.map((item) => (
            <View key={item.id} testID={`sheet-unavailable-${item.id}`} accessible accessibilityLabel={`${item.label}. ${item.reason}`} className="mb-2 rounded-tile px-4 py-2" style={{ borderWidth: 1, borderColor: t.inkLine, borderStyle: "dashed" }}>
              <Text className="text-body text-inkMuted">{item.label}</Text>
              <Text className="mt-0.5 text-label text-inkMuted">{item.reason}</Text>
            </View>
          ))}
        </>
      ) : null}
    </Paper>
  );
}
