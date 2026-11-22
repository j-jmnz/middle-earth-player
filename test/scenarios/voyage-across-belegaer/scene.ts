import { EFFECTS } from "../../../src/effects/index.ts";
import { campaignScenario, scenarioDefinition, type CampaignData, type ScenarioData } from "../../../src/catalog/scenario-data.ts";
import { syncConstants } from "../../../src/rules/interpret/constants.ts";
import { definePrinted, type PrintedCard } from "../../../src/rules/core/printed.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";
import { blankScenario, updateCard, withThreat } from "../../../src/rules/core/state.ts";
import { attachTo, spawn } from "../../../src/rules/core/zones.ts";
import { stampRoutes } from "../../../src/rules/families/sea/routes.ts";

import { loadCampaign, loadScenario, gameCodes } from "../../../scripts/data/load-scenarios.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { causeProblems } from "../../harness/cause-check.ts";
import { addStandIns, allyCard, answer, codesIn, enemyCard, eventCard, HERO, HERO2, HERO3, opening, sceneEffects, send, start, type Run } from "../../harness/scene-kit.ts";
import { pushCardEffects } from "../../../src/rules/interpret/effect-frames.ts";
import type { EngineStep } from "../../../src/rules/core/intents.ts";
import { settle } from "../../../src/rules/engine/machine.ts";
import { legalIntents, legalTargets } from "../../../src/rules/engine/legal.ts";

// Shared scene for the Voyage Across Belegaer effect tests (Dream-chaser part 1, campaign card 11171). Test-only. The heroes are plain numbers (no player card
// text), so what a test shows comes from the scenario's records and the engine. The cards are the campaign's (the Campaign Expansion's reprints of the ships), as a
// campaign game deals them.
export const voyage: ScenarioData = loadScenario("voyage-across-belegaer");
export const campaign: CampaignData = loadCampaign("dream-chaser");
// What a campaign game deals: the reprints in place of the originals.
export const dealt: ScenarioData = campaignScenario(voyage);

export const STAGES = ["11016", "11017", "11018", "11019", "11020", "11021"] as const;
export const CAMPAIGN_CARD = "11171";
export const HEADING_CARD = "11084";
export const SHIPS = { dreamChaser: "110136", dawnStar: "110137", duskbringer: "110138", glorinaith: "110139", narelenya: "110140", silverWing: "110141" } as const;
export const SHIP_CODES: readonly string[] = Object.values(SHIPS);
export const ORIGINAL_SHIPS = ["11080", "11081", "11082", "11083"] as const;
export const SCOUTING_SHIP = "11022";
export const STARLIT_SEA = "11023";
export const FOG_BANK = "11024";
export const CALM_WATERS = "11050";
export const ROLLING_SEAS = "11051";
export const THROWN_OFF_COURSE = "11052";
export const ROUGH_WATERS = "11053";
export const WATERSPOUT = "11054";
export const SUDDEN_STORMS = "11055";
export const WINDS_OF_WRATH = "11056";
export const LIGHT_CRUISER = "11057";
export const CORSAIR_WARSHIP = "11058";
export const BOARDING_PARTY = "11059";
export const SOUTHRON_SAILOR = "11060";
export const CUNNING_PIRATE = "11061";
export const VICIOUS_MARAUDER = "11062";
export const UMBAR_CAPTAIN = "11063";
export const ARMOR_PLATING = "11172";
export const BALLISTA = "11173";
export const ENLARGED_QUARTERS = "11174";
export const EXTRA_SAILS = "11175";
export const OMINOUS_FATE = "11176";
export const THUNDERSTRUCK = "11177";
export const CROWLEY = "11178";
export const HARD_MODE = "11217";
export { HERO, HERO2, HERO3 };

const SCENE_EFFECTS = sceneEffects("odd", "even");

export type VoyageWorld = { definition: ReturnType<typeof scenarioDefinition>; cards: Map<string, PrintedCard> };

