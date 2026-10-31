import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../catalog/boundary.ts";
import { pushCardEffects } from "../rules/effect-frames.ts";
import { settle } from "../rules/machine.ts";
import { syncConstants } from "../rules/constants.ts";
import { addModifier } from "../rules/keywords.ts";
import { updateCard } from "../rules/state.ts";
import type { ScenarioState } from "../rules/state.ts";
import { spawn } from "../rules/zones.ts";
import { CODES, fateTable, idOf, legalIntents, loadFateWorld, send, start, type FateLayout, type FateWorld, type PlayerIntent } from "../../scripts/fate-scene.ts";

import { causeKey, causeText, type LogNames } from "./log.ts";
import { pictureCode, pictureKey } from "./picture-key.ts";
import { readoutFor } from "./readout.ts";
import { pileSelector, secondPilesOf } from "./selectors.ts";
import { shownName } from "./shown-name.ts";
import { sheetFor } from "./sheets.ts";
import type { PickOption, Sheet, SheetNames } from "./sheet-types.ts";
import { previewCards } from "./table-preview.ts";
import { trayTiles } from "./tray-logic.ts";
import { islandTell } from "./uncharted-words.ts";

// Rules: dcce.uncharted, dcce.uncharted-deck (data/rules/entries.json). What the table says of a Lost Island and of the Fate of Númenor's choices: a card on its Lost Island side is a Lost Island in
// every tile, label and log line (its real name and picture never show), the Uncharted deck is a pile, and the words of Calphon, Spyglass, Aimless Wandering and the trade of damage for threat.
let world: FateWorld;

beforeAll(async () => {
  world = await loadFateWorld();
});

const L = (code: string, progress = 0) => ({ code, face: "B" as const, progress });

function make(layout: FateLayout = {}) {
  const made = fateTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

// The names the table gives: a card by its picture key, so a Lost Island is "Lost Island"; the real name only for a look.
function namesOf(get: () => ScenarioState): SheetNames {
  const nameOf = (key: string) => shownName(key, world.cards.get(pictureCode(key)));
  return {
    card: (id) => {
      const card = get().cards[id];
      return nameOf(card ? pictureKey(card) : id);
    },
    facedown: (id) => nameOf(get().cards[id]?.code ?? id),
    line: () => null,
  };
}

// The first Trigger the table offers, by the start of its effect id.
function triggerOf(made: ReturnType<typeof make>, prefix?: string): PlayerIntent {
  const found = legalIntents(made.state, made.ctx).find((intent) => intent.type === "Trigger" && (prefix == null || intent.effectId.startsWith(prefix)));
  if (!found || found.type !== "Trigger") throw new Error("No action is offered");
  return found;
}

function sheetOf(state: ScenarioState, ctx: ReturnType<typeof make>["ctx"]): Sheet {
  const sheet = sheetFor(state, ctx, legalIntents(state, ctx), namesOf(() => state));
  if (!sheet) throw new Error("No sheet");
  return sheet;
}

// An effect's frame pushed and settled: the first window it opens.
function reveal(made: ReturnType<typeof make>, code: string): ScenarioState {
  const spawned = spawn(made.state, code, { zone: "staging" });
  const effects = made.ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === "whenRevealed");
  const pushed = pushCardEffects(spawned.state, "whenRevealed", spawned.id, spawned.state.firstPlayer, false, effects, made.ctx, []);
  return settle({ ...pushed, window: null }, made.ctx, []);
}

describe("a Lost Island in a tray tile", () => {
  it("is drawn from its Lost Island picture and named Lost Island with what tells it apart", () => {
    const made = make({ phase: "Travel", uncharted: [], staging: [L(CODES.lushJungle, 3), L(CODES.shrine), CODES.steepPlateau] });
    const sheet = sheetOf(made.state, made.ctx);
    const tiles = trayTiles(sheet);
    const island = tiles.find((tile) => tile.code === `${CODES.lushJungle}.B`);
    expect(island?.label).toBe("Lost Island · 3 progress · 1st in staging");
    expect(tiles.find((tile) => tile.code === `${CODES.shrine}.B`)?.label).toBe("Lost Island · 2nd in staging");
    expect(tiles.find((tile) => tile.code === CODES.steepPlateau)?.label).not.toContain("Lost Island");
  });

  it("carries the Lost Island picture on a trigger tile too", () => {
    const made = make({ uncharted: [], staging: [L(CODES.lushJungle, 5), L(CODES.shrine)] });
    const trigger = trayTiles({
      kind: "trigger",
      key: "t",
      step: "Action",
      title: "Action",
      note: "",
      hide: null,
      pass: "Pass",
      options: [],
    } as unknown as Sheet);
    expect(trigger).toEqual([]);
    const intents = legalIntents(made.state, made.ctx).filter((intent) => intent.type === "Trigger");
    expect(intents.length).toBeGreaterThan(0);
    const sheet = sheetFor({ ...made.state, window: { kind: "response", seat: 0, options: [] } as never }, made.ctx, intents, namesOf(() => made.state));
    const tiles = sheet ? trayTiles(sheet) : [];
    expect(tiles.map((tile) => tile.code)).toContain(`${CODES.lushJungle}.B`);
    expect(tiles.map((tile) => tile.label).join("|")).toContain("Lost Island");
  });
});

