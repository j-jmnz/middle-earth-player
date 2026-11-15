import { Linking } from "react-native";

// The pages Settings, About opens in the browser, both on the project's GitHub.
// The privacy policy (PRIVACY.md, linked from App Store Connect as well: docs/releasing.md, TestFlight (optional)).
// Guideline 5.1.1 of Apple's App Review asks for the link inside the app as well as in the store metadata.
export const PRIVACY_POLICY_URL = "https://github.com/j-jmnz/middle-earth-player/blob/main/PRIVACY.md";
// The README's Support section: how to support the app's development.
export const SUPPORT_URL = "https://github.com/j-jmnz/middle-earth-player#support";

// With no browser or no network a tap does nothing; both pages are online only.
const open = (url: string) => () => {
  Linking.openURL(url).catch(() => undefined);
};

/** Opens the privacy policy in the browser. */
export const openPrivacyPolicy: () => void = open(PRIVACY_POLICY_URL);
/** Opens the README's Support section in the browser. */
export const openSupport: () => void = open(SUPPORT_URL);
