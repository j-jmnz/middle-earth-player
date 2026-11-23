// The words of the burgle family's choices (src/catalog/families/burgle.ts, The Lonely Mountain) inside a Choose branch: the card type Secret Entrance names, the Baggins resources Pretending to Sleep spends, the progress Western Slopes removes from Smaug the Golden.
// Every sentence names what the branch does and leads with it; the numbers are the engine's, read from the table.
import type { Instruction } from "../../../../catalog/boundary.ts";

import type { ReduceContext } from "../../../../rules/interpret/interpret.ts";
import type { ScenarioState } from "../../../../rules/core/state.ts";
import { inPlay } from "../../../../rules/core/state.ts";
import { burgleEffectOf, nearestBurgle } from "../../../../rules/families/burgle/match.ts";
import { spendablePools } from "../../../../rules/families/costs/verbs.ts";

import { article } from "../../instruction.ts";
import type { ChoiceNames } from "../../choice.ts";
import { seatSays } from "../../seat.ts";

type ChooseInstruction = Extract<Instruction, { verb: "Choose" }>;

/** The progress on the first card in play with this title, or null when none is in play. */
function progressOn(game: ScenarioState, title: string, names: ChoiceNames): number | null {
  const card = Object.values(game.cards).find((entry) => inPlay(entry.zone) && names.code(entry.code) === title);
  return card ? card.progress : null;
}

/** What follows the attempt, by the card that makes it: The Burglar's Turn gives the top treasure card on a success and has Smaug the Golden attack the first player on a failure (132072:B:1, 132072:B:2); A Bare Patch attaches itself to Smaug the Magnificent on a success (132039:A:2). Empty when nothing follows. */
function followWords(game: ScenarioState, names: ChoiceNames, success: boolean): string {
  const maker = nearestBurgle(game)?.frame.cardId;
  const code = maker ? game.cards[maker]?.code : undefined;
  if (code === "132072") return success ? `take the top treasure card from under ${names.code("132043")} into your hand` : `${names.code("132040")} attacks the first player`;
  if (code === "132039" && success) return `${names.code("132039")} attaches to ${names.code("132041")}`;
  return "";
}

const then = (words: string): string => (words ? `, then ${words}` : "");

/** A branch of a burgle family card's choice in words, or null for any other branch. */
export function burgleBranchWords(choose: ChooseInstruction, optionId: string, game: ScenarioState, names: ChoiceNames, ctx?: ReduceContext): string | null {
  const option = choose.options.find((entry) => entry.id === optionId);
  // Step 3 of an attempt: discard the matching cards or decline (families/burgle/attempt.ts).
  if (choose.options.some((entry) => entry.id === "discard") && choose.options.some((entry) => entry.id === "decline")) {
    const facts = ctx ? attemptFacts(game, ctx, names) : null;
    if (optionId === "decline") return `Decline the attempt: the burgle fails and nothing is discarded${then(followWords(game, names, false))}`;
    if (optionId === "discard" && facts) return `Discard ${cards(facts.need)} that ${facts.need === 1 ? "matches" : "match"} the revealed ${facts.revealed} in ${facts.shared}${then(followWords(game, names, true))}`;
  }
  const [first, second] = option?.instructions ?? [];
  // Secret Entrance (132045:A:2): each branch names a card type, travels, looks at the top card and sends the location back unless it is that type.
  if (first?.verb === "Travel") return `Name ${article(optionId)}: travel here, look at the top card of the encounter deck, and send this location back to the staging area unless it is ${article(optionId)}`;
  // Pretending to Sleep (132048:A:2): the progress on Smaug the Golden is the number of Baggins resources.
  if (first?.verb === "SpendBaggins") {
    const progress = progressOn(game, "Smaug the Golden", names);
    return progress == null ? "Spend as many Baggins resources as Smaug the Golden has progress" : `Spend ${progress} Baggins resource${progress === 1 ? "" : "s"} from the Baggins hero's pool`;
  }
  // Western Slopes (132047:A:1): the choice of a card of Smaug the Golden's.
  if (first?.verb === "Pick" && second?.verb === "RemoveProgressFrom") return `Remove ${second.amount === 1 ? "1 progress" : `${String(second.amount)} progress`} from ${first.pick.names?.[0] ?? "the card"}`;
  return null;
}

const TRAIT_WORDS: Readonly<Record<string, string>> = { sphere: "sphere", type: "card type", cost: "printed cost" };

/** What the burgle attempt under way asks of the first player: the card with the effect, the revealed card, how many cards must be discarded and which traits they share with it. Null with no attempt at step 3. */
function attemptFacts(game: ScenarioState, ctx: ReduceContext, names: ChoiceNames): { effectCard: string; revealed: string; need: number; shared: string; done: number } | null {
  const found = nearestBurgle(game);
  const data = found?.frame.data;
  const effectCode = data?.effectCardId ? game.cards[data.effectCardId]?.code : undefined;
  const effect = effectCode ? burgleEffectOf(ctx, effectCode) : undefined;
  if (!data || !effectCode || !effect || data.need <= 0) return null;
  const revealedCode = data.revealedId ? game.cards[data.revealedId]?.code : undefined;
  return {
    effectCard: names.code(effectCode),
    revealed: revealedCode ? names.code(revealedCode) : "the revealed card",
    need: data.need,
    shared: effect.match.map((trait) => TRAIT_WORDS[trait] ?? trait).join(" and "),
    done: data.matching.filter((id) => game.cards[id]?.zone === "discard").length,
  };
}

