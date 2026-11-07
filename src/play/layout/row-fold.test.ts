// Rules: dcce.ship-enemies, dcce.boarding (data/rules/entries.json). The crowding rule of staging and the engagement area (docs/design-system-table.md, Spacing and the play area's rows).
import { describe, expect, it } from "vitest";

import type { CardInstance } from "../../rules/core/state.ts";

import { rowXs } from "./slots.ts";
import { tableLayout, type LayoutViews, type PileViews } from "./layout.ts";
import { hitBounds } from "./hits.ts";
import { FOLD_WORD, foldCount, foldRow, foldTitle, foldWords, groupCards, keeps, leastStep, stagingRank, type FoldGroup } from "./row-fold.ts";
import { PILES, TABLE_ZONES, type PileView, type ZoneEntry, type ZoneId, type ZoneView } from "../store/selectors.ts";
import { touch, UI_SCALES } from "../../ui/ui-scale.ts";

const instance = (id: string, zone: CardInstance["zone"], extra: Partial<CardInstance> = {}): CardInstance => ({
  id,
  code: `c${id}`,
  zone,
  exhausted: false,
  damage: 0,
  progress: 0,
  resources: 0,
  host: null,
  attachments: [],
  committed: false,
  shadowId: null,
  face: "up",
  controller: null,
  enteredPlay: 0,
  ...extra,
});
const entry = (card: CardInstance, extra: Partial<ZoneEntry> = {}): ZoneEntry => ({ card, attached: [], paired: [], fight: null, ...extra });

const group = (id: string, width: number, extra: Partial<FoldGroup> = {}): FoldGroup => ({ id, width, cards: [id], rank: 4, pinned: false, ...extra });
const ROW = { x: 10, width: 300, gap: 6, target: 44, stackW: 40 };

describe("the crowding rule's three tiers", () => {
  it("leaves groups a gap apart while they fit", () => {
    const groups = [group("a", 50), group("b", 50), group("c", 50)];
    const plan = foldRow(groups, ROW);
    expect(plan.xs).toEqual([10, 66, 122]);
    expect(plan.stack).toBeNull();
    expect(plan.step).toBe(Infinity);
    expect(plan.fits).toBe(true);
  });

  it("squeezes groups evenly while every step stays a target, exactly as rowXs does", () => {
    // Six 50 pt groups: natural 330 against 300, a 6 pt squeeze: steps of 50.
    const groups = ["a", "b", "c", "d", "e", "f"].map((id) => group(id, 50));
    const plan = foldRow(groups, ROW);
    expect(plan.stack).toBeNull();
    expect(plan.xs).toEqual(rowXs(groups.map((g) => g.width), ROW.x, ROW.width, ROW.gap));
    expect(plan.step).toBeGreaterThanOrEqual(ROW.target);
    expect(plan.fits).toBe(true);
  });

  it("folds when even 44 pt steps do not fit: groups leave one at a time, the rest fits at 44 pt steps beside the stack", () => {
    const groups = Array.from({ length: 9 }, (_, at) => group(`g${at}`, 50));
    const plan = foldRow(groups, ROW);
    expect(plan.stack).not.toBeNull();
    expect(plan.fits).toBe(true);
    expect(plan.step).toBeGreaterThanOrEqual(ROW.target);
    const shown = plan.xs.filter((x): x is number => x != null);
    // The stack stands at the row's left end, the shown groups after it.
    expect(plan.stack?.x).toBe(ROW.x);
    expect(Math.min(...shown)).toBeGreaterThanOrEqual(ROW.x + ROW.stackW + ROW.gap);
    expect(shown.length + (plan.stack?.groups.length ?? 0)).toBe(9);
    // Folding one fewer would not have fit.
    const fewer = leastStep(Array.from({ length: shown.length + 1 }, () => 50), ROW.width - ROW.stackW - ROW.gap, ROW.gap);
    expect(fewer).toBeLessThan(ROW.target);
  });

  it("is rowXs for a row whose steps stay at 44 pt, whatever the groups' widths", () => {
    for (const widths of [[50], [50, 80], [50, 80, 120, 50], [60, 60, 60, 60, 60], [49, 49, 49, 49, 49, 49]]) {
      const groups = widths.map((w, at) => group(`g${at}`, w));
      const plan = foldRow(groups, ROW);
      if (plan.stack) continue;
      expect(plan.xs).toEqual(rowXs(widths, ROW.x, ROW.width, ROW.gap));
    }
  });

  it("counts every folded card in the stack and says it in words", () => {
    const groups = [group("a", 60, { cards: ["a", "a2"], rank: 2 }), ...Array.from({ length: 8 }, (_, at) => group(`g${at}`, 50))];
    const plan = foldRow(groups, ROW);
    expect(plan.stack?.cards.length).toBeGreaterThanOrEqual(2);
    expect(plan.stack?.top).toBe(groups[plan.stack?.groups[0] ?? 0]?.id);
    expect(foldWords(3, "staging")).toBe("3 more cards in staging");
    expect(foldWords(1, "the engagement area")).toBe("1 more card in the engagement area");
    expect(foldCount(3)).toBe("+3");
    expect(FOLD_WORD).toBe("More");
    expect(foldTitle("staging")).toBe("Staging");
  });
});

