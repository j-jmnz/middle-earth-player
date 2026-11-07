// Rules: emce.boon-allies, emce.dragon-signs, emce.caves-deck, rr.first-player, rr.travel (data/rules/entries.json); ledger lines 12175:B:1, 12175:B:5, 12176:A:4, 12177:A:4, 12180:A:1, 12183:A:1, 19019:A:3, 19020:A:2, 19021:A:1, 19022:B:1, 19024:B:1, 19025:A:1, 19025:B:2.
// The Withered Heath's choices on the live sheet (docs/design-system-table.md, Choice tray): each says the number, the side of the table and the player. One player's choice leads with "Player N:" two-handed (`owned`, so the sheet adds no
// "Player N chooses."), solo it has no lead; the rows state what they do and what an irreversible choice costs. Pure.
import type { Instruction } from "../../catalog/boundary.ts";
import { effectData } from "../../rules/families/encounter/moves.ts";
import { DONE } from "../../rules/families/deck/choose.ts";
import { inPlay, type ScenarioState } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";

import type { ChoiceNames, PickWords } from "./choice.ts";
import { askedSeat, seatSays } from "./seat.ts";
import { assignDamageWords } from "./south.ts";

type Facts = { game: ScenarioState; ctx: ReduceContext; options: readonly string[] };
type Choose = Extract<Instruction, { verb: "Choose" }>;

/** The stage each Accolade boon (12176 to 12179) is the reward of: stages 1 to 3 when they are defeated, stage 4 when Cold-Drake is (12175:B:1). */
const ACCOLADE_STAGE: Readonly<Record<string, number>> = { "12176": 1, "12177": 2, "12178": 3, "12179": 4 };

// The offer of a stage's Accolade boon (12175:B:1): attach the set-aside boon to a hero, or decline.
function accoladeOffer(choose: Choose): { code: string; stage: number } | null {
  const attach = choose.options.find((option) => option.id === "attach");
  const step = attach?.instructions.find((entry) => entry.verb === "AttachSetAside");
  const stage = step?.verb === "AttachSetAside" ? ACCOLADE_STAGE[step.code] : undefined;
  return choose.options.length === 2 && step?.verb === "AttachSetAside" && stage != null && choose.options.some((option) => option.id === "decline") ? { code: step.code, stage } : null;
}

const reward = (stage: number): string => (stage === 4 ? "defeating Cold-Drake" : `defeating stage ${stage}`);

// Whether a seat controls an Accolade boon: one of the four is attached to one of its heroes.
const holdsAccolade = (game: ScenarioState, seat: number): boolean => Object.values(game.cards).some((card) => ACCOLADE_STAGE[card.code] != null && card.host != null && game.seats[seat]?.heroes.includes(card.host) === true);

// The next seat in turn order, after the one asked, that is offered the boon if this one declines: it is in the game and controls no Accolade boon (12175:B:1). Null for the last such seat, and solo.
function nextAccoladeSeat(game: ScenarioState): number | null {
  const order = Array.from({ length: game.seatCount }, (_, index) => (game.firstPlayer + index) % game.seatCount);
  const later = order.slice(order.indexOf(askedSeat(game)) + 1);
  return later.find((seat) => game.seats[seat]?.eliminated === false && (game.seats[seat]?.heroes.length ?? 0) > 0 && !holdsAccolade(game, seat)) ?? null;
}

// Deadly Cold (19021:A:1): the question about one ready character, exhaust it or deal it damage. The damage, or null for another Choose.
function coldOffer(choose: Choose): number | null {
  const [exhaust, damage] = choose.options;
  const hurt = damage?.instructions[0];
  return choose.options.length === 2 && exhaust?.id === "exhaust" && exhaust.instructions[0]?.verb === "Exhaust" && damage?.id === "damage" && hurt?.verb === "DamageCard" && typeof hurt.amount === "number" ? hurt.amount : null;
}

// The character the question is about, and how far through the asked player's ready characters it is: "2 of 3". The frame's picks are every player's, so only this player's count; the pick queue holds the characters still to come.
export function coldPlace(game: ScenarioState): { id: string | null; at: number; of: number } {
  const data = effectData(game);
  const seat = askedSeat(game);
  const mine = (data?.picked ?? []).filter((id) => game.cards[id]?.controller === seat);
  const left = (data?.queue ?? []).filter((item) => item.seat === seat && item.instruction.verb === "Pick" && item.chosen != null).length;
  return { id: data?.picked?.at(-1) ?? null, at: mine.length, of: mine.length + left };
}

/** The sentence over a Choose of The Withered Heath: the Accolade boon offered for a stage defeated (12175:B:1), and Deadly Cold's question about one character (19021:A:1). Null for any other Choose. */
export function heathChooseNote(choose: Choose, game: ScenarioState, names: ChoiceNames): string | null {
  const { say } = seatSays(game);
  const damage = coldOffer(choose);
  if (damage != null) {
    const place = coldPlace(game);
    return say(`exhaust ${place.id ? names.card(place.id) : "this character"}, or deal it ${damage} damage? (${place.at} of ${place.of})`);
  }
  const offer = accoladeOffer(choose);
  if (!offer) return null;
  return say(`attach ${names.code(offer.code)} to one of your heroes? It is the reward for ${reward(offer.stage)}, you control no Accolade boon, and it joins your Campaign Pool on that hero if you win.`);
}

