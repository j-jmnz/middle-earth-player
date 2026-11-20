// Rules: rr.damage, rr.guarded, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 51301:B:1, 51307:B:2, 51307:B:3, 51351:A:1 (docs/brief.md, Escape from Khazad-dûm, The table; docs/design-system-table.md, Top bar).
//
// The pieces Escape from Khazad-dûm's cards hold on the table: the damage on the stage 3B against the number that loses the game (a warming dial), Durin's Bane while it lies set aside (a word dial; a tap shows its card), and the card Nameless Thing holds faceup
// under it (the held pill of the host, which says the card is discarded, not returned, when the host leaves play). The engine decided every number; nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import type { ScenarioState } from "../../../rules/core/state.ts";
import { heldAmount } from "../../../rules/core/state.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";

import type { TableDial } from "../dials.ts";
import { ownerWords } from "../../words/owner.ts";
import { keptPill, type KeptCard } from "../../words/scenarios/standalone-scenarios/wizards-quest-table.ts";
import { baneAsideWords, stageDamageLimitWords, stageDamageNearWords, stageDamageWords } from "./khazad-words.ts";

const SCENARIO = "escape-from-khazad-dum";
const BANE = "51311";

/** The dials Escape from Khazad-dûm's cards hold now: none in any other scenario. */
export function khazadDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  if (game.scenarioId !== SCENARIO) return [];
  const dials: TableDial[] = [];
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  const limit = stage ? heldAmount(game, stage.id, "loseAtDamage") : 0;
  if (stage && limit > 0) {
    const attack = printedOf(ctx.cards, BANE).attack ?? 0;
    const near = stage.damage + attack >= limit;
    dials.push({
      id: "damage",
      testID: "khazad-damage",
      label: "Damage",
      name: `Damage on ${nameOf(stage.code)}`,
      value: stage.damage,
      limit,
      warms: true,
      cardId: stage.id,
      ...(near ? { warn: { level: stage.damage + 1 >= limit ? ("critical" as const) : ("near" as const), words: stageDamageNearWords(stage.damage, limit, attack) } } : {}),
      limitWords: stageDamageLimitWords(limit),
      note: stageDamageWords(nameOf(stage.code), stage.damage, limit),
    });
  }
  const aside = game.setAside.find((id) => game.cards[id]?.code === BANE);
  if (aside) dials.push({ id: "bane", testID: "khazad-bane", label: "Bane", name: `${nameOf(BANE)} is set aside`, value: 1, word: "Aside", cardId: aside, note: baneAsideWords() });
  return dials;
}

/** The player cards lying faceup under a card that discards them when it leaves play (Nameless Thing's), in the order they were laid there. */
function guardedUnder(game: ScenarioState, cardId: string): string[] {
  if (game.scenarioId !== SCENARIO) return [];
  return Object.values(game.cards).filter((card) => card.zone === "under" && card.host === cardId && card.heldDiscard === true).map((card) => card.id);
}

/** The held pill of a card that guards a card of a player's deck ("1 held"), or null: the preview of the card says it is discarded when the guard leaves play (cards/dungeon-preview.ts). */
export function guardedMark(game: ScenarioState, ctx: ReduceContext, cardId: string): { text: string; loses: boolean; speech: string; count: number } | null {
  const ids = guardedUnder(game, cardId);
  if (ids.length === 0) return null;
  const kept: KeptCard[] = ids.map((id) => {
    const card = game.cards[id];
    return { name: printedOf(ctx.cards, card?.code ?? "").name, owner: ownerWords(game.seatCount, card?.owner ?? card?.controller) ?? "an unknown player's" };
  });
  return keptPill(kept);
}
