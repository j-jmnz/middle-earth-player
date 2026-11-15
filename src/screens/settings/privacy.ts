import { Linking } from "react-native";

// The privacy policy (PRIVACY.md, linked from Settings, About and from App Store Connect: docs/releasing.md, TestFlight (optional)).
// Guideline 5.1.1 of Apple's App Review asks for the link inside the app as well as in the store metadata.
export const PRIVACY_POLICY_URL = "https://github.com/j-jmnz/middle-earth-player/blob/main/PRIVACY.md";

/** Opens the policy in the browser. With no browser or no network the tap does nothing; the policy is online only. */
export function openPrivacyPolicy(): void {
  Linking.openURL(PRIVACY_POLICY_URL).catch(() => undefined);
}
