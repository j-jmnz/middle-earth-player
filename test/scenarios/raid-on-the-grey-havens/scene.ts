import { EFFECTS } from "../../../src/effects/index.ts";
import type { Effect } from "../../../src/catalog/boundary.ts";
import { campaignScenario, scenarioDefinition, type CampaignData, type ScenarioData } from "../../../src/catalog/scenario-data.ts";
import { syncConstants } from "../../../src/rules/interpret/constants.ts";
import { definePrinted, type PrintedCard } from "../../../src/rules/core/printed.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";
import { blankScenario, updateCard, withThreat } from "../../../src/rules/core/state.ts";
import { attachTo, spawn } from "../../../src/rules/core/zones.ts";
import { legalIntents, legalTargets } from "../../../src/rules/engine/legal.ts";
import { pushCardEffects } from "../../../src/rules/interpret/effect-frames.ts";
import type { EngineStep } from "../../../src/rules/core/intents.ts";
import { settle } from "../../../src/rules/engine/machine.ts";

import { loadCampaign, loadScenario, gameCodes } from "../../../scripts/data/load-scenarios.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { send, start, type Run } from "../a-shadow-of-the-past/scene.ts";
import { causeProblems } from "../../harness/cause-check.ts";

// Shared scene for the Raid on the Grey Havens effect tests (Dream-chaser part 3, campaign card 11182). Test-only. The heroes are plain numbers (no player card text), so what a test shows comes from
// the scenario's records and the engine. The cards are the campaign's (the Campaign Expansion's Calphon), as a campaign game deals them.
export const raid: ScenarioData = loadScenario("raid-on-the-grey-havens");
export const campaign: CampaignData = loadCampaign("dream-chaser");
export const dealt: ScenarioData = campaignScenario(raid);

export const STAGES = ["11036", "11037"] as const;
export const CODES = {
  campaignCard: "11182",
  assault: "11036",
  advance: "11037",
  burn: "11038",
  dreamChaser: "11039",
  arsonist: "11040",
  harbor: "11042",
  piers: "11043",
  pillaged: "11044",
  whiteShip: "11045",
  waveRunner: "11046",
  caravel: "11047",
  torch: "11048",
  fires: "11049",
  umbar: "11064",
  infiltrator: "11065",
  raidLeader: "11066",
  hardened: "11067",
  sahir: "11076",
  sahirAlly: "11077",
  naasiyah: "11078",
  naasiyahAlly: "11079",
  spyglass: "11180",
  blackKey: "11183",
  counselLeadership: "11184",
  counselTactics: "11185",
  counselSpirit: "11186",
  counselLore: "11187",
  graxar: "11188",
  ravager: "11041",
  cutlass: "11189",
  axe: "11190",
  calphon: "110013",
  calphonOriginal: "11028",
  ominousFate: "11176",
  hardMode: "11217",
} as const;
export const AFLAME = [CODES.dreamChaser, CODES.piers, CODES.pillaged, CODES.whiteShip, CODES.waveRunner, CODES.caravel] as const;
export const HERO = "dh1";
export const HERO2 = "dh2";
export const HERO3 = "dh3";

// The filler event has an Action that does nothing, so it can be played: an event with no record at all cannot (rr.triggered-ability).
const SCENE_EFFECTS: readonly Effect[] = [...EFFECTS, { id: "filler:action:1", cardCode: "filler", lines: ["filler:A:1"], timing: "action", instructions: [] }];

export type RaidWorld = { definition: ReturnType<typeof scenarioDefinition>; cards: Map<string, PrintedCard> };