describe("what folds first", () => {
  const widths = (count: number) => Array.from({ length: count }, () => 50);

  it("folds the lowest rank first and, within a rank, the leftmost", () => {
    const groups = [group("e0", 50, { rank: 4 }), group("l0", 50, { rank: 3 }), group("e1", 50, { rank: 4 }), group("t0", 50, { rank: 1 }), group("l1", 50, { rank: 3 }), ...widths(4).map((w, at) => group(`x${at}`, w, { rank: 4 }))];
    const plan = foldRow(groups, ROW);
    const folded = plan.stack?.groups.map((at) => groups[at]?.id) ?? [];
    // The stack lists them left to right; the order they left in is by rank, so the controlled card (rank 1) went first, then the locations.
    expect(folded).toContain("t0");
    if (folded.length === 2) expect(folded).toEqual(["l0", "t0"].sort((a, b) => groups.findIndex((g) => g.id === a) - groups.findIndex((g) => g.id === b)));
    if (folded.length >= 3) expect(folded).toEqual(expect.arrayContaining(["t0", "l0"]));
  });

  it("never folds a pinned group, however crowded the row", () => {
    const groups = Array.from({ length: 12 }, (_, at) => group(`g${at}`, 50, { pinned: at % 3 === 0 }));
    const plan = foldRow(groups, ROW);
    for (const [at, g] of groups.entries()) if (g.pinned) expect(plan.xs[at], g.id).not.toBeNull();
    expect(plan.stack?.groups.every((at) => !groups[at]?.pinned)).toBe(true);
  });

  it("stops folding when only pinned groups are left, even if they still overlap", () => {
    const groups = Array.from({ length: 10 }, (_, at) => group(`g${at}`, 50, { pinned: true }));
    const plan = foldRow(groups, ROW);
    expect(plan.stack).toBeNull();
    expect(plan.fits).toBe(false);
    expect(plan.xs.every((x) => x != null)).toBe(true);
  });

  it("ranks a staging group: cards the players control, then guarded pairs, then locations, then enemies", () => {
    // A reveal leaves every staging card with the revealing seat as its controller (frames.ts): only the claimed marker puts a card first.
    const revealed = { controller: 0 };
    const controlled = [entry(instance("t", "staging", { ...revealed, claimed: true }), { kind: "other" })];
    const pair = [entry(instance("o", "staging", revealed), { kind: "other" }), entry(instance("g", "staging", { ...revealed, guard: true, host: "o" }), { kind: "enemy" })];
    const location = [entry(instance("l", "staging", revealed), { kind: "location" })];
    const foe = [entry(instance("e", "staging", revealed), { kind: "enemy" })];
    const bare = [entry(instance("u", "staging", revealed))];
    expect([controlled, pair, location, foe].map(stagingRank)).toEqual([1, 2, 3, 4]);
    expect(stagingRank(bare)).toBe(4);
    expect(stagingRank([])).toBe(5);
  });

  it("keeps a group that holds a card the moment names, one of its attachments or a fighter beside it", () => {
    const host = instance("h", "engaged");
    const group1 = [entry(host, { attached: [instance("s", "shadow", { face: "down" })], paired: [instance("p", "play")], fight: "defense" })];
    expect(keeps(group1, new Set(["h"]))).toBe(true);
    expect(keeps(group1, new Set(["s"]))).toBe(true);
    expect(keeps(group1, new Set(["p"]))).toBe(true);
    expect(keeps(group1, new Set(["z"]))).toBe(false);
    expect(keeps(group1, undefined)).toBe(false);
    expect(groupCards(group1)).toEqual(["h", "p"]);
  });
});

