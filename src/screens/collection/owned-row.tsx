// A row of the Collection screen (docs/design-system.md, Collection). A row of one pack is one switch: the whole row is the target.
// A row of several packs has two: its name and line unfold the packs inside the row, each a switch of its own, and the switch at
// its end owns or disowns them all. Partly owned draws a dash and is heard as mixed; a tap on it owns the whole.
import { useState } from "react";
import { Pressable, View } from "react-native";

import type { SetOwnership } from "../../catalog/collection";
import { Chevron } from "../kit/chrome";
import { usePalette } from "../kit/palette-hook";
import { SwitchMark } from "../../ui/setting-switch";
import { rowSurface } from "../../ui/surfaces";
import { Text } from "../../ui/text";
import { touch, useUiScale } from "../../ui/ui-scale";
import { useTableTokens } from "../../ui/use-table-tokens";

import type { CollectionPack } from "./view";

function RowWords({ label, detail, on }: { label: string; detail: string; on: boolean }) {
  return (
    <View className="flex-1" importantForAccessibility="no-hide-descendants">
      <Text className={`font-display text-heading ${on ? "text-bone" : "text-muted"}`}>{label}</Text>
      <Text className="mt-0.5 text-label text-muted">{detail}</Text>
    </View>
  );
}

// One pack inside an unfolded row: its name, its card count and its switch, the whole line one 44 pt target.
function PackRow({ pack, owned, onSwitch }: { pack: CollectionPack; owned: boolean; onSwitch: (owned: boolean) => void }) {
  const s = useUiScale();
  const t = useTableTokens();
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      testID={`pack-${pack.code}-owned`}
      accessibilityRole="switch"
      accessibilityLabel={`Own ${pack.name}, ${pack.cards} ${pack.cards === 1 ? "card" : "cards"}`}
      accessibilityState={{ checked: owned }}
      aria-checked={owned}
      onPress={() => onSwitch(!owned)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      className="flex-row items-center rounded-item"
      style={{ minHeight: touch(s, 44), paddingLeft: 14 * s, paddingRight: 12 * s, gap: 10 * s, ...(pressed ? rowSurface(true, t) : null) }}
    >
      <Text className={`flex-1 text-body ${owned ? "text-bone" : "text-muted"}`}>{pack.name}</Text>
      <Text className="text-label text-faint">{pack.cards}</Text>
      <SwitchMark value={owned} paper={false} />
    </Pressable>
  );
}

export function OwnedRow({
  label,
  detail,
  ownership,
  packs,
  notOwned,
  open,
  onToggle,
  onSwitch,
  onSwitchPack,
  testID,
}: {
  label: string;
  detail: string;
  ownership: SetOwnership;
  // The row's packs. One pack is the row itself; several unfold under it.
  packs: readonly CollectionPack[];
  notOwned: ReadonlySet<string>;
  open: boolean;
  onToggle: () => void;
  onSwitch: (owned: boolean) => void;
  onSwitchPack: (code: string, owned: boolean) => void;
  testID: string;
}) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  const [pressed, setPressed] = useState(false);
  const on = ownership === "all";
  const mixed = ownership === "some";
  const checked = mixed ? "mixed" : on;
  // The name is muted only while none of it is owned.
  const lit = ownership !== "none";

  if (packs.length < 2) {
    return (
      <Pressable
        testID={`${testID}-owned`}
        accessibilityRole="switch"
        accessibilityLabel={`Own ${label}, ${detail}`}
        accessibilityState={{ checked }}
        aria-checked={checked}
        onPress={() => onSwitch(!on)}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        className="mb-1.5 min-h-14 flex-row items-center rounded-item py-2"
        style={{ paddingLeft: 14 * s, paddingRight: 12 * s, gap: 10 * s, ...rowSurface(pressed, t) }}
      >
        <RowWords label={label} detail={detail} on={lit} />
        <SwitchMark value={on} paper={false} />
      </Pressable>
    );
  }

  return (
    <View className="mb-1.5 overflow-hidden rounded-item" style={rowSurface(pressed, t)}>
      <View className="min-h-14 flex-row items-center">
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${detail}`}
          accessibilityHint={open ? "Hides its packs" : "Shows its packs"}
          accessibilityState={{ expanded: open }}
          aria-expanded={open}
          onPress={onToggle}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          className="flex-1 flex-row items-center py-2"
          style={{ paddingLeft: 14 * s, paddingRight: 4 * s, gap: 10 * s }}
        >
          <RowWords label={label} detail={detail} on={lit} />
          <Chevron direction={open ? "up" : "down"} color={palette.faint} size={8} />
        </Pressable>
        <Pressable
          testID={`${testID}-owned`}
          accessibilityRole="switch"
          // A switch has no mixed state on the web, so the line ("3 of 7 packs") is heard with the name.
          accessibilityLabel={`Own ${label}, ${detail}`}
          accessibilityState={{ checked }}
          aria-checked={checked}
          onPress={() => onSwitch(!on)}
          className="items-center justify-center self-stretch"
          style={{ minHeight: touch(s, 44), paddingLeft: 10 * s, paddingRight: 12 * s }}
        >
          <SwitchMark value={on} mixed={mixed} paper={false} />
        </Pressable>
      </View>
      {open ? (
        <View style={{ paddingBottom: 6 * s }}>
          {packs.map((pack) => (
            <PackRow key={pack.code} pack={pack} owned={!notOwned.has(pack.code)} onSwitch={(owned) => onSwitchPack(pack.code, owned)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
