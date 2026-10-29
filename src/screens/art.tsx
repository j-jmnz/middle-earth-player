// Card art on the screens (docs/design-system.md, Card art): a region of a card picture filling a box, a hero's round portrait,
// and a scenario's scene from its first quest card. Each falls back to a dark surface while its file is missing, so a screen never
// waits on a picture and never shows a hole. Scene art is drawn desaturated and darkened (`ART_FILTER`), so it sits in the fog.

import { Image } from "expo-image";
import { eq } from "drizzle-orm";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { View } from "react-native";

import { cards } from "../catalog/schema";
import { nightFade, panelSurface, topShade } from "../play/surfaces";
import { useTableTokens } from "../play/use-table-tokens";
import { withAlphaHex } from "../play/tokens";
import { cropFrame, FACE, PLAYER_CARD_ASPECT, QUEST_CARD_ASPECT, SCENE, type Region } from "./art-crop";
import { scenarioOf } from "./campaign-data";
import { useDatabases } from "./databases";
import { enqueueImageDownloads } from "./images/queue";
import { useCardPreview } from "./images/picture";
import { usePalette } from "./palette-hook";
import { useTheme } from "../play/theme";
import { useUiScale } from "../play/ui-scale";

export type ArtCard = { code: string; imagesrc: string | null };

/** How Carved Stone dims a scene behind words: less colour, a little more contrast, darker. Not drawn inside a list row. */
export const ART_FILTER = "saturate(0.62) contrast(1.12) brightness(0.8)";

/**
 * One region of a card picture covering a box. `width` and `height` fix the box; without a width the box fills its parent and
 * is measured. The picture is decoded at the size it is drawn.
 */
export function CroppedArt({
  card,
  region,
  aspect = PLAYER_CARD_ASPECT,
  width,
  height,
  radius = 0,
  dim = false,
  children,
}: {
  card: ArtCard | null;
  region: Region;
  aspect?: number;
  width?: number;
  height: number;
  radius?: number;
  // Desaturate and darken the picture (ART_FILTER): a scene behind words. Never inside a list row.
  dim?: boolean;
  // Laid over the picture: a fade, a name, a mark.
  children?: ReactNode;
}) {
  const palette = usePalette();
  const [measured, setMeasured] = useState(0);
  const boxWidth = width ?? measured;
  const source = useCardPreview(card?.code ?? "", card?.imagesrc ?? null);
  useEffect(() => {
    if (!card?.imagesrc) return;
    enqueueImageDownloads([{ code: card.code, imagesrc: card.imagesrc }]);
  }, [card?.code, card?.imagesrc]);
  const crop = useMemo(() => (boxWidth > 0 ? cropFrame({ width: boxWidth, height }, aspect, region) : null), [boxWidth, height, aspect, region]);
  return (
    <View
      collapsable={false}
      onLayout={
        width == null
          ? (event) => {
              const next = Math.round(event.nativeEvent.layout.width);
              setMeasured((current) => (current === next ? current : next));
            }
          : undefined
      }
      // A solid fill under the picture, never a gradient: a cropped picture is drawn inside list rows (docs/design-system.md, Performance).
      style={{ width: width ?? "100%", height, overflow: "hidden", borderRadius: radius, backgroundColor: palette.raised }}
    >
      {card && source && crop ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...(dim ? { filter: ART_FILTER } : {}) }}>
          <Image
            recyclingKey={card.code}
            source={source}
            contentFit="fill"
            accessible={false}
            style={{ position: "absolute", width: crop.width, height: crop.height, left: crop.left, top: crop.top }}
          />
        </View>
      ) : null}
      {children}
    </View>
  );
}

/**
 * A hero's face in a ring: the hero's sphere colour (`tint`) with a glow of it, or the accent. The name is the caller's to say; the
 * portrait is not read. `size` is the Medium size; it is scaled here. `glow` is off inside a list row (Performance).
 */
export function Portrait({ card, size: base = 40, ring = true, tint, glow = true }: { card: ArtCard | null; size?: number; ring?: boolean; tint?: string; glow?: boolean }) {
  const palette = usePalette();
  const size = base * useUiScale();
  const color = tint ?? palette.accent;
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        ...(ring ? { borderWidth: 1.5, borderColor: color, ...(glow && tint ? { boxShadow: `0 0 10px ${withAlphaHex(tint, 0.55)}` } : {}) } : { borderWidth: 1, borderColor: palette.hairline }),
      }}
    >
      <CroppedArt card={card} region={FACE} width={size - (ring ? 3 : 2)} height={size - (ring ? 3 : 2)} />
    </View>
  );
}

/** A row of overlapping portraits: a fellowship at a glance. */
export function PortraitRow({ heroes, size: base = 40 }: { heroes: readonly ArtCard[]; size?: number }) {
  const palette = usePalette();
  const size = base * useUiScale();
  return (
    <View className="flex-row" importantForAccessibility="no-hide-descendants">
      {heroes.map((hero, index) => (
        <View key={`${hero.code}:${index}`} style={{ marginLeft: index === 0 ? 0 : -size * 0.3, borderRadius: size / 2, borderWidth: 2, borderColor: palette.night }}>
          <Portrait card={hero} size={base} />
        </View>
      ))}
    </View>
  );
}