// A table with `staging` enemies and `engaged` enemies, at a canvas the table view leaves.
function crowded(staging: number, engaged: number, extra: { attacker?: boolean } = {}): { views: LayoutViews; piles: PileViews } {
  const zones: Record<ZoneId, readonly ZoneEntry[]> = {
    questStage: [entry(instance("q", "questStage"))],
    staging: Array.from({ length: staging }, (_, at) => entry(instance(`s${at}`, "staging"), { kind: at % 2 === 0 ? "enemy" : "location" })),
    activeLocation: [],
    secondActiveLocation: [],
    engaged: Array.from({ length: engaged }, (_, at) => entry(instance(`e${at}`, "engaged", { controller: 0 }), { kind: "enemy", ...(extra.attacker && at === 1 ? { paired: [instance("p", "play")], fight: "defense" as const } : {}) })),
    play: [],
    hand: [],
  };
  const views = Object.fromEntries(TABLE_ZONES.map((zone) => [zone, { zone, seat: 0, entries: zones[zone] } satisfies ZoneView])) as unknown as LayoutViews;
  const piles = Object.fromEntries(PILES.map((pile) => [pile, { pile, seat: 0, ids: ["x"], top: null } satisfies PileView])) as unknown as PileViews;
  return { views, piles };
}

const SCREENS = [{ width: 591, height: 338 }, { width: 760, height: 330 }, { width: 980, height: 600 }];

describe("the rule on the table", () => {
  it("keeps every step at least 44 pt at every scale, folding only what must", () => {
    for (const scale of [UI_SCALES.small, UI_SCALES.medium, UI_SCALES.large, UI_SCALES.xlarge]) {
      for (const screen of SCREENS) {
        for (const count of [3, 6, 9, 14]) {
          const { views, piles } = crowded(count, count);
          const layout = tableLayout(screen.width, screen.height, views, piles, { scale });
          for (const zone of ["staging", "engaged"] as const) {
            const slots = layout.slots.filter((slot) => slot.zone === zone && slot.kind === "card").sort((a, b) => a.x - b.x);
            const target = touch(scale, 44);
            for (let at = 0; at + 1 < slots.length; at += 1) {
              const step = (slots[at + 1]?.x ?? 0) - (slots[at]?.x ?? 0);
              const natural = (slots[at]?.w ?? 0) + 6 * scale;
              // Neighbours overlap only by a squeeze that leaves a target.
              if (step < natural - 0.5) expect(step, `${zone} ${count} ${screen.width} ${scale}`).toBeGreaterThanOrEqual(target - 0.5);
            }
          }
        }
      }
    }
  });

  it("folds staging and the engagement area at 667 x 375 when six or more groups do not fit, and counts the folded cards", () => {
    const { views, piles } = crowded(14, 14);
    const layout = tableLayout(591, 338, views, piles, {});
    expect(layout.folds?.map((fold) => fold.id).sort()).toEqual(["fold:engaged", "fold:staging"]);
    for (const fold of layout.folds ?? []) {
      const slot = layout.slots.find((candidate) => candidate.id === fold.id);
      expect(slot?.kind).toBe("pile");
      expect(slot?.count).toBe(fold.cards.length);
      const drawn = layout.slots.filter((candidate) => candidate.zone === fold.zone && candidate.kind === "card").map((candidate) => candidate.id);
      // A folded card is on no slot, and every card is either drawn or folded.
      for (const id of fold.cards) expect(drawn).not.toContain(id);
      const total = 14;
      expect(drawn.length + fold.cards.length).toBe(total);
    }
  });

  it("folds nothing for a table that fits, and the same for a Fellowship staging row of five", () => {
    const { views, piles } = crowded(5, 2);
    const layout = tableLayout(591, 338, views, piles, {});
    expect(layout.folds).toEqual([]);
  });

  it("keeps a card the open moment names, and the enemy that is attacking or fought, out of the fold", () => {
    const { views, piles } = crowded(14, 14, { attacker: true });
    const layout = tableLayout(591, 338, views, piles, { keep: new Set(["s0", "s1", "e4"]), attacker: "e2" });
    const drawn = new Set(layout.slots.map((slot) => slot.id));
    for (const id of ["s0", "s1", "e4", "e2", "e1"]) expect(drawn.has(id), id).toBe(true);
    for (const fold of layout.folds ?? []) for (const id of ["s0", "s1", "e4", "e2", "e1"]) expect(fold.cards).not.toContain(id);
  });

  it("folds the engagement area's enemies oldest first (leftmost first)", () => {
    const { views, piles } = crowded(2, 12);
    const layout = tableLayout(591, 338, views, piles, {});
    const fold = layout.folds?.find((candidate) => candidate.zone === "engaged");
    expect(fold).toBeDefined();
    const folded = fold?.cards ?? [];
    expect(folded).toEqual(Array.from({ length: folded.length }, (_, at) => `e${at}`));
  });

  it("gives the fold stack a 44 pt hit, as every pile has", () => {
    const { views, piles } = crowded(14, 14);
    for (const scale of [UI_SCALES.small, UI_SCALES.medium, UI_SCALES.large, UI_SCALES.xlarge]) {
      const layout = tableLayout(591, 338, views, piles, { scale });
      for (const fold of layout.folds ?? []) {
        const slot = layout.slots.find((candidate) => candidate.id === fold.id);
        expect(slot).toBeDefined();
        const hit = hitBounds(slot as NonNullable<typeof slot>);
        expect(hit.w).toBeGreaterThanOrEqual(44);
        expect(hit.h).toBeGreaterThanOrEqual(44);
      }
    }
  });
});

