// Rules: rr.damage (data/rules/entries.json); ledger line 02068:A:2.
// The Pick filter `soleMostDamaged`: the character with more damage than each other character of every player, a tie for the most matching none.
import { describe, expect, it } from "vitest";

import { updateCard } from "../../core/state.ts";
import { pickCandidates } from "../../interpret/pick.ts";

import { playCtx, put, seat } from "./fixture.ts";

const ctx = playCtx([]);
const SPEC = { type: "character", control: "any", soleMostDamaged: true } as const;

// Two seats with a hero each, and Wilyador in the first seat's play area, with these damages.
function table(hero: number, other: number, wilyador: number) {
  const made = seat(2, ["dwarf"]);
  const wil = put(made.state, "wil", "play");
  let state = wil.state;
  state = updateCard(state, made.heroes[0] ?? "", { damage: hero });
  state = updateCard(state, made.heroes[1] ?? "", { damage: other });
  state = updateCard(state, wil.id, { damage: wilyador });
  return { state, hero: made.heroes[0] ?? "", other: made.heroes[1] ?? "", wil: wil.id };
}

describe("02068:A:2 soleMostDamaged", () => {
  it("02068:A:2 offers the one character with more damage than each other, Wilyador included", () => {
    const { state, wil } = table(2, 3, 9);
    expect(pickCandidates(state, SPEC, 0, [], null, ctx)).toEqual([wil]);
  });

  it("02068:A:2 offers a hero of another player when it has the most", () => {
    const { state, other } = table(2, 6, 4);
    expect(pickCandidates(state, SPEC, 0, [], null, ctx)).toEqual([other]);
  });

  it("02068:A:2 offers nobody when two characters tie for the most", () => {
    const { state } = table(5, 5, 2);
    expect(pickCandidates(state, SPEC, 0, [], null, ctx)).toEqual([]);
  });

  it("02068:A:2 offers nobody when no character has any damage", () => {
    const { state } = table(0, 0, 0);
    expect(pickCandidates(state, SPEC, 0, [], null, ctx)).toEqual([]);
  });
});
