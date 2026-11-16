// The app's Text and TextInput on the web and the desktop (../text.tsx is the phone's, unchanged; metro.config.js serves this file from this web folder in its place on the web platform only): the
// phone's, with the phone's "Tap" in an instruction worded "Click" for a mouse (ui/web/click-words.ts). It is a copy of the phone's file from its first function on (it holds
// the face hooks the phone's file keeps to itself), held to it by scripts/checks/web-copies.test.ts.
import { useSyncExternalStore, type ComponentProps } from "react";
import { Text as NativeText, TextInput as NativeTextInput, type TextInputProps, type TextProps } from "react-native";

import { accessibility, subscribeAccessibility } from "../accessibility.ts";
import { off, usePlainTitles } from "../display-prefs.ts";
import { faceClass } from "../faces.ts";
import { clickChildren } from "./click-words.ts";

// Bold Text (the phone's, read from the one accessibility store) and the Title face setting decide the face (faces.ts). Each is one boolean
// snapshot, so a text re-renders only when its own answer changes.
const boldOn = () => accessibility().boldText;

function useFaceClass(className: string | undefined): string {
  const bold = useSyncExternalStore(subscribeAccessibility, boldOn, off);
  const plain = usePlainTitles();
  return faceClass(className, { bold, plain });
}

// `ref` reaches the native text through the props (React 19); it is typed so a screen reader's focus can be sent to a title (use-reader-focus.ts).
export function Text({ className, children, ...props }: TextProps & { className?: string; ref?: ComponentProps<typeof NativeText>["ref"] }) {
  const face = useFaceClass(className);
  return (
    <NativeText className={face} {...props}>
      {clickChildren(children)}
    </NativeText>
  );
}

export function TextInput({ className, ...props }: TextInputProps & { className?: string }) {
  const face = useFaceClass(className);
  return <NativeTextInput className={face} {...props} />;
}
