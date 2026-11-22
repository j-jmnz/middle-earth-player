// Rules: rr.reveal, rr.treachery-cards, rr.mulligan, rr.step-3-4 (data/rules/entries.json). The sounds of what an accepted intent did that no motion or spotlight carries (docs/design-system-table.md, Sound):
// a Nazgûl revealed (`combat.roar`), a treachery revealed (`dread.treachery`), a deck or set shuffled in (`card.shuffle`), the cards dealt before the first round (`card.deal`: the hand a mulligan deals) and a result the banner reports, the quest's resolution,
// a test's outcome or a player's elimination (`ui.notice`). Pure: it reads the steps the engine ran and the printed cards, so a test reads it. One of each slot a moment, in the order the steps ran.
import type { EngineStep } from "../../rules/core/intents.ts";
import type { PrintedCard } from "../../rules/core/printed.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import type { SoundSlot } from "../../ui/sound/slots.ts";

const NAZGUL = "nazgul";
const plain = (word: string): string => word.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** The sound a revealed card makes: a Nazgûl enemy roars, a treachery has its sting, and any other card none (the flip is the motion's). */
function revealSlot(card: PrintedCard | undefined): SoundSlot | null {
  if (!card) return null;
  if (card.type === "treachery") return "dread.treachery";
  if (card.type === "enemy" && card.traits.some((trait) => plain(trait) === NAZGUL)) return "combat.roar";
  return null;
}

/** The sounds of one accepted intent: `before` is the state it started from, `after` the state it made. */
export function momentSounds(before: ScenarioState, steps: readonly EngineStep[], after: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): SoundSlot[] {
  const heard: SoundSlot[] = [];
  const hear = (slot: SoundSlot | null): void => {
    if (slot && !heard.includes(slot)) heard.push(slot);
  };
  for (const step of steps) {
    switch (step.kind) {
      case "reveal":
        hear(revealSlot(cards.get(after.cards[step.cardId]?.code ?? before.cards[step.cardId]?.code ?? "")));
        break;
      case "shuffleSet":
      case "resetEncounterDeck":
      case "reshuffleDeck":
        hear("card.shuffle");
        break;
      // The hand a mulligan deals, and any card the Setup effects draw: before the first round.
      case "draw":
        if (before.phase === "Mulligan" || before.phase === "Setup") hear("card.deal");
        break;
      case "quest":
      case "fortitudeTest":
      case "escapeTest":
      case "locateTest":
      case "hideTest":
      case "eliminate":
        hear("ui.notice");
        break;
      default:
        break;
    }
  }
  return heard;
}
