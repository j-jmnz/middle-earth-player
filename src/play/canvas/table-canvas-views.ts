// What the table canvas (table-canvas.native.tsx) reads from the store and the words it draws from it: the zone and pile slices of the
// shown seat, a hero's sphere ring, and a quest card's "progress / quest points" strip. Only the slices drawn here, so a threat change
// alone does not draw the table again (docs/architecture.md, State).
import { useMemo } from "react";
import { useStore } from "zustand";

import { SPHERE_TINT } from "../../ui/icon-map.ts";
import type { CardSlot, LayoutViews, PileViews } from "../layout/layout.ts";
import { PILES, TABLE_ZONES, pileSelector, secondPilesOf, victoryPileSelector, zoneSelector, type BasePileId, type PileView, type ZoneFacts, type ZoneId } from "../store/selectors.ts";
import type { SlotInfo, TableCanvasProps } from "./table-canvas-types.ts";
import { tableTokens, type TableTokens } from "../../ui/tokens.ts";

const noPoints = () => 0;

export function useViews(store: TableCanvasProps["store"], seat: number, facts: ZoneFacts): { views: LayoutViews; piles: PileViews } {
  const zones = useMemo(() => Object.fromEntries(TABLE_ZONES.map((zone) => [zone, zoneSelector(zone, seat, facts)])) as Record<ZoneId, ReturnType<typeof zoneSelector>>, [seat, facts]);
  const pileOf = useMemo(() => Object.fromEntries(PILES.map((pile) => [pile, pileSelector(pile, seat)])) as Record<BasePileId, ReturnType<typeof pileSelector>>, [seat]);
  // The second slot's piles (the Corsair pair), only while the game has a Corsair deck: they are shared, so a peek leaves them where they are.
  const corsair = useMemo(() => ({ deck: pileSelector("corsairDeck", seat), discard: pileSelector("corsairDiscard", seat) }), [seat]);
  const uncharted = useMemo(() => pileSelector("unchartedDeck", seat), [seat]);
  const grotto = useMemo(() => pileSelector("grottoDeck", seat), [seat]);
  // The Evil Creatures pair and the Caves deck (Ered Mithrin), only while the game has dealt them; shared, so a peek leaves them too.
  const wilderland = useMemo(() => ({ evilDeck: pileSelector("evilCreaturesDeck", seat), evilDiscard: pileSelector("evilCreaturesDiscard", seat), caves: pileSelector("cavesDeck", seat), harad: pileSelector("haradDeck", seat), orcs: pileSelector("angmarOrcDeck", seat), balrogDeck: pileSelector("balrogDeck", seat), balrogDiscard: pileSelector("balrogDiscard", seat), smaugDeck: pileSelector("smaugDeck", seat), smaugDiscard: pileSelector("smaugDiscard", seat) }), [seat]);
  // The victory display, shared by the seats, drawn only while a card is in it.
  const victoryOf = useMemo(() => victoryPileSelector(facts.pointsOf ?? noPoints), [facts]);
  const questStage = useStore(store, (state) => zones.questStage(state.game));
  const staging = useStore(store, (state) => zones.staging(state.game));
  const activeLocation = useStore(store, (state) => zones.activeLocation(state.game));
  const secondActiveLocation = useStore(store, (state) => zones.secondActiveLocation(state.game));
  const engaged = useStore(store, (state) => zones.engaged(state.game));
  const play = useStore(store, (state) => zones.play(state.game));
  const hand = useStore(store, (state) => zones.hand(state.game));
  const deck = useStore(store, (state) => pileOf.deck(state.game));
  const discard = useStore(store, (state) => pileOf.discard(state.game));
  const encounterDeck = useStore(store, (state) => pileOf.encounterDeck(state.game));
  const encounterDiscard = useStore(store, (state) => pileOf.encounterDiscard(state.game));
  const corsairDeck = useStore(store, (state): PileView | null => (secondPilesOf(state.game).includes("corsairDeck") ? corsair.deck(state.game) : null));
  const corsairDiscard = useStore(store, (state): PileView | null => (secondPilesOf(state.game).includes("corsairDiscard") ? corsair.discard(state.game) : null));
  const unchartedDeck = useStore(store, (state): PileView | null => (secondPilesOf(state.game).includes("unchartedDeck") ? uncharted(state.game) : null));
  const grottoDeck = useStore(store, (state): PileView | null => (secondPilesOf(state.game).includes("grottoDeck") ? grotto(state.game) : null));
  const evilCreaturesDeck = useStore(store, (state): PileView | null => (secondPilesOf(state.game).includes("evilCreaturesDeck") ? wilderland.evilDeck(state.game) : null));
  const evilCreaturesDiscard = useStore(store, (state): PileView | null => (secondPilesOf(state.game).includes("evilCreaturesDiscard") ? wilderland.evilDiscard(state.game) : null));
  const balrogDeck = useStore(store, (state): PileView | null => (secondPilesOf(state.game).includes("balrogDeck") ? wilderland.balrogDeck(state.game) : null));
  const balrogDiscard = useStore(store, (state): PileView | null => (secondPilesOf(state.game).includes("balrogDiscard") ? wilderland.balrogDiscard(state.game) : null));
  const cavesDeck = useStore(store, (state): PileView | null => (secondPilesOf(state.game).includes("cavesDeck") ? wilderland.caves(state.game) : null));
  const haradDeck = useStore(store, (state): PileView | null => (secondPilesOf(state.game).includes("haradDeck") ? wilderland.harad(state.game) : null));
  const angmarOrcDeck = useStore(store, (state): PileView | null => (secondPilesOf(state.game).includes("angmarOrcDeck") ? wilderland.orcs(state.game) : null));
  const smaugDeck = useStore(store, (state): PileView | null => (secondPilesOf(state.game).includes("smaugDeck") ? wilderland.smaugDeck(state.game) : null));
  const smaugDiscard = useStore(store, (state): PileView | null => (secondPilesOf(state.game).includes("smaugDiscard") ? wilderland.smaugDiscard(state.game) : null));
  const victory = useStore(store, (state) => victoryOf(state.game));
  return useMemo(
    () => ({
      views: { questStage, staging, activeLocation, secondActiveLocation, engaged, play, hand },
      piles: { deck, discard, encounterDeck, encounterDiscard, ...(corsairDeck ? { corsairDeck } : {}), ...(corsairDiscard ? { corsairDiscard } : {}), ...(unchartedDeck ? { unchartedDeck } : {}), ...(grottoDeck ? { grottoDeck } : {}), ...(evilCreaturesDeck ? { evilCreaturesDeck } : {}), ...(evilCreaturesDiscard ? { evilCreaturesDiscard } : {}), ...(balrogDeck ? { balrogDeck } : {}), ...(balrogDiscard ? { balrogDiscard } : {}), ...(cavesDeck ? { cavesDeck } : {}), ...(angmarOrcDeck ? { angmarOrcDeck } : {}), ...(haradDeck ? { haradDeck } : {}), ...(smaugDeck ? { smaugDeck } : {}), ...(smaugDiscard ? { smaugDiscard } : {}), ...(victory ? { victory } : {}) },
    }),
    [questStage, staging, activeLocation, secondActiveLocation, engaged, play, hand, deck, discard, encounterDeck, encounterDiscard, corsairDeck, corsairDiscard, unchartedDeck, grottoDeck, evilCreaturesDeck, evilCreaturesDiscard, balrogDeck, balrogDiscard, cavesDeck, haradDeck, angmarOrcDeck, smaugDeck, smaugDiscard, victory],
  );
}

