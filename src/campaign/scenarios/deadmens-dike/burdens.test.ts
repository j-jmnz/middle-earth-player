// Rules: rr.player-elimination, rr.constant-ability, rr.triggered-ability, rr.travel, rr.blank, rr.first-player, rr.effects, rr.modifiers, rr.surge, rr.then, rr.destroy, rr.campaign-pool, rr.ownership-and-control, faq.first-player-elimination, mec108.indestructible, mec108.side-quests, mec108.time-x (data/rules/entries.json); ledger lines 10166:A:3, 10168:A:1, 10168:A:2, 10169:A:1, 10169:A:2, 10170:A:1, 10170:A:2, 10167:A:1, 10167:A:2, 10167:A:3, 09061:A:1, 100158:A:1, 100158:A:2, 10160:A:3.
// Deadmen's Dike, part 2: Thaurdir's burdens (the random pick, the move to the hero with the most, the blank text box), the pool cards' Setups, Cursed Dead's search of the discard pile, Arnor Ravaged, the boons Mysterious Omens offers, and the cards of the Setup and the Resolution. Each test starts its title with the line it covers.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { flagged, updateCard } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { hasTrait } from "../../../rules/interpret/conditions.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { allyCard, finish, idOf, idsOf, legalIntents, resolveRecords, send, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "deadmens-dike";
const THAURDIR = "09033";
const BURDENS = ["10168", "10169", "10170"];
const HERO = "dh1";
const at = (layout: Layout = {}) => tableFromLayout(ID, { stage: "09073", phase: "Refresh", ...layout });
type Table = ReturnType<typeof at>;

describe("10166:A:3 attaches one of Thaurdir's burdens to him when he enters play", () => {
  const withBurdens = (layout: Layout = {}) => at({ stage: "09074", phase: "Quest", campaign: true, setAside: [THAURDIR], ...layout });

  it("10166:A:3 attaches exactly one of the three set-aside burdens to Thaurdir, a different one for different seeds, though he cannot have attachments", () => {
    const picked = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const t = withBurdens({ seed });
      const run = resolveRecords(t.state, t.ctx, "09074", "whenRevealed");
      const thaurdir = idOf(run.state, THAURDIR);
      const attached = run.state.cards[thaurdir]?.attachments ?? [];
      expect(attached, `seed ${seed}`).toHaveLength(1);
      const code = run.state.cards[attached[0] ?? ""]?.code ?? "";
      expect(BURDENS).toContain(code);
      picked.add(code);
      expect(run.state.cards[thaurdir]?.zone).toBe("staging");
    }
    expect(picked.size).toBeGreaterThan(1);
  });

  it("10166:A:3 attaches the same burden to the same seed, a set-aside copy when the game dealt one, and nothing in standalone play (no campaign card hears it)", () => {
    const code = (seed: number) => {
      const t = withBurdens({ seed });
      const run = resolveRecords(t.state, t.ctx, "09074", "whenRevealed");
      return run.state.cards[run.state.cards[idOf(run.state, THAURDIR)]?.attachments[0] ?? ""]?.code;
    };
    expect(code(3)).toBe(code(3));
    const dealt = withBurdens({ setAside: [THAURDIR, ...BURDENS] });
    const run = resolveRecords(dealt.state, dealt.ctx, "09074", "whenRevealed");
    expect(run.state.setAside.map((id) => run.state.cards[id]?.code).filter((one) => BURDENS.includes(one ?? ""))).toHaveLength(2);
    expect(idsOf(run.state, BURDENS[0] ?? "")).toHaveLength(1);
    const alone = at({ stage: "09074", phase: "Quest", setAside: [THAURDIR] });
    const bare = resolveRecords(alone.state, alone.ctx, "09074", "whenRevealed");
    expect(bare.state.cards[idOf(bare.state, THAURDIR)]?.attachments ?? []).toHaveLength(0);
  });
});

