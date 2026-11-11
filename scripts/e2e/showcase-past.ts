// The README showcase's saves of A Shadow of the Past (docs/showcase.md, Saves and decks), written into src/campaign/fixtures/scenario-1.json
// by scripts/e2e/fixtures.ts beside `duo`: the same two decklists (The One Deck with the saga Frodo, and Stealth and Steadfastness), two-handed, Easy,
// played by the auto-player's answers, each parked on a moment the capture flows open (.maestro/showcase/).
//
// `past-showcase-board`: the first player's planning window in round 3 or later, on the first seed whose table is full (heroes and allies in play with
// attachments, an enemy engaged, an active location, cards in staging). `past-showcase-quest`: the quest commit of a round from 3 on, with staging
// holding cards, so a commit reveals into a busy row. `past-showcase-combat`: an enemy's attack waiting for a defender, from round 2 on.
// Each holds `showcase`, what the flow taps: the characters the auto-player commits, or the defender with the most Defense that is not the Ring-bearer.
import type { StoredLoadout } from "../../src/campaign/save.ts";
import { legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import { nextIntent } from "../../test/harness/auto-player.ts";
import { loadCampaign } from "../data/load-scenarios.ts";
import { createLog } from "../log.ts";
import { boardHolds, playSeed, prebuiltDeck, type SeedSpec } from "./seed-kit.ts";

const say = createLog("e2e-showcase-past");
const FRODO = "141001";
const SEEDS = 40;

export type ShowcaseTap = { commit?: string[]; defender?: string };
export type PastShowcase = { seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; showcase: ShowcaseTap };
export type PastShowcaseName = "past-showcase-board" | "past-showcase-quest" | "past-showcase-combat";

function loadout(): StoredLoadout {
  const stealth = loadCampaign().starterDecks.find((entry) => entry.id === "stealth-and-steadfastness");
  if (!stealth) throw new Error("No starter deck stealth-and-steadfastness");
  const one = prebuiltDeck("the-one-deck");
  return {
    scenarioId: "a-shadow-of-the-past",
    difficulty: "Easy",
    seats: [
      { deckId: "the-one-deck", heroes: one.heroes, deck: one.deck },
      {
        deckId: "stealth-and-steadfastness",
        heroes: stealth.rows.filter((row) => row.type === "hero").map((row) => row.code),
        deck: stealth.rows.filter((row) => row.type !== "hero").flatMap((row) => Array.from({ length: row.count }, () => row.code)),
      },
    ],
    ringBearer: FRODO,
    choices: [],
    acceptPenalty: false,
  };
}

const answer = (state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent => nextIntent(state, ctx, { scout: "", prefer: "141035", protect: FRODO, play: true, act: true }, memory);

const FULL = { play: 8, attached: 4, engaged: 1, staging: 2, location: true } as const;
const atBoard = (state: ScenarioState) => state.round >= 3 && state.mode === "planning" && state.activeSeat === 0 && boardHolds(state, FULL);
const atQuest = (state: ScenarioState) => state.round >= 3 && state.mode === "questCommit" && state.window?.kind === "pass" && boardHolds(state, { play: 8, staging: 2 });
const atCombat = (state: ScenarioState) => state.round >= 2 && state.window?.kind === "defense" && boardHolds(state, { play: 8, staging: 1 });

// The first seed whose game reaches `at`, parked there, with what the flow taps on it.
function find(at: (state: ScenarioState) => boolean, tap: (state: ScenarioState, ctx: ReduceContext) => ShowcaseTap, label: string): PastShowcase | null {
  const base = loadout();
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    let seen: ReduceContext | null = null;
    const spec: SeedSpec<2> = {
      campaignId: "fellowship-of-the-ring",
      scenarioId: base.scenarioId,
      seatCount: 2,
      loadout: base,
      codes: [FRODO],
      limit: 1500,
      answer: (state, ctx, memory) => {
        seen = ctx;
        return answer(state, ctx, memory);
      },
      stop: at,
    };
    const game = playSeed(spec, seed);
    if (!seen || !at(game.state)) continue;
    say.info(`${label}: seed ${seed}, ${game.intents.length} intents, round ${game.state.round}`);
    return { seatCount: 2, loadout: base, seed, intents: game.intents, showcase: tap(game.state, seen) };
  }
  say.warn(`no ${label} game found in ${SEEDS} seeds`);
  return null;
}

// The characters the auto-player commits on this quest.
function commitTap(state: ScenarioState, ctx: ReduceContext): ShowcaseTap {
  const intent = answer(state, ctx, new Set());
  return intent.type === "Commit" ? { commit: [...intent.cardIds] } : {};
}

// The defender with the most Defense, never the Ring-bearer (his hit points hold The One Ring).
function defenderTap(state: ScenarioState, ctx: ReduceContext): ShowcaseTap {
  const defense = (id: string) => ctx.cards.get(state.cards[id]?.code ?? "")?.defense ?? 0;
  const defenders = legalTargets(state, { type: "DeclareDefender" }, ctx).filter((id) => state.cards[id]?.code !== FRODO);
  const best = [...defenders].sort((left, right) => defense(right) - defense(left))[0];
  return best ? { defender: best } : {};
}

export function pastShowcase(): Partial<Record<PastShowcaseName, PastShowcase>> {
  const board = find(atBoard, () => ({}), "past-showcase-board");
  const quest = find(atQuest, commitTap, "past-showcase-quest");
  const combat = find(atCombat, defenderTap, "past-showcase-combat");
  return {
    ...(board ? { "past-showcase-board": board } : {}),
    ...(quest ? { "past-showcase-quest": quest } : {}),
    ...(combat ? { "past-showcase-combat": combat } : {}),
  };
}
