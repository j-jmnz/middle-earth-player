// Rules: rr.guarded, rr.engaged, hrd.side-quests (data/rules/entries.json); ledger lines 17106:A:1, 17091:A:1, 17093:A:2, 17094:A:1, 17101:A:3, 17102:A:2, 17104:A:1, 17107:B:2, 17108:A:1 (docs/scenarios/haradrim/the-black-serpent.md, Table).
// What the table says of The Black Serpent's pieces: a Harad objective lies in the staging area, hangs on an encounter card (an attachment of it), or is held by a hero (an attachment of the hero); The Black Serpent in the staging area
// is considered engaged with each player who holds one; Don't Let Them Escape! is a side quest in the staging area. The set-aside objectives lie out of play and draw nowhere. The engine decided each number; nothing here changes one.
// No control types damage, resources, threat, progress or life.
import { describe, expect, it } from "vitest";

import { consideredEngagedSeats } from "../../rules/core/engaged.ts";
import { claimedBy, idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { effectById } from "../../rules/windows/listen.ts";
import { guardWith } from "../../rules/families/objectives/guard.ts";
import { addsNoThreatNotes, carriedDetail, consideredChip, emptyEngagedWord, guardedChip, serpentDetail } from "../readouts/haradrim/serpent.ts";
import { bandBounds, hitSlot } from "../layout/hits.ts";
import { tableLayout, type LayoutViews, type PileViews } from "../layout/layout.ts";
import { PILES, TABLE_ZONES, pileSelector, secondPilesOf, zoneSelector } from "../store/selectors.ts";
import { zoneFactsOf } from "../store/zone-facts.ts";
import { logLines } from "../store/log.ts";
import { momentOf } from "../store/outcome.ts";
import { sheetFor } from "../choice/sheets.ts";
import { ASKS } from "../words/asks/the-black-serpent.ts";
import { asksOption, type AskFacts } from "../words/asks.ts";

const BANNER = "17091";
const GARB = "17092";
const SERPENT = "17094";
const GUARD = "17095";
const SIDE_QUEST = "17104";
const at = (layout: Layout = {}) => tableFromLayout("the-black-serpent", { seats: 1, phase: "Quest", ...layout });
// An objective a hero holds, as the claim leaves it: zone attached, on the hero, faceup, controlled by the hero's player and claimed.
const claim = (state: ReturnType<typeof at>["state"], code: string, hero: string) => claimedBy(state, idOf(state, code), idOf(state, hero));
const attachedTo = (t: ReturnType<typeof at>, zone: "staging" | "play", code: string): string[] =>
  zoneSelector(zone, 0)(t.state).entries.find((entry) => entry.card.code === code)?.attached.map((card) => card.code) ?? [];

describe("the Harad objectives", () => {
  it("17091:A:1 draws an objective that lies in the staging area as a card of that zone", () => {
    const t = at({ staging: [BANNER] });
    expect(t.state.cards[idOf(t.state, BANNER)]?.zone).toBe("staging");
    expect(zoneSelector("staging", 0)(t.state).entries.map((entry) => entry.card.code)).toContain(BANNER);
  });

  it("17108:A:1 and 17101:A:3 draw an objective hung on an encounter card under it, as one attachment of that card", () => {
    const t = at({ staging: [SERPENT], attached: [{ code: GARB, to: SERPENT, encounter: true }] });
    expect(attachedTo(t, "staging", SERPENT)).toEqual([GARB]);
  });

  it("17106:A:1 and 17107:B:2 draw an objective a hero holds under that hero", () => {
    const t = at({ staging: [BANNER] });
    const held = { ...t, state: claim(t.state, BANNER, "dh1") };
    expect(held.state.cards[idOf(held.state, BANNER)]).toMatchObject({ zone: "attached", claimed: true });
    expect(attachedTo(held, "play", "dh1")).toEqual([BANNER]);
  });

  it("17106:A:1 draws no card of an objective that is set aside, out of play", () => {
    const t = at({ setAside: [BANNER] });
    const drawn = (["staging", "play"] as const).flatMap((zone) => zoneSelector(zone, 0)(t.state).entries.map((entry) => entry.card.code));
    expect(drawn).not.toContain(BANNER);
  });
});

describe("The Black Serpent", () => {
  const STATS = [["engagedWithClaimers", 1]] as const;
  it("17107:B:2 is considered engaged with the player who holds an objective, and with no one while none is held", () => {
    const layout = { staging: [SERPENT], modified: [{ code: SERPENT, from: SERPENT, stats: STATS }] } satisfies Layout;
    const none = at(layout);
    expect(consideredEngagedSeats(none.state, idOf(none.state, SERPENT), [0])).toEqual([]);
    const held = at({ ...layout, staging: [SERPENT, BANNER] });
    const claimed = claim(held.state, BANNER, "dh1");
    expect(consideredEngagedSeats(claimed, idOf(claimed, SERPENT), [0])).toEqual([0]);
    expect(zoneSelector("staging", 0)(claimed).entries.map((entry) => entry.card.code)).toContain(SERPENT);
  });
});

describe("The Black Serpent's Forced choice", () => {
  it("17094:A:3 binds the Serpent's Attack now into the label: the printed Attack and the stage number of the main quest", () => {
    const t = at({ stage: "17107", staging: [SERPENT] });
    const choose = effectById(t.ctx, "17094:forced:1")?.instructions[0];
    const asked: AskFacts = { game: syncConstants(t.state, t.ctx), ctx: t.ctx, names: { card: (id) => id, code: (code) => code }, instruction: choose!, effectId: "17094:forced:1", source: idOf(t.state, SERPENT), options: [] };
    expect(asksOption(asked, "attack", ASKS)).toEqual({ label: "The Black Serpent attacks you (Attack 4)" });
    expect(asksOption(asked, "progress", ASKS)).toEqual({ label: "Remove 2 progress from the main quest" });
  });
});

describe("Chaos in the Night's caution", () => {
  const caution = (seats: 1 | 2, threat: [number, number]) => {
    const t = at({ seats, threat });
    const choose = effectById(t.ctx, "17103:whenRevealed:1")?.instructions[0];
    const asked: AskFacts = { game: t.state, ctx: t.ctx, names: { card: (id) => id, code: (code) => code }, instruction: choose!, effectId: "17103:whenRevealed:1", source: null, options: [] };
    return asksOption(asked, "threat", ASKS)?.caution;
  };

  it("17103:A:1 warns when any player would reach 50, and names that player, not only the one who chooses", () => {
    expect(caution(1, [30, 28])).toBeUndefined();
    expect(caution(1, [47, 28])).toContain("your threat");
    expect(caution(2, [30, 30])).toBeUndefined();
    expect(caution(2, [30, 47])).toContain("Player 2's threat");
    expect(caution(2, [47, 30])).toContain("Player 1's threat");
    expect(caution(2, [48, 49])).toContain("Player 1's and Player 2's");
  });
});

describe("The fighters beside an attacker", () => {
  it("a hero the attack destroyed is in the discard pile and is no longer drawn beside its attacker", () => {
    const t = at({ engaged: [{ code: GUARD, seat: 0 }] });
    const enemy = idOf(t.state, GUARD);
    const hero = idOf(t.state, "dh1");
    const fighting = { ...t.state, pendingAttack: { enemyId: enemy, seat: 0, defenderId: hero } };
    expect(zoneSelector("engaged", 0)(fighting).entries[0]?.paired.map((card) => card.id)).toEqual([hero]);
    const gone = { ...fighting, cards: { ...fighting.cards, [hero]: { ...fighting.cards[hero]!, zone: "discard" as const } } };
    expect(zoneSelector("engaged", 0)(gone).entries[0]?.paired).toEqual([]);
  });
});

describe("The claim of a Harad objective", () => {
  it("17106:B:1 is told in the banner and the log: the objective is claimed and attached to the hero, with the player when several play", () => {
    for (const [seats, words] of [[1, "Banner of the Serpent is claimed: attached to Aragorn."], [2, "Banner of the Serpent is claimed: attached to Aragorn, Player 1."]] as const) {
      const step = { kind: "claim", cardId: "i1", heroId: "i2", seat: 0 } as const;
      const names = { card: (id: string) => (id === "i1" ? "Banner of the Serpent" : "Aragorn"), code: (code: string) => code, effectCard: () => null, line: () => null, rule: () => null } as never;
      expect(logLines([step], names).map((line) => line.text)).toContain(seats === 1 ? "Banner of the Serpent is claimed: attached to Aragorn, Player 1." : words);
      const state = { ...at({ seats }).state };
      const moment = momentOf(state, state, [step], { card: (id: string) => (id === "i1" ? "Banner of the Serpent" : "Aragorn") } as never);
      expect(JSON.stringify(moment)).toContain(words);
    }
  });
});

describe("The Defeat note", () => {
  it("names the player whose last hero was destroyed from the heroes the table kept", () => {
    const t = at({});
    const heroes = Object.values(t.state.cards).filter((card) => card.zone === "heroes").map((card) => card.id);
    const owned = Object.fromEntries(Object.entries(t.state.cards).map(([id, card]) => [id, heroes.includes(id) ? { ...card, owner: 0 } : card]));
    const lost = { ...t.state, cards: owned, lost: true, lossReason: "No seats remain", seats: [{ ...t.state.seats[0], eliminated: true }, { ...t.state.seats[1], eliminated: true }] as typeof t.state.seats };
    const names = { card: (id: string) => id, line: () => null };
    const without = sheetFor(lost, t.ctx, [], names);
    const kept = sheetFor(lost, t.ctx, [], names, new Set(heroes));
    expect(without).toMatchObject({ kind: "outcome", note: "No seats remain." });
    expect(kept).toMatchObject({ kind: "outcome", note: "No seats remain. Player 1's last hero was destroyed." });
  });
});

describe("What the table says of the considered-engaged Serpent, a guarded objective and what a card carries", () => {
  const name = (id: string) => id;
  const stage2 = (layout: Layout = {}) => {
    const t = at({ stage: "17107", staging: [SERPENT, GUARD], ...layout });
    const game = syncConstants(t.state, t.ctx);
    return { t, game };
  };

  it("17107:B:2 says the Serpent is engaged with the player who holds an objective: a chip, the empty engagement word, the quest note and its preview", () => {
    const { t, game: bare } = stage2({ claimed: [{ code: BANNER, by: "dh1" }] });
    const game = syncConstants(bare, t.ctx);
    const serpent = idOf(game, SERPENT);
    expect(consideredChip(game, serpent)).toEqual({ chip: "Engaged", speech: "Considered engaged with you" });
    expect(emptyEngagedWord(game, 0, (id) => game.cards[id]?.code ?? id)).toBe("17094 is engaged with you");
    expect(addsNoThreatNotes(game, 0, (id) => game.cards[id]?.code ?? id)).toBe(" · 17094 adds no threat: it is engaged with you");
    expect(serpentDetail(game, t.ctx, serpent)).toContain("Considered engaged with you");
    // Nobody holds an objective: no chip, the plain word, no note.
    const none = stage2().game;
    expect(consideredChip(none, idOf(none, SERPENT))).toBeNull();
    expect(emptyEngagedWord(none, 0, name)).toBe("No enemy engaged");
    expect(addsNoThreatNotes(none, 0, name)).toBe("");
  });

  it("17107:B:2 names the players in a two-handed game", () => {
    const t = at({ seats: 2, stage: "17107", staging: [SERPENT], claimed: [{ code: BANNER, by: "dh1" }] });
    const game = syncConstants(t.state, t.ctx);
    expect(consideredChip(game, idOf(game, SERPENT))).toEqual({ chip: "Engaged P1", speech: "Considered engaged with Player 1" });
    expect(emptyEngagedWord(game, 1, name)).toBe("No enemy engaged");
  });

  it("17094:A:2 totals: the preview says X is the stage number and each stat now", () => {
    const { t, game } = stage2();
    expect(serpentDetail(game, t.ctx, idOf(game, SERPENT))).toBe("X is the stage number of the main quest: Threat 2, Attack 4, Defense 3 now.");
  });

  it("17091:A:1 wears a Guarded chip that names the guard, also when the guard is engaged", () => {
    const t = at({ staging: [BANNER, GUARD] });
    const guarded = guardWith(t.state, idOf(t.state, GUARD), idOf(t.state, BANNER));
    expect(guardedChip(guarded, t.ctx, idOf(guarded, BANNER), (id) => guarded.cards[id]?.code ?? id)).toEqual({ chip: "Guarded", speech: "Guarded by 17095" });
    const engaged = guardWith(t.state, idOf(t.state, GUARD), idOf(t.state, BANNER), true);
    const stands = { ...engaged, cards: { ...engaged.cards, [idOf(engaged, GUARD)]: { ...engaged.cards[idOf(engaged, GUARD)]!, zone: "engaged" as const } } };
    expect(guardedChip(stands, t.ctx, idOf(stands, BANNER), (id) => stands.cards[id]?.code ?? id)?.speech).toBe("Guarded by 17095");
    expect(guardedChip(t.state, t.ctx, idOf(t.state, BANNER), name)).toBeNull();
  });

  it("17108:A:1 and 17092:A:3 say what a card carries: the objective a hero holds, the objective hanging on the Serpent", () => {
    const held = at({ claimed: [{ code: GARB, by: "dh1" }] });
    expect(carriedDetail(held.state, held.ctx, idOf(held.state, "dh1"), (id) => held.state.cards[id]?.code ?? id)).toBe("Holds 17092.");
    const hung = at({ stage: "17108", staging: [SERPENT], attached: [{ code: BANNER, to: SERPENT, encounter: true }] });
    expect(carriedDetail(hung.state, hung.ctx, idOf(hung.state, SERPENT), (id) => hung.state.cards[id]?.code ?? id)).toBe("17091 hangs on it.");
    expect(carriedDetail(held.state, held.ctx, idOf(held.state, "dh2"), name)).toBeNull();
  });
});

describe("The band of a held or hung objective", () => {
  const laid = (width: number, height: number, scale = 1) => {
    const t = at({ staging: [SERPENT], attached: [{ code: BANNER, to: SERPENT, encounter: true }] });
    const facts = zoneFactsOf(t.ctx.cards);
    const views = Object.fromEntries(TABLE_ZONES.map((zone) => [zone, zoneSelector(zone, 0, facts)(t.state)])) as unknown as LayoutViews;
    const piles = Object.fromEntries([...PILES, ...secondPilesOf(t.state)].map((pile) => [pile, pileSelector(pile, 0)(t.state)])) as unknown as PileViews;
    return tableLayout(width, height, views, piles, { scale });
  };

  it("17108:A:1 is a target of 44 pt: a tap just under the strip finds the objective, one on the host finds the host, one far below finds nothing", () => {
    for (const [width, height] of [[667, 375], [844, 390], [1280, 800]] as const) {
      const layout = laid(width, height);
      const band = layout.slots.find((slot) => slot.kind === "attachment" && slot.zone === "staging");
      const host = layout.slots.find((slot) => slot.kind === "card" && slot.zone === "staging");
      expect(band, `${width}x${height}`).toBeDefined();
      if (!band || !host) continue;
      const bounds = bandBounds(band);
      expect(bounds.h).toBeGreaterThanOrEqual(44);
      const middle = bounds.x + bounds.w / 2;
      // The strip itself and 12 pt under it find the objective: the grown target.
      expect(layout.slots[hitSlot(layout.slots, middle, band.y + band.h - 3)]?.id).toBe(band.id);
      expect(layout.slots[hitSlot(layout.slots, middle, band.y + band.h + 12)]?.id, `${width}x${height}`).toBe(band.id);
      // On the host's own face the host wins.
      expect(layout.slots[hitSlot(layout.slots, host.x + host.w / 2, host.y + host.h / 2)]?.id).toBe(host.id);
      expect(hitSlot(layout.slots, middle, band.y + band.h + 40)).toBe(-1);
    }
  });
});

describe("Don't Let Them Escape!", () => {
  it("17104:A:1 lies in the staging area as a side quest card the table already draws, beside the other staged cards", () => {
    const t = at({ staging: [SIDE_QUEST, GUARD] });
    expect(zoneSelector("staging", 0)(t.state).entries.map((entry) => entry.card.code)).toEqual(expect.arrayContaining([SIDE_QUEST, GUARD]));
  });
});
