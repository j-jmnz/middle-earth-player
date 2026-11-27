import { View } from "react-native";

import { GameIcon } from "../../ui/game-icon.tsx";
import { ICONS } from "../../ui/icons/generated.ts";
import type { IconName } from "../../ui/icon-map.ts";
import type { TableToken, TableTokens } from "../../ui/tokens.ts";

/**
 * The small icon under a dial's number. A raster token takes no tint (GameIcon), so on the solid threat red of a critical dial it stands on a small night disc to stay readable (docs/design-system-table.md, Top bar).
 */
export function DialIcon({ name, size, tint, critical, t, s }: { name: IconName; size: number; tint: TableToken; critical: boolean; t: TableTokens; s: number }) {
  if (ICONS[name].kind === "raster" && critical) {
    return (
      <View style={{ backgroundColor: t.night, borderRadius: size, padding: 1.5 * s }}>
        <GameIcon name={name} size={size} />
      </View>
    );
  }
  return <GameIcon name={name} size={size} tint={tint} />;
}
