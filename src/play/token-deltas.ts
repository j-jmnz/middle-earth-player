// What changed in the counts on cards between two states, for the token pops and the floating numbers (phase 23). Pure. The
// numbers are the reducer's: this only subtracts them. The UI never works out a number of its own.
// The words of a change ("+2" in gold, "-1" in threat red) are here too, so the canvas draws a string it was handed.

/** A token a card carries a count of. */
export type TokenKind = "damage" | "resources" | "progress";

const TOKEN_KINDS: readonly TokenKind[] = ["resources", "damage", "progress"];

/** The part of a state this reads: each card's counts. A ScenarioState has it. */
export type Counted = { readonly cards: Readonly<Record<string, { readonly damage: number; readonly resources: number; readonly progress: number }>> };

export type TokenDelta = { cardId: string; token: TokenKind; change: number };

/** Each count that differs between the two states, per card in `next`, resources then damage then progress. Equal counts give none. */
export function tokenDeltas(prev: Counted, next: Counted): readonly TokenDelta[] {
  const out: TokenDelta[] = [];
  for (const [cardId, card] of Object.entries(next.cards)) {
    const before = prev.cards[cardId];
    // A card new to the table brings its counts with it: it is not a change.
    if (!before) continue;
    for (const token of TOKEN_KINDS) {
      const change = card[token] - before[token];
      if (change !== 0) out.push({ cardId, token, change });
    }
  }
  return out;
}

/** The floating number of a change: "+2" in gold for a gain, "−1" in threat red for damage taken or a loss. Healing is a gain. */
export function floatWords(delta: Pick<TokenDelta, "token" | "change">): { text: string; gain: boolean } {
  // More damage is a loss; every other count rising is a gain.
  const gain = delta.token === "damage" ? delta.change < 0 : delta.change > 0;
  return { text: `${gain ? "+" : "−"}${Math.abs(delta.change)}`, gain };
}
