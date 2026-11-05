// One seat's fellowship on a briefing (docs/design-system.md, Briefing): the saved decks to choose from, then the picked deck as its
// name and Change over its heroes, on the ground, with the Ring-bearer's rows when it needs one. Shared by the campaign briefing and the standalone briefing.
import { useRouter } from "expo-router";
import { useContext, useState } from "react";
import { Pressable, View, type LayoutChangeEvent } from "react-native";

import { notAppliedWords } from "../../play/cards/not-applied";
import { rowSurface } from "../../ui/surfaces";
import { useTableTokens } from "../../ui/use-table-tokens";
import { CroppedArt } from "../art/art";
import { PAINTING } from "../art/crop";
import { usePalette } from "../kit/palette-hook";
import { OpenCardContext, type BriefingDecks } from "./parts";
import { BodyText, Chevron, Label, Section, TextButton } from "../kit/chrome";
import { editSavedDeck } from "../deck/draft";
import { emptyDeckListFilter, useDeckListView } from "../deck/list";
import { FoldHeader, useFolds } from "../kit/fold-section";
import { DeckListBar } from "../deck/list-bar";
import { deckCountLine, deckShortLine, notAppliedCards, notAppliedLine } from "../deck/status";
import { DeckCover, DeckRow, HeroTile, heroFace, PARTY_TILE_HEIGHT, type HeroFace } from "../art/hero-tile";
import { seatFolded, seatState } from "./seat-state";
import { COVER_GAP, coverColumns, coverWidth } from "./layout";
import { useUiScale } from "../../ui/ui-scale";
import { useSizeClass } from "../../ui/use-size-class";
import { Text } from "../../ui/text";

const COVER_HEIGHT = 112;

/**
 * One seat's fellowship. Until a deck is picked, and while it is being changed, the seat lists the saved decks with the Decks
 * tab's search and chips, each a radio (a deck with a fallen hero, or one not ready to play, is shown and cannot be picked; the
 * seat's picked deck stays listed whatever the filter). Picked, it folds to the deck's name with Change, its heroes as pictures
 * under them and, once picked, the Ring-bearer as one more. For the first seat the Ring-bearer's rows show when the deck brings none.
 */
