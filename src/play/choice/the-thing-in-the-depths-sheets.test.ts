// Rules: dcce.grapple, dcce.stormcaller-and-the-thing, rr.travel, rr.attacks-outside-the-combat-phase, rr.step-6-2 (data/rules/entries.json). What the table says in The Thing in the Depths beyond the grapple words: the travel
// rows of a location with enemies grappled with it, the Travel cost another card gave a location, the stage that lets the players travel over the active location, the Ship location's Threat against the total that
// loses the game, where an attack of the Thing and of a detached arm comes from, the beats of the stage swap, and the fold list's reading of a location.
import { beforeAll, describe, expect, it } from "vitest";

import { legalIntents } from "../../rules/engine/legal.ts";
import { settle } from "../../rules/engine/machine.ts";
import type { EngineStep } from "../../rules/core/intents.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { CODES, depthsTable, idOf, loadDepthsWorld, resolveRecords, send, start, type DepthsLayout, type DepthsWorld } from "../../../test/scenarios/the-thing-in-the-depths/scene.ts";

import { slotNumbers } from "../cards/card-effects.ts";
import { attackSource, grappleDetail, grantedTravelWords, returnsNote, shipLoss } from "../words/grapple.ts";
import { logLines } from "../store/log.ts";
import { momentOf } from "../store/outcome.ts";
import { STAGING_RANK, stagingRank } from "../layout/row-fold.ts";
import { sheetFor } from "./sheets.ts";
import { previewCards } from "../cards/table-preview.ts";
import { zoneSelector } from "../store/selectors.ts";
import type { SheetNames } from "./sheet-types.ts";
import { zoneFactsOf } from "../store/zone-facts.ts";

let world: DepthsWorld;

beforeAll(async () => {
  world = await loadDepthsWorld();
});

const nameOf = (code: string): string => world.cards.get(code)?.name ?? code;
const names = (state: ScenarioState): SheetNames => ({ card: (id) => nameOf(state.cards[id]?.code ?? id), line: (id) => id });
const make = (layout: DepthsLayout) => depthsTable(world, layout);

function travelSheet(layout: DepthsLayout) {
  const made = make({ phase: "Travel", ...layout });
  const sheet = sheetFor(made.state, made.ctx, legalIntents(made.state, made.ctx), names(made.state));
  return { made, sheet: sheet?.kind === "pick" ? sheet : null };
}

describe("the travel rows", () => {
  it("say how many enemies come out from under a location and that one attacks the first player, never naming a facedown card, and arm the confirm", () => {
    const { made, sheet } = travelSheet({ staging: [CODES.cargoHold, CODES.weatherDeck], grappled: [[CODES.thrashing, CODES.cargoHold], [CODES.crushing, CODES.cargoHold], [CODES.giant, CODES.weatherDeck]] });
    const cargo = sheet?.options.find((item) => item.id === idOf(made.state, CODES.cargoHold));
    expect(cargo?.label).toContain("2 enemies come out from under it and join the staging area, and one attacks the first player");
    expect(cargo).toMatchObject({ caution: "Tap again: 2 enemies come out from under it and join the staging area, and one attacks the first player" });
    const weather = sheet?.options.find((item) => item.id === idOf(made.state, CODES.weatherDeck));
    expect(weather?.label).toContain("1 enemy comes out from under it and joins the staging area");
    expect(weather?.label).not.toContain("attacks");
    expect(JSON.stringify(sheet)).not.toContain("Thrashing");
    expect(JSON.stringify(sheet)).not.toContain("Crushing");
    expect(sheet?.note).toContain("its own Threat stops counting");
    expect(sheet?.note).toContain("add theirs");
  });

  it("keep the printed note and arm nothing for a location with nothing grappled under it", () => {
    const { made, sheet } = travelSheet({ staging: [CODES.cargoHold] });
    expect(sheet?.note).toBe("The location becomes active and leaves staging: its threat stops counting, and progress goes on it before the quest.");
    expect(sheet?.options.find((item) => item.id === idOf(made.state, CODES.cargoHold))).not.toHaveProperty("caution");
  });

  it("show the Travel cost Weather Deck gives each other Deck location", () => {
    const { made, sheet } = travelSheet({ staging: [CODES.weatherDeck, CODES.quarterDeck] });
    expect(grantedTravelWords(made.state, idOf(made.state, CODES.quarterDeck))).toBe("Travel: each player exhausts a character they control");
    expect(grantedTravelWords(made.state, idOf(made.state, CODES.weatherDeck))).toBeNull();
    expect(sheet?.options.find((item) => item.id === idOf(made.state, CODES.quarterDeck))?.label).toContain("Travel: each player exhausts a character they control");
  });

  it("say where the active location goes when stage 3B lets the players travel over it", () => {
    const { made, sheet } = travelSheet({ stage: "12041", active: CODES.forecastle, staging: [CODES.cargoHold] });
    const note = returnsNote(made.state, made.ctx, names(made.state).card);
    expect(note).toBe("Forecastle Deck returns to the staging area (Threat 3).");
    expect(sheet?.note).toContain("Forecastle Deck returns to the staging area (Threat 3).");
    expect(returnsNote(make({ phase: "Travel", active: CODES.forecastle, staging: [CODES.cargoHold] }).state, made.ctx, (id) => id)).toBeNull();
  });
});

