// Rules: rr.attachment-cards, rr.forced (data/rules/entries.json); ledger lines 132036:A:1, 132036:A:2.
// AttachSelf to the character an event or an attack names: Dark Bats attaches to the character it damages (Forced) and to the defending character (Shadow), and an attached Dark Bats is a Condition attachment.
import { describe, expect, it } from "vitest";

import { modifiedStat } from "../../core/keywords.ts";
import { countsAsAttachment, hasTrait } from "../../interpret/conditions.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { fightEnemy, idOf, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const table = (layout: Layout = {}) => tableFromLayout("the-battle-of-five-armies", layout);
const BATS = "132036";

describe("AttachSelf to subject and defender (132036)", () => {
  it("132036:A:1 Dark Bats that damages a defending hero attaches to it and leaves the engaged enemies", () => {
    const fought = fightEnemy(table, "f0", BATS, {}, { undefended: true });
    const bats = idOf(fought.run.state, BATS);
    expect(fought.run.state.cards[bats]?.zone).toBe("attached");
    expect(fought.run.state.cards[bats]?.host).toBe(fought.made.hero);
    expect(fought.run.state.cards[fought.made.hero]?.attachments).toContain(bats);
  });

  it("132036:A:2 as a Shadow card it attaches to the defending character", () => {
    const fought = fightEnemy(table, BATS, "f3", {});
    const bats = idOf(fought.run.state, BATS);
    expect(fought.run.state.cards[bats]?.host).toBe(fought.made.hero);
  });

  it("132036:A:2 an undefended attack has no defending character, so the Shadow card is not attached", () => {
    const fought = fightEnemy(table, BATS, "f3", {}, { undefended: true });
    expect(fought.run.state.cards[idOf(fought.run.state, BATS)]?.zone).not.toBe("attached");
  });
});

// The printed "Attached character gets -1 Willpower, -1 Attack, and -1 Defense" (132036:A:1), read on the card the bats hang on.
describe("Attached Dark Bats (132036:A:1)", () => {
  const STATS = ["willpower", "attack", "defense"] as const;
  const statsOf = (fought: ReturnType<typeof fightEnemy<ReturnType<typeof table>, Layout>>, id: string) => {
    const synced = syncConstants(fought.run.state, fought.ctx);
    return STATS.map((stat) => modifiedStat(synced, synced.cards[id]!, stat, fought.ctx.cards));
  };

  it("132036:A:1 the attached character gets -1 Willpower, -1 Attack and -1 Defense, and the card counts as a Condition attachment", () => {
    const withBats = fightEnemy(table, "f0", BATS, {}, { undefended: true });
    const without = fightEnemy(table, "f0", "f3", {}, { undefended: true });
    const host = withBats.made.hero;
    expect(withBats.run.state.cards[idOf(withBats.run.state, BATS)]?.host).toBe(host);
    const base = statsOf(without, without.made.hero);
    expect(statsOf(withBats, host)).toEqual(base.map((value) => Math.max(0, value - 1)));
    expect(base.every((value) => value >= 1)).toBe(true);
    const synced = syncConstants(withBats.run.state, withBats.ctx);
    expect(countsAsAttachment(synced, idOf(synced, BATS), withBats.ctx)).toBe(true);
    expect(hasTrait(synced, idOf(synced, BATS), "Condition", withBats.ctx)).toBe(true);
  });

  it("132036:A:1 the other hero, of the same player or of the second player, gets no penalty", () => {
    const withBats = fightEnemy(table, "f0", BATS, { seats: 2 }, { undefended: true });
    const without = fightEnemy(table, "f0", "f3", { seats: 2 }, { undefended: true });
    expect(statsOf(withBats, withBats.made.hero2)).toEqual(statsOf(without, without.made.hero2));
    const second = withBats.made.seat1Hero!;
    expect(statsOf(withBats, second)).toEqual(statsOf(without, second));
  });

  it("132036:A:1 attached to a card that is not a character (an enemy as the host, as after a type change) it gives no penalty", () => {
    const withBats = fightEnemy(table, "f0", BATS, { staging: ["f3"] }, { undefended: true });
    const without = fightEnemy(table, "f0", "f0", { staging: ["f3"] }, { undefended: true });
    const bats = idOf(withBats.run.state, BATS);
    const location = idOf(withBats.run.state, "f3");
    const moved = { ...withBats, run: { ...withBats.run, state: { ...withBats.run.state, cards: { ...withBats.run.state.cards, [bats]: { ...withBats.run.state.cards[bats]!, host: location } } } } };
    expect(statsOf(moved, location)).toEqual(statsOf(without, idOf(without.run.state, "f3")));
    expect(statsOf(moved, location).some((value) => value > 0)).toBe(true);
  });

  it("132036:A:1 the Forced effect attaches it to an ally that it damages, and not to a character it deals no damage to", () => {
    const ally = fightEnemy(table, "f0", BATS, { play: ["ally"] }, { defender: (made) => idOf(made.state, "ally") });
    expect(ally.run.state.cards[idOf(ally.run.state, BATS)]?.host).toBe(idOf(ally.run.state, "ally"));
    const tough = (state: typeof ally.start, made: { hero: string }) => ({ ...state, modifiers: [...state.modifiers, { instanceId: made.hero, sourceId: made.hero, stat: "defense" as const, amount: 30, until: "endOfRound" as const }] });
    const blocked = fightEnemy(table, "f0", BATS, {}, { tweak: tough });
    expect(blocked.run.state.cards[idOf(blocked.run.state, BATS)]?.zone).not.toBe("attached");
  });
});
