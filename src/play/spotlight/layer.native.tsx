// The combat spotlight's full-screen layer (docs/design-system-table.md, Spotlight). It is mounted over the whole table, always,
// and holds what the spotlight draws with: the fonts, the damage token and the card backs, the particle sprite texture, the burn shader
// and the stage-size decodes of the plan's cards. It mounts a Skia canvas (not opaque, so a TextureView on Android and stacked correctly
// over the table) only while a spotlight plays, so with none playing nothing draws and nothing redraws. The plan, the clock and the
// table's pictures come from the table canvas through the handoff store (spotlight/handoff.ts); the canvas ignores touches, so the tap that
// skips goes to the table canvas's gesture, or to the scrim over the bar and the dock (spotlight/scrim.tsx). The layer always draws with
// the dark theme's tokens: the stage is dark on the Light theme too; the screen's theme sets only how deep its flat dark is. The black
// fog's tiles are baked once after the table first paints, and only when a spotlight can play (`useSpotlightScale` above 0), so the
// first spotlight does not pay for the noise and a table that plays none keeps no tiles.
// On the web the canvas stays mounted, transparent and idle between spotlights (HOLD_CANVAS): a web canvas compiles a pipeline the first time
// it draws with it, and a new canvas would compile them all again at every spotlight. Once the table has settled it draws a warm plan through
// it (spotlight/warm-spotlight.native.tsx), so even the first spotlight finds them built. The canvas ignores touches and is invisible while
// nothing plays; the phone mounts it only while a spotlight plays, as it always did.
import { Canvas } from "@shopify/react-native-skia";
import { Platform, StyleSheet } from "react-native";
import { memo, useCallback, useEffect, useMemo } from "react";
import { useStore } from "zustand";

import { sphereIcon } from "../../ui/icon-map.ts";
import { CARD_BACK_FILES, ICON_FILES } from "../../ui/icons/files.generated.ts";
import { Spotlight } from "./spotlight.native.tsx";
import { burnEffect } from "./burn.native.tsx";
import type { SpotlightLayerProps } from "./handoff.ts";
import { useSpriteTexture } from "./particles.native.tsx";
import { EDGE_FOG } from "./fog.ts";
import { useSharedImage } from "../canvas/table-assets.native.ts";
import { useSpotFonts, useTableFonts } from "../canvas/table-fonts.native.ts";
import { usePlainTitles } from "../../ui/display-prefs.ts";
import { warmFog } from "../../ui/fog/fog.native.tsx";
import { tableSettings } from "../../ui/table-settings.ts";
import { useTheme } from "../../ui/theme.ts";
import { tableTokensByTheme } from "../../ui/tokens.ts";
import { useUiScale } from "../../ui/ui-scale.ts";
import { useSpotlightImages } from "./use-spotlight-images.native.ts";
import { useSpotlightScale } from "./use-spotlight.ts";
import { WarmSpotlight } from "./warm-spotlight.native.tsx";

// Whether the canvas stays mounted between spotlights: the web only.
const HOLD_CANVAS = Platform.OS === "web";
// What the canvas is while no spotlight plays: invisible, and it covers nothing a finger can reach (it ignores touches).
const HIDDEN = { ...StyleSheet.absoluteFill, opacity: 0 };

// Memoized: the table renders on every move, and the layer reads its plan and clock from the handoff store, not from props.
export const SpotlightLayer = memo(function SpotlightLayer({ handoff, picture, pictureRevision, nameOf, sphereOf }: SpotlightLayerProps) {
  const s = useUiScale();
  const plan = useStore(handoff, (state) => state.plan);
  const progress = useStore(handoff, (state) => state.progress);
  const k = useStore(handoff, (state) => state.k);
  const playing = useStore(handoff, (state) => state.playing);
  const warm = useStore(handoff, (state) => state.warm);
  const tableImages = useStore(handoff, (state) => state.tableImages);
  const damage = useSharedImage(ICON_FILES.damage);
  const player = useSharedImage(CARD_BACK_FILES.player);
  const encounter = useSharedImage(CARD_BACK_FILES.encounter);
  const backs = useMemo(() => ({ player, encounter }), [player, encounter]);
  const plain = usePlainTitles();
  const fonts = useTableFonts(s, plain);
  const spotFonts = useSpotFonts(s, plain);
  const texture = useSpriteTexture();
  const burn = useMemo(() => burnEffect(), []);
  const images = useSpotlightImages(plan, playing, picture, pictureRevision, tableImages, warm);
  const iconOf = useCallback((code: string) => sphereIcon(sphereOf(code)), [sphereOf]);
  const theme = useTheme();
  const drift = useStore(tableSettings, (state) => state.settings.fogDrift);
  const canPlay = useSpotlightScale() > 0;
  useEffect(() => {
    if (canPlay) warmFog(EDGE_FOG);
  }, [canPlay]);
  const live = playing && plan != null && progress != null;
  // The web keeps the canvas only while a spotlight can play (not with the Combat spotlight off, reduced motion or a screen reader on).
  if (!live && !(HOLD_CANVAS && canPlay)) return null;
  const t = tableTokensByTheme.dark;
  return (
    <Canvas style={live ? StyleSheet.absoluteFill : HIDDEN} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {live ? <Spotlight plan={plan} progress={progress} images={images} damage={damage} backs={backs} fonts={fonts} spotFonts={spotFonts} texture={texture} burn={burn} t={t} theme={theme} drift={drift} s={s} nameOf={nameOf} sphereOf={iconOf} k={k} /> : null}
      {HOLD_CANVAS ? <WarmSpotlight enabled={canPlay} busy={live} card={player ?? encounter} damage={damage} backs={backs} fonts={fonts} spotFonts={spotFonts} texture={texture} burn={burn} t={t} theme={theme} drift={drift} s={s} /> : null}
    </Canvas>
  );
});
