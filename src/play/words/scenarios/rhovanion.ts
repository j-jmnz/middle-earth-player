// Rules: rr.objective-cards, rr.guarded, rr.first-player, rr.engaged (data/rules/entries.json); ledger lines 12184:A:2, 12184:B:1, 19036:A:1, 19040:A:1, 19042:A:2, 19044:A:1, 19045:A:1, 19046:A:1.
// Roam Across Rhovanion's choices on the live sheet (docs/design-system-table.md, Choice tray): each says the number, the side of the table and the player. One player's choice leads with "Player N:" two-handed (`owned`, so the sheet adds no "Player N chooses."),
// solo it has no lead; the rows state what they do now and what an irreversible choice costs. Pure.
import type { Instruction } from "../../../catalog/boundary.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import { inPlay, type ScenarioState } from "../../../rules/core/state.ts";
import type { ReduceContext } from "../../../rules/interpret/interpret.ts";

import type { ChoiceNames, PickWords } from "../choice.ts";
import { coldPlace } from "./heath.ts";
import { seatSays } from "../seat.ts";

type Choose = Extract<Instruction, { verb: "Choose" }>;
type Facts = { game: ScenarioState; ctx: ReduceContext; options: readonly string[] };
const BEAR = "19040";
const CAMPAIGN_CARD = "12184";
const TRUST_REWARD = "12186";
type Kind = "trust" | "bear" | "ravine" | "weather";

// Which of the scenario's choices a Choose is, from the instructions of its options; null for another Choose.
function kindOf(choose: Choose): Kind | null {
  const [first, second] = choose.options;
  if (choose.options.length !== 2 || !first || !second) return null;
  if (first.id === "trust" && second.id === "burden" && first.instructions[0]?.verb === "Pick" && second.instructions[0]?.verb === "ShuffleIntoEncounterDeck") return "trust";
  if (first.id === "attack" && second.id === "discard" && first.instructions[0]?.verb === "AttackFromStaging" && second.instructions[0]?.verb === "DiscardRandomFromHand") return "bear";
  if (first.id === "exhaust" && second.id === "threat" && second.instructions[0]?.verb === "RaiseThreat") {
    if (first.instructions[0]?.verb === "Pick" && second.instructions[0].who === "eachSeat") return "ravine";
    if (first.instructions[0]?.verb === "Exhaust" && second.instructions[0].who === "actor") return "weather";
  }
  return null;
}

// Urdug in play, on either side, and the resources on him now.
function urdugResources(game: ScenarioState, ctx: ReduceContext): number | null {
  const urdug = Object.values(game.cards).find((card) => inPlay(card.zone) && printedOf(ctx.cards, card.code).name === "Urdug");
  return urdug ? urdug.resources : null;
}

// The Bear's name; a table that has not dealt the card yet cannot name it, and the sentence says "The Bear".
const bearName = (names: ChoiceNames): string => {
  const name = names.code(BEAR);
  return name === BEAR ? "The Bear" : name;
};

const burdenOf = (choose: Choose): string => {
  const step = choose.options[1]?.instructions[0];
  return step?.verb === "ShuffleIntoEncounterDeck" ? step.code : "";
};

const amountOf = (choose: Choose, id: string): number => {
  const step = choose.options.find((option) => option.id === id)?.instructions[0];
  return step?.verb === "RaiseThreat" && typeof step.amount === "number" ? step.amount : 1;
};

