// What the table canvas (table-canvas.native.tsx) reads from the store and the words it draws from it: the zone and pile slices of the
// shown seat, a hero's sphere ring, and a quest card's "progress / quest points" strip. Only the slices drawn here, so a threat change
// alone does not draw the table again (docs/architecture.md, State).
import { useMemo } from "react";
import { useStore } from "zustand";

import { SPHERE_TINT } from "../../ui/icon-map.ts";
import type { CardSlot, LayoutViews, PileViews } from "../layout/layout.ts";
import { PILES, TABLE_ZONES, pileSelector, secondPilesOf, victoryPileSelector, zoneSelector, type BasePileId, type PileView, type ZoneFacts, type ZoneId } from "../store/selectors.ts";
import type { TableCanvasProps } from "./table-canvas-types.ts";
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
  const wilderland = useMemo(() => ({ evilDeck: pileSelector("evilCreaturesDeck", seat), evilDiscard: pileSelector("evilCreaturesDiscard", seat), caves: pileSelector("cavesDeck", seat), harad: pileSelector("haradDeck", seat), orcs: pileSelector("angmarOrcDeck", seat), investigation: pileSelector("investigationDeck", seat), sack: pileSelector("sackDeck", seat), balrogDeck: pileSelector("balrogDeck", seat), balrogDiscard: pileSelector("balrogDiscard", seat), ravenDeck: pileSelector("ravenDeck", seat), ravenDiscard: pileSelector("ravenDiscard", seat), smaugDeck: pileSelector("smaugDeck", seat), smaugDiscard: pileSelector("smaugDiscard", seat) }), [seat]);
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
  const ravenDeck = useStore(store, (state): PileView | null => (secondPilesOf(state.game).includes("ravenDeck") ? wilderland.ravenDeck(state.game) : null));
  const ravenDiscard = useStore(store, (state): PileView | null => (secondPilesOf(state.game).includes("ravenDiscard") ? wilderland.ravenDiscard(state.game) : null));
  const cavesDeck = useStore(store, (state): PileView | null => (secondPilesOf(state.game).includes("cavesDeck") ? wilderland.caves(state.game) : null));
  const haradDeck = useStore(store, (state): PileView | null => (secondPilesOf(state.game).includes("haradDeck") ? wilderland.harad(state.game) : null));
  const angmarOrcDeck = useStore(store, (state): PileView | null => (secondPilesOf(state.game).includes("angmarOrcDeck") ? wilderland.orcs(state.game) : null));
  const investigationDeck = useStore(store, (state): PileView | null => (secondPilesOf(state.game).includes("investigationDeck") ? wilderland.investigation(state.game) : null));
  const smaugDeck = useStore(store, (state): PileView | null => (secondPilesOf(state.game).includes("smaugDeck") ? wilderland.smaugDeck(state.game) : null));
  const smaugDiscard = useStore(store, (state): PileView | null => (secondPilesOf(state.game).includes("smaugDiscard") ? wilderland.smaugDiscard(state.game) : null));
  const sackDeck = useStore(store, (state): PileView | null => (secondPilesOf(state.game).includes("sackDeck") ? wilderland.sack(state.game) : null));
  const victory = useStore(store, (state) => victoryOf(state.game));
  return useMemo(
    () => ({
      views: { questStage, staging, activeLocation, secondActiveLocation, engaged, play, hand },
      piles: { deck, discard, encounterDeck, encounterDiscard, ...(corsairDeck ? { corsairDeck } : {}), ...(corsairDiscard ? { corsairDiscard } : {}), ...(unchartedDeck ? { unchartedDeck } : {}), ...(grottoDeck ? { grottoDeck } : {}), ...(evilCreaturesDeck ? { evilCreaturesDeck } : {}), ...(evilCreaturesDiscard ? { evilCreaturesDiscard } : {}), ...(balrogDeck ? { balrogDeck } : {}), ...(balrogDiscard ? { balrogDiscard } : {}), ...(ravenDeck ? { ravenDeck } : {}), ...(ravenDiscard ? { ravenDiscard } : {}), ...(cavesDeck ? { cavesDeck } : {}), ...(angmarOrcDeck ? { angmarOrcDeck } : {}), ...(investigationDeck ? { investigationDeck } : {}), ...(haradDeck ? { haradDeck } : {}), ...(smaugDeck ? { smaugDeck } : {}), ...(smaugDiscard ? { smaugDiscard } : {}), ...(sackDeck ? { sackDeck } : {}), ...(victory ? { victory } : {}) },
    }),
    [questStage, staging, activeLocation, secondActiveLocation, engaged, play, hand, deck, discard, encounterDeck, encounterDiscard, corsairDeck, corsairDiscard, unchartedDeck, grottoDeck, evilCreaturesDeck, evilCreaturesDiscard, balrogDeck, balrogDiscard, ravenDeck, ravenDiscard, cavesDeck, haradDeck, angmarOrcDeck, investigationDeck, smaugDeck, smaugDiscard, sackDeck, victory],
  );
}

// The sphere colour a hero's resource token is ringed with: its resources pay for cards of that sphere (rr.resource-match). The sphere
// colours are the same in every theme; the tokens are a parameter so the lookup stays the theme's.
export function sphereRing(sphere: string | null, t: TableTokens = tableTokens): string | null {
  const tint = sphere ? SPHERE_TINT[sphere] : undefined;
  return tint && tint !== "faint" ? t[tint] : null;
}

/** A card whose progress is past its quest points says the count in its strip and wears no progress token (stripText). */
export const progressInStrip = (progress: number, questPoints: number | null): boolean => questPoints != null && progress > questPoints;

// The "progress / quest points" strip of a quest card or location, which pops when progress is placed on it.
// `owner`: the seat the quest card's stage belongs to once stages are separate between players ("P2 · 2 / 8").
// The Stormcaller's stage keeps it in the part its area's cards leave uncovered, so it is set close ("12/18") to stay inside it at 24/24 (dcce.stormcallers-area).
// `loses`: filling the stage loses the game (143075:B:3), said in a word as well as the strip's threat red ("5 / 8 · lose").
// Progress past the quest points (a stage that cannot be defeated yet, 17027:B:2, 08123:B:4) says its whole count ("20 / 12") and the card wears no progress token (`progressInStrip`): a token at the foot would cover the strip's count.
export function stripText(slot: CardSlot, questPoints: number | null, owner?: string | null, loses = false): string | null {
  if (questPoints == null) return null;
  const count = `${owner ? `${owner} · ` : ""}${slot.progress}${slot.stormcaller === "stage" ? "/" : " / "}${questPoints}`;
  return loses ? `${count} · lose` : count;
}

/**
 * The x the strip's count is centred on: the middle of the card, moved right of the resource token at the card's foot (`resources`; a location with time counters wears one) and left of the progress token (`tokenLeft`, its left edge; null with none),
 * so a token never covers a digit. `half` is half the text's width; `token` the token art's size, both at the scale `s`. The progress token wins when the card is too narrow for both.
 */
export function stripCenterX(x: number, w: number, half: number, tokenLeft: number | null, resources: boolean, token: number, s: number): number {
  const clearOfResources = resources ? Math.max(x + w / 2, x + (token + 1) * s + 2 * s + half) : x + w / 2;
  return tokenLeft == null ? clearOfResources : Math.min(clearOfResources, tokenLeft - 2 * s - half);
}
