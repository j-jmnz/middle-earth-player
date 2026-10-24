// A game icon in React Native chrome: expo-image draws the committed SVG or PNG from assets/icons at the size asked. A
// one-colour vector is tinted with a design-system token; the token-art PNGs keep their printed colours. An icon always
// sits beside its word or carries an accessibility label, so Maestro's text assertions still read the word.
import { Image } from "expo-image";
import { Text, View } from "react-native";

import { iconAspect, type IconName } from "./icon-map.ts";
import { ICONS } from "./icons/generated.ts";
import { ICON_FILES } from "./icons/files.generated.ts";
import { tableTokens, type TableToken } from "./tokens.ts";

export function GameIcon({ name, size = 16, tint, label }: { name: IconName; size?: number; tint?: TableToken; label?: string }) {
  const vector = ICONS[name].kind === "vector";
  return (
    <Image
      source={ICON_FILES[name]}
      contentFit="contain"
      tintColor={vector && tint ? tableTokens[tint] : undefined}
      accessible={label != null}
      accessibilityLabel={label}
      style={{ width: Math.round(size * iconAspect(name)), height: size }}
    />
  );
}

/** An icon and a value on one line ("[willpower] 3"). The value is text, so it stays readable and testable. */
export function IconValue({
  name,
  value,
  word,
  tint,
  size = 16,
  textClass = "text-body text-bone",
  testID,
}: {
  name: IconName;
  value: string;
  word: string;
  tint?: TableToken;
  size?: number;
  textClass?: string;
  testID?: string;
}) {
  return (
    <View testID={testID} accessible accessibilityLabel={`${word} ${value}`} className="flex-row items-center gap-1">
      <GameIcon name={name} size={size} tint={tint} />
      <Text className={textClass}>{value}</Text>
    </View>
  );
}