export function SeatPicker({
  index,
  seatCount,
  decks: briefingDecks,
  picked,
  heroes,
  fallen,
  needsRingBearer,
  saga,
  ringBearer,
  onPick,
  onRingBearer,
  nameOf,
}: {
  index: number;
  seatCount: number;
  decks: BriefingDecks;
  picked: string | null;
  heroes: readonly string[];
  // Heroes the campaign log lists as fallen; none in a standalone game.
  fallen: readonly string[];
  needsRingBearer: boolean;
  // The campaign is a saga: its party is "your fellowship". Outside one there is no Ring-bearer slot (needsRingBearer is false).
  saga: boolean;
  ringBearer: string | null;
  onPick: (deckId: string) => void;
  onRingBearer: (code: string | null) => void;
  nameOf: (code: string) => string;
}) {
  const s = useUiScale();
  const t = useTableTokens();
  const palette = usePalette();
  const router = useRouter();
  const openCard = useContext(OpenCardContext);
  const view = useDeckListView();
  const [changing, setChanging] = useState(false);
  // Expanded, the deck list is in the briefing's right pane: from 600 pt wide the covers go two to a row (briefing/layout.ts).
  const { size } = useSizeClass();
  const [listWidth, setListWidth] = useState(0);
  const { savedDecks, seeded, seedReason, candidates, faces, readiness, filter, setFilter, spheres, shown, inactive, typeOf } = briefingDecks;
  const kept = savedDecks.find((deck) => deck.id === picked);
  const pickedDeck = kept ?? null;
  const listed = kept && !shown.includes(kept) ? [kept, ...shown] : shown;
  const wide = size === "expanded" && view !== "List" && listed.length > 0 && listWidth > 0 && coverColumns(listWidth, s) === 2;
  const faceOf = (code: string): HeroFace => heroFace(faces, code, nameOf(code));
  const heroNames = (codes: readonly string[]) => codes.map(nameOf).join(", ");
  const slot = index === 0 && needsRingBearer;
  const choosing = !pickedDeck || changing;
  const short = pickedDeck ? deckShortLine(pickedDeck) : null;
  const title = seatCount === 1 ? (saga ? "Your fellowship" : "Your party") : `Seat ${index + 1}`;
  // The seat folds to its header line; the body is hidden, not unmounted, so the list's `changing` state and scroll stay. The fold is
  // stored per seat index in `sections`, like every FoldSection (fold-section.tsx); a seat that needs the player opens anyway (seat-state.ts).
  const folds = useFolds();
  const foldId = `briefing-seat-${index}`;
  const state = seatState({ seeded, deck: pickedDeck, fallen, nameOf, readiness, short, missingRingBearer: slot && !ringBearer });
  const folded = seatFolded(folds.folded(foldId), state);
  // A Ring-bearer the deck brings itself is one of the candidates (a Fellowship hero with the Ring-bearer trait).
  const carries = (code: string) => candidates.some((candidate) => candidate.code === code);

  function choose(deckId: string): void {
    onPick(deckId);
    setChanging(false);
  }

  return (
    <View className="mt-5">
      <FoldHeader
        id={foldId}
        title={title}
        folded={folded}
        onFold={(next) => folds.setFolded(foldId, next)}
        lead={pickedDeck?.name}
        summary={state.text}
        attention={state.attention}
        testID={`seat-fold-${index}`}
      />
      <View testID={`seat-body-${index}`} style={folded ? { display: "none" } : undefined} accessibilityElementsHidden={folded} importantForAccessibility={folded ? "no-hide-descendants" : "auto"}>
        {pickedDeck && changing ? (
          <View className="items-end">
            <TextButton label="Done" testID={`deck-choose-done-${index}`} tone="muted" accessibilityLabel={`Keep ${pickedDeck.name}`} onPress={() => setChanging(false)} />
          </View>
        ) : null}
        {seeded === "pending" ? (
          <BodyText tone="muted">Loading</BodyText>
        ) : savedDecks.length === 0 ? (
          <View className="gap-2">
            <BodyText tone={seeded === "missing" ? "danger" : "muted"} testID="briefing-no-deck">
              {seeded === "missing" ? "The starter decks are missing. Save a deck in Decks first." : "No saved deck. Save one in Decks first."}
            </BodyText>
            {seeded === "missing" && seedReason ? (
              <BodyText tone="danger" testID="briefing-starter-reason">
                {seedReason}
              </BodyText>
            ) : null}
          </View>
        ) : choosing ? (
          <View>
            {pickedDeck ? <Label>Pick another deck for this seat.</Label> : null}
            <DeckListBar filter={filter} onFilter={setFilter} spheres={spheres} shown={shown.length} total={savedDecks.length} testIDPrefix={`briefing-decks-${index}`} />
            <View
              className={wide ? "mt-3 flex-row flex-wrap" : "mt-3"}
              style={wide ? { columnGap: COVER_GAP * s } : undefined}
              onLayout={size === "expanded" ? (event: LayoutChangeEvent) => setListWidth(event.nativeEvent.layout.width) : undefined}
            >
              {listed.map((deck) => {
                const fell = deck.heroes.filter((code) => fallen.includes(code));
                const ready = readiness.get(deck.id) ?? { ready: false, text: "Not read yet" };
                const summary = {
                  testID: `deck-pick-${index}-${deck.id}`,
                  name: deck.name,
                  heroes: deck.heroes.map(faceOf),
                  detail: deckCountLine(deck),
                  short: deckShortLine(deck),
                  status: fell.length > 0 ? { ready: false, text: `${heroNames(fell)} fell and cannot be picked` } : ready,
                  note: notAppliedLine(deck, inactive),
                  onPress: () => choose(deck.id),
                  selected: picked === deck.id,
                  disabled: fell.length > 0 || !ready.ready,
                };
                // A deck that is not ready to play cannot be picked; this opens it to be finished.
                const open =
                  !ready.ready && fell.length === 0 ? (
                    <View className="items-start px-1">
                      <TextButton
                        label="Open in Decks"
                        testID={`deck-open-${index}-${deck.id}`}
                        tone="accent"
                        accessibilityLabel={`Open ${deck.name} in Decks to finish it`}
                        onPress={() => {
                          editSavedDeck(deck);
                          router.push({ pathname: "/deck/[id]", params: { id: deck.id } });
                        }}
                      />
                    </View>
                  ) : null;
                return view === "List" ? (
                  <DeckRow key={deck.id} {...summary}>
                    {open}
                  </DeckRow>
                ) : (
                  <View key={deck.id} className="pb-3" style={wide ? { width: coverWidth(listWidth, 2, s) } : undefined}>
                    <DeckCover {...summary} height={COVER_HEIGHT * s}>
                      {open}
                    </DeckCover>
                  </View>
                );
              })}
              {listed.length === 0 ? (
                <View className="items-start">
                  <BodyText tone="muted" testID={`briefing-no-match-${index}`}>
                    No decks match.
                  </BodyText>
                  <View className="-mx-3">
                    <TextButton testID={`briefing-clear-filter-${index}`} label="Clear filter" tone="accent" onPress={() => setFilter(emptyDeckListFilter)} />
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <View testID={`briefing-party-${index}`}>
            {/* The name gets the row's width less Change (a long one never breaks inside a word). The hero tiles show the heroes, so the count
                shows only when the deck is short; a screen reader hears the full count with the name. */}
            <View className="flex-row items-center justify-between gap-3">
              <Text accessibilityLabel={`${pickedDeck.name}, ${deckCountLine(pickedDeck)}`} className="min-w-0 flex-1 font-display text-title text-bone">
                {pickedDeck.name}
              </Text>
              <TextButton label="Change" testID={`deck-change-${index}`} tone="accent" accessibilityLabel={`Change the deck of ${title.toLowerCase()}, now ${pickedDeck.name}`} onPress={() => setChanging(true)} />
            </View>
            {short ? <Label>{short}</Label> : null}
            <View className="mt-3.5 flex-row gap-2">
              {heroes.map((code) => (
                <HeroTile key={code} hero={faceOf(code)} height={PARTY_TILE_HEIGHT * s} dense ringBearer={!slot && carries(code)} onPress={() => openCard(code)} />
              ))}
              {slot ? (
                ringBearer ? (
                  <HeroTile hero={faceOf(ringBearer)} height={PARTY_TILE_HEIGHT * s} dense ringBearer onPress={() => openCard(ringBearer)} onRemove={() => onRingBearer(null)} />
                ) : (
                  // The fourth place stays as room, so the tiles keep their width when the Ring-bearer is picked.
                  <View className="flex-1" />
                )
              ) : null}
            </View>
            {/* The picked deck names each card whose text the app does not apply, and what that costs: say it before the deal. */}
            {notAppliedCards(pickedDeck, inactive).length > 0 ? (
              <View testID={`briefing-not-applied-${index}`} className="mt-3">
                <Label tone="muted">Not applied in this deck:</Label>
                <Label tone="muted" className="mt-0.5">
                  {notAppliedCards(pickedDeck, inactive)
                    .map((card) => `${nameOf(card.code)}: ${notAppliedWords(card.code, typeOf(card.code)).toLowerCase()}`)
                    .join(" · ")}
                </Label>
              </View>
            ) : null}
          </View>
        )}
        {pickedDeck && !choosing && slot && !ringBearer ? (
          <View testID="ringbearer-slot" className="mt-3">
            <Section title="Ring-bearer" />
            <View className="gap-2">
              {candidates.map((candidate) => (
                <Pressable
                  key={candidate.code}
                  testID={`ringbearer-${candidate.code}`}
                  collapsable={false}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${candidate.name}${candidate.packName ? `, ${candidate.packName}` : ""}`}
                  accessibilityHint="Long press to see the card"
                  onPress={() => onRingBearer(candidate.code)}
                  onLongPress={() => openCard(candidate.code)}
                  delayLongPress={350}
                >
                  {({ pressed }) => (
                    <View className="min-h-14 flex-row items-center gap-3 rounded-item px-3 py-2" style={rowSurface(pressed, t)}>
                      {/* The hero tile's painting, square-cornered like the tiles above: no circle, no sphere ring. */}
                      <View className="overflow-hidden rounded-control" importantForAccessibility="no-hide-descendants">
                        <CroppedArt card={faceOf(candidate.code)} region={PAINTING} width={56 * s} height={40 * s} />
                      </View>
                      <View className="flex-1">
                        <Text className="font-display text-heading text-bone">{candidate.name}</Text>
                        {candidate.packName ? <Text className="text-label text-muted">{candidate.packName}</Text> : null}
                      </View>
                      <Chevron direction="right" color={palette.faint} size={8} />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}
