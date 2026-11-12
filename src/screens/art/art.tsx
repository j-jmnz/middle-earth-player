// Card art on the screens (docs/design-system.md, Card art): a region of a card picture filling a box,
// and a scenario's scene from its first quest card. Each falls back to a dark surface while its file is missing, so a screen never
// waits on a picture and never shows a hole. Scene art is drawn desaturated and darkened (`ART_FILTER`), so it sits in the fog.

import { Image } from "expo-image";
import { eq } from "drizzle-orm";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PixelRatio, Platform, View, type ViewStyle } from "react-native";

import { cards } from "../../catalog/schema";
import { DECORATIVE_ALT } from "../../ui/decorative";
import { cachePolicyFor } from "../../ui/image-cache";
import { nightFade, panelSurface, topShade } from "../../ui/surfaces";
import { useTableTokens } from "../../ui/use-table-tokens";
import { withAlphaHex } from "../../ui/tokens";
import { FogVeil, LightVeil } from "./backdrop";
import { rgbOf } from "../../ui/fog/fog";
import { heroVeil } from "./backdrop-scenes";
import { cropFrame, PLAYER_CARD_ASPECT, QUEST_CARD_ASPECT, SCENE, sceneBand, WHOLE, type Region } from "./crop";
import { scenarioOf } from "../data/campaign-data";
import { SceneCanvas } from "./scene-canvas";
import { cssMask, filterMatrix, sceneMask, type MaskRamp } from "./scene-mask";
import { useDatabases } from "../data/databases";
import { enqueueImageDownloads } from "../images/queue";
import { useCardPreview } from "../images/picture";
import { scanAssets } from "../images/scan-map";
import { usePalette } from "../kit/palette-hook";
import { ITEM_RADIUS } from "../../ui/radius";
import { useTheme } from "../../ui/theme";
import { useUiScale } from "../../ui/ui-scale";
import { usePictureHold } from "../../ui/showcase/use-picture-hold";

export type ArtCard = { code: string; imagesrc: string | null };

/** How Carved Stone dims a scene behind words: less colour, a little more contrast, darker. Not drawn inside a list row. */
export const ART_FILTER = "saturate(0.62) contrast(1.12) brightness(0.8)";
// ART_FILTER as a colour matrix, for a scene drawn on a canvas (GroundedScene on a phone).
const ART_MATRIX = filterMatrix(0.62, 1.12, 0.8);

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
  bare = false,
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
  // No fill under the picture: art on the page's ground, which must never show a hard-edged box while its picture loads or is missing.
  bare?: boolean;
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
  // The showcase build waits for the scene until it has loaded (ui/showcase/picture-loads.ts).
  const [loaded, setLoaded] = useState<string | null>(null);
  const drawn = card != null && source != null;
  usePictureHold(drawn && loaded !== card.code);
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
      style={{ width: width ?? "100%", height, overflow: "hidden", borderRadius: radius, backgroundColor: bare ? "transparent" : palette.raised }}
    >
      {card && source && crop ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...(dim ? { filter: ART_FILTER } : {}) }}>
          <Image
            recyclingKey={card.code}
            source={source}
            onLoad={() => setLoaded(card.code)}
            cachePolicy={cachePolicyFor(source)}
            contentFit="fill"
            accessible={false}
            accessibilityLabel={DECORATIVE_ALT}
            style={{ position: "absolute", width: crop.width, height: crop.height, left: crop.left, top: crop.top }}
          />
        </View>
      ) : null}
      {children}
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
 * A scenario's picture: the scene bundled on its own at its source's size (`<code>.scene`, scripts/build/pack-scans.ts), drawn whole; else
 * the first quest card, the scene cropped from it. `sourceWidth` is the bundled scene's, which bounds how large it is drawn sharp.
 */
export function useScenePicture(scenarioId: string | null | undefined): { card: ArtCard | null; region: Region; aspect: number; sourceWidth: number | null } {
  const card = useSceneCard(scenarioId);
  return useMemo(() => {
    const scene = card ? scanAssets[`${card.code}.scene`] : undefined;
    if (!card || !scene) return { card, region: SCENE, aspect: QUEST_CARD_ASPECT, sourceWidth: null };
    return { card: { code: `${card.code}.scene`, imagesrc: null }, region: WHOLE, aspect: scene.width / scene.height, sourceWidth: scene.width };
  }, [card]);
}

/** How tall a scenario's scene is drawn across a box of `width` × `height` (sceneBand): the box's height without a bundled scene. */
function useSceneBand(scenarioId: string | null | undefined, width: number, height: number): number {
  const { region, aspect, sourceWidth } = useScenePicture(scenarioId);
  return sourceWidth != null && width > 0 ? Math.round(sceneBand({ width, height }, (aspect * region.w) / region.h, sourceWidth, PixelRatio.get())) : height;
}

