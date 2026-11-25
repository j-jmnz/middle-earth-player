// Rules: rr.cost, rr.step-6-4-1, rr.step-6-4-3 (data/rules/entries.json).
// The intents the engine offers (or the driver sends) that no labelled element of the table sends, each with why that holds for every player, a
// sighted one too. An entry reads the walk (reach.ts), so it holds only where the reader table really leads there.
import type { Allowed } from "./run.ts";

export const ALLOWED: readonly Allowed[] = [
  {
    when: (_state, what, reach) => what.startsWith("PlayCard ") && reach.refused.some((one) => one.kind === "pay" && one.cardId === what.slice("PlayCard ".length)),
    why: "legalIntents offers PlayCard for a card the pools cannot pay for now (rr.cost); the card's button opens its payment, the table refuses it and announces why (cannotPay), a sighted player gets the same refusal",
  },
  {
    when: (_state, what, reach) => what.startsWith("PlayCard ") && reach.refused.some((one) => one.kind === "host" && one.cardId === what.slice("PlayCard ".length)),
    why: "legalIntents offers PlayCard for an attachment no card can take now (the reducer answers 'Choose a host'); the card's button opens its sheet, which says 'No card can take it now.', a sighted player gets the same",
  },
  {
    when: (state, what, reach) => what.startsWith("ChooseResolution ") && state.window?.kind === "resolution" && reach.outcome,
    why: "the scenario's reward is chosen on the resolution screen (src/screens/routes/resolution/[saveId].tsx), whose tiles are labelled radios; the table's outcome button leads there",
  },
  {
    when: (state, what, reach) => what === "Undefended" && state.window?.kind === "defense" && !state.pendingAttack?.shadowResolved && reach.sent.some((entry) => entry.intent.type === "Undefended" && entry.intent.heroId == null),
    why: "a pinned game names the hero with the declaration, which the engine still takes; the table's Leave undefended names none (rr.step-6-4-1) and each hero is a labelled option of the sheet at the damage step, after the shadow effect (rr.step-6-4-3)",
  },
];