export async function loadRaidWorld(): Promise<RaidWorld> {
  const definition = scenarioDefinition(dealt, campaign, EFFECTS);
  const codes = [...new Set([...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...gameCodes(campaign, raid), CODES.ominousFate, CODES.hardMode, CODES.sahirAlly, CODES.naasiyahAlly])];
  const cards = new Map(await loadPrinted(codes));
  const enemy = (code: string, stats: Partial<Parameters<typeof definePrinted>[0]>): PrintedCard => definePrinted({ code, name: code, type: "enemy", engagementCost: 50, ...stats });
  cards.set("f0", enemy("f0", { threat: 0, attack: 1, defense: 1, health: 3 }));
  cards.set("f3", enemy("f3", { threat: 3, attack: 1, defense: 1, health: 3 }));
  cards.set("mild", enemy("mild", { threat: 1, engagementCost: 10, attack: 3, defense: 1, health: 20 }));
  cards.set("corsair", enemy("corsair", { traits: ["Corsair"], threat: 1, engagementCost: 50, attack: 1, defense: 1, health: 3 }));
  cards.set("corsair2", enemy("corsair2", { traits: ["Corsair"], threat: 2, engagementCost: 50, attack: 1, defense: 1, health: 3 }));
  cards.set("ship", enemy("ship", { traits: ["Corsair", "Ship"], threat: 2, engagementCost: 50, attack: 1, defense: 1, health: 3 }));
  cards.set("raider", enemy("raider", { traits: ["Corsair", "Raider"], threat: 1, engagementCost: 10, attack: 2, defense: 1, health: 3 }));
  cards.set("place", definePrinted({ code: "place", name: "place", type: "location", threat: 2, questPoints: 2 }));
  cards.set("treachery", definePrinted({ code: "treachery", name: "treachery", type: "treachery" }));
  for (const code of [HERO, HERO2, HERO3]) cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", threat: 8, willpower: 2, attack: 2, defense: 2, health: 6 }));
  cards.set("filler", definePrinted({ code: "filler", name: "filler", type: "event", sphere: "neutral", cost: 0 }));
  cards.set("event", definePrinted({ code: "event", name: "event", type: "event", sphere: "neutral", cost: 1 }));
  for (const cost of [0, 1, 2, 3]) cards.set(`c${cost}`, definePrinted({ code: `c${cost}`, name: `c${cost}`, type: "event", sphere: "neutral", cost }));
  cards.set("ally", definePrinted({ code: "ally", name: "ally", type: "ally", sphere: "neutral", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2 }));
  return { definition, cards };
}

/** A card of the staging area or another zone: a code, or a code with its tokens. */
export type Entry = string | { code: string; damage?: number; resources?: number; progress?: number };
const entry = (item: Entry): { code: string; damage: number; resources: number; progress: number } => (typeof item === "string" ? { code: item, damage: 0, resources: 0, progress: 0 } : { code: item.code, damage: item.damage ?? 0, resources: item.resources ?? 0, progress: item.progress ?? 0 });

export type RaidLayout = {
  seats?: 1 | 2;
  seed?: number;
  stage?: (typeof STAGES)[number];
  progress?: number;
  // The encounter deck (top first), its discard pile, the staging area (the Burn and the Dream-chaser first, unless `bare`), the cards set aside, the victory display.
  deck?: readonly string[];
  discard?: readonly string[];
  staging?: readonly Entry[];
  bare?: boolean;
  setAside?: readonly string[];
  victory?: readonly string[];
  // The cards facedown underneath The Havens Burn.
  under?: readonly string[];
  engaged?: readonly (Entry | { code: string; seat: number; damage?: number; resources?: number })[];
  active?: Entry;
  hand?: readonly string[];
  // The Galdor's Counsel the players chose at the campaign Setup, by seat (ScenarioState.chosenAtSetup), wherever the copies are now.
  chosen?: readonly (readonly [string, number])[];
  deckOf?: readonly string[];
  play?: readonly string[];
  phase?: "Quest" | "Encounter" | "Combat" | "Travel" | "Refresh" | "Planning" | "PlayerAttacks";
  threat?: readonly [number, number];
  // Calphon is in play under the first player, with Spyglass and Black Key attached.
  calphon?: boolean;
  campaign?: boolean;
  mode?: "A" | "B";
  // Damage on the first card of each code: [code, damage].
  damage?: readonly (readonly [string, number])[];
};

