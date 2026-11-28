// Rules: rr.lasting-effects, rr.modifiers (data/rules/entries.json); ledger lines 21025:A:1, 21027:A:2. faq.lasting-effects: an encounter card's lasting effect is recalculated, so a card that joins the class later in the phase is held and one that leaves it is not.
// The two classes of cards ModifyHeld names, read by `heldBy` (src/rules/core/holder-classes.ts) the way the core's own classes are: the characters that are exhausted now, and the cards in play with one title.
import type { Instruction } from "../../../catalog/boundary.ts";

import { isCharacterType, printedOf, type PrintedCard } from "../../core/printed.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { isExhausted } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";

const PREFIX = "mordor:";
const EXHAUSTED = `${PREFIX}exhausted`;
const TITLED = `${PREFIX}title:`;

/** Whether a modifier's holder id is one of this family's classes. */
export const isMordorHolder = (id: string): boolean => id.startsWith(PREFIX);

/** Whether a card in play belongs to the class `id` names. The caller has checked that the card is in play. */
export function mordorHeldBy(id: string, instance: CardInstance, printed: PrintedCard): boolean {
  if (id === EXHAUSTED) return isExhausted(instance) && (instance.zone === "heroes" || isCharacterType(printed));
  return id.startsWith(TITLED) && printed.name === id.slice(TITLED.length);
}

/** ModifyHeld: a modifier held by the class, not by the cards in it now. `sourceTitle` is the title of the card the effect is read from. */
export function modifyHeld(state: ScenarioState, instruction: Extract<Instruction, { verb: "ModifyHeld" }>, focus: Focus, ctx: ReduceContext): ScenarioState {
  const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  if (!source || instruction.amount === 0) return state;
  const holder = instruction.holders === "exhaustedCharacters" ? EXHAUSTED : `${TITLED}${printedOf(ctx.cards, source.code).name}`;
  return { ...state, modifiers: [...state.modifiers, { instanceId: holder, sourceId: source.id, stat: instruction.stat, amount: instruction.amount, until: instruction.until }] };
}
