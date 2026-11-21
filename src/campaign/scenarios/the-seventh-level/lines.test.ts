// Rules: rr.damage, rr.cancel, rr.attachment-cards, rr.forced, rr.shadow-effects, dwd.last-player, dwd.book-of-mazarbul, faq.progress-without-advancing (data/rules/entries.json); ledger lines 03022:A:1, 03024:A:2, 03031:A:1, 03033:A:2, 03034:A:1, 03034:A:2, 03068:B:3, 901102:A:2, 901104:A:2.
// The Seventh Level's records that need more than one row: the Book moving between heroes and returning to the staging area, Hidden Threat's last player, Plundered Armoury's attachments and the host they may go on, the lines whose row would pass without
// the record (what a record leaves alone), and Orc Taskmaster's Forced on the real record.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../../rules/core/intents.ts";
import { destroyCard, placeDamage } from "../../../rules/core/keywords.ts";
import { ruleCause } from "../../../rules/core/cause.ts";
import { printedFromCard } from "../../../rules/core/printed.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { reduce } from "../../../rules/engine/reduce.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { loadCards } from "../../../../scripts/data/load-cards.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { attack, damageOn, defend, endRound, rowProblems, stat, won, zone, type Row } from "../../../../test/harness/card-spec.ts";
import { finish, first, resolveRecords, start, send, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const table = (layout: Layout) => tableFromLayout("the-seventh-level", layout);
const BOOK = "03024";
const holds = (row: Row) => expect(rowProblems("the-seventh-level", row, EFFECTS)).toEqual([]);

describe("03024:A:2 Book of Mazarbul", () => {
  // The Book is claimed from the staging area, then again by another hero (dwd.book-of-mazarbul): the claim moves it.
  function claimedBy() {
    const made = table({ staging: [BOOK] });
    const book = first(made.state, BOOK);
    const claim = (state: ScenarioState, heroCode: string) => resolveRecords(state, made.ctx, BOOK, "action", book, (current) => (current.window?.kind === "choose" ? (current.window.options.find((id) => current.cards[id]?.code === heroCode) ?? current.window.options[0] ?? "") : "")).state;
    return { made, book, claim };
  }

  it("03024:A:2 claimed from another hero's attachment it moves to the hero that exhausts, who is controlled by that hero's controller", () => {
    const { made, book, claim } = claimedBy();
    const first1 = claim(made.state, "dh1");
    expect(first1.cards[book]).toMatchObject({ zone: "attached", host: made.hero, claimed: true, controller: 0 });
    const moved = claim(first1, "dh2");
    expect(moved.cards[book]).toMatchObject({ zone: "attached", host: made.hero2, claimed: true });
    expect(moved.cards[made.hero]?.attachments).toEqual([]);
    expect(moved.cards[made.hero2]?.attachments).toEqual([book]);
    expect(moved.cards[made.hero]?.exhausted).toBe(true);
    expect(moved.cards[made.hero2]?.exhausted).toBe(true);
  });

  it("03024:A:2 returns to the staging area, controlled by nobody, when its hero leaves play", () => {
    const { made, book, claim } = claimedBy();
    const held = settle({ ...claim(made.state, "dh1"), window: null }, made.ctx, []);
    const steps: EngineStep[] = [];
    const gone = destroyCard(held, made.hero, made.ctx.cards, steps);
    expect(gone.cards[book]).toMatchObject({ zone: "staging", controller: null });
    expect(gone.cards[book]?.claimed).toBeUndefined();
    expect(gone.staging).toContain(book);
  });
});

describe("03022:A:1 Hidden Threat's last player", () => {
  it("03022:A:1 is the last player of a two-handed game, who discards an attachment he controls and not the first player's", () => {
    const made = table({ seats: 2, deck: ["f0"], attached: [{ code: "attachment", to: "dh1" }, { code: "attachment", to: "dh3" }] });
    const attachments = Object.values(made.state.cards).filter((card) => card.code === "attachment");
    const theirs = attachments.find((card) => card.host === made.hero)?.id;
    const mine = attachments.find((card) => card.host !== made.hero)?.id;
    const owned = updateCard(made.state, mine ?? "", { controller: 1 });
    const state = resolveRecords(owned, made.ctx, "03022", "whenRevealed").state;
    expect(state.cards[mine ?? ""]?.zone).toBe("discard");
    expect(state.cards[theirs ?? ""]?.zone).not.toBe("discard");
  });
});

describe("03034:A:2 Plundered Armoury's attachments", () => {
  const byCode = new Map(loadCards().map((card) => [card.code, card]));
  // The Dwarven Axe attaches to a hero only; the Raiment of the Second Age (Weapon, Armor) to any character.
  const AXE = "01041";
  const RAIMENT = "10191";

  // The quest succeeds with the Armoury the active location (2 quest points): it is explored, leaves play and its Response is offered to the first player.
  function explored(code: string) {
    const made = table({ play: ["ally"], active: "03034", phase: "Quest" });
    made.cards.set(code, printedFromCard(byCode.get(code)!));
    const card = spawn(made.state, code, { zone: "hand", seat: 0 });
    const offered: string[][] = [];
    const pick = (state: ScenarioState): string => {
      if (state.window?.kind !== "choose") return "";
      const options = state.window.options;
      if (options.includes("attach")) return "attach";
      offered.push(options.map((id) => state.cards[id]?.code ?? id));
      // The attachment is the first choice, then its host: the ally when it is offered, else the first hero.
      return options.find((id) => state.cards[id]?.code === "ally") ?? options[0] ?? "";
    };
    let run = start(card.state);
    run = send(run, { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx);
    run = send(run, { type: "Pass" }, made.ctx);
    run = finish(send(run, { type: "Trigger", cardId: first(run.state, "03034"), effectId: "03034:response:1" }, made.ctx), made.ctx, pick);
    return { made, id: card.id, run, offered };
  }

  it("03034:A:2 puts a Weapon the hero alone may carry on a hero: the ally is not offered as its host", () => {
    const { made, id, run, offered } = explored(AXE);
    const hosts = offered.at(-1) ?? [];
    expect(hosts).toContain("dh1");
    expect(hosts).not.toContain("ally");
    expect(run.state.cards[id]?.zone).toBe("play");
    expect([made.hero, made.hero2]).toContain(run.state.cards[id]?.host);
  });

  it("03034:A:2 puts a Weapon any character may carry on an ally when the player chooses it, for free", () => {
    const { id, run } = explored(RAIMENT);
    expect(run.state.cards[id]?.zone).toBe("play");
    expect(run.state.cards[run.state.cards[id]?.host ?? ""]?.code).toBe("ally");
    expect(run.state.seats[0]?.heroes.every((hero) => (run.state.cards[hero]?.resources ?? 0) === 0)).toBe(true);
  });
});

describe("rows whose record leaves something alone", () => {
  it("03031:A:1 gives nothing to another enemy's undefended attack from a Goblin Spearman in the staging area", () => {
    holds({ line: "03031:A:1", layout: { threat: [10, 10], staging: ["03031"] }, act: attack("f0", { undefended: true }), expect: damageOn("dh1", 1) });
  });

  it("03033:A:2 leaves the ally alone when the attack is undefended: there is no defending character", () => {
    holds({ line: "03033:A:2", layout: { play: ["ally"] }, act: attack("f0", { shadow: "03033", undefended: true }), expect: zone("ally", "play") });
    holds({ line: "03033:A:2", layout: { play: ["ally"] }, act: [attack("f0", { shadow: "03033" }), defend("ally")], expect: zone("ally", "discard") });
  });

  it("03034:A:1 gives the Attack while Plundered Armoury is in the staging area and not as the active location", () => {
    holds({ line: "03034:A:1", layout: { staging: ["03034", "f0"] }, act: [], expect: stat("f0", "attack", 2) });
    holds({ line: "03034:A:1", layout: { active: "03034", staging: ["f0"] }, act: [], expect: stat("f0", "attack", 1) });
  });

  it("03068:B:3 wins the game when the players defeat the last stage", () => {
    holds({ line: "03068:B:3", layout: { stage: "03068", progress: 17 }, act: endRound, expect: won });
  });

  it("901102:A:2 lets the stage advance once Overseer Maurûl is in the victory display", () => {
    holds({ line: "901102:A:2", layout: { stage: "03068", progress: 17, victory: ["901102"] }, act: endRound, expect: won });
  });
});

describe("901104:A:2 Orc Taskmaster's Forced", () => {
  // The Goblin that was dealt the damage loses its resource: the card the event is about, not the Taskmaster, and the damage is canceled.
  const scene = () => {
    const made = table({ staging: ["901104"], deck: ["f0", "f0", "f0", "f0"], engaged: [{ code: "03031", seat: 0, resources: 1 }, { code: "03031", seat: 0 }, { code: "03020", seat: 0, resources: 1 }] });
    const goblins = Object.values(made.state.cards).filter((card) => card.code === "03031");
    const charged = goblins.find((card) => (card.resources ?? 0) > 0)?.id ?? "";
    const bare = goblins.find((card) => (card.resources ?? 0) === 0)?.id ?? "";
    return { made, charged, bare, troll: first(made.state, "03020"), master: first(made.state, "901104") };
  };
  const hit = (made: ReturnType<typeof scene>["made"], id: string, amount: number): ScenarioState => {
    const damaged = placeDamage({ ...made.state, holdLethal: true }, id, amount, made.ctx.cards, [], "framework", ruleCause("rr.damage"));
    const passed = reduce(damaged, { type: "Pass" }, made.ctx);
    return passed.ok ? passed.state : damaged;
  };

  it("901104:A:2 removes the resource from the damaged Goblin, not from the Taskmaster, and cancels the damage that would have destroyed it", () => {
    const { made, charged, master } = scene();
    const after = hit(made, charged, 5);
    expect(after.cards[charged]).toMatchObject({ damage: 0, resources: 0, zone: "engaged" });
    expect(after.cards[master]?.resources ?? 0).toBe(0);
  });

  it("901104:A:2 leaves a Goblin with no resource and a Cave-troll to the damage", () => {
    const { made, bare, troll } = scene();
    expect(hit(made, bare, 5).cards[bare]?.zone).toBe("encounterDiscard");
    expect(["encounterDiscard", "victory"]).toContain(hit(made, troll, 8).cards[troll]?.zone);
  });
});