describe("a Lost Island's preview", () => {
  it("offers no Details, and a card on its real side does", () => {
    const made = make({ staging: [L(CODES.lushJungle), CODES.steepPlateau] });
    const describe = (code: string, key = code) => ({ name: shownName(key, world.cards.get(pictureCode(key))), source: null });
    const hidden = previewCards(made.state, made.ctx, idOf(made.state, CODES.lushJungle), describe, () => "x").cards[0];
    expect(hidden?.name).toBe("Lost Island");
    expect(hidden?.lostIsland).toBe(true);
    const shown = previewCards(made.state, made.ctx, idOf(made.state, CODES.steepPlateau), describe, () => "x").cards[0];
    expect(shown?.lostIsland).toBeUndefined();
  });

  it("is the real side only for the look that shows it", () => {
    const made = make({ staging: [L(CODES.lushJungle)] });
    const id = idOf(made.state, CODES.lushJungle);
    const looking = { ...made.state, window: { kind: "look" as const, seat: 0, cardIds: [id], side: "A" as const } };
    const describe = (code: string, key = code) => ({ name: shownName(key, world.cards.get(pictureCode(key))), source: null });
    expect(previewCards(looking, made.ctx, id, describe, () => "x").cards[0]?.lostIsland).toBeUndefined();
  });
});

describe("the log", () => {
  it("names a cause on the Lost Island side a Lost Island, and one on the real side by its name", () => {
    const names: LogNames = {
      card: (id) => id,
      code: (key) => shownName(key, world.cards.get(pictureCode(key))),
      effectCard: (effectId, lineId) => {
        const code = made.ctx.effects.find((effect) => effect.id === effectId)?.cardCode;
        return code ? causeKey(code, lineId, world.cards.get(code)?.keywords.uncharted === true) : null;
      },
      rule: () => null,
      line: () => null,
    };
    const made = make({ staging: [L(CODES.lushJungle, 5)] });
    expect(causeText({ effect: "11030:action:1", line: "11030:B:4" }, names)).toBe("Lost Island");
    expect(causeText({ effect: "11030:forced:1", line: "11030:A:1" }, names)).toBe("Lush Jungle");
  });
});

describe("the Uncharted deck pile", () => {
  it("is the second slot's pile while a game deals the deck, drawn as the Lost Island side, and nothing else changes", () => {
    const none = make({});
    expect(secondPilesOf(none.state)).toEqual([]);
    const made = make({ uncharted: [CODES.lushJungle, CODES.forbiddenCoast] });
    expect(secondPilesOf(made.state)).toEqual(["unchartedDeck"]);
    const view = pileSelector("unchartedDeck", 0)(made.state);
    expect(view.ids).toHaveLength(2);
    expect(view.top?.face).toBe("B");
    expect(secondPilesOf({ corsairDeck: [], uncharted: made.state.uncharted })).toEqual(["corsairDeck", "corsairDiscard"]);
  });
});

