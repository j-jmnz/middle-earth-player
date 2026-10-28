// Card art on the screens (docs/design-system.md, Card art): a region of a card picture filling a box, a hero's round portrait,
// and a scenario's scene from its first quest card. Each falls back to a lit night surface while its file is missing, so a
// screen never waits on a picture and never shows a hole.
import { Image } from "expo-image";
import { eq } from "drizzle-orm";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { View } from "react-native";

import { cards } from "../catalog/schema";
import { nightFade, raisedEdgeOf, panelSurface, topShade } from "../play/surfaces";
import { useTableTokens } from "../play/use-table-tokens";
import { cropFrame, FACE, PLAYER_CARD_ASPECT, QUEST_CARD_ASPECT, SCENE, type Region } from "./art-crop";
import { Corners } from "./chrome-marks";
import { scenarioOf } from "./campaign-data";
import { useDatabases } from "./databases";
import { enqueueImageDownloads } from "./images/queue";
import { useCardPreview } from "./images/picture";
import { usePalette } from "./palette-hook";
import { useUiScale } from "../play/ui-scale";

export type ArtCard = { code: string; imagesrc: string | null };

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
  children,
}: {
  card: ArtCard | null;
  region: Region;
  aspect?: number;
  width?: number;
  height: number;
  radius?: number;
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
        <Image
          recyclingKey={card.code}
          source={source}
          contentFit="fill"
          accessible={false}
          style={{ position: "absolute", width: crop.width, height: crop.height, left: crop.left, top: crop.top }}
        />
      ) : null}
      {children}
    </View>
  );
}

/** A hero's face in a gold ring. The name is the caller's to say; the portrait is not read. `size` is the Medium size; it is scaled here. */
export function Portrait({ card, size: base = 40, ring = true }: { card: ArtCard | null; size?: number; ring?: boolean }) {
  const palette = usePalette();
  const size = base * useUiScale();
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        ...(ring ? { borderWidth: 1.5, borderColor: palette.gold } : { borderWidth: 1, borderColor: palette.hairline }),
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
  children,
}: {
  scenarioId: string | null | undefined;
  height: number;
  width?: number;
  radius?: number;
  shade?: number;
  fade?: number;
  fadeTo?: string;
  children?: ReactNode;
}) {
  const card = useSceneCard(scenarioId);
  const t = useTableTokens();
  return (
    <CroppedArt card={card} region={SCENE} aspect={QUEST_CARD_ASPECT} height={height} width={width} radius={radius}>
      {shade != null ? <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...topShade(shade, t) }} /> : null}
      {fade != null ? <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...nightFade(fade, 1, fadeTo, t) }} /> : null}
      {children}
    </CroppedArt>
  );
}

/**
 * A framed card that opens on a scenario's scene (the Continue card, the scenario to play on the path, a game in progress): the
 * goldLine edge and the gold corners, the scene on top with `over` laid on it (chips), and `children` pulled up over the scene's
 * fade so the words start in its night.
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
    <View className={hero ? "rounded-hero" : "rounded-card"} style={{ ...panelSurface(pressed, t), borderWidth: 1, borderColor: palette.goldLine, boxShadow: raisedEdgeOf(t) }}>
      <View className={`overflow-hidden ${hero ? "rounded-t-hero" : "rounded-t-card"}`}>
        <SceneArt scenarioId={scenarioId} height={sceneHeight * s} shade={0.4} fade={0.4} fadeTo={palette.raised}>
          {over}
        </SceneArt>
      </View>
      <View style={{ marginTop: -pullUp * s }}>{children}</View>
      <Corners />
    </View>
  );
}
