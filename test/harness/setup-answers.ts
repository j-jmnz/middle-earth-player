// How many answers a scenario's Campaign Setup takes, counted from the campaign card's Setup records and not typed by hand. The checklist
// (src/campaign/checklist.ts) is run with the answers given so far and, while it asks for one more (`needs`), is given another "skip".
// A seed finder, a fixture test or a scenario's skeleton that only needs the Setup out of the way uses it in place of a literal ["skip", "skip"].
import type { World } from "../../src/campaign/world.ts";
import { checklist, type ChecklistInput } from "../../src/campaign/checklist.ts";
import type { CampaignLog } from "../../src/campaign/log.ts";

const MOST_ANSWERS = 50;

/** The answers that decline each offer of the Setup, as many as it asks: [] when it asks nothing. Throws on a Setup that fails for another reason, or never stops asking. */
export function skippedSetupAnswers(input: Omit<ChecklistInput, "choices">): string[] {
  const answers: string[] = [];
  while (answers.length <= MOST_ANSWERS) {
    const plan = checklist({ ...input, choices: answers });
    if (plan.ok) return answers;
    if (plan.needs === null) throw new Error(`The Campaign Setup of ${input.scenario.id} fails with no choice to make: ${plan.errors.join("; ")}`);
    answers.push("skip");
  }
  throw new Error(`The Campaign Setup of ${input.scenario.id} asks for more than ${MOST_ANSWERS} answers`);
}

/** The same for a world dealt to these seats on `log`: a campaign scenario's Setup. */
export function skippedSetupAnswersOf(world: Pick<World, "scenario" | "effects" | "cards">, seats: ChecklistInput["seats"], log: CampaignLog): string[] {
  const { scenario } = world;
  if (scenario.campaignCard === undefined) return [];
  return skippedSetupAnswers({ log, scenario, seats, effects: world.effects, cards: world.cards });
}

/** The number of answers the Setup takes (the length of `skippedSetupAnswersOf`). */
export const setupAnswerCount = (world: Pick<World, "scenario" | "effects" | "cards">, seats: ChecklistInput["seats"], log: CampaignLog): number => skippedSetupAnswersOf(world, seats, log).length;