describe("a Ship location against the total that loses the game", () => {
  const ship = (threat: number): DepthsLayout => ({ stage: "12041", staging: [CODES.cargoHold], grappled: Array.from({ length: threat }, () => [CODES.thrashing, CODES.cargoHold] as const) });

  it("says its Threat of 9 in the preview and the reader's line, and the pill is threat red at 9", () => {
    const low = make(ship(3));
    const cargo = idOf(low.state, CODES.cargoHold);
    // Cargo Hold prints 2 Threat; 3 enemies add 6.
    expect(shipLoss(low.state, low.ctx, cargo)).toEqual({ text: "8/9", danger: false, speech: "Threat 8 of 9: at 9, at the end of the round, the players lose" });
    const high = make(ship(4));
    const full = shipLoss(high.state, high.ctx, idOf(high.state, CODES.cargoHold));
    expect(full).toEqual({ text: "10/9", danger: true, speech: "Threat 10 of 9: at the end of the round the players lose" });
    expect(slotNumbers(high.state, high.ctx, idOf(high.state, CODES.cargoHold)).loss?.danger).toBe(true);
    expect(slotNumbers(low.state, low.ctx, cargo).loss?.danger).toBe(false);
    const describe = (code: string) => ({ name: nameOf(code), picture: null, landscape: false, text: "", inactive: [] as string[] });
    const shown = previewCards(low.state, low.ctx, cargo, describe as never, (id) => nameOf(low.state.cards[id]?.code ?? ""));
    expect(shown.cards[0]?.detail).toBe("Grappled: 3 facedown enemies, +6 Threat. Threat 8 of 9: at 9, at the end of the round, the players lose");
  });

  it("is said for no location while stage 3 is not the stage, nor for a location with no Ship trait", () => {
    const early = make({ stage: "12040", staging: [CODES.cargoHold] });
    expect(shipLoss(early.state, early.ctx, idOf(early.state, CODES.cargoHold))).toBeNull();
    const plain = make({ stage: "12041", staging: ["place"] });
    expect(shipLoss(plain.state, plain.ctx, idOf(plain.state, "place"))).toBeNull();
  });
});