export async function loadVoyageWorld(): Promise<VoyageWorld> {
  const definition = scenarioDefinition(dealt, campaign, EFFECTS);
  const codes = [...new Set([...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...gameCodes(campaign, voyage), ...Object.values(SHIPS), ...ORIGINAL_SHIPS])];
  const cards = new Map(await loadPrinted(codes));
  addStandIns(cards, ["f0", "f3"]);
  cards.set("brute", enemyCard("brute", { threat: 1, engagementCost: 10, attack: 9, defense: 1, health: 20 }));
  // 8 Attack against a hero's 2 Defense is 6 damage: exactly the hit points of a hero with none lost.
  cards.set("bruiser", enemyCard("bruiser", { threat: 1, engagementCost: 10, attack: 8, defense: 1, health: 20 }));
  cards.set("raider", enemyCard("raider", { traits: ["Raider"], threat: 1, engagementCost: 10, attack: 2, defense: 1, health: 3 }));
  addStandIns(cards, ["heroes", "filler", "place"]);
  cards.set("odd", eventCard("odd", 1));
  cards.set("even", eventCard("even", 2));
  cards.set("ally", allyCard("ally", 2));
  cards.set("blade", definePrinted({ code: "blade", name: "blade", type: "attachment", sphere: "neutral", cost: 3 }));
  return { definition, cards };
}

export type VoyageLayout = {
  seats?: 1 | 2;
  seed?: number;
  stage?: (typeof STAGES)[number];
  progress?: number;
  // The encounter deck, the encounter discard pile, the Corsair deck and its discard pile, the staging area, the cards set aside: top first.
  deck?: readonly string[];
  discard?: readonly string[];
  corsair?: readonly string[];
  corsairDiscard?: readonly string[];
  staging?: readonly string[];
  setAside?: readonly string[];
  engaged?: readonly { code: string; seat: number }[];
  active?: string;
  heading?: "Sun" | "Cloud" | "Rain" | "Storm";
  // The ships each seat controls, in order (their codes), and the Modification boons attached to the first of them.
  ships?: readonly { code: string; seat: number; face?: "up" | "B" }[];
  fitted?: readonly string[];
  // Which ship (by position in `ships`) the Modification boons go on; the first by default.
  fittedShip?: number;
  // The side the fitted boons show.
  fittedFace?: "up" | "B";
  hand?: readonly string[];
  deckOf?: readonly string[];
  victory?: readonly string[];
  phase?: "Quest" | "Encounter" | "Combat" | "Travel" | "Refresh" | "Planning";
  threat?: readonly [number, number];
  // The Hard/Expert Mode card in play (zone modeCard) on this side.
  mode?: "A" | "B";
  // The campaign card is in the game (Campaign Mode).
  campaign?: boolean;
  resources?: number;
  // Damage on the first card of each code: [code, damage]; the ships are exhausted; player attachments (cards of type attachment) on the first hero.
  damage?: readonly (readonly [string, number])[];
  exhaustedShips?: boolean;
  attachments?: readonly string[];
  // The records that name these ledger lines are left out of the table's effects (a test run again without the records of its line).
  without?: readonly string[];
};

export type VoyageTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null; ships: string[]; heading: string | null };