/** The row of an option of that Choose, or null for another. */
export function heathBranchWords(choose: Choose, optionId: string, names: ChoiceNames, game?: ScenarioState): string | null {
  const damage = coldOffer(choose);
  if (damage != null) {
    const who = (game && coldPlace(game).id) || null;
    const name = who ? names.card(who) : "it";
    return optionId === "exhaust" ? `Exhaust ${name}` : `Deal ${name} ${damage} damage`;
  }
  const offer = accoladeOffer(choose);
  if (!offer) return null;
  if (optionId === "attach") return `Attach ${names.code(offer.code)} to one of your heroes`;
  const next = game ? nextAccoladeSeat(game) : null;
  return `Decline ${names.code(offer.code)}: ${next != null ? `Player ${next + 1} is offered it next` : "it is not offered again"}`;
}

/** The label of an option of a pick that has words of its own: the Done that ends The Canny Huntsman's choice of cards for the bottom, and the card rows of that choice and of Master of the Hunt's, which say where the card goes. Null for another pick. */
export function heathOptionLabel(instruction: Instruction, id: string, names: ChoiceNames): string | null {
  // Master of the Hunt (12176:A:4): the first card chosen stays on top, each next one goes to the bottom.
  if (instruction.verb === "ArrangeLookedDeck") return `${instruction.kept == null ? "Keep on top" : "To bottom"}: ${names.card(id)}`;
  if (instruction.verb !== "Each" || !instruction.instructions.some((step) => step.verb === "MoveEncounterCard" && step.to === "deckBottom")) return null;
  return id === DONE ? "Done: the rest stay on top" : `To bottom: ${names.card(id)}`;
}

// Rhyme of the Slayer's bonus Attack against the chosen enemy, read from the record, when a hero carries Dragon-slayer (12179) now; null when none does.
function slayerBonus(game: ScenarioState, ctx: ReduceContext): number | null {
  const carried = Object.values(game.cards).some((card) => card.code === "12179" && card.host != null && inPlay(game.cards[card.host]?.zone ?? "removed"));
  if (!carried) return null;
  const versus = ctx.effects.filter((effect) => effect.cardCode === "12183").flatMap((effect) => effect.instructions).flatMap((step) => (step.verb === "Each" ? step.instructions : [])).find((step) => step.verb === "ModifyStatVersus");
  return versus?.verb === "ModifyStatVersus" && typeof versus.amount === "number" ? versus.amount : null;
}

