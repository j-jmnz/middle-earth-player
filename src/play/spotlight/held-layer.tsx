// The web's spotlight layer once CanvasKit is loaded (spotlight/layer.tsx imports it): spotlight/layer.native.tsx's layer with one difference. A web
// canvas compiles a pipeline the first time it draws with it, and a new canvas would compile them all again at every spotlight, so here the canvas
// stays mounted, transparent and idle between spotlights, and once the table has settled it draws a warm plan through it (warm-spotlight.tsx), so
// even the first spotlight finds them built. It stays only while a spotlight can play (not with the Combat spotlight off, reduced motion or a
// screen reader on). The canvas ignores touches, clicks and hover and is invisible while nothing plays. The phone's file is not edited for the web: change the two
// together where they share a line (what the layer holds, and the dark tokens).
import { Canvas } from "@shopify/react-native-skia";
import { StyleSheet } from "react-native";
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
import { WarmSpotlight } from "./warm-spotlight.tsx";

// What the canvas is while a spotlight plays, and while none does (invisible). The Skia canvas on the web ignores the `pointerEvents` prop, so the style says it
// too: without it the full-screen canvas would take every touch, click and hover meant for the table beneath it.
const LIVE = { ...StyleSheet.absoluteFill, pointerEvents: "none" } as const;
const HIDDEN = { ...LIVE, opacity: 0 } as const;

// Memoized: the table renders on every move, and the layer reads its plan and clock from the handoff store, not from props.
export const HeldSpotlightLayer = memo(function HeldSpotlightLayer({ handoff, picture, pictureRevision, nameOf, sphereOf }: SpotlightLayerProps) {
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
  if (!live && !canPlay) return null;
  const t = tableTokensByTheme.dark;
  return (
    <Canvas style={live ? LIVE : HIDDEN} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {live ? <Spotlight plan={plan} progress={progress} images={images} damage={damage} backs={backs} fonts={fonts} spotFonts={spotFonts} texture={texture} burn={burn} t={t} theme={theme} drift={drift} s={s} nameOf={nameOf} sphereOf={iconOf} k={k} /> : null}
      <WarmSpotlight enabled={canPlay} busy={live} card={player ?? encounter} damage={damage} backs={backs} fonts={fonts} spotFonts={spotFonts} texture={texture} burn={burn} t={t} theme={theme} drift={drift} s={s} />
    </Canvas>
  );
});
