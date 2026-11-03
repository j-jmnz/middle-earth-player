// The one Modal the paper sheets open in (docs/design-system.md, Tablets): the filter sheet and the deck editor's unsaved-changes sheet.
// It dims the screen behind with a tap-to-close scrim, allows every orientation on a tablet and portrait on a phone (an iOS Modal is portrait only unless told), and
// outside compact floats the sheet centred, at most 560 wide with all four corners rounded. In compact it is the phone's sheet,
// risen from the bottom edge, as before.
import type { ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";

import { usePalette } from "./palette-hook";
import { SheetCornersContext } from "../../play/choice/sheet-paper";
import { SHEET_MAX } from "../../ui/size-class";
import { useIsTablet, useSizeClass } from "../../ui/use-size-class";

const ALL_ORIENTATIONS = ["portrait", "portrait-upside-down", "landscape", "landscape-left", "landscape-right"] as const;
const PORTRAIT = ["portrait"] as const;

export function SheetModal({
  visible,
  onRequestClose,
  scrimLabel,
  animationType = "fade",
  children,
}: {
  visible: boolean;
  // The scrim, Android Back and the iOS dismiss gesture all call it.
  onRequestClose: () => void;
  scrimLabel: string;
  animationType?: "none" | "fade" | "slide";
  children: ReactNode;
}) {
  const palette = usePalette();
  const { size, s } = useSizeClass();
  const floating = size !== "compact";
  // A phone stays portrait inside the Modal as it does outside; only a tablet turns.
  const tablet = useIsTablet();
  return (
    <Modal visible={visible} transparent animationType={animationType} onRequestClose={onRequestClose} supportedOrientations={tablet ? ALL_ORIENTATIONS : PORTRAIT}>
      <View className={floating ? "flex-1 items-center justify-center" : "flex-1 justify-end"}>
        <Pressable accessibilityRole="button" accessibilityLabel={scrimLabel} onPress={onRequestClose} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: palette.night, opacity: 0.72 }} />
        <SheetCornersContext.Provider value={floating ? "all" : "top"}>
          {floating ? <View style={{ width: "100%", maxWidth: SHEET_MAX * s }}>{children}</View> : children}
        </SheetCornersContext.Provider>
      </View>
    </Modal>
  );
}
