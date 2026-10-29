import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { CroppedArt } from "./art";
import { PAINTING } from "./art-crop";
import { Chevron, markedSphere, RingMark, sphereWord, SphereMark, usePressedNight } from "./chrome";
import { CardThumb, useCardPreview } from "./images/picture";
import { nightFade, rowSurface, selectedRingOf } from "../play/surfaces";
import { useTableTokens } from "../play/use-table-tokens";
import type { PictureSource } from "../play/table-canvas-types";
import { withAlphaHex } from "../play/tokens";
import { usePalette } from "./palette-hook";
import { useUiScale } from "../play/ui-scale";
import { Text } from "../play/text";

export type HeroFace = {
  code: string;
  name: string;
  sphereCode: string | null;
  sphereName: string | null;
  imagesrc: string | null;
};

/** The face of a hero the catalog lacks: its code (or a name the caller knows), with no sphere and no picture. */
export function heroFace(faces: ReadonlyMap<string, HeroFace>, code: string, name: string = code): HeroFace {
  return faces.get(code) ?? { code, name, sphereCode: null, sphereName: null, imagesrc: null };
}

export function HeroTile({
  hero,
  height,
  onRemove,
  onPress,
  onLongPress,
  flush = false,
  dense = false,
  bare = false,
  loss = null,
  ringBearer = false,
  card,
}: {
  hero: HeroFace;
  height: number;
  onRemove?: () => void;
  // The deck editor opens the hero's card on a tap and previews it on a long press, as it does a card row.
  onPress?: () => void;
  onLongPress?: (source: PictureSource | null) => void;
  flush?: boolean;
  dense?: boolean;
  // The picture alone, with no name band: the deck list's covers, where the deck's own name is the only text.
  bare?: boolean;
  // What the app leaves out of this hero's text ("Ability not applied"), under its sphere; null when it applies all of it.
  loss?: string | null;
  // The hero carries the One Ring: an accent edge and the Ring mark in the corner.
  ringBearer?: boolean;
  // The whole card at this width instead of its painting with a name band: the deck editor's hero cards.
  card?: number;
}) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  const preview = useCardPreview(hero.code, hero.imagesrc);
  const sphere = sphereWord(hero.sphereName);
  const mark = markedSphere(hero.sphereCode);
  return (
    <View
      className={`flex-1 overflow-hidden ${flush ? "" : "rounded-tile"}`}
      style={{ height, ...(flush ? {} : { boxShadow: ringBearer ? selectedRingOf(t, 1.5) : `0 8px 18px ${withAlphaHex(t.shade, t.depth === "light" ? 0.2 : 0.8)}` }) }}
    >
      {card != null ? (
        <View>
          <CardThumb code={hero.code} imagesrc={hero.imagesrc} width={card} height={height} />
          {loss ? (
            <View className="absolute left-1 right-1 rounded px-1 py-0.5" style={{ bottom: 4 * s, backgroundColor: withAlphaHex(palette.night, 0.82) }}>
              <Text testID={`hero-loss-${hero.code}`} className="text-center text-micro text-muted" numberOfLines={1}>
                {loss}
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
      <CroppedArt card={hero} region={PAINTING} height={height}>
        {bare ? null : (
          <>
            {/* Night rises from the foot, so the name reads on the painting; it grows past a third of the tile rather than lose the name. */}
            <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: height * 0.62, ...nightFade(0, 0.78, undefined, t) }} />
            <View pointerEvents="none" className="justify-end px-2 pb-2" style={{ position: "absolute", left: 0, right: 0, bottom: 0, minHeight: height / 3 }}>
              {/* A dense tile (four to a row in the briefing) gives the name the tile's whole width on two lines, its marks on a
                  line above it: the sphere's printed icon, and the Ring for the Ring-bearer. */}
              {dense && (mark || ringBearer) ? (
                <View className="mb-0.5 flex-row items-center gap-1">
                  {mark ? <SphereMark sphere={mark} size={11} /> : null}
                  {ringBearer ? <RingMark size={10} state="current" /> : null}
                </View>
              ) : null}
              <Text className={`font-display ${dense ? "" : "text-heading"} ${ringBearer ? "text-accentHigh" : "text-bone"}`} style={dense ? { fontSize: 12 * s, lineHeight: 15 * s } : undefined} numberOfLines={2}>
                {hero.name}
              </Text>
              {dense ? null : (
                <View className="mt-0.5 flex-row flex-wrap items-center gap-x-1">
                  {mark ? <SphereMark sphere={mark} /> : null}
                  <Text className="text-label text-bone" numberOfLines={1}>
                    {sphere}
                  </Text>
                  {hero.sphereCode === "fellowship" ? (
                    <Text testID={`saga-only-${hero.code}`} className="text-label text-accent" numberOfLines={1}>
                      Saga only
                    </Text>
                  ) : null}
                </View>
              )}
              {loss ? (
                <Text testID={`hero-loss-${hero.code}`} className="text-label text-muted" numberOfLines={1}>
                  {loss}
                </Text>
              ) : null}
            </View>
            {ringBearer && !dense ? (
              <View pointerEvents="none" className="absolute left-1.5 top-1.5 h-6 w-6 items-center justify-center rounded-pill" style={{ backgroundColor: withAlphaHex(palette.night, 0.8) }}>
                <RingMark size={12} state="current" />
              </View>
            ) : null}
          </>
        )}
      </CroppedArt>
      )}
      {onPress ? (
        <Pressable
          testID={`hero-${hero.code}`}
          collapsable={false}
          accessibilityRole="button"
          accessibilityLabel={`${hero.name}, ${sphere}${loss ? `, ${loss}` : ""}`}
          accessibilityHint="Opens the card"
          onPress={onPress}
          onLongPress={onLongPress ? () => onLongPress(preview) : undefined}
          delayLongPress={350}
          // A transparent fill at full opacity, not an invisible view: iOS skips a view below 0.01 opacity when it hit-tests.
          style={({ pressed }) => ({ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: pressed ? withAlphaHex(palette.night, 0.25) : "transparent" })}
        />
      ) : null}
      {onRemove ? (
        <Pressable
          testID={`hero-remove-${hero.code}`}
          collapsable={false}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${hero.name}`}
          onPress={onRemove}
          className="absolute right-0 top-0 min-h-touch min-w-touch items-center justify-center"
        >
          {({ pressed }) => (
            <View className="h-7 w-7 items-center justify-center rounded-pill" style={{ backgroundColor: pressed ? palette.pressed : withAlphaHex(palette.night, 0.78), boxShadow: `0 4px 10px ${withAlphaHex(palette.night, 0.8)}` }}>
              <Text style={{ color: palette.bone, fontSize: 13 * s, lineHeight: 15 * s, fontWeight: "700" }}>{"\u2715"}</Text>
            </View>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyHeroSlot({
  height,
  label = "Hero",
  onPress,
  testID,
}: {
  height: number;
  label?: string;
  // An empty slot the player can fill (the deck editor's hero slots) is a button: "+ Add hero".
  onPress?: () => void;
  testID?: string;
}) {
  const palette = usePalette();
  const pressedNight = usePressedNight();
  const frame = { height, borderWidth: 1.5, borderStyle: "dashed" as const, borderColor: withAlphaHex(palette.accentLine, 0.7), backgroundColor: withAlphaHex(palette.night, 0.45) };
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={`Add ${label.toLowerCase()}`}
        onPress={onPress}
        className="w-full overflow-hidden rounded-tile"
        style={frame}
      >
        {({ pressed }) => (
          <View className="flex-1 items-center justify-center" style={pressed ? pressedNight : undefined}>
            <Text className="font-display text-title text-accent">+</Text>
            <Text className="font-display text-label text-accent">{`Add ${label.toLowerCase()}`}</Text>
          </View>
        )}
      </Pressable>
    );
  }
  return (
    <View testID={testID} className="w-full items-center justify-center gap-2 rounded-tile px-1" style={frame}>
      <RingMark size={18} state="current" />
      <Text className="text-center font-display text-label text-accent">{label}</Text>
    </View>
  );
}

type DeckSummary = {
  name: string;
  heroes: readonly HeroFace[];
  // "3 heroes · 47 of 50 cards".
  detail: string;
  status: { ready: boolean; text: string };
  // "6 cards with text not applied" (deck-status.ts, notAppliedLine), under the status; not a readiness rule.
  note?: string | null;
  onPress: () => void;
  onLongPress?: () => void;
  testID: string;
  // The row of actions under the deck while the list is managed, or Open in Decks in the briefing.
  children?: ReactNode;
  // Set in the briefing's picker: the deck is a radio, accent-edged with the word Selected when picked, dimmed when it
  // cannot be picked (the status line says why).
  selected?: boolean;
  disabled?: boolean;
};

// The press props of a deck in the list (a button) or in the briefing's picker (a radio).
function pressProps({ name, heroes, detail, status, note, onPress, onLongPress, testID, selected, disabled }: DeckSummary) {
  const picker = selected !== undefined;
  return {
    testID,
    collapsable: false,
    accessibilityRole: picker ? ("radio" as const) : ("button" as const),
    accessibilityState: picker ? { selected, disabled: disabled ?? false } : undefined,
    accessibilityLabel: `${name}, ${heroNames(heroes)}, ${detail}, ${status.text}${note ? `, ${note}` : ""}`,
    accessibilityHint: picker ? undefined : "Opens the deck",
    disabled: disabled ?? false,
    onPress,
    onLongPress,
    delayLongPress: 350,
  };
}

function SelectedMark({ selected }: { selected: boolean | undefined }) {
  if (selected === undefined) return null;
  return (
    <View className="flex-row items-center gap-1.5">
      <RingMark size={14} state={selected ? "done" : "locked"} />
      {selected ? <Text className="text-label font-semibold text-accentHigh">Selected</Text> : null}
    </View>
  );
}

function heroNames(heroes: readonly HeroFace[]): string {
  return heroes.length > 0 ? heroes.map((hero) => hero.name).join(", ") : "No heroes yet";
}

function StatusLine({ testID, detail, status, note }: { testID: string; detail: string; status: DeckSummary["status"]; note?: string | null }) {
  const palette = usePalette();
  const s = useUiScale();
  return (
    <View>
      <View className="mt-1 flex-row flex-wrap items-center gap-x-2">
        <Text className="text-label text-muted">{detail}</Text>
        <View className="flex-row items-center gap-1.5">
          <View style={{ width: 8 * s, height: 8 * s, borderRadius: 4 * s, ...(status.ready ? { backgroundColor: palette.ok } : { borderWidth: 1.5, borderColor: palette.danger }) }} />
          <Text testID={`${testID}-status`} className={`text-label ${status.ready ? "text-ok" : "text-danger"}`}>
            {status.text}
          </Text>
        </View>
      </View>
      {note ? (
        <Text testID={`${testID}-not-applied`} className="mt-0.5 text-label text-muted">
          {note}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * A saved deck in the deck list's Cards view: its three heroes' paintings side by side, split by 1 pt of the ground and fading into
 * the cover's foot, then the deck's name, and a line with the heroes on the left and whether it is ready on the right. The selected
 * deck (the briefing's picker) carries the silver ring. A FlashList row: a solid fill and no shadow (docs/design-system.md, Performance).
 */
export function DeckCover(props: DeckSummary & { height: number }) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  const { name, heroes, detail, status, note, height, testID, children, selected, disabled } = props;
  const foot = t.depth === "light" ? palette.raised : palette.dusk;
  return (
    <View className="overflow-hidden rounded-card" style={{ backgroundColor: foot, ...(selected ? { boxShadow: selectedRingOf(t) } : {}) }}>
      <Pressable {...pressProps(props)}>
        {({ pressed }) => (
          <View style={pressed && !disabled ? rowSurface(true, t) : undefined}>
            <View className="flex-row" style={{ height, opacity: disabled ? 0.45 : 1, gap: 1, backgroundColor: palette.night }}>
              {heroes.length > 0 ? (
                heroes.map((hero) => <HeroTile key={hero.code} hero={hero} height={height} flush bare />)
              ) : (
                <View className="flex-1 items-center justify-center bg-dusk">
                  <Text className="text-label text-faint">No heroes yet</Text>
                </View>
              )}
              <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: height * 0.5, ...nightFade(0, 1, foot, t) }} />
            </View>
            <View className="px-3 pb-3" style={{ marginTop: -18 * s }}>
              <View className="flex-row items-start justify-between gap-2">
                <Text className={`shrink font-display ${disabled ? "text-faint" : selected ? "text-accentHigh" : "text-bone"}`} style={{ fontSize: 20 * s, lineHeight: 25 * s }} numberOfLines={2}>
                  {name}
                </Text>
                <View className="pt-1.5">
                  <SelectedMark selected={selected} />
                </View>
              </View>
              <View className="mt-0.5 flex-row items-center justify-between gap-2">
                <Text className="min-w-0 shrink text-label text-muted" numberOfLines={1}>
                  {heroNames(heroes)}
                </Text>
                <Readiness testID={testID} status={status} />
              </View>
              <Text className="text-label text-faint">{detail}</Text>
              {note ? (
                <Text testID={`${testID}-not-applied`} className="mt-0.5 text-label text-muted">
                  {note}
                </Text>
              ) : null}
            </View>
          </View>
        )}
      </Pressable>
      {children ? <View className="px-1" style={{ backgroundColor: withAlphaHex(palette.night, 0.3) }}>{children}</View> : null}
    </View>
  );
}

/** Ready to play, with a green dot, or what the deck still needs, with a red one. */
function Readiness({ testID, status }: { testID: string; status: DeckSummary["status"] }) {
  const palette = usePalette();
  const s = useUiScale();
  const color = status.ready ? palette.ok : palette.danger;
  return (
    <View className="flex-row items-center gap-1.5">
      <View style={{ width: 7 * s, height: 7 * s, borderRadius: 3.5 * s, backgroundColor: color, boxShadow: `0 0 6px ${withAlphaHex(color, 0.7)}` }} />
      <Text testID={`${testID}-status`} className="text-label" style={{ color }} numberOfLines={1}>
        {status.text}
      </Text>
    </View>
  );
}

const rowThumb = { width: 30, height: 42 };

/** A saved deck in the deck list's List view: the heroes as small pictures, the name, the counts and the readiness. */
export function DeckRow(props: DeckSummary) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  const { name, heroes, detail, status, note, testID, children, selected, disabled } = props;
  const thumb = { width: rowThumb.width * s, height: rowThumb.height * s };
  return (
    <View className="mb-1.5 overflow-hidden rounded-tile" style={selected ? { boxShadow: selectedRingOf(t) } : undefined}>
      <Pressable
        {...pressProps(props)}
        className="min-h-16 flex-row items-center gap-3 px-3 py-2"
        style={({ pressed }) => rowSurface(pressed && !disabled, t)}
      >
        <View className="flex-row" style={{ width: thumb.width * 3 - 16 * s, opacity: disabled ? 0.45 : 1 }}>
          {heroes.length > 0 ? (
            heroes.slice(0, 3).map((hero, at) => (
              <View key={hero.code} style={{ marginLeft: at === 0 ? 0 : -8 * s, borderRadius: 3, overflow: "hidden", boxShadow: `0 2px 6px ${withAlphaHex(palette.night, 0.8)}` }}>
                <CardThumb code={hero.code} imagesrc={hero.imagesrc} width={thumb.width} height={thumb.height} />
              </View>
            ))
          ) : (
            <View className="items-center justify-center rounded-sm bg-dusk" style={thumb}>
              <Text className="text-label text-faint">—</Text>
            </View>
          )}
        </View>
        <View className="flex-1">
          <Text className={`font-display text-heading ${disabled ? "text-faint" : selected ? "text-accentHigh" : "text-bone"}`} numberOfLines={1}>
            {name}
          </Text>
          <StatusLine testID={testID} detail={detail} status={status} note={note} />
        </View>
        {selected === undefined ? <Chevron direction="right" color={palette.faint} size={8} /> : <SelectedMark selected={selected} />}
      </Pressable>
      {children}
    </View>
  );
}