describe("where an attack comes from", () => {
  it("names the Thing's relay while Eye of the Beast is engaged with the defender", () => {
    const made = make({ phase: "Combat", staging: [CODES.thing], engaged: [CODES.eye], deck: ["f0", "f0"] });
    const eye = idOf(made.state, CODES.eye);
    const thing = idOf(made.state, CODES.thing);
    const attacking: ScenarioState = { ...made.state, pendingAttack: { enemyId: thing, seat: 0 } };
    expect(attackSource(attacking, made.ctx, names(made.state).card)).toBe(` ${nameOf(CODES.eye)} is engaged with you: ${nameOf(CODES.thing)} attacks you from the staging area.`);
    expect(eye).toBeDefined();
    expect(attackSource({ ...attacking, pendingAttack: null }, made.ctx, names(made.state).card)).toBe("");
  });

  it("names a detached arm's attack on the first player", () => {
    const made = make({ phase: "Travel", staging: [CODES.cargoHold], grappled: [[CODES.crushing, CODES.cargoHold]] });
    const run = send(start(made.state), { type: "Travel", locationId: idOf(made.state, CODES.cargoHold) }, made.ctx);
    const arm = Object.values(run.state.cards).find((card) => card.code === CODES.crushing)?.id ?? "";
    expect(run.state.pendingAttack).toMatchObject({ enemyId: arm, immediate: true });
    expect(attackSource(run.state, made.ctx, (id) => nameOf(run.state.cards[id]?.code ?? ""))).toBe(` ${nameOf(CODES.crushing)} was detached: it attacks the first player now.`);
    // The log tells the arm coming out from under its location before its attack.
    const kinds = run.steps.map((step) => step.kind);
    expect(kinds.indexOf("detach")).toBeGreaterThanOrEqual(0);
    expect(kinds.indexOf("detach")).toBeLessThan(kinds.indexOf("attack"));
    const label = { card: (id: string) => nameOf((run.state.cards[id] ?? made.state.cards[id])?.code ?? ""), code: nameOf, effectCard: () => null, line: () => null, rule: () => null } as never;
    const lines = logLines(run.steps, label).map((line) => line.text);
    expect(lines.indexOf("Crushing Arm comes out from under Cargo Hold")).toBeGreaterThanOrEqual(0);
    expect(lines.indexOf("Crushing Arm comes out from under Cargo Hold")).toBeLessThan(lines.findIndex((line) => line.endsWith("attacks Player 1")));
  });
});

describe("the swap at stage 2", () => {
  it("gives the log a line for each flip, the set that leaves the game and the set shuffled in, and the banner the printed words of the stage", () => {
    const made = make({ stage: "12040", setAside: [CODES.thing, CODES.eye], engaged: [{ code: CODES.sahir, seat: 0 }, { code: CODES.naasiyah, seat: 0 }, CODES.umbar] });
    const run = resolveRecords(made.state, made.ctx, "12040", "whenRevealed", idOf(made.state, "12040"));
    const steps: readonly EngineStep[] = [{ kind: "advance", cardId: idOf(made.state, "12040") }, ...run.steps];
    const label = { card: (id: string) => nameOf((run.state.cards[id] ?? made.state.cards[id])?.code ?? ""), code: nameOf, effectCard: () => null, line: () => null, rule: () => null } as never;
    const lines = logLines(steps, label).map((line) => line.text);
    expect(lines).toContain("Captain Sahír flips to its objective side, and Player 1 takes it");
    expect(lines).toContain("Na'asiyah flips to its objective side, and Player 1 takes it");
    expect(lines).toContain("1 card of Corsair Raiders leaves the game");
    expect(lines.some((line) => /^\d+ cards? of The Thing in the Depths (is|are) shuffled into the encounter deck$/.test(line))).toBe(true);
    const moment = momentOf(made.state, run.state, steps, { card: (id: string) => nameOf((run.state.cards[id] ?? made.state.cards[id])?.code ?? ""), revealed: () => "12040:B:1" });
    expect(moment?.lines.map((line) => line.text)).toContain("12040:B:1");
  });
});

describe("the fold list and the fold order", () => {
  it("folds a location with enemies grappled under it last and reads its count in the list", () => {
    const made = make({ staging: [CODES.cargoHold, CODES.weatherDeck, "mild"], grappled: [[CODES.thrashing, CODES.cargoHold]] });
    const state = settle(made.state, made.ctx, []);
    const facts = zoneFactsOf(made.ctx.cards);
    const staging = zoneSelector("staging", 0, facts)(state).entries;
    const cargo = staging.filter((entry) => entry.card.code === CODES.cargoHold);
    const weather = staging.filter((entry) => entry.card.code === CODES.weatherDeck);
    const enemy = staging.filter((entry) => entry.card.code === "mild");
    expect(stagingRank(cargo)).toBe(STAGING_RANK.grappled);
    expect(stagingRank(weather)).toBe(STAGING_RANK.location);
    expect(stagingRank(enemy)).toBe(STAGING_RANK.enemy);
    expect(STAGING_RANK.grappled).toBeGreaterThan(STAGING_RANK.other);
    expect(grappleDetail(state, idOf(state, CODES.cargoHold))).toBe("Grappled: 1 facedown enemy, +2 Threat");
  });
});