export function voyageTable(world: VoyageWorld, layout: VoyageLayout = {}): VoyageTable {
  const seats = layout.seats ?? 1;
  const stage = layout.stage ?? "11016";
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
  state = withThreat(state, 0, layout.threat?.[0] ?? 28);
  if (seats === 2) state = withThreat(state, 1, layout.threat?.[1] ?? 26);
  for (let seat = 0; seat < seats; seat += 1) {
    for (const code of layout.hand ?? []) state = spawn(state, code, { zone: "hand", seat }).state;
    for (const code of layout.deckOf ?? []) state = spawn(state, code, { zone: "deck", seat }, "down").state;
  }
  for (const code of layout.deck ?? []) state = spawn(state, code, { zone: "encounterDeck" }, "down").state;
  for (const code of layout.discard ?? []) state = spawn(state, code, { zone: "encounterDiscard" }).state;
  if (layout.corsair || layout.corsairDiscard) {
    state = { ...state, corsairDeck: [], corsairDiscard: [] };
    for (const code of layout.corsair ?? []) state = spawn(state, code, { zone: "corsairDeck" }, "down").state;
    for (const code of layout.corsairDiscard ?? []) state = spawn(state, code, { zone: "corsairDiscard" }).state;
  }
  for (const code of layout.staging ?? []) state = spawn(state, code, { zone: "staging" }).state;
  for (const code of layout.setAside ?? []) state = spawn(state, code, { zone: "setAside" }).state;
  for (const row of layout.engaged ?? []) state = spawn(state, row.code, { zone: "engaged", seat: row.seat }).state;
  if (layout.active) state = spawn(state, layout.active, { zone: "activeLocation" }).state;
  for (const code of layout.victory ?? []) state = spawn(state, code, { zone: "victory" }).state;
  const ships: string[] = [];
  for (const row of layout.ships ?? []) {
    const spawned = spawn(state, row.code, { zone: "play", seat: row.seat }, row.face ?? "up");
    state = spawned.state;
    ships.push(spawned.id);
  }
  if (layout.exhaustedShips) for (const id of ships) state = updateCard(state, id, { exhausted: true });
  // The Modification boons are attached to the first ship (or the one `fittedShip` names).
  for (const code of layout.fitted ?? []) {
    const host = ships[layout.fittedShip ?? 0];
    const card = spawn(state, code, { zone: "play", seat: layout.ships?.[layout.fittedShip ?? 0]?.seat ?? 0 }, layout.fittedFace ?? "up");
    state = host ? attachTo(card.state, card.id, host) : card.state;
  }
  state = stampRoutes(state, world.cards);
  let headingCard: string | null = null;
  if (layout.heading) {
    const spawned = spawn(state, HEADING_CARD, { zone: "play", seat: 0 });
    state = ships[0] ? attachTo(spawned.state, spawned.id, ships[0]) : spawned.state;
    headingCard = spawned.id;
    state = { ...state, sea: { routes: {}, ...state.sea, heading: layout.heading, headingCard } };
  }
  for (const code of layout.attachments ?? []) {
    const card = spawn(state, code, { zone: "play", seat: 0 });
    state = attachTo(card.state, card.id, first.id);
  }
  for (const [code, damage] of layout.damage ?? []) {
    const id = Object.values(state.cards).find((card) => card.code === code)?.id;
    if (id) state = updateCard(state, id, { damage });
  }
  if (layout.resources != null) state = updateCard(state, first.id, { resources: layout.resources });
  if (layout.campaign) state = spawn(state, CAMPAIGN_CARD, { zone: "campaign" }).state;
  if (layout.mode) state = spawn(state, HARD_MODE, { zone: "modeCard" }, layout.mode).state;
  state = { ...state, ...opening(layout.phase ?? "Quest") };
  const without = layout.without ?? [];
  const ctx = { effects: without.length === 0 ? SCENE_EFFECTS : SCENE_EFFECTS.filter((effect) => !effect.lines.some((line) => without.includes(line))), cards: world.cards };
  return { state: syncConstants(state, ctx), ctx, hero: first.id, hero2: secondHero.id, seat1Hero, ships, heading: headingCard };
}

export { send, start, codesIn };
export type { Run, PlayerIntent };

// The first card of a code is resolved or used in a test: this answers the choices the effect opens (the first option by default).
export const settleChoices = answer;