/**
 * A scenario's scene, cropped from its first quest card (or its bundled scene), filling a box. `shade` lays a soft night over its top (for Back and the
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
  bare = false,
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
  // On the page's ground (HeroArt, GroundedScene): no fill under the picture (CroppedArt).
  bare?: boolean;
  children?: ReactNode;
}) {
  const { card, region, aspect } = useScenePicture(scenarioId);
  const t = useTableTokens();
  return (
    <CroppedArt card={card} region={region} aspect={aspect} height={height} width={width} radius={radius} dim={!vivid} bare={bare}>
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
  pressed = false,
  over,
  children,
}: {
  scenarioId: string | null | undefined;
  sceneHeight: number;
  // How far the words rise into the scene's fade.
  pullUp: number;
  pressed?: boolean;
  over?: ReactNode;
  children: ReactNode;
}) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <View className="rounded-container" style={panelSurface(pressed, t)}>
      <View className="overflow-hidden rounded-t-container">
        <SceneArt scenarioId={scenarioId} height={sceneHeight * s} shade={0.4} fade={0.35} fadeTo={palette.dusk}>
          {over}
        </SceneArt>
      </View>
      <View style={{ marginTop: -pullUp * s }}>{children}</View>
    </View>
  );
}

/**
 * How a picture behind a page meets the ground, which is fog and light, not one colour. Dark screens the picture onto the ground and
 * fades it to black, which screens to nothing; Light multiplies it onto the ground and fades it to white, which multiplies to nothing.
 * Either way it ends on the ground itself, fog and all, and leaves no band where it stops (user report, 2026-10-30: a fade to night
 * met the fog under it in a line).
 */
export function useArtGround(): { ground: string; blend: { mixBlendMode: "multiply" | "screen" } } {
  return useTheme() === "light" ? { ground: "#FFFFFF", blend: { mixBlendMode: "multiply" } } : { ground: "#000000", blend: { mixBlendMode: "screen" } };
}

/**
 * A scenario's scene at the head of a page (the briefing), faded out at its foot and, with `edge`, at its right so it sits in the fog
 * of the pane beside it. `children` are laid over it unfaded (the banner's words). `soft` is a picture that stands inside a page's
 * content (the Campaigns start block): 12 pt corners and every edge feathered into the page, so no rectangle shows. The fades are
 * the picture's own alpha (sceneMask), not a colour laid over it, so they end in whatever fog is behind: a CSS mask in the browser
 * (which still meets the ground with useArtGround's blend), a Skia canvas on a phone, where a view's blend does not reach the
 * backdrop's canvas and a fade to the ground drew as a line.
 */
export function GroundedScene({
  scenarioId,
  height,
  shade,
  fade,
  edge = false,
  soft = false,
  children,
}: {
  scenarioId: string | null | undefined;
  height: number;
  shade?: number;
  fade: number;
  edge?: boolean;
  soft?: boolean;
  children?: ReactNode;
}) {
  const { blend } = useArtGround();
  const t = useTableTokens();
  const s = useUiScale();
  const [width, setWidth] = useState(0);
  // A band at the box's top when the box would blow the scene up (sceneBand); it fades out, and the words below it sit in the fog.
  const band = useSceneBand(scenarioId, width, height);
  const ramps = sceneMask({ width, height, band, fade, edge, edgeWidth: 96 * s, soft });
  const fill = { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 } as const;
  const corners = soft ? { borderRadius: ITEM_RADIUS * s, overflow: "hidden" as const } : {};
  return (
    <View
      style={{ height }}
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        setWidth((current) => (current === next ? current : next));
      }}
    >
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={Platform.OS === "web" ? { ...fill, ...blend, ...corners, ...webMask(cssMask(ramps)) } : { ...fill, ...corners }}>
        {Platform.OS === "web" ? (
          <SceneArt scenarioId={scenarioId} height={band} shade={shade} bare />
        ) : (
          <NativeScene scenarioId={scenarioId} width={width} height={height} band={band} shade={shade == null ? null : { colors: [withAlphaHex(t.night, 0.55), withAlphaHex(t.night, 0)], to: shade * band }} ramps={ramps} />
        )}
      </View>
      {children}
    </View>
  );
}

// The browser's mask for a scene: the ramps intersected, so each multiplies the picture's alpha.
const webMask = (mask: string) => ({ maskImage: mask, WebkitMaskImage: mask, maskComposite: "intersect", WebkitMaskComposite: "source-in" }) as object;

