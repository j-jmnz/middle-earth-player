// The alt text of a picture that is only decoration. expo-image draws an <img> on the web, and `accessible={false}` does not hide it from a
// reader there, so the decorative picture says `alt=""` (expo-image takes `accessibilityLabel` as the alt text). Native has no alt text to
// give: its decorative pictures are hidden with `accessible={false}` (scripts/checks/a11y.ts, picture-label).
import { Platform } from "react-native";

export const DECORATIVE_ALT: string | undefined = Platform.OS === "web" ? "" : undefined;
