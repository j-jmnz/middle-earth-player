// Rules: mec109.multiple-staging-areas, mec109.saga-staging-rules (data/rules/entries.json); stage 2B and the stage 3 cards of Breaking of the
// Fellowship (142062:B:1, 142063:A:1 to 142066:A:1).
//
// Separate staging. From stage 2B each seat has a staging area and a quest stage of its own:
//
// - `Seat.staging` lists the encounter cards in that seat's area; `Seat.stage` is its quest stage (the stage 3 and 4 cards). `ScenarioState.separate`
//   is true from then on. Every card in an area is still in the zone `staging`, and `ScenarioState.staging` still lists every staging card in any
//   area plus the cards in no area yet (the shared staging area stage 2B empties), so the code that does not care which area reads it unchanged.
//   `ScenarioState.questStage`, the shared stage, is null while stages are separate, except a stage no player is at (Fog on the Barrow-downs' parked 3B, `parkedStage`), which stays in it.
// - Each seat has an active location of its own at its stage (`Seat.active`, the card in the zone activeLocation): the quest only applies to a player's own stage
//   (mec109.multiple-staging-areas), and the active location takes that quest's progress first (rr.active-location). `ScenarioState.activeLocation` and
//   `secondActiveLocation` mirror seat 0's and seat 1's active location, so code that reads them outside a seat's view still sees them; in a seat's view
//   `activeLocation` is that seat's and `secondActiveLocation` is null.
// - A game that never separates has no `separate`, empty seat lists and no `Seat.stage`, so each function here returns what the shared state holds.
// - Fog on the Barrow-downs separates only some of its players (families/breaking/barrow.ts): `ScenarioState.isolated` makes each area resolve alone (`isolatedAreas`), and a stage no player is at is parked in `ScenarioState.questStage` (`parkedStage`).
// - The engine asks per seat through `viewOf`: the state as that seat sees it, with `staging` its own area and `questStage` its own stage, so
//   the threat total, the engagement checks, the travel and pick helpers and the quest's progress and advance read the seat's staging area and stage
//   without knowing about seats. `mergeView` writes what a view changed back. Nothing is cached on the view.
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { livingSeats, updateCard, withSeat } from "../../core/state.ts";
import type { Destination } from "../../core/zones.ts";
import { moveCard } from "../../core/zones.ts";

export function isSeparate(state: ScenarioState): boolean {
  return state.separate === true;
}

// Whether each area resolves as if only its players were in the game ("each player", "the first player", "in play" and a player card's Doomed read the area, mec108.create-staging-area): Escape from Mount Gram's areas always are (it has captured decks, `capture`),
// and Fog on the Barrow-downs' once a player is trapped (`isolated`). Breaking of the Fellowship's areas are not.
export function isolatedAreas(state: ScenarioState): boolean {
  return state.separate === true && (state.capture != null || state.isolated === true);
}

// The seat whose area and stage the seat has: itself, or the player it joined (mec108.joining-another-player, families/captured/join.ts). A game that never joins returns the seat.
export function headOf(state: ScenarioState, seat: number): number {
  return state.separate ? (state.seats[seat]?.joined ?? seat) : seat;
}

// The living seats that share the seat's staging area and stage, in player order: the head of the area and the players that joined it. Not separate: every living seat.
export function sharing(state: ScenarioState, seat: number): number[] {
  if (!state.separate) return livingSeats(state);
  const head = headOf(state, seat);
  return livingSeats(state).filter((index) => headOf(state, index) === head);
}

// The first player of the seat's area: the player of the area nearest the first player in turn order ("the resolution of each phase occurs as if only the player or players that share any given staging area are currently in the game", mec108.create-staging-area).
export function firstOfArea(state: ScenarioState, seat: number): number {
  const mine = sharing(state, seat);
  const count = Math.max(1, state.seatCount);
  return [...mine].sort((left, right) => ((left - state.firstPlayer + count) % count) - ((right - state.firstPlayer + count) % count))[0] ?? state.firstPlayer;
}

