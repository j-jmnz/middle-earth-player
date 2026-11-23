// Rules: rr.engaged (data/rules/entries.json); FAQ 1.50 (docs/brief.md, Considered to be engaged).
// An enemy in the staging area that is considered engaged with a player (Bolg at stage 5 of The Battle of Five Armies: with the first player) is engaged with him
// for a trigger's subject filter and for a pick that lists the staging area and the enemies engaged with another player, once each.
import { describe, expect, it } from "vitest";

import type { PickSpec } from "../../catalog/boundary.ts";
import { pickCandidates } from "../interpret/pick.ts";
import { first, tableFromLayout } from "../../../test/harness/scene-kit.ts";
import { subjectMatches } from "./listen.ts";

const S5 = "132079";
const BOLG = "132053";

describe("A staging enemy considered engaged with the first player", () => {
  const made = tableFromLayout("the-battle-of-five-armies", { stage: S5, seats: 2, staging: [BOLG], engaged: [{ code: "f3", seat: 0 }] });
  const bolg = first(made.state, BOLG);
  const heroOf = (seat: number) => made.state.cards[seat === 0 ? made.hero : (made.seat1Hero ?? "")]!;

  it("is the subject of a trigger for an enemy engaged with you for the first player, and one engaged with another player for the second", () => {
    const you: PickSpec = { type: "enemy", control: "any", engaged: "you" };
    const other: PickSpec = { type: "enemy", control: "any", engaged: "other" };
    expect(subjectMatches(made.state, bolg, you, heroOf(0), made.ctx)).toBe(true);
    expect(subjectMatches(made.state, bolg, other, heroOf(0), made.ctx)).toBe(false);
    expect(subjectMatches(made.state, bolg, you, heroOf(1), made.ctx)).toBe(false);
    expect(subjectMatches(made.state, bolg, other, heroOf(1), made.ctx)).toBe(true);
  });

  it("is listed once by a pick of the staging area or an enemy engaged with another player (Son of Arnor 01015:A:1; counted, since Bolg is immune to a player card's pick)", () => {
    const spec: PickSpec = { type: "enemy", control: "any", staging: true, engaged: "other" };
    const candidates = pickCandidates(made.state, spec, 1, [], null, made.ctx, undefined, undefined, true);
    expect(candidates.filter((id) => id === bolg)).toHaveLength(1);
    expect(candidates).toContain(first(made.state, "f3"));
  });
});