export type RaidTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null; calphon: string | null; burn: string | null };

export function raidTable(world: RaidWorld, layout: RaidLayout = {}): RaidTable {
  const seats = layout.seats ?? 1;
  const stage = layout.stage ?? "11036";
  const ctx: ReduceContext = { effects: SCENE_EFFECTS, cards: world.cards };
  let state = blankScenario({ seatCount: seats, seed: layout.seed ?? 3, definition: world.definition });
  const at = STAGES.indexOf(stage);
  for (const code of STAGES) {
    const index = STAGES.indexOf(code);
    const placed = index === at ? { zone: "questStage" as const } : index > at ? { zone: "questDeck" as const } : { zone: "setAside" as const };
    const spawned = spawn(state, code, placed, placed.zone === "questStage" ? "B" : "A");
    state = code === stage ? updateCard(spawned.state, spawned.id, { progress: layout.progress ?? 0 }) : spawned.state;
  }
  const first = spawn(state, HERO, { zone: "heroes", seat: 0 });
  const secondHero = spawn(first.state, HERO2, { zone: "heroes", seat: 0 });
  state = secondHero.state;
  let seat1Hero: string | null = null;
  if (seats === 2) {
    const other = spawn(state, HERO3, { zone: "heroes", seat: 1 });
    state = other.state;
    seat1Hero = other.id;
  }
  for (let seat = 0; seat < seats; seat += 1) state = withThreat(state, seat, layout.threat?.[seat] ?? 28);
  for (let seat = 0; seat < seats; seat += 1) {
    for (const code of layout.hand ?? []) state = spawn(state, code, { zone: "hand", seat }).state;
    for (const code of layout.deckOf ?? []) state = spawn(state, code, { zone: "deck", seat }, "down").state;
  }
  for (const code of layout.play ?? []) state = spawn(state, code, { zone: "play", seat: 0 }).state;
  for (const code of layout.deck ?? []) state = spawn(state, code, { zone: "encounterDeck" }, "down").state;
  for (const code of layout.discard ?? []) state = spawn(state, code, { zone: "encounterDiscard" }).state;
  let burn: string | null = null;
  if (!layout.bare) {
    const placed = spawn(state, CODES.burn, { zone: "staging" });
    burn = placed.id;
    state = spawn(placed.state, CODES.dreamChaser, { zone: "staging" }).state;
  }
  for (const item of layout.staging ?? []) {
    const row = entry(item);
    const spawned = spawn(state, row.code, { zone: "staging" });
    state = updateCard(spawned.state, spawned.id, { progress: row.progress, damage: row.damage, resources: row.resources });
  }
  for (const code of layout.setAside ?? []) state = spawn(state, code, { zone: "setAside" }, "up").state;
  for (const row of layout.engaged ?? []) {
    const item = typeof row === "string" ? { code: row, seat: 0 } : row;
    const tokens = entry(item);
    const spawned = spawn(state, tokens.code, { zone: "engaged", seat: "seat" in item ? item.seat : 0 });
    state = updateCard(spawned.state, spawned.id, { damage: tokens.damage, resources: tokens.resources });
  }
  if (layout.active) {
    const row = entry(layout.active);
    const spawned = spawn(state, row.code, { zone: "activeLocation" });
    state = updateCard(spawned.state, spawned.id, { progress: row.progress, damage: row.damage });
  }
  for (const code of layout.victory ?? []) state = spawn(state, code, { zone: "victory" }).state;
  const host = burn ?? Object.values(state.cards).find((card) => card.code === CODES.burn)?.id;
  for (const code of layout.under ?? []) if (host) state = spawn(state, code, { zone: "under", locationId: host }, "down").state;
  let calphon: string | null = null;
  if (layout.calphon) {
    const spawned = spawn(state, CODES.calphon, { zone: "play", seat: 0 }, "up");
    state = spawned.state;
    calphon = spawned.id;
    for (const code of [CODES.spyglass, CODES.blackKey]) {
      const attached = spawn(state, code, { zone: "play", seat: 0 }, "up");
      state = attachTo(attached.state, attached.id, spawned.id);
    }
  }
  for (const [code, damage] of layout.damage ?? []) {
    const id = Object.values(state.cards).find((card) => card.code === code)?.id;
    if (id) state = updateCard(state, id, { damage });
  }
  if (layout.chosen) state = { ...state, chosenAtSetup: layout.chosen.map(([code, seat]) => ({ code, seat })) };
  if (layout.campaign) state = spawn(state, CODES.campaignCard, { zone: "campaign" }).state;
  if (layout.mode) state = spawn(state, CODES.hardMode, { zone: "modeCard" }, layout.mode).state;
  const asked = layout.phase ?? "Quest";
  const phase = asked === "PlayerAttacks" ? "Combat" : asked;
  const mode = asked === "PlayerAttacks" ? "playerAttacks" : phase === "Quest" ? "questCommit" : phase === "Encounter" ? "optionalEngage" : phase === "Travel" ? "travel" : phase === "Planning" ? "planning" : phase === "Refresh" ? "refresh" : "combatActions";
  const window = asked === "PlayerAttacks" ? { kind: "playerAttack" as const } : phase === "Encounter" ? { kind: "optionalEngage" as const } : phase === "Travel" ? { kind: "travel" as const } : phase === "Refresh" ? null : { kind: "pass" as const };
  state = { ...state, phase, boundaryPhase: phase, mode, window, activeSeat: 0 };
  return { state: syncConstants(state, ctx), ctx, hero: first.id, hero2: secondHero.id, seat1Hero, calphon, burn };
}

