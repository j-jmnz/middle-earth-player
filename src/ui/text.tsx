// The app's Text and TextInput (docs/design-system.md, Type): React Native's, with the body face, Barlow Semi Condensed, under every
// text that does not ask for the display face (`font-display`, Marcellus SC). React Native has no default font family, so every screen
// and the table's chrome import these instead of react-native's. A weight class (font-semibold, font-bold) or `italic` picks the
// family's file on both platforms (app.json registers it as one family).
import type { ComponentProps } from "react";
import { Text as NativeText, TextInput as NativeTextInput, type TextInputProps, type TextProps } from "react-native";

function withBody(className: string | undefined): string {
  if (className?.includes("font-display")) return className;
  return className ? `font-body ${className}` : "font-body";
}

// `ref` reaches the native text through the props (React 19); it is typed so a screen reader's focus can be sent to a title (use-reader-focus.ts).
export function Text({ className, ...props }: TextProps & { className?: string; ref?: ComponentProps<typeof NativeText>["ref"] }) {
  return <NativeText className={withBody(className)} {...props} />;
}

export function TextInput({ className, ...props }: TextInputProps & { className?: string }) {
  return <NativeTextInput className={withBody(className)} {...props} />;
}
