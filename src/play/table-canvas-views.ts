// What the table canvas (table-canvas.native.tsx) reads from the store and the words it draws from it: the zone and pile slices of the
// shown seat, a hero's sphere ring, and a quest card's "progress / quest points" strip. Only the slices drawn here, so a threat change
// alone does not draw the table again (docs/architecture.md, State).
import { useMemo } from "react";
import { useStore } from "zustand";

import { SPHERE_TINT } from "./icon-map.ts";
import type { CardSlot, LayoutViews, PileViews } from "./layout.ts";
import { PILES, TABLE_ZONES, pileSelector, zoneSelector, type PileId, type ZoneId } from "./selectors.ts";
import type { TableCanvasProps } from "./table-canvas-types.ts";
import { tableTokens, type TableTokens } from "./tokens.ts";

export function useViews(store: TableCanvasProps["store"], seat: number): { views: LayoutViews; piles: PileViews } {
  const zones = useMemo(() => Object.fromEntries(TABLE_ZONES.map((zone) => [zone, zoneSelector(zone, seat)])) as Record<ZoneId, ReturnType<typeof zoneSelector>>, [seat]);
  const pileOf = useMemo(() => Object.fromEntries(PILES.map((pile) => [pile, pileSelector(pile, seat)])) as Record<PileId, ReturnType<typeof pileSelector>>, [seat]);
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
  return useMemo(
    () => ({ views: { questStage, staging, activeLocation, secondActiveLocation, engaged, play, hand }, piles: { deck, discard, encounterDeck, encounterDiscard } }),
    [questStage, staging, activeLocation, secondActiveLocation, engaged, play, hand, deck, discard, encounterDeck, encounterDiscard],
  );
}

// The sphere colour a hero's resource token is ringed with: its resources pay for cards of that sphere (rr.resource-match). The sphere
// colours are the same in every theme; the tokens are a parameter so the lookup stays the theme's.
export function sphereRing(sphere: string | null, t: TableTokens = tableTokens): string | null {
  const tint = sphere ? SPHERE_TINT[sphere] : undefined;
  return tint && tint !== "faint" ? t[tint] : null;
}

// The "progress / quest points" strip of a quest card or location, which pops when progress is placed on it.
export function stripText(slot: CardSlot, questPoints: number | null): string | null {
  return questPoints == null ? null : `${slot.progress} / ${questPoints}`;
}
