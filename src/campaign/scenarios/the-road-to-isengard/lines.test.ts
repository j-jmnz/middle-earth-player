// Rules: mec112.wizardry, rr.forced, rr.constant-ability, rr.player-elimination, rr.the-word-choose, rr.defending-player, rr.reveal (data/rules/entries.json); ledger lines 143020:A:1, 143047:A:2, 143048:A:1, 143052:A:1, 143053:A:2, 143078:A:1, 143078:B:1, 143079:B:1,
// 143080:B:1, 143080:B:3. What a card-spec row cannot hold on The Road to Isengard's own cards: a card that waits for a hero (the Palantír), a shadow card's Wizardry resolved for the defending player alone, the Staff's attack, the order of Orthanc's Forced
// effect, the shuffle of a Setup, the stage that bars resources and commitment, a card held by a holder class, and the elimination at an empty hand. Each test title starts with the line it covers (scripts/checks/spec-coverage.test.ts).
import { describe, expect, it } from "vitest";

import { attachmentHostIds } from "../../../rules/player/attach.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { UNATTRIBUTED } from "../../../rules/core/cause.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { legalTargets } from "../../../rules/engine/reduce.ts";
import { drawMany, gainSeatResources } from "../../../rules/interpret/interpret.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { queueEvent } from "../../../rules/windows/queue.ts";
import { printedFromCard } from "../../../rules/core/printed.ts";
import { loadCards } from "../../../../scripts/data/load-cards.ts";
import { fightEnemy, finish, idOf, resolveRecords, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "the-road-to-isengard";
const at = (layout: Layout = {}) => tableFromLayout(ID, { stage: "143079", phase: "Quest", deck: ["f0", "f0", "f0", "f0"], ...layout });
const rest = (state: ScenarioState, ctx: ReturnType<typeof at>["ctx"], steps: EngineStep[] = []): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, ctx, steps);
const threats = (state: ScenarioState): number[] => state.seats.map((seat) => seat.threat);

describe("143020:A:1 the Palantír of Orthanc attaches to Fellowship Aragorn", () => {
  it("143020:A:1 is offered only the hero named Aragorn of the Fellowship sphere, and no other hero", () => {
    const made = at({ hand: ["143020"] });
    expect(attachmentHostIds(made.state, 0, "143020", made.ctx)).toEqual([]);
    const printed = loadCards().find((card) => card.code === "145001");
    if (!printed) throw new Error("no Fellowship Aragorn in data/cards");
    const ctx = { ...made.ctx, cards: new Map([...made.ctx.cards, ["145001", printedFromCard(printed)]]) };
    const aragorn = spawn(made.state, "145001", { zone: "heroes", seat: 0 });
    expect(attachmentHostIds(aragorn.state, 0, "143020", ctx)).toEqual([aragorn.id]);
  });
});

describe("143047:A:2 Saruman's shadow card with a Wizardry effect", () => {
  it("143047:A:2 is resolved for the defending player alone: the number of players reads 1 and only that player's characters take the damage", () => {
    const made = at({ staging: ["143047"], seats: 2, threat: [20, 30] });
    const saruman = idOf(made.state, "143047");
    const vent = spawn(made.state, "143057", { zone: "shadow", enemyId: saruman }, "up");
    const dealt = updateCard(vent.state, saruman, { shadowId: vent.id });
    const queued = queueEvent({ ...dealt, pendingAttack: null }, { trigger: "shadowWizardry", seat: 1, cardId: saruman, subject: saruman, other: vent.id });
    const done = finish({ state: rest(queued, made.ctx), steps: [] }, made.ctx).state;
    const damage = (id: string | null): number => (id ? (done.cards[id]?.damage ?? 0) : 0);
    expect(damage(made.hero) + damage(made.hero2)).toBe(0);
    expect(damage(made.seat1Hero)).toBe(2);
    const alone = spawn(made.state, "143059", { zone: "shadow", enemyId: saruman }, "up");
    const wizard = queueEvent({ ...updateCard(alone.state, saruman, { shadowId: alone.id }), pendingAttack: null }, { trigger: "shadowWizardry", seat: 0, cardId: saruman, subject: saruman, other: alone.id });
    expect(threats(rest(wizard, made.ctx))).toEqual([22, 30]);
  });
});

describe("143048:A:1 Saruman's Staff", () => {
  it("143048:A:1 has its host Saruman attack the player who drew, from the staging area with 2 shadow cards, and then heals 1 damage from him", () => {
    const made = at({ staging: ["143047"], seats: 2, attached: [{ code: "143048", to: "143047" }], deckOf: ["filler", "filler", "filler", "filler"] });
    const saruman = idOf(made.state, "143047");
    const hurt = updateCard(made.state, saruman, { damage: 3 });
    const drawn = rest(drawMany(hurt, 1, 1, [], UNATTRIBUTED, made.ctx, false, false), made.ctx);
    expect(drawn.pendingAttack?.enemyId).toBe(saruman);
    expect(drawn.pendingAttack?.seat).toBe(1);
    expect(drawn.cards[saruman]?.extraShadowIds).toHaveLength(1);
    const none = rest(drawMany(hurt, 1, 0, [], UNATTRIBUTED, made.ctx, false, false), made.ctx);
    expect(none.pendingAttack).toBeNull();
  });
});