// The card's When Revealed records resolve now, in the quest phase (the way a reveal resolves them), and the choices they open are answered.
export function resolveReveal(state: ScenarioState, ctx: ReduceContext, code: string, pick?: (state: ScenarioState) => string): Run & { id: string } {
  const spawned = spawn(state, code, { zone: "staging" });
  const effects = ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === "whenRevealed");
  const steps: EngineStep[] = [];
  const pushed = pushCardEffects(spawned.state, "whenRevealed", spawned.id, spawned.state.firstPlayer, false, effects, ctx, steps);
  const run = settleChoices({ state: settle({ ...pushed, window: null }, ctx, steps), steps }, ctx, pick);
  if (causeProblems(run.steps).length > 0) throw new Error(`Steps without a cause: ${causeProblems(run.steps).join("; ")}`);
  return { ...run, id: spawned.id };
}

// An enemy engaged with the first seat attacks in the combat phase with `shadow` dealt to it. The defender declared is `defender` (the first hero by default), or nobody
// defends. A choice the shadow effect asks takes `answer` (the first option by default). The state at the end of the attack and every state from the defender's declaration on.
export function voyageFight(
  world: VoyageWorld,
  shadow: string,
  enemy: string,
  layout: VoyageLayout = {},
  options: { undefended?: boolean; defender?: (made: VoyageTable) => string; answer?: (state: ScenarioState) => PlayerIntent; tweak?: (state: ScenarioState, made: VoyageTable) => ScenarioState } = {},
): { run: Run; ctx: ReduceContext; made: VoyageTable; seen: ScenarioState[]; start: ScenarioState } {
  const made = voyageTable(world, { phase: "Encounter", heading: "Sun", ships: [{ code: SHIPS.dreamChaser, seat: 0 }], engaged: [{ code: enemy, seat: 0 }], deck: [shadow, "f0", "f0", "f0"], hand: ["filler", "filler", "filler"], ...layout });
  const state = syncConstants(options.tweak ? options.tweak(made.state, made) : made.state, made.ctx);
  let run: Run = send(start(state), { type: "DeclineEngage" }, made.ctx);
  for (let guard = 0; guard < 60 && run.state.window?.kind !== "defense"; guard += 1) {
    if (run.state.window?.kind === "chooseEnemy") {
      const cards = run.state.cards;
      const wanted = run.state.window.options.find((id) => cards[cards[id]?.shadowId ?? ""]?.code === shadow) ?? run.state.window.options[0] ?? "";
      run = send(run, { type: "ChooseEnemy", enemyId: wanted }, made.ctx);
      continue;
    }
    // A Forced effect of the attacking enemy that asks (damage to distribute) is answered with the first option.
    if (run.state.window?.kind === "choose") {
      run = send(run, options.answer?.(run.state) ?? { type: "Choose", optionId: run.state.window.options[0] ?? "" }, made.ctx);
      continue;
    }
    const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, made.ctx);
  }
  if (run.state.window?.kind !== "defense") throw new Error(`no defense window: ${JSON.stringify(run.state.window)}`);
  const defender = options.defender ? options.defender(made) : made.hero;
  run = send(run, options.undefended ? { type: "Undefended", heroId: defender } : { type: "DeclareDefender", defenderId: defender }, made.ctx);
  const seen: ScenarioState[] = [run.state];
  for (let guard = 0; guard < 30 && (run.state.pendingAttack != null || run.state.stack.length > 0); guard += 1) {
    const window = run.state.window;
    // A second attack (the attacking enemy attacks again): defended or not as the first was.
    if (window?.kind === "defense") {
      const canDefend = legalTargets(run.state, { type: "DeclareDefender" }, made.ctx).includes(defender);
      run = send(run, options.undefended || !canDefend ? { type: "Undefended", heroId: defender } : { type: "DeclareDefender", defenderId: defender }, made.ctx);
      seen.push(run.state);
      continue;
    }
    if (window?.kind === "choose") {
      run = send(run, options.answer?.(run.state) ?? { type: "Choose", optionId: window.options[0] ?? "" }, made.ctx);
      seen.push(run.state);
      continue;
    }
    const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, made.ctx);
    seen.push(run.state);
  }
  return { run, ctx: made.ctx, made, seen, start: state };
}