export { send, start };
export type { Run, PlayerIntent };

/** The first card of a code. */
export function idOf(state: ScenarioState, code: string): string {
  const found = Object.values(state.cards).find((card) => card.code === code);
  if (!found) throw new Error(`no card ${code}`);
  return found.id;
}

/** The ids of the cards of a code, in id order. */
export function idsOf(state: ScenarioState, code: string): string[] {
  return Object.values(state.cards).filter((card) => card.code === code).map((card) => card.id);
}

/** The codes of the cards in a zone, sorted. */
export function codesIn(state: ScenarioState, zone: string): string[] {
  return Object.values(state.cards).filter((card) => card.zone === zone).map((card) => card.code).sort();
}

/** An answer to the choices a resolving effect opens (the first option by default). */
export function answer(run: Run, ctx: ReduceContext, pick: (state: ScenarioState) => string = (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")): Run {
  let current = run;
  for (let guard = 0; guard < 30 && current.state.window?.kind === "choose"; guard += 1) current = send(current, { type: "Choose", optionId: pick(current.state) }, ctx);
  return current;
}

/** Closes the look windows and answers the choices an effect opens, until it is done. */
export function finish(run: Run, ctx: ReduceContext, pick?: (state: ScenarioState) => string): Run {
  let current = run;
  for (let guard = 0; guard < 40; guard += 1) {
    if (current.state.window?.kind === "look") current = send(current, { type: "Pass" }, ctx);
    else if (current.state.window?.kind === "choose") current = answer(current, ctx, pick);
    else break;
  }
  return current;
}

export { legalIntents, legalTargets };

/** The card's records of this timing resolve now (a When Revealed in the quest phase, a Setup), and the look windows and choices they open are answered. `source` is the card they belong to (spawned in the staging area when absent). */
export function resolveRecords(state: ScenarioState, ctx: ReduceContext, code: string, timing: Effect["timing"], source?: string, pick?: (state: ScenarioState) => string): Run & { id: string } {
  const spawned = source ? { state, id: source } : spawn(state, code, { zone: "staging" });
  const effects = ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === timing);
  const steps: EngineStep[] = [];
  const frame = timing === "whenRevealed" ? "whenRevealed" : timing === "setup" ? "setup" : timing === "travel" ? "travel" : timing === "shadow" ? "shadow" : "forced";
  const pushed = pushCardEffects(spawned.state, frame, spawned.id, spawned.state.firstPlayer, false, effects, ctx, steps);
  // The mode stops the round where it is, so only what the records do is read.
  const run = finish({ state: settle({ ...pushed, window: null, mode: "stopped" }, ctx, steps), steps }, ctx, pick);
  if (causeProblems(run.steps).length > 0) throw new Error(`Steps without a cause: ${causeProblems(run.steps).join("; ")}`);
  return { ...run, id: spawned.id };
}