// The sphere colour a hero's resource token is ringed with: its resources pay for cards of that sphere (rr.resource-match). The sphere
// colours are the same in every theme; the tokens are a parameter so the lookup stays the theme's.
export function sphereRing(sphere: string | null, t: TableTokens = tableTokens): string | null {
  const tint = sphere ? SPHERE_TINT[sphere] : undefined;
  return tint && tint !== "faint" ? t[tint] : null;
}

// The "progress / quest points" strip of a quest card or location, which pops when progress is placed on it.
// `owner`: the seat the quest card's stage belongs to once stages are separate between players ("P2 · 2 / 8").
// The Stormcaller's stage keeps it in the part its area's cards leave uncovered, so it is set close ("12/18") to stay inside it at 24/24 (dcce.stormcallers-area).
// `loses`: filling the stage loses the game (143075:B:3), said in a word as well as the strip's threat red ("5 / 8 · lose").
export function stripText(slot: CardSlot, questPoints: number | null, owner?: string | null, loses = false): string | null {
  if (questPoints == null) return null;
  const count = `${owner ? `${owner} · ` : ""}${slot.progress}${slot.stormcaller === "stage" ? "/" : " / "}${questPoints}`;
  return loses ? `${count} · lose` : count;
}

// What the canvas draws on a card, in words: an enemy's engagement cost against the threat, a delayed effect to come. No screen reads it; the scenario table tests check those words through it.
export function marksText(slot: SlotInfo | null): string {
  if (!slot) return "";
  // A Reanimated Dead names its engagement cost in its own sentence (`dead`), so the pill is not said twice.
  const engagement = slot.engagement && !slot.dead ? ` · engagement ${slot.engagement.cost}, ${slot.engagement.engages ? "engages" : "stays"}` : "";
  const loss = slot.loss ? ` · ${slot.loss.speech}` : "";
  // A side quest in the staging area: the current quest, and Protect the Innocent's damage against the number that loses (the same words the native reader says, card-speech.ts).
  const current = slot.side?.current ? " · the current quest" : "";
  const sideLoses = slot.side?.loses ? ` · ${slot.side.loses.speech}${slot.side.loses.danger ? ", one more damage loses the game" : ""}` : "";
  // A character the Campaign Log marks determined, or that carries Determination (the same words the native reader says, card-speech.ts).
  const determined = slot.determined ? ` · ${slot.determined.speech}` : "";
  // The cards held underneath a card (the captured cards of Escape from Mount Gram, the pill the canvas draws): the same sentence the native reader says.
  const under = slot.under ? ` · ${slot.under.speech}` : "";
  // A Reanimated Dead says what it is and whose card it is (the same sentence the native reader says, realm-preview.ts); it never names its face.
  const dead = slot.dead ? ` · ${slot.dead}` : "";
  return `${engagement}${loss}${current}${sideLoses}${determined}${dead}${under}${slot.delayed ? " · an effect comes later" : ""}`;
}
