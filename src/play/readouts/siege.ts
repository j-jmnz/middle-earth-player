// Rules: mec113.saga-staging-rules, mec113.army-of-the-dead, mec113.multiplayer-aragorn, rr.quest-advancement, rr.damage, rr.travel (data/rules/entries.json); ledger lines 145030:A:1, 145030:A:2, 145033:A:1, 145034:A:1, 145068:A:1, 145069:B:2, 145071:A:1.
//
// The pieces of The Siege of Gondor's table (docs/design-system-table.md, Cards, The Siege of Gondor): The Corsair Fleet's resources (X), the Ship locations in the victory display toward the 3 that let the players travel to Great Corsair Ship, each
// Pelargir Quays' damage tokens toward the 4 at which it is discarded, the most damage the Port of Pelargir has let one character have healed this round against its 1, stage 1B's progress against the 20 it needs while Great Corsair Ship holds it, and
// the seat that controls the Army of the Dead. The engine decided every number (the Fleet's tokens, `roundHealed`, the records' limits); nothing here changes one. Pure, so a test reads it.
import type { Effect } from "../../catalog/boundary.ts";
import { modifiedStat } from "../../rules/core/keywords.ts";
import { heldLeast, inPlay } from "../../rules/core/state.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import { countMatching } from "../../rules/interpret/pick.ts";
import { effectsOf } from "../../rules/windows/listen.ts";

import { armyLabel, ARMY_WORDS, fleetWords, heldProgressWords, portReachedWords, portWords, quaysNearWords, quaysWords, shipsWords } from "../words/scenarios/siege.ts";
import type { TableDial } from "./dials.ts";
import { reaches, type HandMark } from "./isengard.ts";

const GREAT_SHIP = "145030";
const FLEET = "145071";
const PORT = "145033";
const QUAYS = "145034";
const STAGE = "145069";
const ARMY = "145068";

/** The cards of a code that are in play (the staging area, the active location, a play area). */
const cardsOf = (game: ScenarioState, code: string) => Object.values(game.cards).filter((card) => card.code === code && inPlay(card.zone));

type ShipsRule = { needed: number; pick: Extract<NonNullable<Effect["condition"]>, { kind: "count" }>["pick"] };

/** The Ship locations that bar the travel to Great Corsair Ship: the condition's own pick ("cannot travel here unless 3 or more", 145030:A:2) and one more than its bar, the number the players need. Null when the record holds no such count. */
function shipsRule(ctx: ReduceContext): ShipsRule | null {
  for (const effect of effectsOf(ctx, GREAT_SHIP) as readonly Effect[]) {
    const condition = effect.condition;
    if (effect.timing === "constant" && condition?.kind === "count" && condition.pick.from === "victory" && typeof condition.max === "number") return { needed: condition.max + 1, pick: condition.pick };
  }
  return null;
}

/**
 * The dials The Siege of Gondor's pieces hold now, in the order the top bar draws them: the ones that can warn first, each Pelargir Quays' damage tokens (it warms one short of the limit: it deals damage to the characters) and the heal cap (while
 * the Port is in the staging area: it warns once a character has used its allowance), then The Corsair Fleet's resources (X, no limit) and the Ship locations in the victory display (a goal dial toward the travel to Great Corsair Ship, while it
 * is in the staging area). Empty in any other scenario. The stage's held progress is the quest meter's (`siegeProgressWords`), not a dial.
 */
export function siegeDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  const dials: TableDial[] = [];
  const limit = reaches(ctx, QUAYS, "AssignDamage");
  const quays = cardsOf(game, QUAYS).filter((card) => card.zone === "staging" || card.id === game.activeLocation);
  if (limit != null) {
    quays.forEach((card, index) => {
      dials.push({
        id: `quays-${index + 1}`,
        testID: index === 0 ? "siege-quays" : `siege-quays-${index + 1}`,
        label: index === 0 ? "Quays" : `Quays ${index + 1}`,
        name: `Damage tokens on ${nameOf(QUAYS)}, ${card.id === game.activeLocation ? "the active location" : "in the staging area"}, ${limit} to discard it:`,
        value: card.damage,
        limit,
        warms: true,
        ...(card.damage >= limit - 1 ? { warn: { level: "near" as const, words: quaysNearWords(card.damage, limit) } } : {}),
        limitWords: quaysWords(limit),
      });
    });
  }
  const cap = cardsOf(game, PORT).some((card) => card.zone === "staging") ? heldLeast(game, "table", "healCap") : 0;
  if (cap > 0) {
    const healed = Object.entries(game.roundHealed ?? {}).filter(([id]) => game.cards[id] != null);
    const most = Math.max(0, ...healed.map(([, amount]) => amount));
    const atCap = healed.filter(([, amount]) => amount >= cap).map(([id]) => nameOf(game.cards[id]?.code ?? ""));
    dials.push({ id: "port", testID: "siege-port", label: "Healed", name: `Most damage healed from one character this round, ${cap} allowed each by ${nameOf(PORT)}:`, value: Math.min(most, cap), limit: cap, ...(atCap.length > 0 ? { warn: { level: "near" as const, words: portReachedWords(cap, atCap) } } : {}), limitWords: portWords(cap) });
  }
  const fleet = cardsOf(game, FLEET)[0];
  if (fleet) dials.push({ id: "fleet", testID: "siege-fleet", label: "Fleet", name: `Resources on ${nameOf(FLEET)}, X:`, value: fleet.resources, note: fleetWords(fleet.resources) });
  const ship = cardsOf(game, GREAT_SHIP)[0];
  const rule = shipsRule(ctx);
  if (ship?.zone === "staging" && rule) {
    const count = countMatching(game, rule.pick, game.firstPlayer, ship.id, ctx);
    dials.push({ id: "ships", testID: "siege-ships", label: "Ships", name: `Ship locations in the victory display, ${rule.needed} to travel to ${nameOf(GREAT_SHIP)}:`, value: count, limit: rule.needed, goal: true, limitWords: shipsWords(rule.needed, count) });
  }
  return dials;
}

/** What the quest readout says of `progress` while Great Corsair Ship holds stage 1B and the progress would reach the stage's quest points, or null: the stage is not defeated while the Ship is in play (145069:B:2). */
export function siegeProgressWords(game: ScenarioState, ctx: ReduceContext, progress: number): string | null {
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  if (progress <= 0 || stage?.code !== STAGE || cardsOf(game, GREAT_SHIP).length === 0) return null;
  return stage.progress + progress >= modifiedStat(game, stage, "questPoints", ctx.cards) ? heldProgressWords(progress) : null;
}

/** The mark of the seat that controls the Army of the Dead ("Army", "P2 · Army" two-handed): it passes with the first player token, so the mark follows it. Empty while the Army is not in play. */
export function siegeHands(game: ScenarioState): readonly HandMark[] {
  return cardsOf(game, ARMY).flatMap((card) => (card.controller == null ? [] : [{ seat: card.controller, label: armyLabel(game.seatCount > 1 ? card.controller : null), note: ARMY_WORDS }]));
}