/** An enemy engaged with the first seat attacks in the combat phase with `shadow` dealt to it, the first hero defending (or nobody). The state at the end of the attack. */
export function raidFight(world: RaidWorld, shadow: string, enemy: string, layout: RaidLayout = {}, options: { undefended?: boolean; defender?: (made: RaidTable) => string; pick?: (state: ScenarioState) => string; tweak?: (state: ScenarioState, made: RaidTable) => ScenarioState } = {}): { run: Run; ctx: ReduceContext; made: RaidTable; start: ScenarioState; during: ScenarioState } {
  const made = raidTable(world, { phase: "Encounter", engaged: [{ code: enemy, seat: 0 }], deck: [shadow, "f0", "f0", "f0"], hand: ["filler", "filler"], ...layout });
  const state = syncConstants(options.tweak ? options.tweak(made.state, made) : made.state, made.ctx);
  let run: Run = send(start(state), { type: "DeclineEngage" }, made.ctx);
  for (let guard = 0; guard < 60 && run.state.window?.kind !== "defense"; guard += 1) {
    if (run.state.window?.kind === "chooseEnemy") {
      run = send(run, { type: "ChooseEnemy", enemyId: run.state.window.options[0] ?? "" }, made.ctx);
      continue;
    }
    if (run.state.window?.kind === "choose") {
      run = send(run, { type: "Choose", optionId: options.pick?.(run.state) ?? run.state.window.options[0] ?? "" }, made.ctx);
      continue;
    }
    const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, made.ctx);
  }
  if (run.state.window?.kind !== "defense") throw new Error(`no defense window: ${JSON.stringify(run.state.window)}`);
  const defender = options.defender ? options.defender(made) : made.hero;
  let during = run.state;
  run = send(run, options.undefended ? { type: "Undefended", heroId: defender } : { type: "DeclareDefender", defenderId: defender }, made.ctx);
  for (let guard = 0; guard < 40 && (run.state.pendingAttack != null || run.state.window?.kind === "choose" || run.state.window?.kind === "look" || run.state.window?.kind === "defense"); guard += 1) {
    const window = run.state.window;
    if (window?.kind === "defense") {
      const canDefend = legalTargets(run.state, { type: "DeclareDefender" }, made.ctx).includes(defender);
      run = send(run, options.undefended || !canDefend ? { type: "Undefended", heroId: defender } : { type: "DeclareDefender", defenderId: defender }, made.ctx);
      continue;
    }
    if (window?.kind === "choose") {
      run = send(run, { type: "Choose", optionId: options.pick?.(run.state) ?? window.options[0] ?? "" }, made.ctx);
      continue;
    }
    if (window?.kind === "look") {
      run = send(run, { type: "Pass" }, made.ctx);
      continue;
    }
    const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
    if (!pass) break;
    if (run.state.pendingAttack != null) during = run.state;
    run = send(run, pass as PlayerIntent, made.ctx);
  }
  return { run, ctx: made.ctx, made, start: state, during };
}
