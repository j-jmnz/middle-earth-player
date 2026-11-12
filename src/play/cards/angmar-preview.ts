// Rules: mec108.time-x, mec108.side-quests, mec108.side-quests-in-play, mec108.objective-allies, mec108.indestructible (data/rules/entries.json); ledger lines 09024:A:2, 09036:A:2, 09038:A:1, 09038:A:2, 09051:A:1, 09067:A:2, 09074:B:2, 10158:A:2, 10158:A:3, 10168:A:2, 10169:A:2, 10170:A:2.
// The one line a card of Intruders in Chetwood says about itself in the card preview (dungeon-preview.ts) when it has more to say than its text: Iârion facedown under Rescue Iârion and Rescue Iârion holding him, the hands under Lost in the
// Wilderness, Protect the Innocent's damage against the number that loses, and the side quest that is the current quest; Deadmen's Dike's Thaurdir (his damage against his hit points and the burden he carries), a burden on its host, Fornost Square's tokens, Broken Battlements' time counters and The Power of Angmar's lock. The engine decided each; nothing here changes one. Pure.
import { cardsUnder } from "../../rules/core/zones.ts";
import { flagged, heldAmount, inPlay, type ScenarioState } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/engine/reduce.ts";
import { ownerWords } from "../words/owner.ts";
import { timeOf } from "../../rules/families/angmar/time.ts";
import { captiveUnder } from "../../rules/families/south/captive.ts";

import { huntLimit, thaurdirStagePoints } from "../readouts/angmar.ts";
import { wastesDetail } from "./wastes-preview.ts";
import { hitPointsOf } from "../../rules/families/angmar/quest.ts";
import { battlementsPreviewWords, burdenWords, CURRENT_QUEST_WORDS, fornostWords, heldWords, isBurden, POWER_OF_ANGMAR_WORDS, thaurdirPreviewWords, holdsWords, huntPreviewWords, protectPreviewWords, savagePreviewWords, shelterPreviewWords, wildernessWords } from "../words/scenarios/angmar-table.ts";

const WILDERNESS = "09051";

/** Each seat's cards under the card, in seat order, with whose they are in words. */
function handsUnder(game: ScenarioState, cardId: string): { owner: string; count: number }[] {
  const counts = new Map<number, number>();
  for (const id of cardsUnder(game, cardId)) {
    const owner = game.cards[id]?.owner;
    if (owner != null) counts.set(owner, (counts.get(owner) ?? 0) + 1);
  }
  return [...counts].sort((left, right) => left[0] - right[0]).map(([seat, count]) => ({ owner: ownerWords(game.seatCount, seat), count }));
}

export function angmarDetail(game: ScenarioState, ctx: ReduceContext, cardId: string, name: (id: string) => string): string | null {
  const card = game.cards[cardId];
  // The Wastes of Eriador's own pieces (the Time objective, Pack Leader's gate, Determination) hold in a game whether or not a side quest has been seen yet.
  const wastes = wastesDetail(game, ctx, cardId);
  if (wastes) return wastes;
  if (!card || game.sideQuests !== true) return null;
  const host = card.zone === "captive" && card.host != null ? game.cards[card.host] : undefined;
  if (host && timeOf(ctx, host.code) != null) return heldWords(name(host.id), host.resources);
  const held = captiveUnder(game, cardId);
  if (held && timeOf(ctx, card.code) != null) return holdsWords(name(held), card.resources);
  if (card.code === WILDERNESS) return wildernessWords(handsUnder(game, cardId));
  if (card.code === "09071") return huntPreviewWords(card.resources, huntLimit(game, ctx, cardId));
  if (card.code === "09032" && inPlay(card.zone)) return shelterPreviewWords(card.resources);
  if (card.code === "09036" && inPlay(card.zone)) return battlementsPreviewWords(card.resources);
  if (card.code === "09038" && inPlay(card.zone)) return fornostWords(card.resources, game.seatCount > 1 ? `Player ${game.firstPlayer + 1}` : null);
  if (card.code === "09067" && card.zone === "staging") return POWER_OF_ANGMAR_WORDS;
  // A burden lies on the card it is attached to wherever that card is: Thaurdir in the staging area or engaged, or the hero it moved to.
  if (isBurden(card.code) && card.host != null) {
    const on = game.cards[card.host];
    return on ? burdenWords(card.code, name(on.id), on.zone === "heroes") : null;
  }
  if (card.code === "09033" && inPlay(card.zone)) {
    const burden = card.attachments.map((id) => game.cards[id]).find((one) => one != null && isBurden(one.code));
    return thaurdirPreviewWords(card.damage, hitPointsOf(game, card, ctx), thaurdirStagePoints(game, ctx), burden ? name(burden.id) : null);
  }
  if (card.code === "09072") return savagePreviewWords(card.resources);
  const lines: string[] = [];
  const limit = heldAmount(game, cardId, "loseAtDamage");
  if (limit > 0 && card.zone === "staging") lines.push(protectPreviewWords(card.damage, limit));
  if (card.zone === "staging" && flagged(game, cardId, "currentQuest")) lines.push(CURRENT_QUEST_WORDS);
  return lines.length > 0 ? lines.join(" ") : null;
}
