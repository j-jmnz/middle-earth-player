// Rules: rr.step-6-4-3, rr.step-6-4-4, rr.multiple-defenders, rr.step-6-8-1, rr.ranged, mec109.archery
// (data/rules/entries.json).
//
// The combat sheets: the defender pick (several with Stand Together), the hero an undefended attack hits, archery, and the
// players' attack. Each option carries what the engine says it would do (foresight.ts), and a choice that loses the game
// asks twice.
import { defenseAsDefender, modifiedStat } from "../../rules/core/keywords.ts";
import { attackStatAgainst } from "../../rules/families/attack/spectral.ts";
import { legalTargets, type LegalIntent, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../rules/engine/reduce.ts";

import { undefendedRedirectWords } from "../readouts/against-the-shadow/cair-andros.ts";
import { fateAttackNote, fateTargetNote } from "../words/scenarios/fate.ts";
import { attackSource } from "../words/scenarios/grapple.ts";
import { nightDefenderExcess, nightStageAttack } from "../words/scenarios/night.ts";
import { damageOutcome, defenseDamage, undefendedDamage } from "../store/foresight.ts";
import { has, option, statOf } from "./sheet-parts.ts";
import type { Alternative, MultiSheet, OptionMark, Sheet, SheetNames, SheetStat } from "./sheet-types.ts";

// What an attack would do to a character before the shadow card (foresight.ts): the damage as a stat on its tile and card,
// "destroyed" in the label when it would be, and a caution when that loses the game, so the confirm asks twice.
function foreseen(game: ScenarioState, ctx: ReduceContext, names: SheetNames, id: string, damage: number): { stats: SheetStat[]; suffix: string; mark: OptionMark; caution?: string } {
  const outcome = damageOutcome(game, ctx, id, damage);
  const stats: SheetStat[] = [{ icon: "damage", value: damage, word: "Damage" }];
  const mark: OptionMark = { icon: "damage", value: damage, danger: outcome.destroyed };
  if (!outcome.destroyed) return { stats, suffix: "", mark };
  // Short enough for the two lines above the buttons; the readout says why the game is lost.
  const caution = outcome.loss ? `Tap again: ${names.card(id)} falls and the game is lost` : undefined;
  return { stats, suffix: " · destroyed", mark, ...(caution ? { caution } : {}) };
}

/** The heroes an undefended attack can land on, when there is more than one to choose from. */
function undefendedSheet(game: ScenarioState, ctx: ReduceContext, names: SheetNames, title: string, note: string, redirect: string | null): Sheet | PlayerIntent {
  const heroes = legalTargets(game, { type: "Undefended" }, ctx);
  if (heroes.length <= 1) return heroes[0] ? { type: "Undefended", heroId: heroes[0] } : { type: "Undefended" };
  const enemyId = game.pendingAttack?.enemyId ?? "";
  const damage = undefendedDamage(game, ctx, enemyId);
  return {
    kind: "pick",
    key: `undefended:${game.pendingAttack?.enemyId ?? ""}`,
    step: "Combat",
    title,
    note: `${note} ${redirect ?? "Undefended: a hero takes all of it."}`,
    verb: "Damage to",
    confirm: "Take the damage",
    options: heroes.map((id) => {
      const seen = foreseen(game, ctx, names, id, damage);
      const base = option(game, names, id);
      return { ...base, label: `${base.label}${seen.suffix}`, stats: seen.stats, mark: seen.mark, intent: { type: "Undefended", heroId: id }, ...(seen.caution ? { caution: seen.caution } : {}) };
    }),
    primary: null,
    alternative: null,
  };
}

function attackNumbers(game: ScenarioState, ctx: ReduceContext): { attack: number; enemyId: string } | null {
  const enemyId = game.pendingAttack?.enemyId;
  const enemy = enemyId ? game.cards[enemyId] : undefined;
  return enemy && enemyId ? { attack: modifiedStat(game, enemy, "attack", ctx.cards), enemyId } : null;
}

/** The attackers that can join an attack on one enemy, for the second half of the player-attack sheet. */
function attackersSheet(game: ScenarioState, ctx: ReduceContext, names: SheetNames, enemyId: string): MultiSheet {
  const enemy = game.cards[enemyId];
  const defense = enemy ? modifiedStat(game, enemy, "defense", ctx.cards) : 0;
  // The stat each row shows is the one the attack reads: Willpower against a Spectral enemy (50312:A:1).
  const read = attackStatAgainst(game, enemyId, ctx.cards);
  // Another seat's ranged characters may join the attack (rr.ranged, rr.step-6-8-1); the active seat's come first.
  const seats = [game.activeSeat, ...game.seats.map((_, index) => index).filter((index) => index !== game.activeSeat && index < game.seatCount)];
  const characters = seats
    .flatMap((seat) => [...(game.seats[seat]?.heroes ?? []), ...(game.seats[seat]?.play ?? [])])
    .filter((id) => legalTargets(game, { type: "DeclareAttackers", cardId: id }, ctx).includes(enemyId));
  return {
    kind: "multi",
    key: `attackers:${enemyId}`,
    step: "Combat",
    title: `Attack ${names.card(enemyId)}`,
    note: fateTargetNote(game, ctx, enemyId, defense, names.card(enemyId)) ?? `Defense ${defense}. Choose the characters that attack it.`,
    verb: "Attack",
    stats: statOf(game, ctx, enemyId, "defense"),
    options: characters.map((id) => ({ ...option(game, names, id), stats: statOf(game, ctx, id, read) })),
    build: { kind: "attack", enemyId },
    allowEmpty: false,
    preselected: [],
    alternative: { label: "No attack", intent: { type: "DeclineAttack" } },
  };
}

/** The enemy's attack: the defenders the player may declare, each with the damage it would take, or leave it undefended. */
export function defenseSheet(game: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[], names: SheetNames): Sheet {
  const numbers = attackNumbers(game, ctx);
  const title = numbers ? `${names.card(numbers.enemyId)} attacks` : "An enemy attacks";
  // An attack a shadow card makes says where it comes from, as a pick says its card's line (sheets.ts).
  const shadowSource = numbers && game.pendingAttack?.shadowAttack ? ` ${names.card(numbers.enemyId)}'s shadow effect: it attacks you now, and goes back to the top of the encounter deck after combat.` : "";
  // An attack the Thing makes from the staging area while Eye of the Beast is engaged with the defender, or a detached arm's (dcce.grapple, 12050:A:3, 12052:A:3).
  const source = shadowSource || attackSource(game, ctx, names.card) || fateAttackNote(game, ctx, names.card);
  const note = numbers ? `Attack ${numbers.attack}.${source}` : "";
  const defenders = has(legal, "DeclareDefender") ? legalTargets(game, { type: "DeclareDefender" }, ctx) : [];
  // While stage 1B of The Siege of Cair Andros is current the damage of an undefended attack goes to a Battleground location, not a hero (05072:B:2).
  const redirect = numbers ? undefendedRedirectWords(game, ctx, numbers.attack) : null;
  const undefended = undefendedSheet(game, ctx, names, title, note, redirect);
  // Leave undefended with one hero to take it: the armed line says when that hero falls and the game with it.
  const lone = "kind" in undefended ? null : undefended.type === "Undefended" ? undefended.heroId : null;
  const loneCaution = lone && numbers ? foreseen(game, ctx, names, lone, numbers.attack).caution : undefined;
  // The attack on Hrogar's Hill (19083:B:1) says where the damage goes, and arms Leave undefended when the Hill would hold as much as it has quest points.
  const onHill = numbers ? nightStageAttack(game, ctx, numbers.enemyId, defenders.length) : null;
  const cautious = onHill ? onHill.caution : loneCaution;
  const leave: Alternative =
    "kind" in undefended
      ? { label: "Leave undefended", next: undefended }
      : { label: "Leave undefended", intent: undefended, ...(cautious ? { caution: cautious } : {}) };
  return {
    kind: "pick",
    key: `defense:${numbers?.enemyId ?? ""}:${game.pendingAttack?.undefended ? "u" : "d"}`,
    step: "Combat",
    title,
    stats: numbers ? statOf(game, ctx, numbers.enemyId, "attack") : [],
    note: game.pendingAttack?.undefended ? `${note} This attack is undefended.${redirect ? ` ${redirect}` : ""}` : (onHill?.note ?? (defenders.length === 0 ? `${note} No character can defend.${redirect ? ` ${redirect}` : ""}` : `${note} Choose a defender, or leave it undefended.${redirect ? ` ${redirect}` : ""}`)),
    verb: "Defend with",
    options: defenders.map((id) => {
      const defense = defenseAsDefender(game, id, ctx.cards);
      const damage = numbers ? defenseDamage(game, ctx, numbers.enemyId, id) : 0;
      const base = option(game, names, id);
      const seen = foreseen(game, ctx, names, id, damage);
      // Damage beyond the defender's hit points goes on Hrogar's Hill (19083:B:1): the row says how much, and arms the caution when that fills the Hill.
      const hill = nightDefenderExcess(game, ctx, id, damage);
      const caution = hill?.caution ?? ("caution" in seen ? seen.caution : undefined);
      return {
        ...base,
        label: `${base.label}${seen.suffix}${hill?.suffix ?? ""}`,
        stats: [{ icon: "defense" as const, value: defense, word: "Defense" }, ...seen.stats],
        mark: seen.mark,
        intent: { type: "DeclareDefender", defenderId: id },
        ...(caution ? { caution } : {}),
      };
    }),
    primary: null,
    alternative: leave,
  };
}

/**
 * One more defender picked in the defense family's declaration frame (Stand Together, 01038:A:1): its Defense, and the
 * pooled damage the attack would deal. Who takes it is chosen after the declarations, so nothing is destroyed by this pick
 * yet (rr.multiple-defenders).
 */
export function extraDefender(game: ScenarioState, ctx: ReduceContext, id: string): { stats: SheetStat[]; mark: OptionMark } | null {
  const numbers = attackNumbers(game, ctx);
  if (!numbers || !game.cards[id]) return null;
  const damage = defenseDamage(game, ctx, numbers.enemyId, id);
  return {
    stats: [{ icon: "defense", value: defenseAsDefender(game, id, ctx.cards), word: "Defense" }, { icon: "damage", value: damage, word: "Damage" }],
    mark: { icon: "damage", value: damage, danger: false },
  };
}

/** Archery: its total spread over the player's characters (mec109.archery). */
export function archerySheet(game: ScenarioState, ctx: ReduceContext, names: SheetNames, total: number): Sheet {
  const recipients = legalTargets(game, { type: "Distribute" }, ctx);
  return {
    kind: "distribute",
    key: `archery:${game.round}:${total}`,
    step: "Combat",
    title: `Archery ${total}`,
    note: `Assign ${total} damage among your characters. Defense does not stop it.`,
    total: total,
    exact: true,
    options: recipients.map((id) => {
      const card = game.cards[id];
      const health = card ? modifiedStat(game, card, "hitPoints", ctx.cards) - card.damage : 0;
      return { ...option(game, names, id), stats: [{ icon: "hitPoints" as const, value: health, word: "Hit points left" }], max: total };
    }),
    purpose: { kind: "archery" },
  };
}

/** The players' attack: the enemy first, then the characters that attack it. */
export function playerAttackSheet(game: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[], names: SheetNames): Sheet {
  if (!has(legal, "DeclareAttackers")) {
    return {
      kind: "pick",
      key: `playerAttack:${game.round}:none`,
      step: "Combat",
      title: "No attack is possible",
      note: null,
      verb: "",
      options: [],
      primary: { label: "Continue", intent: { type: "DeclineAttack" } },
      alternative: null,
    };
  }
  const seat = game.activeSeat;
  const enemies = new Set<string>();
  for (const id of [...(game.seats[seat]?.heroes ?? []), ...(game.seats[seat]?.play ?? [])]) {
    for (const enemyId of legalTargets(game, { type: "DeclareAttackers", cardId: id }, ctx)) enemies.add(enemyId);
  }
  // A location in the staging area a card lets the first player attack as if engaged (Cracked Pillar, 41028:A:1) is among the options.
  const location = [...enemies].some((id) => ctx.cards.get(game.cards[id]?.code ?? "")?.type === "location");
  return {
    kind: "pick",
    key: `playerAttack:${game.round}:${[...enemies].join(",")}`,
    step: "Combat",
    title: location ? "Attack an enemy or location" : "Attack an enemy",
    note: location ? "Choose the enemy or location, then the characters that attack it." : "Choose the enemy, then the characters that attack it.",
    verb: "Attack",
    options: [...enemies].map((id) => ({ ...option(game, names, id), stats: statOf(game, ctx, id, "defense"), next: attackersSheet(game, ctx, names, id) })),
    primary: null,
    alternative: { label: "No attack", intent: { type: "DeclineAttack" } },
  };
}