const cards = (count: number): string => `${count} card${count === 1 ? "" : "s"}`;

/** The sentence over the choice step 3 of a burgle attempt opens (the discard or decline Choose the engine makes): the first player may discard the cards that match the revealed card. Null for any other Choose. */
export function burgleChooseNote(choose: ChooseInstruction, game: ScenarioState, ctx: ReduceContext, names: ChoiceNames, seat: number): string | null {
  if (!choose.options.some((option) => option.id === "discard") || !choose.options.some((option) => option.id === "decline")) return null;
  const facts = attemptFacts(game, ctx, names);
  if (!facts) return null;
  return seatSays(game, seat).titled(facts.effectCard, `burgle attempt. The revealed card is ${facts.revealed}. As the first player, discard ${cards(facts.need)} from your hand that ${facts.need === 1 ? "matches" : "match"} its ${facts.shared}, or decline and the attempt fails.`);
}

/** The words over one hand card the burgle effect makes the first player discard: which card of how many, and what it must match. Null for any other pick. */
export function burglePickWords(game: ScenarioState, ctx: ReduceContext, names: ChoiceNames, effectId: string | undefined, seat: number): { verb: string; prompt: string; owned?: true } | null {
  if (!effectId?.startsWith("burgle:")) return null;
  const facts = attemptFacts(game, ctx, names);
  if (!facts) return null;
  const says = seatSays(game, seat);
  return { verb: "Discard", prompt: says.titled(facts.effectCard, `burgle attempt, card ${Math.min(facts.done + 1, facts.need)} of ${facts.need}. Choose a card from your hand to discard that matches the revealed ${facts.revealed} in its ${facts.shared}.`), ...says.owned };
}

const SPHERES: Readonly<Record<string, string>> = { leadership: "leadership", lore: "lore", spirit: "spirit", tactics: "tactics", neutral: "neutral", baggins: "Baggins" };

/** What the first player sees of the revealed card: "Snowbourn Scout (a leadership ally, cost 1)". */
function revealedWords(game: ScenarioState, ctx: ReduceContext, names: ChoiceNames, revealedId: string | null): string {
  const code = revealedId ? game.cards[revealedId]?.code : undefined;
  const printed = code ? ctx.cards.get(code) : undefined;
  if (!code || !printed) return "no card (the deck is empty)";
  const sphere = printed.sphere ? `${SPHERES[printed.sphere] ?? printed.sphere} ` : "";
  const cost = printed.costX ? ", cost X" : printed.cost != null ? `, cost ${printed.cost}` : "";
  return `${names.code(code)} (${article(`${sphere}${printed.type}`)}${cost})`;
}

/** Why The Lonely Mountain's Action cannot be used now, or null when it can: the first player pays 2 Baggins resources, and a revealed card must still lie on his deck (132043:A:2). */
function actionBarred(game: ScenarioState, ctx: ReduceContext, names: ChoiceNames, revealedId: string | null): string | null {
  if (revealedId == null || game.cards[revealedId]?.zone !== "deck") return "no revealed card is left on the deck to take";
  const have = spendablePools(game, game.firstPlayer, { sphere: "baggins" }, ctx).total;
  if (have >= 2) return null;
  const hero = (game.seats[game.firstPlayer]?.heroes ?? []).find((id) => ctx.cards.get(game.cards[id]?.code ?? "")?.sphere === "baggins");
  const name = hero ? names.code(game.cards[hero]?.code ?? "") : "The first player's heroes";
  return `${name} ${hero ? "has" : "have"} ${have === 0 ? "no" : have} Baggins resource${have === 1 ? "" : "s"}`;
}

/** The note of the action window of a burgle attempt (after step 2): the card the attempt stopped at, the revealed card that stays on the deck, what step 3 asks and The Lonely Mountain's Action, with the reason when it cannot be used. The first player is named when two play. Null with no attempt at the window. */
export function burgleWindowNote(game: ScenarioState, ctx: ReduceContext, names: ChoiceNames): string | null {
  const found = nearestBurgle(game);
  const data = found?.frame.data;
  const effectCode = data?.effectCardId ? game.cards[data.effectCardId]?.code : undefined;
  const effect = effectCode ? burgleEffectOf(ctx, effectCode) : undefined;
  if (!data || !effectCode || !effect) return null;
  const shared = effect.match.map((trait) => TRAIT_WORDS[trait] ?? trait).join(" and ");
  const mountain = Object.values(game.cards).some((card) => card.code === "132043" && inPlay(card.zone));
  // Two-handed, the player whose deck and hand the attempt uses is named.
  const his = game.seatCount > 1 ? `Player ${game.firstPlayer + 1}'s` : "the first player's";
  const barred = mountain ? actionBarred(game, ctx, names, data.revealedId) : null;
  const action = mountain ? ` ${names.code("132043")}: Action, spend 2 Baggins resources to take the revealed card into hand and reveal the next card.${barred ? ` Not available now: ${barred}.` : ""}` : "";
  return `Burgle attempt, step 2: ${his} deck is shuffled and ${revealedWords(game, ctx, names, data.revealedId)} is revealed; it stays on the deck. ${names.code(effectCode)} asks for ${cards(effect.discard)} from ${his} hand that ${effect.discard === 1 ? "matches" : "match"} its ${shared}.${action}`;
}
