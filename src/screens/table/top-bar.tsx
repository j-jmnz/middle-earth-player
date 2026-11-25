// The table's top bar, 52 pt (TOP_BAR), three zones and nothing else (docs/design-system-table.md): the threat dials at the left (then
// Life and the Burden deck), the phase rail centered on the screen, and the menu button at the right. Back, Log, Rules, Booklet
// and Table settings are in the menu (src/play/chrome/table-menu.tsx). The bar holds no state of its own beyond measurements; the
// table view passes the numbers and the handlers.
import { useEffect, useLayoutEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";

import { setDialsEdge } from "../../play/chrome/bar-edge";
import { GameIcon } from "../../ui/game-icon";
import { Text } from "../../ui/text";
import { seatDial } from "../../play/store/peek";
import type { Rail } from "../../play/phases/rail";
import type { SeatThreat } from "../../play/store/selectors";
import type { HeldDial } from "../../play/readouts/widgets";
import { PhaseRail } from "../../play/phases/phase-rail";
import { HeadingDial, ThreatRing } from "../../play/chrome/table-chrome";
import { IslandChip } from "../../play/dream-chaser/island-chip";
import type { IslandReadout } from "../../play/dream-chaser/island-table";
import type { HeadingStep } from "../../play/dream-chaser/heading";
import { MenuButton } from "../../play/chrome/table-menu";
import type { HandMark } from "../../play/readouts/isengard";
import { dialProps, type TableDial } from "../../play/readouts/dials";
import { defenseLimitWords } from "../../play/words/scenarios/fortress";
import { useTableTokens } from "../../ui/use-table-tokens";
import { withAlphaHex } from "../../ui/tokens";
import { BAR_PAD, chipCompact, dialZones, DIAL_GAP, keepWidest, dialScale, EDGE_FADE, HEADING_BADGE_OVER, headingCompact, headingOffset, railWide, TOP_BAR } from "../../play/chrome/top-bar-layout";
import { UiScaleContext, useUiScale } from "../../ui/ui-scale";

export { TOP_BAR };
// The scroll fade: this many bands of this width (EDGE_FADE in all), rising to nearly the felt.
const FADE_BANDS = 7;
const FADE_BAND = EDGE_FADE / FADE_BANDS;
const NO_TICKS: readonly number[] = [];
const NO_HELD: readonly HeldDial[] = [];
const NO_DIALS: readonly TableDial[] = [];
const NO_HANDS: readonly HandMark[] = [];

export type TopBarProps = {
  threats: readonly SeatThreat[];
  // The seat the engine is asking, whose label is accent in two-handed play, and the seat peeked at (never the acting one) or null: that
  // dial gets a bone ring and an eye mark. A dial that is not shown peeks when tapped (src/play/store/peek.ts).
  acting: number;
  viewed: number | null;
  life: number | null;
  burdenDeck: number | null;
  // The resource tokens on the campaign card (The Oath, 41050:A:3) or on the current stage (Journey in the Dark, 142041:B:3) and the card's name, or null
  // when its scenario has none.
  tokens?: { name: string; tokens: number; cardId: string } | null;
  // The Heading dial, after the seat dials, while the Heading card is in play (dcce.heading): the current step, and what a tap does (the Heading card's preview). Absent: no dial.
  heading?: { step: HeadingStep; onPress: () => void } | null;
  // The Island Map chip, right after the seat dials, while the game has a map (dcce.island-map): the map as the table reads it, and what a tap does (the map panel).
  island?: IslandReadout | null;
  onIsland?: () => void;
  // On Nightmare: opens the setup card next to the quest deck (the Eye of Sauron after the dials). Absent on Easy and Normal.
  onNightmare?: (() => void) | null;
  // A tap on a scenario dial that names a card (`cardId`): shows that card large.
  onDial?: ((cardId: string, extra?: readonly string[]) => void) | null;
  // A tap on a scenario dial that names a pile (`pile`): opens its list.
  onDialPile?: ((pile: string) => void) | null;
  // A tap on a scenario dial that holds lists (`lists`): opens its panel.
  onDialReading?: ((id: string) => void) | null;
  rail: Rail;
  // Stops are on and one of the player's stops lies ahead in this phase: an accent S by the next phase.
  stopAhead: boolean;
  // The phase carousel is open.
  carouselOpen: boolean;
  // A small phone in landscape (under 760 pt inside the insets).
  narrow: boolean;
  // Stage 2B has split the table: a peek shows the other seat's staging area and stage as well as its cards.
  areas?: boolean;
  // The engagement costs marked on each dial, by seat.
  ticks: readonly (readonly number[])[];
  // Each seat's elimination level when it is not 50, by seat: 99 while the main quest has Dire (mec113.dire), five less for a seat holding The One Ring; the seat dial fills and warms toward it.
  limits?: readonly (number | undefined)[];
  // The pursuit value of The Uruk-hai and the value at which the players lose (mec112.pursuit), or null: a dial after Life that warms toward the limit.
  pursuit?: { value: number; limit: number } | null;
  // The tokens on The Defense of Helm's Deep, its name and the number that ends it and the stage it advances to (mec112.defense, 143033:A:3), or null: a dial after Pursuit whose ring fills toward the limit in the accent.
  defense?: { name: string; value: number; limit: number; stage: number } | null;
  // The dials of the scenario's own pieces, in the order they are drawn (readouts/scenario-dials.ts): The Road to Isengard's, The Passage of the Marshes', Journey to the Cross-roads' and Shelob's Lair's.
  scenarioDials?: readonly TableDial[];
  // What a seat's threat dial wears besides its number (readouts/scenario-dials.ts, `seatMarks`): its cards in hand on stage 3B of The Road to Isengard (143080:B:3), its allies this round in Shelob's Lair (144071:B:2), and The Passing of the Grey
  // Company's Overcome by Fear (its label and spoken note) and starting-level notch (145064:B:2). Each is a label, a spoken note, a warning or a notch on the ring.
  hands?: readonly HandMark[];
  // The seats that hold something facedown or as a Captive and what to say of each (a mark on its dial): the Ring-bearer under the Watcher, a prisoner, a hero an enemy holds, a Captive.
  held?: readonly HeldDial[];
  menuOpen: boolean;
  onThreat: (seat: number) => void;
  onRail: () => void;
  onMenu: () => void;
};

export function TableTopBar({ threats, acting, viewed, life, burdenDeck, tokens = null, heading = null, island = null, onIsland, onNightmare = null, onDial = null, onDialPile = null, onDialReading = null, rail, stopAhead, carouselOpen, narrow, areas, ticks, limits, pursuit = null, defense = null, scenarioDials, hands, held, menuOpen, onThreat, onRail, onMenu }: TopBarProps) {
  const t = useTableTokens();
  const s = useUiScale();
  const screen = useWindowDimensions();
  // The bar's width and its left edge on the screen: the table lays it out from the screen's left edge, after the left inset.
  const [bar, setBar] = useState({ width: 0, x: 0 });
  const [dials, setDials] = useState(0);
  // The Heading dial's place in the dials row, measured, so the row can scroll to it and the other dials' width can be told from it.
  const [headingBox, setHeadingBox] = useState({ x: 0, w: 0 });
  const [currentBox, setCurrentBox] = useState({ x: 0, w: 0 });
  const onCurrent = (event: LayoutChangeEvent) => setCurrentBox({ x: Math.round(event.nativeEvent.layout.x), w: Math.round(event.nativeEvent.layout.width) });
  const onHeading = (event: LayoutChangeEvent) => setHeadingBox({ x: Math.round(event.nativeEvent.layout.x), w: Math.round(event.nativeEvent.layout.width) });
  // The Map chip's width in the row, measured: the chip drops its word "Map" when the dials would scroll with it (chipCompact).
  const [chipW, setChipW] = useState(0);
  const onChip = (event: LayoutChangeEvent) => setChipW(Math.round(event.nativeEvent.layout.width));
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const onBar = (event: LayoutChangeEvent) => setBar({ width: Math.round(event.nativeEvent.layout.width), x: Math.round(event.nativeEvent.layout.x) });
  // The zones need the bar and the dials measured. Until both are, the rail is held invisible rather than drawn at a guess, so it
  // never jumps when the table opens.
  // If the dials never report a width, the rail still shows after a moment, on a dial width of 0.
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), 400);
    return () => clearTimeout(timer);
  }, []);
  // The zones are worked out inside the bar's side padding (px-2, 8 pt at every scale), so the screen's middle is counted from there.
  const center = screen.width / 2 - bar.x - BAR_PAD;
  // The scenario dials drop their words while the row with them would scroll (dialZones). The row's width with the words is measured while they show and kept until the row's makeup changes.
  const scenario = scenarioDials ?? NO_DIALS;
  const rowKey = [s, threats.length, life, burdenDeck, tokens?.name, pursuit != null, defense != null, island != null, heading != null, onNightmare != null, held?.length, hands?.map((mark) => mark.label).join(","), scenario.map((dial) => `${dial.id}:${dial.label}`).join(",")].join("|");
  const [labelled, setLabelled] = useState({ key: "", width: 0 });
  const withWords = scenario.length > 0 && labelled.key === rowKey ? labelled.width : 0;
  const zones = bar.width > 0 && (dials > 0 || waited) ? dialZones(bar.width - 2 * BAR_PAD, dials, withWords, s, center) : null;
  const wordless = zones?.wordless === true;
  // The row's width with the words is kept from the layout event, while the words show; within one makeup the widest width is kept, never a narrower one (keepWidest).
  // A layout event can reach the handler of the render before the one that dropped the words or changed the row (the web build does), so the handler reads the row's key and its words' state through a ref that a layout effect keeps current: the key travels with the value, so a width measured on one row is never kept for another.
  const latest = useRef({ key: rowKey, wordless });
  useLayoutEffect(() => {
    latest.current = { key: rowKey, wordless };
  }, [rowKey, wordless]);
  const onDials = (event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    setDials(width);
    const now = latest.current;
    if (!now.wordless && width > 0 && scenario.length > 0) setLabelled((was) => keepWidest(was, now.key, width));
  };
  // The Heading dial drops its word and lays its badge under the disc when the dial at its full width would make the dials scroll; that is told from the other dials' width, not the dial's own.
  const others = heading ? dials - headingBox.w - DIAL_GAP * s : dials;
  const compact = heading != null && bar.width > 0 && dials > 0 && headingCompact(bar.width - 2 * BAR_PAD, others, s, center, narrow);
  const chipHere = island != null && onIsland != null;
  const mapCompact = chipHere && bar.width > 0 && dials > 0 && chipCompact(bar.width - 2 * BAR_PAD, dials - chipW - DIAL_GAP * s, s, center);
  // While the dials scroll, the row keeps the Heading dial whole in the zone, clear of the fade (headingOffset).
  // Without a Heading dial, a scenario dial that is the current stage of several is kept whole the same way.
  const hasCurrent = scenario.some((dial) => dial.current);
  const keptBox = (heading && headingBox) || (hasCurrent && currentBox) || null;
  const offset = zones && keptBox ? headingOffset(zones, { x: keptBox.x, w: keptBox.w }, dials, s) : 0;
  useEffect(() => {
    scroller.current?.scrollTo({ x: offset, animated: false });
  }, [offset]);
  // The tray's outside-tap layer over the bar stops where the dials end, so a dial tap reaches the dial (src/play/chrome/bar-edge.ts).
  const edge = zones ? BAR_PAD + Math.min(dials, zones.left) : 0;
  useEffect(() => setDialsEdge(edge), [edge]);
  return (
    <View testID="table-top-bar" className="flex-row items-center px-2" style={{ height: TOP_BAR * s }} onLayout={onBar}>
      <View testID="top-bar-left" style={{ width: zones?.left ?? "30%" }}>
        {/* The scroll view is taller than the bar so a dial's pop (scale 1.22) is not clipped; it scrolls only when the dials
            are wider than the room the rail leaves, so none is cut. */}
        <ScrollView
          ref={scroller}
          testID="top-bar-scroll"
          horizontal
          scrollEnabled={zones?.scroll ?? false}
          showsHorizontalScrollIndicator={false}
          style={{ height: (TOP_BAR + 20) * s, marginVertical: -10 * s }}
          contentContainerStyle={{ alignItems: "center", paddingVertical: 10 * s, paddingRight: zones?.scroll ? EDGE_FADE * s : 0 }}
        >
          {/* A gap between the dials, so a seat's label (P1) never runs into the next seat's dial. */}
          <View style={{ flexDirection: "row", flexShrink: 0, gap: DIAL_GAP * s }} onLayout={onDials}>
            {threats.map((threat) => {
              const dial = seatDial(threats.length, acting, viewed, threat.seat, areas);
              const holding = (held ?? NO_HELD).find((entry) => entry.seat === threat.seat);
              const hand = (hands ?? NO_HANDS).find((entry) => entry.seat === threat.seat);
              const seatLabel = threats.length > 1 ? `P${threat.seat + 1}` : "Threat";
              return (
                <UiScaleContext.Provider key={threat.seat} value={dialScale(s)}>
                  <ThreatRing
                    threat={threat}
                    label={hand ? hand.label : seatLabel}
                    accessibilityName={threats.length > 1 ? `Player ${threat.seat + 1} threat` : "Threat"}
                    spokenWord="Threat"
                    voiced
                    limit={limits?.[threat.seat]}
                    eliminates={limits?.[threat.seat] != null}
                    limitWords={limits?.[threat.seat] != null ? `a player is eliminated at ${limits[threat.seat]}` : undefined}
                    role={dial.role}
                    hint={dial.hint}
                    compact
                    ticks={ticks[threat.seat] ?? NO_TICKS}
                    ring={holding?.words ?? null}
                    ringMark={holding?.mark}
                    warn={hand?.warn}
                    note={hand?.note}
                    notch={hand?.notch}
                    onPress={() => onThreat(threat.seat)}
                  />
                </UiScaleContext.Provider>
              );
            })}
            {/* The Map chip follows the seat dials; it drops its word when the row would scroll with it. */}
            {island && onIsland ? (
              <View onLayout={onChip}>
                <IslandChip readout={island} compact={mapCompact} onPress={onIsland} />
              </View>
            ) : null}
            {heading ? (
              // The compact dial's badge reaches past it; the room it needs is part of the dial's place in the row, so the zones count it.
              <View onLayout={onHeading} style={{ paddingRight: compact ? HEADING_BADGE_OVER * s : 0 }}>
                <HeadingDial step={heading.step} compact={compact} onPress={heading.onPress} />
              </View>
            ) : null}
            {life != null ? <ThreatRing threat={{ seat: 0, threat: life, eliminated: false }} label="Life" testID="life" icon={null} elimination={false} compact /> : null}
            {pursuit != null ? <ThreatRing threat={{ seat: 0, threat: pursuit.value, eliminated: false }} label="Pursuit" accessibilityName="Pursuit value" testID="pursuit" icon={null} limit={pursuit.limit} compact /> : null}
            {defense != null ? <ThreatRing threat={{ seat: 0, threat: defense.value, eliminated: false }} label="Tokens" accessibilityName={`Resource tokens on ${defense.name}`} testID="defense-tokens" icon={null} limit={defense.limit} limitWords={defenseLimitWords(defense.value, defense.limit, defense.stage)} goal compact /> : null}
            {scenario.map((dial) => {
              const press = dial.cardId && onDial ? () => onDial(dial.cardId ?? "", dial.extra) : dial.pile && onDialPile ? () => onDialPile(dial.pile ?? "") : dial.lists && onDialReading ? () => onDialReading(dial.id) : undefined;
              // Only a dial that opens a reading drops its word: a bare number with no press has nothing else to name it.
              const ring = <ThreatRing key={dial.id} {...dialProps(dial)} wordless={wordless && press != null} onPress={press} compact />;
              return dial.current ? <View key={dial.id} onLayout={onCurrent}>{ring}</View> : ring;
            })}
            {tokens != null ? <ThreatRing threat={{ seat: 0, threat: tokens.tokens, eliminated: false }} label="Tokens" accessibilityName={`Resource tokens on ${tokens.name}`} testID="campaign-tokens" icon="resource" elimination={false} hint="Shows the card the tokens are on" onPress={onDial ? () => onDial(tokens.cardId) : undefined} compact /> : null}
            {burdenDeck != null ? <ThreatRing threat={{ seat: 0, threat: burdenDeck, eliminated: false }} label="Burden" accessibilityName="Burden deck" testID="burden-deck" icon={null} elimination={false} compact /> : null}
            {onNightmare ? (
              // Laid out as Life, Tokens and Burden are (the mark, then its word), with the dials' pressed fill. The word stays at every
              // width: the peeked seat's eye mark is another eye.
              <Pressable
                testID="nightmare-card"
                accessibilityRole="button"
                accessibilityLabel="Nightmare setup card"
                accessibilityHint="Shows the Nightmare setup card"
                onPress={onNightmare}
                style={({ pressed }) => ({ minHeight: 44 * s, flexDirection: "row", alignItems: "center", gap: 6 * s, paddingHorizontal: 4 * s, borderRadius: 999, backgroundColor: pressed ? withAlphaHex(t.bone, 0.12) : "transparent" })}
              >
                <GameIcon name="nightmare" size={22 * s} tint="threat" />
                <Text className="text-label text-muted">Nightmare</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
        {/* The dials scroll: a fade at the right edge so a cut dial reads as more to scroll to (bands, no gradient library). */}
        {zones?.scroll ? (
          <View testID="top-bar-fade" pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: FADE_BANDS * FADE_BAND * s, flexDirection: "row" }}>
            {Array.from({ length: FADE_BANDS }, (_, band) => (
              <View key={band} style={{ width: FADE_BAND * s, backgroundColor: withAlphaHex(t.felt, ((band + 1) / FADE_BANDS) * 0.9) }} />
            ))}
          </View>
        ) : null}
      </View>
      <View testID="top-bar-middle" collapsable={false} style={{ width: zones?.rail ?? "40%", opacity: zones ? 1 : 0 }} pointerEvents={zones ? "auto" : "none"} importantForAccessibility={zones ? "auto" : "no-hide-descendants"}>
        <PhaseRail rail={rail} wide={zones != null && railWide(zones.rail, narrow, s)} stopAhead={stopAhead} open={carouselOpen} onPress={onRail} />
      </View>
      <View testID="top-bar-right" style={{ width: zones?.right ?? "30%", alignItems: "flex-end" }}>
        <MenuButton open={menuOpen} onPress={onMenu} />
      </View>
    </View>
  );
}
