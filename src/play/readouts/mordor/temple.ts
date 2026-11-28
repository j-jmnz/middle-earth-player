// Rules: rr.forced, rr.quest-advancement, rr.threat-threat-dial (data/rules/entries.json); ledger lines 21053:A:1, 21054:A:2, 21080:B:2, 21085:B:2, 21065:A:1, 21062:A:1, 21070:A:2 (docs/scenarios/vengeance-of-mordor/the-temple-of-doom.md, Table).
//
// The numbers The Temple of Doom keeps in view: the damage on Tribute to Mordor against the 4 that reveal a Power of Mordor card (a plain limit that warms), Thane Ulchor's hit points left, the resources on stage 1B against the 2 that advance it (a goal dial), the progress stage 2B took this round against its cap, and a mark on each seat for the cards under its threat dial (Lost in the Dark), the cards it played this round under Narrow Opening and the threat its card effects took off under Covered in Darkness.
// The engine decided every number (`damage`, `resources`, `stageProgressCap`, the cards under a side quest, `played`, `playerThreatLoweredBy`); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { cardsUnder } from "../../../rules/core/zones.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import { livingSeats } from "../../../rules/core/state.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import type { ReduceContext } from "../../../rules/interpret/interpret.ts";
import { cardsOf, type TableDial } from "../dials.ts";
import type { HandMark } from "../isengard.ts";
import { capMarkLabel, capMarkWords } from "./dorwinion-words.ts";
import { darkMarkLabel, darkMarkWords, lordCapWords, playMarkLabel, playMarkWords, templeGateLimitWords, templeGateWords, tributeLimitWords, tributeLoseWords, tributeWords, ulchorWords } from "./temple-words.ts";

const SCENARIO = "the-temple-of-doom";
const TRIBUTE = "21053";
const ULCHOR = "21054";
const TEMPLE = "21080";
const LORD = "21085";
const DARK = "21065";
const NARROW = "21062";
const COVERED = "21070";
/** The damage tokens that reveal a card, and the resources that advance stage 1B. */
const TRIBUTE_AT = 4;
const TEMPLE_AT = 2;

const stagingOrEngaged = (zone: string): boolean => zone === "staging" || zone === "engaged";

/** The dials the table holds now: stage 1B's gate, the stage 2B cap once the Forced effect set it, Tribute to Mordor and Thane Ulchor while each is in play. None in any other scenario. */
export function templeDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  if (game.scenarioId !== SCENARIO) return [];
  const dials: TableDial[] = [];
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  if (stage?.code === TEMPLE && stage.face === "B") {
    dials.push({ id: "gate", testID: "temple-gate", label: "Temple", name: `Resources on ${nameOf(TEMPLE)}:`, value: stage.resources, limit: TEMPLE_AT, goal: true, limitWords: templeGateLimitWords(), cardId: stage.id, note: templeGateWords(stage.resources) });
  }
  if (stage?.code === LORD && stage.face === "B") {
    const caps = game.modifiers.filter((modifier) => modifier.stat === "stageProgressCap" && modifier.instanceId === stage.id).map((modifier) => modifier.amount);
    if (caps.length > 0) {
      const cap = Math.min(...caps);
      const placed = game.modifiers.filter((modifier) => modifier.stat === "stageProgressPlaced" && modifier.instanceId === stage.id).reduce((sum, modifier) => sum + modifier.amount, 0);
      const name = nameOf(LORD);
      dials.push({ id: "cap", testID: "temple-cap", label: "Cap", name: `Progress placed on ${name} this round, no more than ${cap}:`, value: placed, limit: cap, limitWords: `No more than ${cap} progress this round`, ...(placed >= cap ? { warn: { level: "near" as const, words: `No more progress can be placed on ${name} this round.` } } : {}), cardId: stage.id, note: lordCapWords(placed, cap) });
    }
  }
  const tribute = cardsOf(game, TRIBUTE)[0];
  if (tribute) {
    const deck = game.piles?.powerOfMordorDeck?.length ?? 0;
    const losing = deck === 0 && tribute.damage >= TRIBUTE_AT - 1;
    dials.push({ id: "tribute", testID: "temple-tribute", label: "Tribute", name: `Damage on ${nameOf(TRIBUTE)}:`, value: tribute.damage, limit: TRIBUTE_AT, warms: true, limitWords: tributeLimitWords(), ...(losing ? { warn: { level: "critical" as const, words: tributeLoseWords() } } : {}), cardId: tribute.id, note: tributeWords(tribute.damage, deck) });
  }
  const ulchor = cardsOf(game, ULCHOR).find((card) => stagingOrEngaged(card.zone));
  if (ulchor) {
    const left = Math.max(0, modifiedStat(game, ulchor, "hitPoints", ctx.cards) - ulchor.damage);
    const x = game.victory.filter((id) => game.cards[id] && printedOf(ctx.cards, game.cards[id].code).type === "quest").length + 1;
    dials.push({ id: "ulchor", testID: "temple-ulchor", label: "Ulchor", short: "Ulc", name: `Hit points left on ${nameOf(ULCHOR)}:`, value: left, cardId: ulchor.id, note: ulchorWords(left, x) });
  }
  return dials;
}

/** Each living seat's marks: the cards under its threat dial while Lost in the Dark is in play, the cards it played this round while Narrow Opening is the active location, and the threat its card effects took off while Covered in Darkness is in play. None otherwise. */
export function templeHands(game: ScenarioState): readonly HandMark[] {
  if (game.scenarioId !== SCENARIO) return [];
  const seats = livingSeats(game);
  const solo = game.seatCount > 1 ? null : 0;
  const label = (seat: number): number | null => (solo === 0 ? null : seat);
  const marks: HandMark[] = [];
  const dark = cardsOf(game, DARK)[0];
  if (dark) {
    const under = cardsUnder(game, dark.id).filter((id) => game.cards[id]?.stackedAt != null);
    for (const seat of seats) {
      const held = under.filter((id) => game.cards[id]?.owner === seat).length;
      marks.push({ seat, label: darkMarkLabel(label(seat), held), note: darkMarkWords(held) });
    }
  }
  if (game.activeLocation != null && game.cards[game.activeLocation]?.code === NARROW) {
    for (const seat of seats) {
      const played = (game.played ?? []).filter((entry) => entry.round === game.round && entry.seat === seat).length;
      marks.push({ seat, label: playMarkLabel(label(seat), played), note: playMarkWords(played) });
    }
  }
  if (cardsOf(game, COVERED).some((card) => stagingOrEngaged(card.zone))) {
    for (const seat of seats) {
      const lowered = game.playerThreatLoweredBy?.[seat] ?? 0;
      marks.push({ seat, label: capMarkLabel(label(seat), lowered), note: capMarkWords(lowered).replace("Hillside Manor", "Covered in Darkness") });
    }
  }
  return marks;
}