describe("10168:A:2, 10169:A:2 and 10170:A:2 move a burden to the hero with the most of something", () => {
  const burdened = (code: string, layout: Layout = {}) => at({ phase: "Quest", seats: 2, staging: [THAURDIR], attached: [{ code, to: THAURDIR }], ...layout });
  const hostOf = (state: ScenarioState, code: string): string | null => state.cards[idOf(state, code)]?.host ?? null;

  it("10168:A:2 moves Thaurdir's Legacy to the hero with the most resources, any player's hero", () => {
    const t = burdened("10168");
    const rich = updateCard(t.state, t.seat1Hero ?? "", { resources: 5 });
    const run = resolveRecords(rich, t.ctx, "10168", "forced", idOf(rich, "10168"));
    expect(hostOf(run.state, "10168")).toBe(t.seat1Hero);
    expect(run.state.cards[idOf(run.state, THAURDIR)]?.attachments ?? []).toHaveLength(0);
  });

  it("10168:A:2 keeps the burden on the hero that holds the most, and asks the first player when heroes tie", () => {
    const t = burdened("10168");
    const ahead = updateCard(t.state, t.hero, { resources: 4 });
    const first = resolveRecords(ahead, t.ctx, "10168", "forced", idOf(ahead, "10168"));
    expect(hostOf(first.state, "10168")).toBe(t.hero);
    const stays = resolveRecords(first.state, t.ctx, "10168", "forced", idOf(first.state, "10168"));
    expect(hostOf(stays.state, "10168")).toBe(t.hero);
    const tied = updateCard(updateCard(t.state, t.hero, { resources: 3 }), t.hero2, { resources: 3 });
    const options: string[][] = [];
    const answered = resolveRecords(tied, t.ctx, "10168", "forced", idOf(tied, "10168"), (state) => {
      if (state.window?.kind === "choose") options.push([...state.window.options]);
      return t.hero2;
    });
    expect(options[0]).toEqual(expect.arrayContaining([t.hero, t.hero2]));
    expect(hostOf(answered.state, "10168")).toBe(t.hero2);
  });

  it("10169:A:2 counts the attachments that are not objectives: the burden itself does not count", () => {
    const t = burdened("10169", { attached: [{ code: "10169", to: THAURDIR }, { code: "attachment", to: HERO }] });
    const run = resolveRecords(t.state, t.ctx, "10169", "forced", idOf(t.state, "10169"));
    expect(hostOf(run.state, "10169")).toBe(t.hero);
  });

  it("10170:A:2 moves Thaurdir's Spite to the hero with the most damage", () => {
    const t = burdened("10170");
    const hurt = updateCard(t.state, t.hero2, { damage: 3 });
    const run = resolveRecords(hurt, t.ctx, "10170", "forced", idOf(hurt, "10170"));
    expect(hostOf(run.state, "10170")).toBe(t.hero2);
  });
});

describe("10168:A:2 blanks the host's text box and Traits, 10169:A:2 and 10170:A:2 take stats and abilities", () => {
  const on = (code: string, host: string) => {
    const t = at({ phase: "Quest", staging: [THAURDIR], attached: [{ code, to: host }] });
    return t;
  };

  it("10168:A:2 blanks the printed text box and the printed Traits of the host hero, and a Trait another card grants stays", () => {
    const bare = at({ phase: "Quest", staging: [THAURDIR] });
    bare.cards.set(HERO, { ...bare.cards.get(HERO)!, traits: ["Noldor"] });
    expect(hasTrait(bare.state, bare.hero, "Noldor", bare.ctx)).toBe(true);
    const t = on("10168", HERO);
    t.cards.set(HERO, { ...t.cards.get(HERO)!, traits: ["Noldor"] });
    expect(flagged(t.state, t.hero, "blankText")).toBe(true);
    expect(flagged(t.state, t.hero, "blanksTraits")).toBe(true);
    expect(hasTrait(t.state, t.hero, "Noldor", t.ctx)).toBe(false);
    expect(modifiedStat(t.state, t.state.cards[t.hero]!, "willpower", t.cards)).toBe(modifiedStat(bare.state, bare.state.cards[bare.hero]!, "willpower", bare.cards) - 2);
  });

  it("10168:A:2 does nothing to Thaurdir while he carries it (it works on an attached hero only), and Thaurdir keeps his Traits", () => {
    const t = on("10168", THAURDIR);
    const thaurdir = idOf(t.state, THAURDIR);
    expect(flagged(t.state, thaurdir, "blankText")).toBe(false);
    expect(hasTrait(t.state, thaurdir, "Undead", t.ctx)).toBe(true);
  });

  it("10169:A:2 and 10170:A:2 hold their stat changes on the host hero only", () => {
    const majesty = on("10169", HERO);
    expect(flagged(majesty.state, majesty.hero, "cannotQuest")).toBe(true);
    expect(modifiedStat(majesty.state, majesty.state.cards[majesty.hero]!, "attack", majesty.cards)).toBe(0);
    const spite = on("10170", HERO);
    expect(flagged(spite.state, spite.hero, "cannotBeHealed")).toBe(true);
    const carried = on("10169", THAURDIR);
    expect(flagged(carried.state, carried.hero, "cannotQuest")).toBe(false);
  });
});