// The first player an effect read by `actor` means: the first player of the actor's area while the areas are isolated ("the resolution of each phase occurs as if only the player or players that share any given staging area are currently present in the game", hob.staging-area-creating), else the first player.
export function firstPlayerFor(state: ScenarioState, actor: number): number {
  return isolatedAreas(state) ? firstOfArea(state, actor) : state.firstPlayer;
}

// The seat that heads the area the card is in: its staging area, its active location or the engagement of a player of the area; null for a card in no area (or while stages are not separate).
export function areaHeadOf(state: ScenarioState, id: string): number | null {
  if (!state.separate) return null;
  const card = state.cards[id];
  if (!card) return null;
  const staged = areaOf(state, id);
  if (staged != null) return headOf(state, staged);
  const active = state.seats.findIndex((seat, index) => index < state.seatCount && seat.active === id);
  if (active >= 0) return headOf(state, active);
  return card.zone === "engaged" && card.controller != null ? headOf(state, card.controller) : null;
}

// The seat a card's constants and records read as "you" and "the first player": its controller (the first player with none), or, while the areas are isolated, the engaged player of an engaged enemy, else the first player of the area it lies in (a staging card's controller is whoever revealed it, not whoever is there now).
// Null for a staging card or an active location in no area while a stage is parked: no player is at it, so its constants hold for nobody. (Escape from Mount Gram's cards in every area have no area either, and keep their controller.)
export function sideOf(state: ScenarioState, card: CardInstance): number | null {
  if (!isolatedAreas(state)) return card.controller ?? state.firstPlayer;
  // An enemy engaged with a player is that player's: its "you" is the engaged player, not the first of the area.
  if (card.zone === "engaged" && card.controller != null) return card.controller;
  const head = areaHeadOf(state, card.id);
  if (head != null) return firstOfArea(state, head);
  return parkedStage(state) != null && (card.zone === "staging" || card.zone === "activeLocation") ? null : (card.controller ?? state.firstPlayer);
}

// The living seats that own an area (not a seat that joined another): the seats a phase resolves for once stages are separate. A game with no joined seat returns every living seat.
export function areaSeats(state: ScenarioState): number[] {
  return state.separate ? livingSeats(state).filter((index) => headOf(state, index) === index) : livingSeats(state);
}

// The encounter cards that are in every area at once ("considered to be in each player's staging area", 10175:A:1): the cards of the shared staging area the game marked (state.capture.here).
function everyArea(state: ScenarioState): readonly string[] {
  const here = state.capture?.here;
  return here && here.length > 0 ? here.filter((id) => state.cards[id]?.zone === "staging") : [];
}

// The encounter cards in the seat's staging area; the shared staging area when stages are not separate.
export function stagingOf(state: ScenarioState, seat: number): readonly string[] {
  if (!state.separate) return state.staging;
  const head = headOf(state, seat);
  if (state.viewSeat === head) return state.staging;
  const own = state.seats[head]?.staging ?? [];
  const everywhere = everyArea(state);
  return everywhere.length === 0 ? own : [...own, ...everywhere];
}

// Whether the card is in the staging area of the seat's area, or engaged with a player who shares it (mec108.create-staging-area).
export function inAreaOf(state: ScenarioState, card: CardInstance, seat: number): boolean {
  if (!state.separate) return true;
  if (card.zone === "engaged") return card.controller != null && headOf(state, card.controller) === seat;
  const area = areaOf(state, card.id);
  // A staging card in no seat's list is in no area while its stage is parked, and in every area before stage 2B deals it out.
  return area == null ? parkedStage(state) == null : headOf(state, area) === seat;
}

// The seat whose staging area holds the card, or null when it is in no area (the shared staging area, or not in staging).
export function areaOf(state: ScenarioState, id: string): number | null {
  if (!state.separate) return null;
  const at = state.seats.findIndex((seat, index) => index < state.seatCount && seat.staging.includes(id));
  return at < 0 ? null : at;
}

// The staging cards in no seat's area: the shared staging area before stage 2B deals it out.
export function sharedStaging(state: ScenarioState): readonly string[] {
  if (!state.separate) return state.staging;
  const owned = new Set(state.seats.flatMap((seat) => seat.staging));
  return state.staging.filter((id) => !owned.has(id));
}