// A phone's scene: the picture GroundedScene fades, drawn on a canvas (SceneCanvas) once its file and the box's width are known.
function NativeScene({ scenarioId, width, height, band, shade, ramps }: { scenarioId: string | null | undefined; width: number; height: number; band: number; shade: { colors: [string, string]; to: number } | null; ramps: MaskRamp[] }) {
  const { card, region, aspect } = useScenePicture(scenarioId);
  const source = useCardPreview(card?.code ?? "", card?.imagesrc ?? null);
  useEffect(() => {
    if (!card?.imagesrc) return;
    enqueueImageDownloads([{ code: card.code, imagesrc: card.imagesrc }]);
  }, [card?.code, card?.imagesrc]);
  if (!card || !source || width <= 0 || band <= 0) return null;
  const crop = cropFrame({ width, height: band }, aspect, region);
  return <SceneCanvas source={source} crop={crop} width={width} height={height} band={band} matrix={ART_MATRIX} shade={shade} ramps={ramps} />;
}

/**
 * A scenario's scene as the art layer of a page (the Campaigns hub): drawn large and dimmed behind the hero words, faded out at its
 * top and its foot to the ground with its middle left clear, and veiled under the title by the theme's air (`heroVeil`: Dark's fog,
 * Light's morning light), so the words and panels under it sit in it. It does not scroll and takes no touches. `left` places it (centred on the page by default); `right`, when given, is where it stops (in its
 * parent's points), fading to the ground over its last 64 pt, so it stays behind its own column.
 */
export function HeroArt({ scenarioId, width, height, left, right }: { scenarioId: string | null | undefined; width: number; height: number; left?: number; right?: number }) {
  const { ground, blend } = useArtGround();
  const palette = usePalette();
  const theme = useTheme();
  const s = useUiScale();
  const shown = right == null ? width : Math.max(0, Math.min(width, right - (left ?? 0)));
  // The picture is a band at the box's top, as tall as it stays sharp (sceneBand; user report, 2026-10-30: grainy and zoomed in); the
  // fog and the light still fill the box.
  const band = useSceneBand(scenarioId, width, height);
  const fill = { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 } as const;
  const box: ViewStyle = { position: "absolute", top: 0, width: shown, height, overflow: "hidden", ...(left == null ? { alignSelf: "center" } : { left }) };
  const edge = (color: string) =>
    shown < width ? <View style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 64 * s, backgroundImage: `linear-gradient(90deg, ${withAlphaHex(color, 0)}, ${color})` }} /> : null;
  return (
    <>
      {/* The picture in three bands (user request, 2026-10-29): the top falls to the ground under the status bar and the head, the
          middle is the picture alone with nothing over it, and from under the title down it falls to the ground. */}
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={{ ...box, ...blend }}>
        <View style={{ width, height: band }}>
          <SceneArt scenarioId={scenarioId} width={width} height={band} bare />
          <View style={{ ...fill, backgroundImage: `linear-gradient(180deg, ${ground} 0%, ${withAlphaHex(ground, 0.85)} 9%, ${withAlphaHex(ground, 0)} 28%)` }} />
          <View style={{ ...fill, backgroundImage: `linear-gradient(180deg, ${withAlphaHex(ground, 0)} 57%, ${withAlphaHex(ground, 0.55)} 76%, ${ground} 100%)` }} />
        </View>
        {edge(ground)}
      </View>
      {/* The theme's air over the picture, a layer of its own so Light's multiply stays on the picture and its light can brighten. */}
      {/* Both screen their veil onto the page, so the fog and the light brighten on a phone's canvas as on the web, and black hides them. */}
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={{ ...box, mixBlendMode: "screen" }}>
        {theme === "dark" ? (
          <>
            {/* Dark: a bank of fog under the title, falling to black at the foot and the edge so it ends in the page's own fog. */}
            <FogVeil layers={heroVeil.dark} width={width} height={height} />
            <View style={{ position: "absolute", left: 0, top: 0, width, height, backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 84%, #000000 100%)` }} />
            {edge("#000000")}
          </>
        ) : (
          <>
            {/* Light: the morning glow and its beams over the picture, and a warm glow behind the title. */}
            <LightVeil light={heroVeil.light} width={width} height={height} />
            <View style={{ position: "absolute", left: 0, top: 0, width, height, backgroundImage: `linear-gradient(180deg, rgba(${rgbOf(heroVeil.light.rgb)},0) 42%, rgba(${rgbOf(heroVeil.light.rgb)},0.45) 62%, rgba(${rgbOf(heroVeil.light.rgb)},0) 90%)` }} />
            {/* On a screened layer only dark hides light: the beams fade out at a two-column edge into Light's darkest ink. */}
            {edge(palette.bone)}
          </>
        )}
      </View>
    </>
  );
}
