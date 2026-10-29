// DEBUG BUILDS ONLY, temporary (user report, 2026-10-29: the campaign path's Log and Resume under a 3-button navigation bar, path only,
// always; not reproduced on the web). The numbers the path's foot is laid out from, at the top of the screen, so one screenshot says
// whether the insets or the layout put the bar under the phone's buttons. Renders nothing outside __DEV__.
import { useEffect, useState, type ComponentRef, type RefObject } from "react";
import { Dimensions, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "../play/text";

export function InsetReadout({ bar }: { bar: RefObject<ComponentRef<typeof View> | null> }) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [box, setBox] = useState<string>("?");
  useEffect(() => {
    if (!__DEV__) return;
    const timer = setInterval(() => bar.current?.measureInWindow((_x: number, y: number, _w: number, h: number) => setBox(`${Math.round(y)}+${Math.round(h)}=${Math.round(y + h)}`)), 1000);
    return () => clearInterval(timer);
  }, [bar]);
  if (!__DEV__) return null;
  const screen = Dimensions.get("screen");
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: insets.top, left: 8, right: 8, backgroundColor: "rgba(0,0,0,0.7)", padding: 4 }}>
      <Text style={{ color: "#ff0", fontSize: 11 }}>
        {`insets t${Math.round(insets.top)} b${Math.round(insets.bottom)} l${Math.round(insets.left)} r${Math.round(insets.right)} · window ${Math.round(window.width)}x${Math.round(window.height)} · screen ${Math.round(screen.width)}x${Math.round(screen.height)} · bar ${box}`}
      </Text>
    </View>
  );
}