/** The first quest card of a scenario: its scene is the scenario's picture. Null for a scenario the data lacks. */
export function useSceneCard(scenarioId: string | null | undefined): ArtCard | null {
  const { catalog } = useDatabases();
  const code = scenarioId ? (scenarioOf(scenarioId)?.stages[0] ?? null) : null;
  return useMemo(() => {
    if (!code) return null;
    const row = catalog.select({ imagesrc: cards.imagesrc }).from(cards).where(eq(cards.code, code)).get();
    return { code, imagesrc: row?.imagesrc ?? null };
  }, [catalog, code]);
}

/**
 * A scenario's scene, cropped from its first quest card, filling a box. `shade` lays a soft night over its top (for Back and the
 * status bar, or chips), `fade` night rising from that fraction of its height to solid at its foot, in `fadeTo` (the surface the
 * words below it sit on).
 */
export function SceneArt({
  scenarioId,
  height,
  width,
  radius = 0,
  shade,
  fade,
  fadeTo,
  vivid = false,
  children,
}: {
  scenarioId: string | null | undefined;
  height: number;
  width?: number;
  radius?: number;
  shade?: number;
  fade?: number;
  fadeTo?: string;
  // Keep the scene's full colour: a small thumb in a list row, where no filter is drawn (Performance).
  vivid?: boolean;
  children?: ReactNode;
}) {
  const card = useSceneCard(scenarioId);
  const t = useTableTokens();
  return (
    <CroppedArt card={card} region={SCENE} aspect={QUEST_CARD_ASPECT} height={height} width={width} radius={radius} dim={!vivid}>
      {shade != null ? <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...topShade(shade, t) }} /> : null}
      {fade != null ? <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...nightFade(fade, 1, fadeTo, t) }} /> : null}
      {children}
    </CroppedArt>
  );
}

/**
 * A floating panel that opens on a scenario's scene (the scenario to play on the path, a game in progress): the scene, dimmed, on top
 * with `over` laid on it (chips), and `children` pulled up over the scene's fade so the words start in its dark.
 */
export function SceneCard({
  scenarioId,
  sceneHeight,
  pullUp,
  hero = false,
  pressed = false,
  over,
  children,
}: {
  scenarioId: string | null | undefined;
  sceneHeight: number;
  // How far the words rise into the scene's fade.
  pullUp: number;
  // The Continue card's larger corners (rounded-hero).
  hero?: boolean;
  pressed?: boolean;
  over?: ReactNode;
  children: ReactNode;
}) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <View className={hero ? "rounded-hero" : "rounded-card"} style={panelSurface(pressed, t)}>
      <View className={`overflow-hidden ${hero ? "rounded-t-hero" : "rounded-t-card"}`}>
        <SceneArt scenarioId={scenarioId} height={sceneHeight * s} shade={0.4} fade={0.35} fadeTo={palette.dusk}>
          {over}
        </SceneArt>
      </View>
      <View style={{ marginTop: -pullUp * s }}>{children}</View>
    </View>
  );
}

/**
 * How a picture behind a page meets the ground, which is a gradient, not one colour. Dark fades it to night (the ground is near enough
 * night everywhere). Light multiplies the picture onto the ground and fades it to white, which multiplies to nothing, so it ends on the
 * ground itself and leaves no band where it stops.
 */
export function useArtGround(): { ground: string; blend: { mixBlendMode?: "multiply" } } {
  const palette = usePalette();
  return useTheme() === "light" ? { ground: "#FFFFFF", blend: { mixBlendMode: "multiply" } } : { ground: palette.night, blend: {} };
}

/**
 * A scenario's scene as the art layer of a page (the Campaigns hub): drawn large and dimmed behind the hero words, faded out at its
 * edges by an elliptical shade and taken down to the ground towards its foot, so the words and panels under it sit in the fog. It does
 * not scroll and takes no touches. `left` places it (centred on the page by default).
 */
export function HeroArt({ scenarioId, width, height, left }: { scenarioId: string | null | undefined; width: number; height: number; left?: number }) {
  const { ground, blend } = useArtGround();
  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={{ position: "absolute", top: 0, width, height, ...blend, ...(left == null ? { alignSelf: "center" } : { left }) }}>
      <SceneArt scenarioId={scenarioId} width={width} height={height} />
      <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundImage: `radial-gradient(52% 64% at 50% 34%, ${withAlphaHex(ground, 0)} 40%, ${ground} 100%)` }} />
      <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundImage: `linear-gradient(180deg, ${withAlphaHex(ground, 0)} 40%, ${withAlphaHex(ground, 0.75)} 70%, ${ground} 88%)` }} />
    </View>
  );
}
