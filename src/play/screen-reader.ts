// Whether VoiceOver or TalkBack is on. The table then lists the choices of the open moment on paper as well as on the
// canvas (a card drawn only on the canvas is not a control a screen reader can reach), and an armed button waits longer.
// react-native-web always answers yes, so the web build, whose table is already a list of names, lists every choice on
// paper.
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((value) => {
      if (live) setOn(value);
    });
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", setOn);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return on;
}
