// Rules: ats.hidden-cards-turn-faceup, ats.ally-objectives, rr.first-player, rr.quest-advancement, rr.reveal, rr.surge (data/rules/entries.json); ledger lines 06118:A:1, 06129:A:1, 06132:A:1, 06133:A:1, 05063:A:1.
// The moments a game reaches the objective allies and the stages: the first player token passing in the refresh phase, the quest that defeats stage 1 and reveals Captured!, Lying in Wait revealed from the encounter deck, and an Orc Arsonist that a hidden turn engages in the middle of the combat phase.
import { describe, expect, it } from "vitest";

import { idOf, revealedTop, send } from "../../../../test/harness/scene-kit.ts";
import { CODES, drive, hiddenCodes, opened, table, takes, where } from "../../../../test/scenarios/the-blood-of-gondor/table.ts";

const { ambusher, arsonist, southern, faramir, alcaron, captured, ambush, lyingInWait, looms, rabble } = CODES;
const engagedCodes = (state: Parameters<typeof hiddenCodes>[0], seat = 0) => state.seats[seat]?.engaged.map((id) => state.cards[id]?.code);

describe("the first player token (06132:A:1, 06133:A:1)", () => {
  it("passes in the refresh phase and the two allies go with it to the new first player's play area", () => {
    const t = table({ seats: 2, phase: "PlayerAttacks", play: [faramir, alcaron] });
    const done = drive(t, opened(t), (state) => state.phase === "Planning");
    expect(done.state.firstPlayer).toBe(1);
    for (const code of [faramir, alcaron]) expect(done.state.cards[idOf(done.state, code)]).toMatchObject({ zone: "play", controller: 1 });
    expect(done.state.seats[1]?.play).toContain(idOf(done.state, faramir));
    expect(done.state.seats[0]?.play).not.toContain(idOf(done.state, faramir));
  });

  it("leaves the allies under Captured! where they are", () => {
    const t = table({ seats: 2, phase: "Quest", stage: ambush, progress: 10, committed: ["dh1", "dh2"], play: [faramir, alcaron] });
    const held = drive(t, opened(t), (state) => state.round === 1);
    expect(held.state.firstPlayer).toBe(1);
    for (const code of [faramir, alcaron]) expect(held.state.cards[idOf(held.state, code)]).toMatchObject({ zone: "captive", controller: null });
  });
});

describe("the quest that defeats stage 1 (06118:A:1)", () => {
  it("reveals Captured!: Faramir and Lord Alcaron lie under it, the players do not lose, and every player's hidden cards turn faceup in player order", () => {
    const t = table({ seats: 2, phase: "Quest", stage: ambush, progress: 10, committed: ["dh1", "dh2"], play: [faramir, alcaron], deck: [ambusher, rabble, southern, "f0", "f0", "f0"] });
    const held = takes(t, takes(t, t.state, 0), 1);
    const done = drive(t, opened(t, held), (state) => state.questStage != null && state.cards[state.questStage]?.code === captured);
    expect(done.state.lost).toBe(false);
    for (const code of [faramir, alcaron]) expect(done.state.cards[idOf(done.state, code)]).toMatchObject({ zone: "captive", controller: null, host: idOf(done.state, captured) });
    expect(hiddenCodes(done.state)).toEqual([]);
    expect(engagedCodes(done.state, 0)).toEqual([ambusher]);
    expect(engagedCodes(done.state, 1)).toEqual([rabble]);
  });
});

describe("Lying in Wait (06129:A:1)", () => {
  it("revealed from the encounter deck turns the first player's hidden cards: enemies engage, a treachery's When Revealed resolves, a location joins the staging area, and the other player's cards stay", () => {
    const t = table({ seats: 2, phase: "Quest", deck: [looms, southern, ambusher, ...Array<string>(8).fill("f0")] });
    const held = takes(t, takes(t, t.state, 0, 3), 1);
    const revealed = revealedTop({ state: held, ctx: t.ctx }, lyingInWait);
    expect(engagedCodes(revealed, 0)).toEqual([ambusher]);
    expect(where(revealed, southern)).toBe("staging");
    expect(where(revealed, looms)).toBe("encounterDiscard");
    // Mordor Looms's When Revealed took a card for each player; the second player's first card stays facedown.
    expect(hiddenCodes(revealed, 1).length).toBe(2);
    expect(hiddenCodes(revealed, 0).length).toBe(1);
  });
});

describe("Orc Arsonist engaged by a hidden turn (hidden.shadow-vs-arsonist)", () => {
  it("deals 1 shadow card to each enemy engaged with that player, itself included, before the combat phase deals its cards, which then deal none more", () => {
    const t = table({ phase: "Encounter", engaged: [rabble], deck: [arsonist, ...Array<string>(8).fill("f0")] });
    const at = drive(t, opened(t, takes(t, t.state, 0)), (state) => state.window?.kind === "choose");
    const turned = send(at, { type: "Choose", optionId: "turn" }, t.ctx);
    const shadowsOn = (code: string) => Object.values(turned.state.cards).filter((card) => card.zone === "shadow" && turned.state.cards[card.host ?? ""]?.code === code).length;
    expect(engagedCodes(turned.state)).toEqual([rabble, arsonist]);
    // The engine turns first: the card the Forced effect deals is the one the combat phase would deal (an enemy that holds a shadow card is dealt no second one), so each enemy holds 1.
    expect([shadowsOn(rabble), shadowsOn(arsonist)]).toEqual([1, 1]);
  });
});
