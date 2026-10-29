// The combat spotlight's full-screen layer (docs/plans/combat-spotlight-redesign.md, §1). It is mounted over the whole table, always,
// and holds what the spotlight draws with: the fonts, the damage token and the card backs, the particle sprite texture, the burn shader
// and the stage-size decodes of the plan's cards. It mounts a Skia canvas (not opaque, so a TextureView on Android and stacked correctly
// over the table) only while a spotlight plays, so with none playing nothing draws and nothing redraws. The plan, the clock and the
// table's pictures come from the table canvas through the handoff store (spotlight-handoff.ts); the canvas ignores touches, so the tap that
// skips goes to the table canvas's gesture, or to the scrim over the bar and the dock (spotlight-scrim.tsx). The layer always draws with
// the dark theme's tokens: the stage is dark on the Light theme too.
import { Canvas, useImage } from "@shopify/react-native-skia";
import { StyleSheet } from "react-native";
import { memo, useCallback, useMemo } from "react";
import { useStore } from "zustand";

import { sphereIcon } from "./icon-map.ts";
import { CARD_BACK_FILES, ICON_FILES } from "./icons/files.generated.ts";
import { Spotlight } from "./spotlight.native.tsx";
import { burnEffect } from "./spotlight-burn.native.tsx";
import type { SpotlightLayerProps } from "./spotlight-handoff.ts";
import { useSpriteTexture } from "./spotlight-particles.native.tsx";
import { useSpotFonts, useTableFonts } from "./table-fonts.native.ts";
import { tableTokensByTheme } from "./tokens.ts";
import { useUiScale } from "./ui-scale.ts";
import { useSpotlightImages } from "./use-spotlight-images.native.ts";

// Memoized: the table renders on every move, and the layer reads its plan and clock from the handoff store, not from props.
export const SpotlightLayer = memo(function SpotlightLayer({ handoff, picture, pictureRevision, nameOf, sphereOf }: SpotlightLayerProps) {
  const s = useUiScale();
  const plan = useStore(handoff, (state) => state.plan);
  const progress = useStore(handoff, (state) => state.progress);
  const k = useStore(handoff, (state) => state.k);
  const playing = useStore(handoff, (state) => state.playing);
  const tableImages = useStore(handoff, (state) => state.tableImages);
  const damage = useImage(ICON_FILES.damage);
  const player = useImage(CARD_BACK_FILES.player);
  const encounter = useImage(CARD_BACK_FILES.encounter);
  const backs = useMemo(() => ({ player, encounter }), [player, encounter]);
  const fonts = useTableFonts(s);
  const spotFonts = useSpotFonts(s);
  const texture = useSpriteTexture();
  const burn = useMemo(() => burnEffect(), []);
  const images = useSpotlightImages(plan, playing, picture, pictureRevision, tableImages);
  const iconOf = useCallback((code: string) => sphereIcon(sphereOf(code)), [sphereOf]);
  if (!playing || !plan || !progress) return null;
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Spotlight plan={plan} progress={progress} images={images} damage={damage} backs={backs} fonts={fonts} spotFonts={spotFonts} texture={texture} burn={burn} t={tableTokensByTheme.dark} s={s} nameOf={nameOf} sphereOf={iconOf} k={k} />
    </Canvas>
  );
});