/** The note over the look at a deck that Master of the Hunt (12176:A:4) makes: whose deck, who arranges it, and that the cards are moved next (the look is followed by the switch to the deck's owner). Null for any other look. */
export function heathLookNote(game: ScenarioState, cardIds: readonly string[]): string | null {
  if (!(effectData(game)?.queue ?? []).some((item) => item.instruction.verb === "ArrangeLookedDeck")) return null;
  const owner = game.seats.findIndex((seat) => seat.deck.includes(cardIds[0] ?? ""));
  const mine = owner < 0 || owner === askedSeat(game);
  return seatSays(game).say(`the top ${cardIds.length} cards of ${mine ? "your" : `Player ${owner + 1}'s`} deck. ${mine ? "You keep" : `Player ${owner + 1} keeps`} 1 on top and ${mine ? "put" : "puts"} the rest on the bottom next.`);
}

// The cards a LookAtTop showed and the player has not placed yet: what is left to choose among, counted from the effect's own record.
const lookedCount = (game: ScenarioState): number | null => effectData(game)?.looked?.length ?? null;

/** The sentence a pick or an ask of The Withered Heath says (19022:B:1, 19024:B:1, 19025:A:1, 19019:A:3, 19020:A:2, 12175:B:1, 12176:A:4, 12180:A:1, 12183:A:1), or null for another. */
export function heathAsk(instruction: Instruction, source: string | null, names: ChoiceNames, next: Instruction | undefined, facts: Facts | undefined): PickWords | null {
  const game = facts?.game;
  const says = game ? seatSays(game) : null;
  const ask = (verb: string, text: string): PickWords => (says ? { verb, prompt: says.say(text), ...says.owned } : { verb, prompt: `${text.charAt(0).toUpperCase()}${text.slice(1)}` });
  const code = source ? (game?.cards[source]?.code ?? source) : undefined;
  // The look at the encounter deck on a stage's side B: one of the cards is revealed, the rest are discarded before it resolves.
  if (instruction.verb === "PickEncounter" && instruction.from === "looked" && next?.verb === "DiscardOtherLooked") {
    const looked = facts?.options.length || 3;
    return ask("Reveal", `choose 1 of the ${looked} cards you looked at to reveal. ${looked === 2 ? "The other is" : "The others are"} discarded first.`);
  }
  // Master of the Hunt (12176:A:4): the player whose deck is looked at keeps one card on top and puts the rest on the bottom, one at a time.
  if (instruction.verb === "ArrangeLookedDeck") {
    const looked = game ? lookedCount(game) : null;
    // The cards still to place: the cards looked at, but the one on top and those placed already (equal copies are one row, so the rows are not the count).
    const left = looked != null ? Math.max(0, looked - 1 - (instruction.bottom?.length ?? 0)) : (facts?.options.length ?? 0);
    const rest = looked != null && looked > 1 ? `The other ${looked - 1} go to the bottom, in the order you choose next.` : "The rest go to the bottom, in the order you choose next.";
    return ask("Choose", instruction.kept == null ? `choose the card that stays on top of your deck. ${rest}` : `choose the next card to place under the rest of your deck, below the ones already placed (${left} left).`);
  }
  // The Canny Huntsman (12180:A:1): the cards of the top 5 that go to the bottom of the encounter deck, in the order chosen; the rest are put back on top.
  if (instruction.verb === "ArrangeEncounter" && code === "12180") return ask("Put on top", `choose the card to put on top of the encounter deck; the others follow in the order you choose (${facts?.options.length ?? 0} left to place).`);
  if (instruction.verb === "Each" && instruction.upTo === "any" && code === "12180") {
    const looked = game ? lookedCount(game) : null;
    const moved = instruction.taken?.length ?? 0;
    return ask("Choose", `choose the cards that go to the bottom of the encounter deck${looked != null ? `, from the top ${looked} you looked at` : ""}, one at a time. Each is placed under the rest.${moved > 0 ? ` ${moved} to the bottom so far.` : ""} Done puts the rest back on top, in the order you choose next.`);
  }
  // High Falls (19019:A:3): the first player assigns all X damage among any player's characters, one point at a time.
  if (instruction.verb === "AssignDamage" && code === "19019") {
    const words = assignDamageWords(instruction, null);
    return ask(words.verb, `${words.prompt.charAt(0).toLowerCase()}${words.prompt.slice(1)}`);
  }
  if (instruction.verb !== "Pick") return null;
  const pick = instruction.pick;
  // Unbroken (12177:A:4): the player who uses it discards a card from their own hand to heal the hero that carries it.
  if (code === "12177" && pick.from === "hand") {
    const host = source ? game?.cards[source]?.host : null;
    return ask("Discard", `choose 1 card from your hand to discard. ${host ? `${names.card(host)}, the hero with ${names.code("12177")},` : `The hero with ${names.code("12177")}`} heals 1 damage.`);
  }
  // Rhyme of the Slayer (12183:A:1): any enemy gets -4 Attack; the hero with Dragon-slayer, when one is in play, gets +4 Attack against it.
  if (code === "12183" && pick.type === "enemy" && next?.verb === "ModifyStat") {
    const bonus = game && facts ? slayerBonus(game, facts.ctx) : null;
    return ask("Weaken", `choose an enemy: it gets ${next.amount} Attack until the end of the phase${bonus != null ? `, and the hero with ${names.code("12179")} gets +${bonus} Attack against it` : ""}.`);
  }
  // Heavy Snow (19020:A:2): the first player chooses a ready character, any player's; until the end of the round no player card effect readies one.
  if (code === "19020" && pick.who === "firstPlayer" && next?.verb === "Exhaust") return ask("Exhaust", "choose a ready character in play to exhaust, any player's. No player card effect can ready a character until the end of the round.");
  // An Accolade boon taken (12175:B:1): the hero that carries it.
  if (pick.type === "hero" && pick.attachable != null && ACCOLADE_STAGE[pick.attachable] != null) return ask("Attach", `choose one of your heroes to carry ${names.code(pick.attachable)}. It joins your Campaign Pool on that hero if you win.`);
  // Master of the Hunt (12176:A:4): the player whose deck is looked at; that player puts one card on top and the rest on the bottom.
  if (code === "12176" && pick.type === "player" && next?.verb === "LookAtTop") return ask("Look", `choose a player to look at the top ${typeof next.count === "number" ? next.count : 3} cards of their deck. They put 1 of them on top of their deck and the rest on the bottom, in any order.`);
  // Cold-Drake (19025:B:2): the dragon that returns to the staging area and attacks each player.
  if (pick.type === "enemy" && pick.names?.length === 1 && next?.verb === "ReturnToStaging") return { verb: "Choose", prompt: `${pick.names[0]} returns to the staging area, then makes an immediate attack against each player in turn order.` };
  // Cold-Drake (19025:A:1): the one enemy that attacks each player in turn order; the sheet has nothing to ask while it is the only candidate.
  if (pick.type === "enemy" && pick.names?.length === 1 && next?.verb === "ForEachPlayer") return { verb: "Choose", prompt: `${pick.names[0]} makes an immediate attack against each player in turn order.` };
  // Rhyme of the Slayer (12183:A:1): the hero with Dragon-slayer on it.
  if (pick.type === "hero" && pick.hasAttachment?.names?.length === 1 && next?.verb === "ModifyStatVersus") return { verb: "Choose", prompt: `The hero with ${pick.hasAttachment.names[0]} gets +${next.amount} Attack while attacking the chosen enemy this phase.` };
  return null;
}
