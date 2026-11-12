// Rules: mec113.fortitude-tests, mec113.player-actions-during-fortitude-tests, mec113.dire, rr.then (data/rules/entries.json); ledger lines 146043:A:1, 146047:A:1, 146049:A:3, 146055:A:2, 146057:A:1, 146076:B:2, 146077:B:2, 146079:A:2.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../effects/index.ts";
import { updateCard } from "../../rules/core/state.ts";
import { play } from "../../../test/harness/card-spec-play.ts";
import { reveal } from "../../../test/harness/card-spec.ts";
import { idOf, send, start, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { fortitudeCommitNote, fortitudeCountNote, fortitudeNumbers } from "./fortitude.ts";
import { mountDoomDials, mountDoomHands, mountDoomQuestNote } from "./mount-doom.ts";
import { dialLimit } from "./threat-level.ts";

const ID = "mount-doom";
const CAMPAIGN_CARD = "146079";
const at = (layout: Layout = {}) => tableFromLayout(ID, layout);
const name = (code: string) => code;
const withTokens = (layout: Layout, tokens: number) => {
  const made = at({ campaign: true, ...layout });
  return { ...made, state: updateCard(made.state, idOf(made.state, CAMPAIGN_CARD), { resources: tokens }) };
};

describe("146079:A:2 the tokens on the campaign card", () => {
  it("are a countdown dial that warns at two and at one and has no ring to fill", () => {
    for (const [tokens, level] of [[5, undefined], [2, "near"], [1, "critical"]] as const) {
      const [dial] = mountDoomDials(withTokens({}, tokens).state, name);
      expect(dial).toMatchObject({ id: "doom", testID: "doom-tokens", value: tokens });
      expect(dial?.warn?.level).toBe(level);
      expect(dial?.limit).toBeUndefined();
      expect(dial?.goal).toBeUndefined();
    }
    expect(mountDoomDials(withTokens({}, 1).state, name)[0]?.note).toContain("the next end of round loses");
  });

  it("with none recorded, and none on the card, say the timer does not run, and a standalone game has no dial", () => {
    expect(mountDoomDials(withTokens({}, 0).state, name)[0]?.note).toContain("the timer does not run");
    expect(mountDoomDials(at({}).state, name)).toEqual([]);
  });

  it("are the first dial, before stage 2B's resources", () => {
    const state = withTokens({ stage: "146076", seats: 2 }, 3).state;
    expect(mountDoomDials(state, name).map((dial) => dial.id)).toEqual(["doom", "resources"]);
  });
});

describe("146076:B:2 stage 2B's resources", () => {
  it("are a goal dial against the number of players, full only when the quest advances", () => {
    const made = at({ stage: "146076", seats: 2 });
    const state = updateCard(made.state, idOf(made.state, "146076"), { resources: 1 });
    const [dial] = mountDoomDials(state, name);
    expect(dial).toMatchObject({ id: "resources", value: 1, limit: 2, goal: true });
    expect(dial?.warn).toBeUndefined();
    expect(dial?.note).toContain("1 resource on stage 2B of 2");
    expect(mountDoomDials(at({ stage: "146075" }).state, name)).toEqual([]);
  });
});

describe("146077:B:2 and 146043:A:1 what the quest readout adds", () => {
  it("says the cap after a failed test on stage 3B, and Mount Doom's X while it is in the staging area", () => {
    const made = at({ stage: "146077", staging: ["146043"], threat: [34, 28] });
    expect(mountDoomQuestNote(made.state, made.ctx)).toBe(". Mount Doom's Threat X is 3, the tens digit of the first player's threat (34)");
    const capped = { ...made.state, modifiers: [...made.state.modifiers, { instanceId: "table", sourceId: idOf(made.state, "146077"), stat: "questProgressCap" as const, amount: 5, until: "endOfRound" as const }] };
    expect(mountDoomQuestNote(capped, made.ctx)).toContain("The first player failed the Fortitude test: no more than 5 progress can be placed here this round");
    expect(mountDoomQuestNote(at({ stage: "146076" }).state, made.ctx)).toBe("");
  });
});

describe("146057:A:1 the hero with Heavy and Tired", () => {
  it("is marked on its seat, with what it does", () => {
    const made = at({ seats: 2, attached: [{ code: "146057", to: "dh3" }] });
    const [mark] = mountDoomHands(made.state, made.ctx);
    expect(mark).toMatchObject({ seat: 1, label: "P2 · Tired" });
    expect(mark?.note).toContain("cannot commit to Fortitude tests");
    expect(mountDoomHands(at({}).state, made.ctx)).toEqual([]);
  });
});

describe("146055:A:2 the Fortitude test's sheets and readout", () => {
  const waiting = (layout: Layout, acts: Parameters<typeof play>[1]["act"]) => {
    const done = play(ID, { line: "146055:A:2", layout, act: acts, expect: [] } as never, EFFECTS, false);
    return { state: done.run.state, ctx: done.table.ctx, hero: done.table.hero };
  };

  it("names the cards discarded, the icons added and what failing does while the heroes are chosen, and counts the Willpower picked", () => {
    const { state, ctx, hero } = waiting({ staging: ["146047"], deck: ["f0", "f0"], threat: [34, 28] }, [reveal("146055")]);
    expect(state.window?.kind).toBe("fortitudeCommit");
    const note = fortitudeCommitNote(state, ctx);
    expect(note).toBe("Exhaust heroes to commit them. 3 encounter cards are discarded next, and their Sauron's Eye icons, 1 more already added, must be fewer than the Willpower you commit. If you fail, raise your threat by 10.");
    for (const sentence of note.split(/(?<=\.)\s+/)) expect(sentence.split(/\s+/).length).toBeLessThanOrEqual(25);
    expect(fortitudeNumbers(state, ctx, [hero])?.stats.map((stat) => stat.value)).toEqual([2, 1]);
    expect(fortitudeNumbers(state, ctx, [])?.stats.map((stat) => stat.value)).toEqual([0, 1]);
  });

  it("leads with the player who tests when two play", () => {
    const { state, ctx } = waiting({ seats: 2, deck: ["f0", "f0"] }, [reveal("146055")]);
    expect(fortitudeCommitNote(state, ctx)).toMatch(/^Player 1: exhaust heroes to commit them\./);
  });

  it("counts the Willpower against the icons in the action window, with the cards discarded", () => {
    const { state, ctx, hero } = waiting({ deck: ["146052", "f0", "f0"] }, [reveal("146055")]);
    const counted = send(start(state), { type: "CommitFortitude", cardIds: [hero] }, ctx).state;
    expect(counted.window?.kind).toBe("frameAction");
    const nameOf = (id: string) => counted.cards[id]?.code ?? id;
    const note = fortitudeCountNote(counted, ctx, nameOf);
    expect(note).toContain("Fortitude test: Willpower 2 against 1 Sauron's Eye icon. It passes if nothing changes.");
    expect(note).toContain("Discarded: 146052 (1)");
    expect(fortitudeNumbers(counted, ctx, null)).toMatchObject({ result: "Fortitude passed if nothing changes" });
    expect(fortitudeNumbers(counted, ctx, null)?.stats.map((stat) => stat.value)).toEqual([2, 1]);
  });

  it("146049:A:3 shows the icons ignored apart from the ones counted", () => {
    const { state, ctx, hero } = waiting({ deck: ["146054", "f0", "f0"] }, [reveal("146055")]);
    const counted = send(start(state), { type: "CommitFortitude", cardIds: [hero] }, ctx).state;
    const ids = counted.stack.find((frame) => frame.data.kind === "fortitude");
    const data = ids?.data.kind === "fortitude" ? ids.data : null;
    expect(data?.eyes).toBe(3);
    const ignored = { ...counted, stack: counted.stack.map((frame) => (frame.data.kind === "fortitude" ? { ...frame, data: { ...frame.data, ignored: frame.data.discardedIds.filter((id) => counted.cards[id]?.code === "146054"), eyes: 0 } } : frame)) };
    expect(fortitudeCountNote(ignored, ctx, (id) => counted.cards[id]?.code ?? id)).toContain("Ignored: 146054 (3).");
  });
});

describe("mec113.dire the threat dial's limit", () => {
  it("is 99 under Dire, as in every scene of the saga", () => {
    expect(dialLimit(true)).toBe(99);
    expect(dialLimit(false)).toBeUndefined();
  });
});