describe("10167:A:1, 10168:A:1, 10169:A:1 and 10170:A:1 attach a pool card to the card with a title, or remove it from the game", () => {
  const pool = (code: string, layout: Layout = {}) => {
    const t = at({ phase: "Planning", ...layout });
    t.cards.set("10067", allyCard("10067", 0, { name: "Amarthiúl" }));
    const spawned = spawn(t.state, code, { zone: "setAside" });
    return { t, id: spawned.id, state: spawned.state };
  };

  it("10168:A:1 attaches to Thaurdir though he is out of play (set aside)", () => {
    const made = pool("10168", { setAside: [THAURDIR] });
    const run = resolveRecords(made.state, made.t.ctx, "10168", "setup", made.id);
    expect(run.state.cards[made.id]?.host).toBe(idOf(run.state, THAURDIR));
  });

  const attachesToThaurdir = (code: string) => {
    const made = pool(code, { setAside: [THAURDIR] });
    expect(resolveRecords(made.state, made.t.ctx, code, "setup", made.id).state.cards[made.id]?.host).toBe(idOf(made.state, THAURDIR));
    const none = pool(code);
    expect(resolveRecords(none.state, none.t.ctx, code, "setup", none.id).state.cards[none.id]?.zone).toBe("removed");
  };

  it("10169:A:1 attaches to Thaurdir though he is out of play, and with no Thaurdir at all the card is removed from the game", () => attachesToThaurdir("10169"));

  it("10170:A:1 attaches to Thaurdir though he is out of play, and with no Thaurdir at all the card is removed from the game", () => attachesToThaurdir("10170"));

  it("10167:A:1 attaches to Amarthiúl in play, and is removed from the game when he is not there", () => {
    const withHim = pool("10167", { play: ["10067"] });
    const run = resolveRecords(withHim.state, withHim.t.ctx, "10167", "setup", withHim.id);
    expect(run.state.cards[withHim.id]?.host).toBe(idOf(run.state, "10067"));
    const without = pool("10167");
    expect(resolveRecords(without.state, without.t.ctx, "10167", "setup", without.id).state.cards[without.id]?.zone).toBe("removed");
  });
});

describe("09061:A:1 puts each copy of Cursed Dead in the encounter discard pile into the staging area", () => {
  it("09061:A:1 takes every copy from the discard pile only, not the one in the encounter deck, with no reveal", () => {
    const t = at({ phase: "Quest", discard: ["09061", "09061", "f0"], deck: ["09061"] });
    const run = resolveRecords(t.state, t.ctx, "09061", "whenRevealed");
    const zones = idsOf(run.state, "09061").map((id) => run.state.cards[id]?.zone);
    expect(zones.filter((zone) => zone === "encounterDeck")).toHaveLength(1);
    expect(zones.filter((zone) => zone === "staging")).toHaveLength(3);
    expect(run.state.cards[idOf(run.state, "f0")]?.zone).toBe("encounterDiscard");
  });
});

describe("100158:A:2 moves damage from Arnor Ravaged to the character an attack damaged", () => {
  const hurt = (state: ScenarioState, t: Table, other: string): ScenarioState => {
    const steps: never[] = [];
    return settle(fireForced({ ...state, window: null, mode: "stopped" }, { trigger: "attackDamagedCharacter", seat: 0, cardId: idOf(state, "f0"), other }, t.ctx, steps), t.ctx, steps);
  };

  it("100158:A:2 moves 1 damage from it to the character the attack damaged, placed and not dealt", () => {
    const t = at({ phase: "Combat", staging: [{ code: "100158", damage: 2 }, "f0"] });
    const done = hurt(t.state, t, t.hero);
    expect(done.cards[idOf(done, "100158")]?.damage).toBe(1);
    expect(done.cards[t.hero]?.damage).toBe(1);
  });

  it("100158:A:2 moves nothing when it holds no damage, or when the character is no longer in play", () => {
    const dry = at({ phase: "Combat", staging: ["100158", "f0"] });
    expect(hurt(dry.state, dry, dry.hero).cards[dry.hero]?.damage).toBe(0);
    const t = at({ phase: "Combat", staging: [{ code: "100158", damage: 2 }, "f0"] });
    const gone = spawn(t.state, "ally", { zone: "discard", seat: 0 });
    const done = hurt(gone.state, t, gone.id);
    expect(done.cards[idOf(done, "100158")]?.damage).toBe(2);
    expect(done.cards[gone.id]?.damage).toBe(0);
  });
});