// The stage no player is at while the areas are isolated (Fog on the Barrow-downs, stage 3B when every player is trapped): the stage in play with no seat, held in `ScenarioState.questStage`. Null otherwise.
export function parkedStage(state: ScenarioState): string | null {
  return state.separate === true && state.isolated === true ? state.questStage : null;
}

// The seat's quest stage, or the shared one when stages are not separate.
export function stageOf(state: ScenarioState, seat: number): string | null {
  if (!state.separate) return state.questStage;
  const head = headOf(state, seat);
  return state.viewSeat === head ? state.questStage : (state.seats[head]?.stage ?? null);
}

// The seat whose stage the card is, or null.
export function stageSeat(state: ScenarioState, id: string): number | null {
  if (!state.separate) return null;
  // On a seat's view its stage is the view's `questStage`, and the seat's own record is written back by mergeView.
  if (state.viewSeat != null && state.questStage === id) return state.viewSeat;
  const at = state.seats.findIndex((seat, index) => index < state.seatCount && seat.stage === id);
  return at < 0 ? null : at;
}

// Where a card the seat puts into "the staging area" goes: that seat's own area once stages are separate.
export function stagingDest(state: ScenarioState, seat: number): Destination {
  return state.separate ? { zone: "staging", area: headOf(state, seat) } : { zone: "staging" };
}

// The state as the seat sees it: its own staging area and its own stage in the shared fields. Not separate: the state itself.
export function viewOf(state: ScenarioState, seat: number | undefined): ScenarioState {
  if (!state.separate || seat == null) return state;
  const head = headOf(state, seat);
  const owner = state.seats[head];
  if (!owner) return state;
  // A card that is in every area is in this seat's too (mergeView leaves it out of the seat's own list).
  const everywhere = everyArea(state);
  // Mount Gram: "the first player" of an effect in an area is the area's own (the table's first player may be in another area).
  const first = isolatedAreas(state) ? { firstPlayer: firstOfArea(state, head) } : {};
  return { ...state, ...first, staging: everywhere.length > 0 ? [...owner.staging, ...everywhere] : owner.staging, questStage: owner.stage ?? null, activeLocation: owner.active ?? null, secondActiveLocation: null, viewSeat: head };
}

// The seat's active location, or the shared one when stages are not separate.
export function activeOf(state: ScenarioState, seat: number): string | null {
  if (!state.separate) return state.activeLocation;
  const head = headOf(state, seat);
  return state.viewSeat === head ? state.activeLocation : (state.seats[head]?.active ?? null);
}

// The active locations a seat's effect sees: its own once stages are separate, unless it reads every area (`all`); the shared slots otherwise.
export function activeFor(state: ScenarioState, seat: number, all = false): string[] {
  if (!state.separate || all) return [state.activeLocation, state.secondActiveLocation].filter((id): id is string => id != null);
  const own = activeOf(state, seat);
  return own ? [own] : [];
}

// The shared slots mirror the seats' active locations (see the header).
export function mirrorActive(state: ScenarioState): ScenarioState {
  const first = state.seats[0].active ?? null;
  const second = state.seats[1].active ?? null;
  return state.activeLocation === first && state.secondActiveLocation === second ? state : { ...state, activeLocation: first, secondActiveLocation: second };
}

