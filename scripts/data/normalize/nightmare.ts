import type { Card } from "../../../src/catalog/card-facts.ts";
import { NIGHTMARE_PILES, type NightmareData, type Placement } from "../../../src/catalog/scenario-data.ts";
import { isNightmareCard, nightmareDeckOf, nightmareDeckOfCode } from "../nightmare-defs.ts";
import { sameName, titleKey } from "./names.ts";

// A built scenario's Nightmare deck (docs/plans/done/nightmare-mode.md). The setup card's side B prints the recipe: "Begin with the
// standard quest deck and encounter deck", "Remove the following cards, in the specified quantities, from the standard encounter
// deck" (one card a line, "3x Evil Crow" or "Forest Spider x3"), then shuffle the deck's own encounter cards in and place the setup
// card next to the quest deck, its side A faceup. The removals name the scenario's cards by title; a title the scenario does not
// deal, or more copies than it deals, is a problem, never a guess. The setup card is applied before the quest's Setup ("Begin with
// the standard quest deck and encounter deck"), so the Setup's searches find the Nightmare cards of the titles they name.

// One line of the removal list, in either order the cards print it.
const REMOVAL = /^(?:(\d+)\s*x\s+(.+?)|(.+?)\s+x\s*(\d+))\s*$/i;

export function removalLines(text: string | null): { name: string; copies: number }[] {
  const lines = (text ?? "").split("\n").map((line) => line.trim());
  const start = lines.findIndex((line) => /^Remove the following cards/i.test(line));
  if (start < 0) return [];
  const out: { name: string; copies: number }[] = [];
  for (const line of lines.slice(start + 1)) {
    const match = REMOVAL.exec(line);
    if (!match) break;
    const copies = Number(match[1] ?? match[4]);
    const name = (match[2] ?? match[3] ?? "").replaceAll("`", "'").trim();
    out.push({ name, copies });
  }
  return out;
}

type Named = Pick<Card, "code" | "name">;
type Slots = NightmareData["cards"];

// The scenario's one card a removal line names: the exact title, else the one near title (a printed typo, "Striken Dumb").
function resolveRemoval(name: string, dealt: readonly string[], byCode: ReadonlyMap<string, Named>): string[] {
  const key = titleKey(name);
  const exact = dealt.filter((code) => titleKey(byCode.get(code)?.name ?? "") === key);
  return exact.length > 0 ? exact : dealt.filter((code) => sameName(titleKey(byCode.get(code)?.name ?? ""), key));
}

// The removed copies come out of the encounter deck first, then out of the piles the quest's Setup fills from it (NIGHTMARE_PILES
// order). A copy taken from such a pile leaves its slot to the Nightmare card of the same title (Nightmare Fell Rider is staged one
// per player, as the Fell Rider it replaces): the quest's Setup names the card by title. With no card of that title (Journey in the
// Dark removes all 4 Mines of Moria, the one its Setup stages too) the Setup finds none and the slot stays empty. Returns the copies
// it could not take.
function takeFromPiles(code: string, copies: number, placed: readonly Placement[], slots: Slots, removed: NightmareData["removed"], byCode: ReadonlyMap<string, Named>, problem: (text: string) => void): number {
  let left = copies;
  for (const pile of NIGHTMARE_PILES) {
    const at = placed.find((p) => p.code === code && p.pile === pile);
    const take = Math.min(left, at?.normal ?? 0);
    if (!at || take === 0) continue;
    left -= take;
    removed.push({ code, copies: take, pile });
    if (pile === "encounter") continue;
    const title = titleKey(byCode.get(code)?.name ?? "");
    const twin = slots.find((card) => card.pile === "encounter" && titleKey(byCode.get(card.code)?.name ?? "") === title);
    if (!twin) continue;
    if (twin.copies < take) problem(`removes ${take} ${byCode.get(code)?.name ?? code} from the ${pile} pile and its deck prints only ${twin.copies}`);
    const moved = Math.min(take, twin.copies);
    twin.copies -= moved;
    if (moved > 0) slots.push({ code: twin.code, copies: moved, pile, ...(at.perPlayer != null ? { perPlayer: at.perPlayer } : {}) });
  }
  return left;
}

export function nightmareOf(scenarioId: string, placed: readonly Placement[], cards: readonly Card[]): { data: NightmareData | null; problems: string[] } {
  const deck = nightmareDeckOf(scenarioId);
  if (!deck) return { data: null, problems: [] };
  const problems: string[] = [];
  const problem = (text: string) => problems.push(`${scenarioId}: Nightmare ${text}`);
  // A deck's cards are the Nightmare pack's codes under its prefix (the setup card has no encounter set of its own).
  const own = cards.filter((card) => isNightmareCard(card) && nightmareDeckOfCode(card.code) === deck);
  const setup = own.filter((card) => card.type === "nightmare");
  if (setup.length !== 1 || !setup[0]) return { data: null, problems: [`${scenarioId}: Nightmare deck ${deck.set} has ${setup.length} setup cards`] };
  const setupCard = setup[0];
  const byCode = new Map(cards.map((card) => [card.code, card]));
  // Only the piles a removal can take from count: a burden is never in the encounter deck.
  const takeable = placed.filter((p) => (NIGHTMARE_PILES as readonly string[]).includes(p.pile));
  const dealt = [...new Set(takeable.map((p) => p.code))];
  const copiesOf = (code: string) => takeable.filter((p) => p.code === code).reduce((sum, p) => sum + p.normal, 0);
  const removed: NightmareData["removed"] = [];
  const lines = removalLines(setupCard.back?.text ?? null);
  if (lines.length === 0) problem(`setup card ${setupCard.code} prints no removal list`);
  const slots: Slots = own
    .filter((card) => card.type !== "nightmare" && card.type !== "quest" && card.quantity > 0)
    .map((card) => ({ code: card.code, copies: card.quantity, pile: "encounter" as const }));
  for (const line of lines) {
    const named = resolveRemoval(line.name, dealt, byCode);
    const code = named[0];
    if (named.length !== 1 || !code) {
      problem(`removal "${line.name}" names ${named.length} of the scenario's cards`);
      continue;
    }
    if (removed.some((item) => item.code === code)) problem(`removes ${line.name} twice`);
    if (line.copies > copiesOf(code)) problem(`removes ${line.copies} ${line.name}, the scenario deals ${copiesOf(code)}`);
    const left = takeFromPiles(code, line.copies, takeable, slots, removed, byCode, problem);
    if (left > 0 && line.copies <= copiesOf(code)) problem(`could not take ${left} of the ${line.copies} ${line.name} it removes`);
  }
  if (own.some((card) => card.type === "quest")) problem(`deck ${deck.set} prints quest cards, which the build does not place yet`);
  removed.sort((a, b) => a.code.localeCompare(b.code) || a.pile.localeCompare(b.pile));
  const cardsOut = slots.filter((card) => card.copies > 0).sort((a, b) => a.code.localeCompare(b.code) || a.pile.localeCompare(b.pile));
  return { data: { setupCard: setupCard.code, removed, cards: cardsOut }, problems };
}