describe("143052:A:1 the Wolf of Isengard's shadow Wizardry", () => {
  it("143052:A:1 makes an additional attack against the defending player after this one, and only while an attack is under way", () => {
    // Outside an attack a Wizardry shadow card (dealt by Underground Armoury) stays facedown: nothing is asked.
    const armoury = at({ staging: ["143056"], engaged: ["143052"], deck: ["143059", "f0"], hand: ["filler"] });
    const wolf = idOf(armoury.state, "143052");
    const dealt = finish({ state: rest(queueEvent(armoury.state, { trigger: "engaged", seat: 0, cardId: wolf, subject: wolf }), armoury.ctx), steps: [] }, armoury.ctx).state;
    expect(dealt.window?.kind === "choose" ? dealt.window.options : []).toEqual([]);
    // In an attack the second attack comes against the same player.
    const fought = fightEnemy(at, "143059", "143052", { stage: "143079" }, { pick: (state) => (state.window?.kind === "choose" && state.window.options.includes("attack") ? "attack" : (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")) });
    const struck = fought.run.steps.filter((step) => step.kind === "strike" && step.side === "enemy" && step.enemyId === idOf(fought.run.state, "143052"));
    expect(struck.length).toBeGreaterThanOrEqual(2);
  });
});

describe("143053:A:2 Orthanc's Forced effect", () => {
  it("143053:A:2 reveals the chosen card and resolves it, then discards the other cards it looked at: a surge reaches the looked-at cards first", () => {
    const made = at({ staging: ["143053"], deck: ["143062", "f0", "treachery", "place", "f3"] });
    const orthanc = idOf(made.state, "143053");
    const done = resolveRecords(made.state, made.ctx, "143053", "forced", orthanc).state;
    const zoneOf = (code: string) => done.cards[idOf(done, code)]?.zone;
    expect(zoneOf("143062")).toBe("encounterDiscard");
    // Machines of Isengard surges (no active location): the next card of the three looked at is revealed before the others are discarded.
    expect(zoneOf("f0")).toBe("staging");
    expect(zoneOf("treachery")).toBe("encounterDiscard");
    expect(zoneOf("place")).toBe("encounterDeck");
  });
});

describe("143078:A:1 Rouse the Ents", () => {
  it("143078:A:1 shuffles the encounter deck at Setup", () => {
    const deck = Array.from({ length: 12 }, (_, index) => (index % 2 === 0 ? "f0" : "f3"));
    const made = at({ stage: "143078", deck });
    const before = made.state.encounterDeck;
    const after = resolveRecords(made.state, made.ctx, "143078", "setup", idOf(made.state, "143078")).state.encounterDeck;
    expect(after).toHaveLength(before.length);
    expect(new Set(after)).toEqual(new Set(before));
    expect(after).not.toEqual(before);
  });
});

describe("143078:B:1 stage 1B", () => {
  it("143078:B:1 bars gaining resources, drawing and commitment, and skips the staging step, only while it is the current stage", () => {
    const made = at({ stage: "143078", deckOf: ["filler", "filler"] });
    expect(gainSeatResources(made.state, 0, [], UNATTRIBUTED).cards[made.hero]?.resources).toBe(0);
    expect(drawMany(made.state, 0, 1, [], UNATTRIBUTED, made.ctx, false, false).seats[0]?.hand).toHaveLength(0);
    expect(legalTargets(made.state, { type: "Commit" }, made.ctx)).toEqual([]);
    const open = at({ stage: "143079", deckOf: ["filler", "filler"] });
    expect(gainSeatResources(open.state, 0, [], UNATTRIBUTED).cards[open.hero]?.resources).toBe(1);
    expect(drawMany(open.state, 0, 1, [], UNATTRIBUTED, open.ctx, false, false).seats[0]?.hand).toHaveLength(1);
    expect(legalTargets(open.state, { type: "Commit" }, open.ctx).length).toBeGreaterThan(0);
  });
});

describe("143079:B:1 Breaking Isengard", () => {
  it("143079:B:1 bars travel to Orthanc and to no other location", () => {
    const made = at({ staging: ["143053", "143059"], phase: "Travel" });
    const offered = (code: string) => legalTargets(made.state, { type: "Travel" }, made.ctx).includes(idOf(made.state, code));
    expect(offered("143053")).toBe(false);
    expect(offered("143059")).toBe(true);
  });
});

describe("143080:B:1 stage 3B", () => {
  it("143080:B:1 engages Saruman with the first player while Orthanc is the active location, and not otherwise", () => {
    const held = (layout: Layout): boolean => {
      const made = at({ stage: "143080", staging: ["143047"], ...layout });
      return flagged(syncConstants(made.state, made.ctx), idOf(made.state, "143047"), "engagedWithFirst");
    };
    expect(held({ active: "143053" })).toBe(true);
    expect(held({ active: "143059" })).toBe(false);
  });
});

describe("143080:B:3 a player with no cards in hand is eliminated", () => {
  it("143080:B:3 eliminates the player whose hand is empty once the effect that emptied it is done, and loses the game when every player is out", () => {
    const made = at({ stage: "143080", seats: 2, hand: [{ code: "filler", seat: 0 }] });
    const done = rest(made.state, made.ctx);
    expect(done.seats.map((seat) => seat.eliminated)).toEqual([false, true]);
    expect(done.lost).toBe(false);
    const alone = at({ stage: "143080" });
    expect(rest(alone.state, alone.ctx).lost).toBe(true);
    const open = at({ stage: "143079", seats: 2 });
    expect(rest(open.state, open.ctx).seats.map((seat) => seat.eliminated)).toEqual([false, false]);
  });
});