describe("the words of the Fate of Númenor's choices", () => {
  it("Calphon's look says the switch comes next, and its options are the switch and the hand kept", () => {
    const made = make({ seats: 2, calphon: "up", hand: ["filler", "filler"], deckOf: ["c1", "c3"] });
    const run = send(start(made.state), triggerOf(made, "110013"), made.ctx);
    expect(run.state.window?.kind).toBe("look");
    expect(sheetOf(run.state, made.ctx).note).toBe("The bottom of your deck. You may switch it with a card in your hand next.");
    const done = send(run, { type: "Pass" }, made.ctx);
    const labels = trayTiles(sheetOf(done.state, made.ctx)).map((tile) => tile.label);
    expect(labels).toEqual(["Switch it with a card in your hand", "Keep your hand"]);
  });

  it("Spyglass says 2 progress on a Lost Island, 4 on its Upgraded side", () => {
    for (const [side, amount] of [["up", 2], ["B", 4]] as const) {
      const made = make({ seats: 2, calphon: side, spyglass: side, staging: [L(CODES.lushJungle)] });
      const labels = trayTiles(sheetOf(send(start(made.state), triggerOf(made, "11180"), made.ctx).state, made.ctx)).map((tile) => tile.label);
      expect(labels).toContain(`Place 1 progress on a location (${amount} on a Lost Island)`);
    }
  });

  it("Aimless Wandering leads with the trade, shows each character's Willpower and keeps no 'only you see it'", () => {
    const made = make({ seats: 2, staging: [L(CODES.lushJungle), L(CODES.shrine)] });
    let state = made.state;
    for (const id of Object.keys(state.cards)) if (state.cards[id]?.zone === "heroes") state = updateCard(state, id, { committed: true });
    const asked = reveal({ ...made, state }, CODES.wandering);
    expect(asked.window?.kind).toBe("choose");
    const removal = trayTiles(sheetOf(asked, made.ctx));
    expect(removal.length).toBeGreaterThan(0);
    expect(removal.every((tile) => tile.stats.some((stat) => stat.word === "Willpower"))).toBe(true);
    const next = send({ state: asked, steps: [] }, legalIntents(asked, made.ctx).find((intent) => intent.type === "Choose") ?? { type: "Pass" }, made.ctx);
    const either = trayTiles(sheetOf(next.state, made.ctx)).map((tile) => tile.label);
    if (either.some((label) => label.startsWith("Raise"))) expect(either).toContain("Raise each player's threat by 2 to look at a Lost Island's facedown side");
    expect(JSON.stringify(sheetOf(next.state, made.ctx))).not.toContain("Only you see it");
  });

  it("the trade of damage for threat names the player and what is left of Calphon", () => {
    const made = make({ seats: 2, campaign: true, calphon: "up" });
    const trade: Effect = { id: "trade", cardCode: CODES.campaignCard, lines: ["11179:A:2"], timing: "whenRevealed", instructions: [{ verb: "TradeDamageForThreat", damage: 1, threat: 1 }] };
    const ctx = { ...made.ctx, effects: [...made.ctx.effects, trade] };
    const card = idOf(made.state, CODES.campaignCard);
    const state = settle({ ...pushCardEffects({ ...made.state, window: null }, "whenRevealed", card, 0, false, [trade], ctx, []), window: null }, ctx, []);
    const first = sheetOf(state, ctx);
    expect(first.kind).toBe("pick");
    const note = first.kind === "pick" ? first.note : "";
    expect(note).toMatch(/take 1 damage to lower Player 1's threat by 1\?/);
    const options: readonly PickOption[] = first.kind === "pick" ? first.options : [];
    expect(options.map((option) => option.id)).toEqual(["trade", "keep"]);
  });

  it("a Lost Island's look note no longer says only you see it", () => {
    const made = make({ staging: [L(CODES.lushJungle, 4)] });
    const look = send(start(made.state), triggerOf(made), made.ctx).state;
    expect(sheetOf(look, made.ctx).kind === "pick" && (sheetOf(look, made.ctx) as { note: string }).note).toBe("The facedown side of a Lost Island. Nothing on it happens and it stays facedown.");
  });
});

describe("islandTell", () => {
  it("tells Lost Islands apart by progress and place, and says nothing of any other card", () => {
    const made = make({ uncharted: [], staging: [L(CODES.lushJungle, 2), L(CODES.shrine), CODES.steepPlateau] });
    const card = (code: string) => made.state.cards[idOf(made.state, code)]!;
    expect(islandTell(made.state, card(CODES.lushJungle))).toBe("2 progress · 1st in staging");
    expect(islandTell(made.state, card(CODES.shrine))).toBe("2nd in staging");
    expect(islandTell(made.state, card(CODES.steepPlateau))).toBeNull();
  });
});

describe("the attack on a card that limits its damage", () => {
  it("is read as the damage it takes at most (Revenant, 11181:A:3)", () => {
    const base = make({ phase: "Combat", engaged: [{ code: CODES.revenant, seat: 0 }] });
    const enemy = idOf(base.state, CODES.revenant);
    const attackers = Object.values(base.state.cards).filter((card) => card.zone === "heroes").map((card) => card.id);
    // Its Forced effect sets the limit as it joins the staging area (11181:A:3); the heroes hit hard.
    const limited = addModifier(base.state, enemy, enemy, "damageLimit", 2, "whileSourceInPlay");
    const made = { ...base, state: attackers.reduce((state, id) => addModifier(state, id, id, "attack", 6, "endOfPhase"), limited) };
    const sheet = { kind: "multi", key: "attackers", step: "Combat", title: "", note: "", verb: "Attack", options: [], build: { kind: "attack", enemyId: enemy }, allowEmpty: false, preselected: [], alternative: null } as unknown as Sheet;
    const readout = readoutFor(made.state, made.ctx, sheet, { key: "attackers", ids: attackers, shares: [] }, (id) => id);
    expect(readout?.result).toBe("2 damage, the most it takes at a time");
  });
});
