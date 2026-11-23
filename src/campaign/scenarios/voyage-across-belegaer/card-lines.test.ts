// Rules: dcce.ship-objectives, dcce.prepare-your-fleet, dcce.scalable-upgradable, rr.player-elimination, rr.removed-from-game, rr.attachment-cards (data/rules/entries.json). Lines: the
// ships' "If the <ship> is destroyed, its controller is eliminated from the game." (110138:A:4, 110138:B:5, 110139:A:5, 110139:B:6, 11082:A:4, 110140:A:4, 110140:B:5, 11083:A:6, 110141:A:6,
// 110141:B:7), the Upgraded Modification boons' "When <boon> leaves play, remove it from the game." (11173:B:1, 11174:B:1, 11175:B:1) and "Attached Ship gets +1 <stat>." (11172:B:2,
// 11175:B:2), read from the ledger (data/printed/dream-chaser.json). Each test runs its table a second time with the records of its line left out (`without`,
// test/scenarios/voyage-across-belegaer/scene.ts) and shows the result differs.
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../../../rules/interpret/constants.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { modifiedStat, placeDamage } from "../../../rules/core/keywords.ts";
import { settle } from "../../../rules/engine/machine.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { ARMOR_PLATING, BALLISTA, ENLARGED_QUARTERS, EXTRA_SAILS, SHIPS, loadVoyageWorld, voyageTable, type VoyageLayout, type VoyageWorld } from "../../../../test/scenarios/voyage-across-belegaer/scene.ts";

let world: VoyageWorld;

beforeAll(async () => {
  world = await loadVoyageWorld();
});

function make(layout: VoyageLayout = {}) {
  const made = voyageTable(world, { heading: "Sun", ships: [{ code: SHIPS.dreamChaser, seat: 0 }], phase: "Encounter", ...layout });
  return { ...made, state: syncConstants(made.state, made.ctx) };
}
type Table = ReturnType<typeof make>;

// The ship is destroyed by damage: damage up to its hit points, then the sweep settles.
function destroyed(made: Table, id: string): ScenarioState {
  const hit = placeDamage(made.state, id, 99, made.ctx.cards, [], "framework", { rule: "rr.damage" });
  return settle(syncConstants({ ...hit, window: null }, made.ctx), made.ctx, []);
}

describe("If the ship is destroyed, its controller is eliminated from the game", () => {
  // [line, ship code, side, the line of the same text on the card's other side]
  const ROWS = [
    ["110138:A:4", SHIPS.duskbringer, "up", "110138:B:5"],
    ["110138:B:5", SHIPS.duskbringer, "B", "110138:A:4"],
    ["110139:A:5", SHIPS.glorinaith, "up", "110139:B:6"],
    ["110139:B:6", SHIPS.glorinaith, "B", "110139:A:5"],
    ["11082:A:4", "11082", "up", "11082:A:4"],
    ["110140:A:4", SHIPS.narelenya, "up", "110140:B:5"],
    ["110140:B:5", SHIPS.narelenya, "B", "110140:A:4"],
    ["11083:A:6", "11083", "up", "11083:A:6"],
    ["110141:A:6", SHIPS.silverWing, "up", "110141:B:7"],
    ["110141:B:7", SHIPS.silverWing, "B", "110141:A:6"],
  ] as const;

  it.each(ROWS)("%s eliminates the player who controls the ship (%s on side %s), not the first player", (line, code, face, other) => {
    // The first player (seat 0) has the Dream-chaser; seat 1 controls the ship that is destroyed and still has a hero, so only the card's text eliminates them.
    const layout: VoyageLayout = { seats: 2, ships: [{ code: SHIPS.dreamChaser, seat: 0 }, { code, seat: 1, face }] };
    const made = make(layout);
    const ship = made.ships[1] ?? "";
    expect(made.state.cards[ship]?.face).toBe(face);
    const next = destroyed(made, ship);
    expect(next.cards[ship]?.zone).not.toBe("play");
    expect(next.seats[1]?.eliminated).toBe(true);
    expect(next.seats[0]?.eliminated).toBe(false);
    expect(next.lost).toBe(false);
    const bare = make({ ...layout, without: [line, other] });
    const kept = destroyed(bare, bare.ships[1] ?? "");
    expect(kept.cards[bare.ships[1] ?? ""]?.zone).not.toBe("play");
    expect(kept.seats[1]?.eliminated).toBe(false);
  });
});

describe("the Upgraded Modification boons", () => {
  // The boon on its Upgraded side, attached to seat 1's Silver Wing (the first player keeps the Dream-chaser).
  const fitted = (code: string, without: readonly string[] = []) => {
    const made = make({ seats: 2, ships: [{ code: SHIPS.dreamChaser, seat: 0 }, { code: SHIPS.silverWing, seat: 1 }], fitted: [code], fittedShip: 1, fittedFace: "B", without });
    const boon = Object.values(made.state.cards).find((card) => card.code === code)?.id ?? "";
    return { made, boon };
  };

  it.each([
    ["11173:B:1", BALLISTA, "11173:A:1"],
    ["11174:B:1", ENLARGED_QUARTERS, "11174:A:1"],
    ["11175:B:1", EXTRA_SAILS, "11175:A:1"],
  ] as const)("%s When the boon leaves play with the ship it is on, it is removed from the game, not discarded", (line, code, other) => {
    const { made, boon } = fitted(code);
    expect(made.state.cards[boon]?.face).toBe("B");
    expect(destroyed(made, made.ships[1] ?? "").cards[boon]?.zone).toBe("removed");
    const bare = fitted(code, [line, other]);
    expect(destroyed(bare.made, bare.made.ships[1] ?? "").cards[bare.boon]?.zone).not.toBe("removed");
  });

  it.each([
    ["11173:B:1", BALLISTA, "11173:A:1"],
    ["11174:B:1", ENLARGED_QUARTERS, "11174:A:1"],
    ["11175:B:1", EXTRA_SAILS, "11175:A:1"],
  ] as const)("%s When the boon is discarded by a player card effect, it is removed from the game", (line, code, other) => {
    const discard = (table: ReturnType<typeof fitted>) => {
      const next = runInstruction({ ...table.made.state, window: null }, { verb: "Discard", target: { kind: "self" } }, { seat: 1, sourceId: table.boon }, table.made.ctx, []);
      return settle(syncConstants(next, table.made.ctx), table.made.ctx, []);
    };
    const table = fitted(code);
    expect(discard(table).cards[table.boon]?.zone).toBe("removed");
    const bare = fitted(code, [line, other]);
    expect(discard(bare).cards[bare.boon]?.zone).not.toBe("removed");
  });

  it.each([
    ["11172:B:2", ARMOR_PLATING, "defense"],
    ["11175:B:2", EXTRA_SAILS, "willpower"],
  ] as const)("%s Attached Ship gets +1 %s, and no other ship does", (line, code, which) => {
    const statOf = (made: Table, id: string) => modifiedStat(made.state, made.state.cards[id]!, which, made.ctx.cards);
    const plain = make({ seats: 2, ships: [{ code: SHIPS.dreamChaser, seat: 0 }, { code: SHIPS.silverWing, seat: 1 }] });
    const { made } = fitted(code);
    expect(statOf(made, made.ships[1] ?? "")).toBe(statOf(plain, plain.ships[1] ?? "") + 1);
    expect(statOf(made, made.ships[0] ?? "")).toBe(statOf(plain, plain.ships[0] ?? ""));
    const bare = fitted(code, [line]);
    expect(statOf(bare.made, bare.made.ships[1] ?? "")).toBe(statOf(plain, plain.ships[1] ?? ""));
  });
});
