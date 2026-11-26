// Rules: rm.out-of-play-deck, rr.engaged, rm.grima-objective-ally, rr.cannot, rr.first-player (data/rules/entries.json); ledger lines 07024:A:2, 07025:A:1, 07016:A:1, 07016:A:3, 07023:A:1, 07059:A:1, 07059:B:3.
// The one line a card of The Fords of Isen says about itself in the card preview (dungeon-preview.ts): Mugash held under his hero and the Guard that engages its player (To Catch an Orc), Gríma held under The Islet (wherever The Islet lies), free in the staging area, or in a player's play area, and Ill Tidings held in a hand. The engine decided each; nothing here changes one. Pure.
import { flagged, inPlay, type ScenarioState } from "../../../rules/core/state.ts";
import type { ReduceContext } from "../../../rules/interpret/interpret.ts";
import { captorSeat } from "../../../rules/families/ring-maker/captor.ts";
import { GRIMA_IN_STAGING, grimaControlledWords, grimaOnWords, illTidingsWords } from "../../words/scenarios/ring-maker/fords-table.ts";
import { guardWords, heroHoldsWords, mugashHeldWords } from "../../words/scenarios/ring-maker/orc-table.ts";
import { hinderWords, mugashFreeWords, mugashOnEdgeWords, mugashOnHeroWords, needOfRestHostWords, offTrackHostWords } from "../../words/scenarios/ring-maker/fangorn-table.ts";
import { hillsWords, oldSouthRoadWords, ravineOnEnemyWords, ravineWords, turchWords } from "../../words/scenarios/ring-maker/dunland-table.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import { IN_NEED_OF_REST } from "../../readouts/ring-maker/fangorn.ts";
import { GUARD, MUGASH, MUGASH_OBJECTIVE, mugashLyingOn } from "../../readouts/ring-maker/orc.ts";

const GRIMA = "07016";
const ILL_TIDINGS = "07023";
// The stage whose text stops the quest from advancing unless the first player controls Gríma (07059:B:3).
const STAGE_1 = "07059";
// Into Fangorn: the Hinder Huorns, Edge of Fangorn that holds Mugash, and the two attachments that name their hosts.
const HUORNS: readonly string[] = ["07033", "07034", "07035"];
const EDGE = "07032";
const OFF_TRACK = "07057";

// The line of Mugash (the objective) on a host: Edge of Fangorn or a hero, by the host's code (`hostId` names it).
function mugashOnHostWords(game: ScenarioState, hostId: string, name: (id: string) => string): string {
  return game.cards[hostId]?.code === EDGE ? mugashOnEdgeWords(name(hostId)) : mugashOnHeroWords(name(hostId));
}

// What Into Fangorn's cards say about themselves: Mugash (the objective) on Edge, on a hero or free, a Huorn, and the line of each attachment on its host; one line for each piece a card holds.
function fangornDetail(game: ScenarioState, cardId: string, name: (id: string) => string): string | null {
  const card = game.cards[cardId];
  if (!card) return null;
  if (card.code === MUGASH_OBJECTIVE) {
    const host = card.zone === "attached" && card.host != null ? game.cards[card.host] : undefined;
    if (host) return mugashOnHostWords(game, host.id, name);
    return card.zone === "staging" ? mugashFreeWords(card.attachments.length > 0) : null;
  }
  if (HUORNS.includes(card.code)) return hinderWords(card.zone === "engaged");
  const lines = card.attachments.flatMap((id) => {
    const code = game.cards[id]?.code;
    if (code === MUGASH_OBJECTIVE) return [mugashOnHostWords(game, cardId, name)];
    if (code === OFF_TRACK) return [offTrackHostWords()];
    return code === IN_NEED_OF_REST ? [needOfRestHostWords(name(cardId))] : [];
  });
  return lines.length > 0 ? lines.join(" ") : null;
}

// The Dunland Trap: Chief Turch, Hills of Dunland, the Ravine and the Road, and a Dunland enemy under the Ravine.
const TURCH = "08014";
const RAVINE = "08015";
const OLD_SOUTH_ROAD = "08016";
const HILLS = "08020";

function dunlandDetail(game: ScenarioState, ctx: ReduceContext, cardId: string): string | null {
  const card = game.cards[cardId];
  if (!card) return null;
  if (card.code === TURCH) return turchWords();
  if (card.code === HILLS) return hillsWords(card.zone === "staging");
  if (card.code === RAVINE) return ravineWords();
  if (card.code === OLD_SOUTH_ROAD) return oldSouthRoadWords();
  const enemy = (card.zone === "staging" || card.zone === "engaged") && printedOf(ctx.cards, card.code)?.traits.includes("Dunland") === true;
  return enemy && Object.values(game.cards).some((other) => other.code === RAVINE && inPlay(other.zone)) ? ravineOnEnemyWords() : null;
}

export function ringMakerDetail(game: ScenarioState, ctx: ReduceContext, cardId: string, name: (id: string) => string): string | null {
  const card = game.cards[cardId];
  if (!card) return null;
  const fangorn = fangornDetail(game, cardId, name);
  if (fangorn) return fangorn;
  const dunland = dunlandDetail(game, ctx, cardId);
  if (dunland) return dunland;
  if (card.code === ILL_TIDINGS && card.zone === "hand" && flagged(game, cardId, "cannotLeaveHand")) return illTidingsWords(game.seatCount > 1 && card.controller != null ? `Player ${card.controller + 1}` : null);
  if (card.code === MUGASH) return card.zone === "attached" && card.host != null && game.cards[card.host] ? mugashHeldWords(name(card.host)) : null;
  if (card.code === GUARD && (card.zone === "staging" || card.zone === "engaged")) {
    // The seat the engine's sweep engages (an eliminated seat holds nothing): the same answer, not a second reading of the table.
    const seat = captorSeat(game, ctx, cardId);
    return guardWords(seat != null, seat != null && game.seatCount > 1 ? `Player ${seat + 1}` : null);
  }
  if (mugashLyingOn(game, cardId).length > 0) return heroHoldsWords(name(cardId));
  if (card.code !== GRIMA) return null;
  if (card.zone === "attached" && card.host != null && game.cards[card.host]) return grimaOnWords(name(card.host));
  if (card.zone === "staging" && card.controller == null) return GRIMA_IN_STAGING;
  if (card.controller != null && card.zone === "play") return grimaControlledWords(game.seatCount > 1 ? `Player ${card.controller + 1}` : null, game.questStage != null && game.cards[game.questStage]?.code === STAGE_1);
  return null;
}
