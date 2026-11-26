// Rules: rm.out-of-play-deck, rr.engaged, rm.grima-objective-ally, rr.cannot, rr.first-player (data/rules/entries.json); ledger lines 07024:A:2, 07025:A:1, 07016:A:1, 07016:A:3, 07023:A:1, 07059:A:1, 07059:B:3, 08068:A:1.
// The one line a card of The Fords of Isen says about itself in the card preview (dungeon-preview.ts): Mugash held under his hero and the Guard that engages its player (To Catch an Orc), Gríma held under The Islet (wherever The Islet lies), free in the staging area, or in a player's play area, and Ill Tidings held in a hand. The engine decided each; nothing here changes one. Pure.
import { flagged, type ScenarioState } from "../../../rules/core/state.ts";
import type { ReduceContext } from "../../../rules/interpret/interpret.ts";
import { captorSeat } from "../../../rules/families/ring-maker/captor.ts";
import { GRIMA_IN_STAGING, grimaControlledWords, grimaOnWords, illTidingsWords } from "../../words/scenarios/ring-maker/fords-table.ts";
import { nalirControlledWords } from "../../words/scenarios/ring-maker/tharbad-table.ts";
import { guardWords, heroHoldsWords, mugashHeldWords } from "../../words/scenarios/ring-maker/orc-table.ts";
import { hinderWords, mugashFreeWords, mugashOnEdgeWords, mugashOnHeroWords, needOfRestHostWords, offTrackHostWords } from "../../words/scenarios/ring-maker/fangorn-table.ts";
import { hillsWords, oldSouthRoadWords, ravineWords, turchWords } from "../../words/scenarios/ring-maker/dunland-table.ts";
import { timeOf } from "../../../rules/families/angmar/time.ts";
import { effectsOf } from "../../../rules/windows/listen.ts";
import { IN_NEED_OF_REST } from "../../readouts/ring-maker/fangorn.ts";
import { trialsDetail } from "./trials-preview.ts";
import { GUARD, MUGASH, MUGASH_OBJECTIVE, mugashLyingOn } from "../../readouts/ring-maker/orc.ts";

const GRIMA = "07016";
const NALIR = "08068";
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

// The Ravine's sentence, read from its own constant record: the stat changes it makes and the holders it names. Null when the record holds none.
function ravineDetail(ctx: ReduceContext): string | null {
  let trait: string | undefined;
  let staged = false;
  const bonuses: string[] = [];
  for (const effect of effectsOf(ctx, RAVINE)) {
    if (effect.timing !== "constant") continue;
    for (const instruction of effect.instructions) {
      if (instruction.verb !== "ModifyStat" || typeof instruction.amount !== "number" || instruction.holders?.trait == null) continue;
      trait = instruction.holders.trait;
      staged = instruction.holders.staging === true;
      bonuses.push(`${instruction.amount > 0 ? "+" : ""}${instruction.amount} ${instruction.stat.charAt(0).toUpperCase()}${instruction.stat.slice(1)}`);
    }
  }
  return trait == null ? null : ravineWords(trait, staged, bonuses);
}

function dunlandDetail(ctx: ReduceContext, game: ScenarioState, cardId: string): string | null {
  const card = game.cards[cardId];
  if (!card) return null;
  if (card.code === TURCH) return turchWords();
  if (card.code === HILLS) return hillsWords(card.zone === "staging");
  if (card.code === RAVINE) return ravineDetail(ctx);
  return card.code === OLD_SOUTH_ROAD ? oldSouthRoadWords(game.questStage != null && timeOf(ctx, game.cards[game.questStage]?.code ?? "") != null) : null;
}

export function ringMakerDetail(game: ScenarioState, ctx: ReduceContext, cardId: string, name: (id: string) => string): string | null {
  const card = game.cards[cardId];
  if (!card) return null;
  const fangorn = fangornDetail(game, cardId, name);
  if (fangorn) return fangorn;
  const dunland = dunlandDetail(ctx, game, cardId);
  if (dunland) return dunland;
  const trials = trialsDetail(game, ctx, cardId, name);
  if (trials) return trials;
  if (card.code === ILL_TIDINGS && card.zone === "hand" && flagged(game, cardId, "cannotLeaveHand")) return illTidingsWords(game.seatCount > 1 && card.controller != null ? `Player ${card.controller + 1}` : null);
  if (card.code === MUGASH) return card.zone === "attached" && card.host != null && game.cards[card.host] ? mugashHeldWords(name(card.host)) : null;
  if (card.code === GUARD && (card.zone === "staging" || card.zone === "engaged")) {
    // The seat the engine's sweep engages (an eliminated seat holds nothing): the same answer, not a second reading of the table.
    const seat = captorSeat(game, ctx, cardId);
    return guardWords(seat != null, seat != null && game.seatCount > 1 ? `Player ${seat + 1}` : null);
  }
  if (mugashLyingOn(game, cardId).length > 0) return heroHoldsWords(name(cardId));
  if (card.code === NALIR && card.controller != null && card.zone === "play") return nalirControlledWords(game.seatCount > 1 ? `Player ${card.controller + 1}` : null);
  if (card.code !== GRIMA) return null;
  if (card.zone === "attached" && card.host != null && game.cards[card.host]) return grimaOnWords(name(card.host));
  if (card.zone === "staging" && card.controller == null) return GRIMA_IN_STAGING;
  if (card.controller != null && card.zone === "play") return grimaControlledWords(game.seatCount > 1 ? `Player ${card.controller + 1}` : null, game.questStage != null && game.cards[game.questStage]?.code === STAGE_1);
  return null;
}