describe("a group that sheds cards before it folds (the Stormcaller's area)", () => {
  // A pinned lead group of 200 with three cards that can leave (50 wide once they have), its last card 150 in.
  const lead = (extra: Partial<FoldGroup> = {}) => group("lead", 200, { rank: 0, pinned: true, cards: ["lead", "a", "b", "c"], tail: 150, shed: { cards: ["a", "b", "c"], keptWidth: 50, keptTail: 0 }, ...extra });

  it("sheds its cards into the stack before any other group folds, and never folds the lead", () => {
    const groups = [lead(), ...Array.from({ length: 3 }, (_, at) => group(`g${at}`, 50))];
    const plan = foldRow(groups, ROW);
    expect(plan.shed).toEqual([0]);
    expect(plan.stack?.groups).toEqual([]);
    expect(plan.stack?.cards).toEqual(["a", "b", "c"]);
    expect(plan.stack?.top).toBe("a");
    expect(plan.xs[0]).not.toBeNull();
  });

  it("counts the last card's strip against the target: a group squeezed so its last card shows less than a target sheds or lets another group fold", () => {
    // 200 + 60 + 60 + 60 + gaps = 338 in 300: a 13 pt squeeze keeps every step above the target, but the lead's last card (150 in) would show only 56 - 13 = 43.
    const groups = [lead({ shed: { cards: [], keptWidth: 200, keptTail: 150 } }), group("x", 60), group("y", 60), group("z", 60)];
    const plan = foldRow(groups, { ...ROW, target: 44 });
    expect(plan.stack?.groups.length).toBeGreaterThan(0);
    expect(plan.fits).toBe(true);
  });

  it("sheds when the lead is alone and wider than the row, and keeps a pinned card's place by not listing it", () => {
    const plan = foldRow([lead({ width: 400, shed: { cards: ["b", "c"], keptWidth: 150, keptTail: 100 } })], { ...ROW, width: 300 });
    expect(plan.shed).toEqual([0]);
    expect(plan.stack?.cards).toEqual(["b", "c"]);
  });

  it("leaves the plan as it was for groups with no cards to shed", () => {
    const groups = Array.from({ length: 9 }, (_, at) => group(`g${at}`, 50));
    expect(foldRow(groups, ROW).shed).toEqual([]);
  });
});
