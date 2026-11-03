// Rules: rr.limits, rr.campaign-cards (data/rules/entries.json); ledger lines 41050:A:3, 41050:B:1, 41044:A:3. What the table says for The Oath: the resource tokens on
// the campaign card, and an Adaptation whose Action is used for the campaign. The engine decides both; nothing here changes a card.
import { beforeAll, describe, expect, it } from "vitest";

import { legalIntents } from "../rules/engine/legal.ts";
import { settle } from "../rules/engine/machine.ts";
import type { PlayerIntent } from "../rules/engine/reduce.ts";
import { loadOathWorld, oathTable, type OathWorld } from "../../scripts/oath-scene.ts";
import { first, send, start } from "../../scripts/past-scene.ts";

import { oathDetail } from "./oath-preview.ts";
import { sheetFor, wonSheet } from "./sheets.ts";
import type { SheetNames } from "./sheet-types.ts";
import { campaignTokens } from "./widgets.ts";

let world: OathWorld;

beforeAll(async () => {
  world = await loadOathWorld();
});

const nameOf = (code: string) => world.cards.get(code)?.name ?? code;

describe("the resource tokens on the campaign card (41050:A:3)", () => {
  it("shows the number the engine wrote, named for the card, in a Campaign Mode game of The Oath", () => {
    const made = oathTable(world, { campaign: true });
    expect(campaignTokens(made.state, made.ctx.effects, nameOf)).toEqual({ name: "The Oath", tokens: 0 });
    const id = first(made.state, "41050");
    const more = { ...made.state, cards: { ...made.state.cards, [id]: { ...made.state.cards[id]!, resources: 4 } } };
    expect(campaignTokens(more, made.ctx.effects, nameOf)).toEqual({ name: "The Oath", tokens: 4 });
  });

  it("shows nothing in a standalone game (no campaign card), and nothing for a campaign card that places no token", () => {
    const made = oathTable(world, {});
    expect(campaignTokens(made.state, made.ctx.effects, nameOf)).toBeNull();
    const withCard = oathTable(world, { campaign: true });
    expect(campaignTokens(withCard.state, withCard.ctx.effects.filter((effect) => effect.cardCode !== "41050"), nameOf)).toBeNull();
  });
});

describe("an Adaptation's preview (41044:A:3)", () => {
  it("says its Action is used once the Campaign Log records it, and says nothing before", () => {
    const fresh = oathTable(world, { attachments: ["41044"] });
    expect(oathDetail(fresh.state, fresh.ctx, first(fresh.state, "41044"))).toBeNull();
    const used = oathTable(world, { attachments: ["41044"], facts: { usedOnce: ["41044"] } });
    expect(oathDetail(used.state, used.ctx, first(used.state, "41044"))).toBe("Its Action is used for this campaign.");
    // Another Adaptation's use does not mark this one, and a card without the limit says nothing.
    const other = oathTable(world, { attachments: ["41044"], facts: { usedOnce: ["41045"] } });
    expect(oathDetail(other.state, other.ctx, first(other.state, "41044"))).toBeNull();
    expect(oathDetail(used.state, used.ctx, used.hero)).toBeNull();
  });
});

describe("the end-of-round Response sheet (41050:A:3, 41050:B:1)", () => {
  it("is headed 'End of round' and says what 6 or more tokens lead to", () => {
    const made = oathTable(world, { campaign: true, phase: "Refresh" });
    let run = start(settle({ ...made.state, window: null }, made.ctx, []));
    for (let guard = 0; guard < 14 && run.state.window?.kind !== "response"; guard += 1) {
      const intents = legalIntents(run.state, made.ctx);
      const next = intents.find((intent) => intent.type === "Pass") ?? intents[0];
      if (!next) break;
      run = send(run, next as PlayerIntent, made.ctx);
    }
    expect(run.state.window?.kind).toBe("response");
    const names: SheetNames = { card: (id) => nameOf(run.state.cards[id]?.code ?? id), line: () => null };
    const sheet = sheetFor(run.state, made.ctx, legalIntents(run.state, made.ctx), names);
    expect(sheet?.kind).toBe("trigger");
    if (sheet?.kind !== "trigger") return;
    expect(sheet.step).toBe("End of round");
    expect(sheet.title).toBe("The Oath");
    expect(sheet.note).toContain("6 or more tokens at the end earn Guilty Conscience.");
  });
});

describe("the dock of a won game (rr.campaign-cards)", () => {
  it("offers the Resolution, not rewards, when the campaign card's Resolution asks nothing (41050:B:1)", () => {
    const made = oathTable(world, { campaign: true });
    const sheet = wonSheet({ ...made.state, stageCleared: true });
    expect(sheet.kind === "outcome" ? [sheet.note, sheet.action] : []).toEqual(["The scenario is won. The campaign card's Resolution is next.", "See the Resolution"]);
  });
});
