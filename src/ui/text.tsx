// The app's Text and TextInput (docs/design-system.md, Type): React Native's, with the body face, Barlow Semi Condensed, under every
// text that does not ask for the display face (`font-display`, Marcellus SC). React Native has no default font family, so every screen
// and the table's chrome import these instead of react-native's. A weight class (font-semibold, font-bold) or `italic` picks the
// family's file on both platforms (app.json registers it as one family). Bold Text and the Title face change the class (faces.ts).
import { useSyncExternalStore, type ComponentProps } from "react";
import { Text as NativeText, TextInput as NativeTextInput, type TextInputProps, type TextProps } from "react-native";

import { accessibility, subscribeAccessibility } from "./accessibility.ts";
import { faceClass } from "./faces.ts";
import { tableSettings } from "./table-settings.ts";

// Bold Text (the phone's, read from the one accessibility store) and the Title face setting decide the face (faces.ts). Each is one boolean
// snapshot, so a text re-renders only when its own answer changes.
const subscribeSettings = (onChange: () => void) => tableSettings.subscribe(onChange);
const boldOn = () => accessibility().boldText;
const plainOn = () => tableSettings.getState().settings.titleFace === "plain";
const off = () => false;

function useFaceClass(className: string | undefined): string {
  const bold = useSyncExternalStore(subscribeAccessibility, boldOn, off);
  const plain = useSyncExternalStore(subscribeSettings, plainOn, off);
  return faceClass(className, { bold, plain });
}

// `ref` reaches the native text through the props (React 19); it is typed so a screen reader's focus can be sent to a title (use-reader-focus.ts).
export function Text({ className, ...props }: TextProps & { className?: string; ref?: ComponentProps<typeof NativeText>["ref"] }) {
  const face = useFaceClass(className);
  return <NativeText className={face} {...props} />;
}

export function TextInput({ className, ...props }: TextInputProps & { className?: string }) {
  const face = useFaceClass(className);
  return <NativeTextInput className={face} {...props} />;
}