// What a function did to a view of the seat, written back: the seat's own area and stage take the view's, the other seats' areas are the view's
// seats, and the shared fields (the stage, the union of the staging cards) are rebuilt from the original. A card the view moved out of staging
// leaves every list.
export function mergeView(state: ScenarioState, asked: number | undefined, view: ScenarioState): ScenarioState {
  const seat = asked == null ? undefined : headOf(state, asked);
  if (!state.separate || seat == null || !state.seats[seat]) return view;
  const everywhere = new Set(everyArea(state));
  const was = state.seats[seat].staging;
  const seats: [typeof view.seats[0], typeof view.seats[1]] = [view.seats[0], view.seats[1]];
  // A card the view put into another seat's area (`{ zone: "staging", area }`, or an enemy returned from that seat's engagement) is in that area only,
  // not in this seat's too.
  const elsewhere = new Set(seats.flatMap((other, index) => (index === seat ? [] : other.staging)));
  const now = view.staging.filter((id) => !elsewhere.has(id) && !everywhere.has(id));
  const owner = seats[seat];
  const { stage: _old, active: _active, ...rest } = owner;
  seats[seat] = { ...rest, staging: now, ...(view.questStage != null ? { stage: view.questStage } : {}), ...(view.activeLocation != null ? { active: view.activeLocation } : {}) };
  const kept = state.staging.filter((id) => !was.includes(id) || now.includes(id) || elsewhere.has(id));
  const added = [...now, ...elsewhere].filter((id) => !state.staging.includes(id));
  const { viewSeat: _seat, ...plain } = view;
  // The view's first player is the area's own (viewOf), unless the view passed the token on.
  const first = isolatedAreas(state) && view.firstPlayer === firstOfArea(state, seat) ? { firstPlayer: state.firstPlayer } : {};
  const merged: ScenarioState = { ...plain, ...first, seats, questStage: state.questStage, staging: [...kept, ...added] };
  return mirrorActive({ ...merged, staging: merged.staging.filter((id) => merged.cards[id]?.zone === "staging") });
}

// Runs `act` on the seat's view and writes the result back.
export function withView(state: ScenarioState, seat: number | undefined, act: (view: ScenarioState) => ScenarioState): ScenarioState {
  if (!state.separate || seat == null) return act(state);
  return mergeView(state, seat, act(viewOf(state, seat)));
}

// An eliminated seat's stage and the encounter cards at it are discarded (mec109.multiple-staging-areas): the cards in its staging area, its active location, go to the
// encounter discard pile and its stage card to the set-aside pile, as a defeated stage does. Nothing happens when the seat has neither. When players joined the seat
// (mec108.joining-another-player) they are still in the game and in that area, so the area passes to the first of them clockwise and nothing is discarded
// (agent recommendation, docs/scenarios/angmar-awakened/escape-from-mount-gram.md, Escape from Mount Gram).
export function discardArea(state: ScenarioState, seat: number): ScenarioState {
  const owner = state.seats[seat];
  if (!state.separate || !owner) return state;
  const heir = areaHeir(state, seat);
  if (heir != null) return passArea(state, seat, heir);
  let next = state;
  for (const id of owner.staging) next = updateCard(moveCard(next, id, { zone: "encounterDiscard" }), id, { face: "up", controller: null });
  if (owner.active) next = updateCard(moveCard(next, owner.active, { zone: "encounterDiscard" }), owner.active, { face: "up", controller: null });
  if (owner.stage) next = moveCard(next, owner.stage, { zone: "setAside" });
  return next;
}

// The living seat that takes over the area of the eliminated seat: the first clockwise of the seats that joined it; null when none did.
function areaHeir(state: ScenarioState, seat: number): number | null {
  const count = Math.max(1, state.seatCount);
  const joined = livingSeats(state).filter((index) => index !== seat && state.seats[index]?.joined === seat);
  return [...joined].sort((left, right) => ((left - seat + count) % count) - ((right - seat + count) % count))[0] ?? null;
}

// The heir holds the area (its staging cards, active location and stage), and the other seats that joined the eliminated seat now share the heir's.
function passArea(state: ScenarioState, seat: number, heir: number): ScenarioState {
  const owner = state.seats[seat];
  const taker = state.seats[heir];
  if (!owner || !taker) return state;
  const { joined: _joined, ...rest } = taker;
  let next = withSeat(state, heir, { ...rest, staging: owner.staging, ...(owner.stage != null ? { stage: owner.stage } : {}), ...(owner.active != null ? { active: owner.active } : {}) });
  for (let index = 0; index < next.seatCount; index += 1) {
    const other = next.seats[index];
    if (index !== heir && other?.joined === seat) next = withSeat(next, index, { ...other, joined: heir });
  }
  const { stage: _stage, active: _active, ...left } = next.seats[seat] ?? owner;
  return mirrorActive(withSeat(next, seat, { ...left, staging: [] }));
}