describe("10160:A:3 offers a boon only while no other copy of it is in the game", () => {
  const offeredBoons = (layout: Layout): string[] => {
    const t = at({ phase: "Quest", campaign: true, ...layout });
    const ask: Effect = { id: "t:forced:2", cardCode: "f0", lines: [], timing: "forced", instructions: [{ verb: "ChooseBoon", codes: ["10161", "10162", "10163"] }] };
    const ctx = { ...t.ctx, effects: [...t.ctx.effects, ask] };
    const seen: string[][] = [];
    resolveRecords(t.state, ctx, "f0", "forced", undefined, (state) => {
      if (state.window?.kind !== "choose") return "";
      seen.push([...state.window.options]);
      return state.window.options.includes(t.hero) ? t.hero : "none";
    });
    return seen[0] ?? [];
  };

  it("10160:A:3 offers the boons still set aside or not yet in the game, and none for one already attached to a hero (kept from the Campaign Pool)", () => {
    expect(offeredBoons({ setAside: ["10161", "10162", "10163"] })).toEqual(["10161", "10162", "10163", "none"]);
    expect(offeredBoons({ setAside: ["10161", "10163"], attached: [{ code: "10162", to: HERO }] })).toEqual(["10161", "10163", "none"]);
    expect(offeredBoons({ attached: [{ code: "10162", to: HERO }] })).toEqual(["10161", "10163", "none"]);
  });

  it("10160:A:3 asks nobody when every boon it names is held already", () => {
    expect(offeredBoons({ attached: [{ code: "10161", to: HERO }, { code: "10162", to: HERO }, { code: "10163", to: HERO }] })).toEqual([]);
  });
});

describe("the cards of the Resolution and the Setup", () => {
  it("100158:A:1 adds Arnor Ravaged to the staging area from the pool with the damage the log noted (none noted here)", () => {
    const t = at({ phase: "Planning", campaign: true });
    const spawned = spawn(t.state, "100158", { zone: "setAside" });
    const run = resolveRecords(spawned.state, t.ctx, "100158", "setup", spawned.id);
    expect(run.state.staging.map((id) => run.state.cards[id]?.code)).toContain("100158");
  });

  it("10167:A:2 gives the attached hero +1 Willpower and +1 hit point", () => {
    const bare = at({ phase: "Planning" });
    const boosted = at({ phase: "Planning", attached: [{ code: "10167", to: HERO }] });
    const stat = (t: Table, name: "willpower" | "hitPoints") => modifiedStat(t.state, t.state.cards[idOf(t.state, HERO)]!, name, t.cards);
    expect(stat(boosted, "willpower")).toBe(stat(bare, "willpower") + 1);
    expect(stat(boosted, "hitPoints")).toBe(stat(bare, "hitPoints") + 1);
  });

  it("10167:A:3 readies the attached hero with its Action, once in the game", () => {
    const t = at({ phase: "Planning", attached: [{ code: "10167", to: HERO }], deckOf: ["filler", "filler", "filler"] });
    const tired = { ...t.state, cards: { ...t.state.cards, [idOf(t.state, HERO)]: { ...t.state.cards[idOf(t.state, HERO)]!, exhausted: true } } } as ScenarioState;
    const intent = legalIntents(tired, t.ctx).find((one) => one.type === "Trigger" && one.cardId === idOf(tired, "10167"));
    expect(intent).toBeTruthy();
    const run = finish(send({ state: tired, steps: [] }, intent as PlayerIntent, t.ctx), t.ctx);
    expect(run.state.cards[idOf(run.state, HERO)]?.exhausted).toBe(false);
    expect(legalIntents(run.state, t.ctx).some((one) => one.type === "Trigger" && one.cardId === idOf(run.state, "10167"))).toBe(false);
  });
});
