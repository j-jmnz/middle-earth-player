// Rules: mec113.minas-tirith, mec113.assault, mec113.multiplayer-aragorn, mec113.saga-staging-rules, rr.active-location, rr.quest-advancement, rr.damage (data/rules/entries.json); ledger lines 145043:A:1, 145043:A:2, 145044:A:2, 145044:A:3, 145046:A:1, 145046:A:2, 145072:A:1, 145074:B:1, 145075:B:1, 145076:B:1.
//
// The pieces of The Battle of the Pelennor Fields' table (docs/design-system-table.md, Cards, The Battle of the Pelennor Fields): Minas Tirith's damage against its hit points (30, plus 10 for each player), City Wall's damage against its quest points while it
// is the active location, The Corsair Fleet's resources (Aragorn returns when none are left), Grond's resources (X) and the total cost of the allies in the staging area on stage 2B, and the quest result on stages 3B and 4B. The engine decided every number
// (`hitPoints`, the cards' tokens, `stagedAlliesCost`, the flags `assault` and `progressAsDamage`); nothing here changes one. Pure, so a test reads it.
import { modifiedStat } from "../../rules/core/keywords.ts";
import { printedOf } from "../../rules/core/printed.ts";
import { flagged, inPlay } from "../../rules/core/state.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import { stagedAlliesCost } from "../../rules/families/pelennor/allies.ts";
import { wallRoom } from "../../rules/families/pelennor/wall.ts";

import { alliesWords, assaultQuestWords, cityDestroyedWords, cityNearWords, cityWords, fleetWords, grondWords, rohanQuestWords, wallNearWords, wallWords } from "../words/scenarios/pelennor.ts";
import type { TableDial } from "./dials.ts";

const MINAS_TIRITH = "145043";
const GROND = "145044";
const WALL = "145046";
const FLEET = "145072";
const STAGE_TWO = "145074";
// The City's dial warns once this few hit points remain: the last quarter of a 40 hit point Minas Tirith.
const LOW = 10;

/** The cards of a code that are in play (the staging area, the active location, a play area). */
const cardsOf = (game: ScenarioState, code: string) => Object.values(game.cards).filter((card) => card.code === code && inPlay(card.zone));

/** The damage the end of the round deals to Minas Tirith now: 1 for each enemy in the staging area (145043:A:2), less what City Wall, the active location, takes first (145046:A:1). */
function incomingDamage(game: ScenarioState, ctx: ReduceContext, cityId: string): number {
  const enemies = game.staging.filter((id) => printedOf(ctx.cards, game.cards[id]?.code ?? "").type === "enemy").length;
  const room = wallRoom(game, cityId, ctx.cards)?.room ?? 0;
  return Math.max(0, enemies - room);
}

/**
 * The dials The Battle of the Pelennor Fields' pieces hold now, in the order the top bar draws them: the ones that can warn first, Minas Tirith's damage against its hit points (it warms toward them: the players lose) and City Wall's damage against its quest points
 * (it is discarded and each player raises their threat), then The Corsair Fleet's resources (no limit: Aragorn returns when none are left), Grond's resources (X, no limit) and, on stage 2B, the cost of the allies in the staging area (X). Empty in any other scenario.
 */
export function pelennorDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  const dials: TableDial[] = [];
  const city = cardsOf(game, MINAS_TIRITH)[0];
  if (city) {
    const hitPoints = modifiedStat(game, city, "hitPoints", ctx.cards);
    const incoming = incomingDamage(game, ctx, city.id);
    const left = hitPoints - city.damage;
    const warn = incoming >= left ? { level: "critical" as const, words: cityDestroyedWords(city.damage, hitPoints, incoming) } : left <= LOW ? { level: "near" as const, words: cityNearWords(city.damage, hitPoints, incoming) } : null;
    dials.push({ id: "city", testID: "pelennor-city", label: "City", name: `Damage on ${nameOf(MINAS_TIRITH)}, ${hitPoints} hit points:`, value: city.damage, limit: hitPoints, warms: true, ...(warn ? { warn } : {}), limitWords: cityWords(hitPoints) });
  }
  const wall = game.activeLocation ? game.cards[game.activeLocation] : undefined;
  if (wall?.code === WALL) {
    const questPoints = printedOf(ctx.cards, WALL).questPoints ?? 0;
    dials.push({
      id: "wall",
      testID: "pelennor-wall",
      label: "Wall",
      name: `Damage on ${nameOf(WALL)}, the active location, ${questPoints} to discard it:`,
      value: wall.damage,
      limit: questPoints,
      warms: true,
      ...(wall.damage >= questPoints - 1 ? { warn: { level: "near" as const, words: wallNearWords(wall.damage, questPoints) } } : {}),
      limitWords: wallWords(questPoints),
    });
  }
  const fleet = cardsOf(game, FLEET)[0];
  if (fleet) dials.push({ id: "fleet", testID: "pelennor-fleet", label: "Fleet", name: `Resources on ${nameOf(FLEET)}, Aragorn returns when none are left:`, value: fleet.resources, note: fleetWords(fleet.resources) });
  const grond = cardsOf(game, GROND)[0];
  if (grond) dials.push({ id: "grond", testID: "pelennor-grond", label: "Grond", name: `Resources on ${nameOf(GROND)}, X:`, value: grond.resources, note: grondWords(grond.resources) });
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  if (stage?.code === STAGE_TWO) {
    const cost = stagedAlliesCost(game, ctx);
    dials.push({ id: "allies", testID: "pelennor-allies", label: "Allies", name: "Total cost of the allies in the staging area, X:", value: cost, note: alliesWords(cost) });
  }
  return dials;
}

/** What the quest result line says on stage 3B (Assault: no progress on the stage, a failed quest damages Minas Tirith, no threat raised) and on stage 4B (the progress is dealt as damage among the enemies), or null on any other stage. */
export function pelennorQuestWords(game: ScenarioState, ctx: ReduceContext, margin: number): string | null {
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  if (!stage) return null;
  if (flagged(game, stage.id, "assault")) {
    const city = cardsOf(game, MINAS_TIRITH)[0];
    const left = city ? modifiedStat(game, city, "hitPoints", ctx.cards) - city.damage : null;
    const room = city ? (wallRoom(game, city.id, ctx.cards)?.room ?? 0) : 0;
    return assaultQuestWords(margin, game.activeLocation != null, city ? city.damage : null, left == null ? null : left + room);
  }
  if (flagged(game, stage.id, "progressAsDamage") && margin > 0) return rohanQuestWords(margin);
  return null;
}