/** The sentence over a Choose of Roam Across Rhovanion: the trust in Urdug (12184:A:2, 12184:B:1), Wilderland Bear (19040:A:1), Deep Ravine's Travel (19042:A:2), Harsh Weather's question about one ready character (19045:A:1). Null for any other Choose. */
export function rhovanionChooseNote(choose: Choose, game: ScenarioState, ctx: ReduceContext, names: ChoiceNames, claimed?: string | null): string | null {
  const kind = kindOf(choose);
  if (!kind) return null;
  const { say } = seatSays(game);
  if (kind === "trust") {
    const now = urdugResources(game, ctx);
    const cunning = names.code(burdenOf(choose));
    // After a claim (12184:B:1) the question leads with the claim; the Setup's (12184:A:2) does not.
    const lead = claimed ? `you claimed ${names.card(claimed)}. Put your trust in Urdug?` : "put your trust in Urdug?";
    const count = now != null ? ` He has ${now}; trust makes it ${now + 1}.` : "";
    return say(`${lead}${count} If you don't, a copy of ${cunning} is shuffled into the encounter deck. At the Resolution, with 3 or more resources on him each player adds ${names.code(TRUST_REWARD)} to the campaign pool and their deck. With fewer, each player adds ${cunning}.`);
  }
  if (kind === "bear") return say(`${bearName(names)} attacks you, or each player discards 1 card at random from their hand?`);
  if (kind === "ravine") {
    const amount = amountOf(choose, "threat");
    const spent = Object.values(game.cards).some((card) => inPlay(card.zone) && card.exhausted && printedOf(ctx.cards, card.code).name === "Urdug");
    return say(spent ? `Urdug is exhausted: travelling to Deep Ravine raises each player's threat by ${amount}.` : `to travel to Deep Ravine, exhaust Urdug, or raise each player's threat by ${amount}?`);
  }
  const place = coldPlace(game);
  return say(`exhaust ${place.id ? names.card(place.id) : "this character"}, or raise your threat by ${amountOf(choose, "threat")}? (${place.at} of ${place.of})`);
}

/** The row of an option of that Choose, or null for another. */
export function rhovanionBranchWords(choose: Choose, optionId: string, names: ChoiceNames, game?: ScenarioState): string | null {
  const kind = kindOf(choose);
  if (!kind) return null;
  if (kind === "trust") {
    return optionId === "trust" ? "Put a resource on Urdug: +1 Willpower, Threat, Attack and Defense" : `Decline: shuffle a copy of ${names.code(burdenOf(choose))} into the encounter deck`;
  }
  if (kind === "bear") return optionId === "attack" ? `${bearName(names)} makes an immediate attack against you` : "Each player discards 1 card at random from their hand";
  if (kind === "ravine") return optionId === "exhaust" ? "Exhaust Urdug" : `Raise each player's threat by ${amountOf(choose, "threat")}`;
  const who = (game && coldPlace(game).id) || null;
  const name = who ? names.card(who) : "it";
  return optionId === "exhaust" ? `Exhaust ${name}` : `Raise your threat by ${amountOf(choose, "threat")}`;
}

/** The sentence a pick of Roam Across Rhovanion asks (19036:A:1, 19044:A:1, 19046:A:1), or null for another. */
export function rhovanionAsk(instruction: Instruction, source: string | null, names: ChoiceNames, next: Instruction | undefined, facts: Facts | undefined): PickWords | null {
  const game = facts?.game;
  if (instruction.verb !== "Pick") return null;
  const says = game ? seatSays(game) : null;
  const ask = (verb: string, text: string): PickWords => (says ? { verb, prompt: says.say(text), ...says.owned } : { verb, prompt: `${text.charAt(0).toUpperCase()}${text.slice(1)}` });
  const pick = instruction.pick;
  const code = source ? (game?.cards[source]?.code ?? source) : undefined;
  // Sneaking Off (19044:A:1): the first player chooses the location in the staging area that comes to guard Urdug.
  if (code === "19044" && pick.type === "location" && pick.stagingOnly === true) return ask("Guard", "choose a location in the staging area. Urdug is attached to it as a guarded objective. You lose control of him until it leaves play, and Sneaking Off is removed from the game.");
  // Wild Creatures (19046:A:1): each player in turn engages an enemy from the staging area.
  if (code === "19046" && pick.type === "enemy" && pick.stagingOnly === true && next?.verb === "Engage") return ask("Engage", "choose an enemy in the staging area to engage. If any player has none to engage, cards are discarded from the encounter deck until a Creature enemy is, and it joins the staging area.");
  // Durin's Key (19036:A:1): the first player attaches it to a hero they control.
  if (code === "19036" && pick.type === "hero" && next?.verb === "ClaimObjective") return ask("Attach", `attach ${source ? names.card(source) : "this objective"} to one of your heroes. It is free of encounters, so you claim it${game && Object.values(game.cards).some((card) => card.code === CAMPAIGN_CARD) ? "; you are asked about trust in Urdug next" : ""}.`);
  // Deep Ravine (19042:A:2): the ready Urdug exhausted to travel here.
  if (code === "19042" && pick.names?.length === 1 && pick.names[0] === "Urdug" && next?.verb === "Exhaust") return { verb: "Exhaust", prompt: "Urdug is exhausted to travel to Deep Ravine." };
  return null;
}
