import { describe, expect, it } from "vitest";

import { raiseThreat } from "../../../rules/core/keywords.ts";
import { exhaustAnnounced } from "../../../rules/windows/exhaust.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { attachTo, spawn } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { fightEnemy, finish, idOf, revealFromTop, legalIntents, send, start, tableFromLayout, type Layout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";

const S = "peril-in-pelargir";
function withScroll(table: LayoutTable, hostCode = "dh1"): LayoutTable {
  const hostId = idOf(table.state, hostCode);
  const spawned = spawn(table.state, "05019", { zone: "attached" }, "up");
  const attached = attachTo(spawned.state, spawned.id, hostId);
  const state = updateCard(attached, spawned.id, { claimed: true, controller: attached.cards[hostId]?.controller ?? 0, face: "up" });
  return { ...table, state: syncConstants(state, table.ctx) };
}
const run = (t: LayoutTable, state: ScenarioState) => finish({ state, steps: [] as EngineStep[] }, t.ctx).state;

describe("build check", () => {
  it("thug engages on a threat raise by the Scroll holder only", () => {
    const t = withScroll(tableFromLayout(S, { seats: 2, staging: ["05020"], engaged: [{ code: "05020", seat: 1 }] }));
    const steps: EngineStep[] = [];
    const raised = raiseThreat({ ...t.state, window: null }, 1, 1, steps, { rule: "x" } as never);
    const a = run(t, settle(raised, t.ctx, steps));
    console.log("other seat raised:", Object.values(a.cards).filter((c) => c.code === "05020").map((c) => `${c.zone}:${c.controller}`));
    const raised0 = raiseThreat({ ...t.state, window: null }, 0, 1, steps, { rule: "x" } as never);
    const b = run(t, settle(raised0, t.ctx, steps));
    console.log("holder raised:", Object.values(b.cards).filter((c) => c.code === "05020").map((c) => `${c.zone}:${c.controller}`));
  });

  it("scroll action in staging claims", () => {
    const t = tableFromLayout(S, { staging: ["05019"], phase: "Planning" });
    const s = start(t.state, t.ctx);
    console.log("intents", JSON.stringify(legalIntents(s.state ?? (s as never), t.ctx).filter((i) => i.type !== "Pass").slice(0, 5)));
  });

  const dmg = (state: ScenarioState, code: string) => Object.values(state.cards).filter((c) => c.code === code).map((c) => c.damage);
  it("zealous traitor: optional vs check", () => {
    const layout: Layout = { phase: "Encounter", staging: ["05042"], play: ["ally", "ally"], threat: [20, 20] };
    const t = tableFromLayout(S, layout);
    const b = start(t.state, t.ctx);
    const opt = finish(send(b, { type: "Engage", enemyId: idOf(t.state, "05042") }, t.ctx), t.ctx);
    console.log("optional:", dmg(opt.state, "ally"), opt.state.window?.kind);
    const t2 = tableFromLayout(S, { ...layout, threat: [40, 40] });
    let r = start(t2.state, t2.ctx);
    r = send(r, { type: "DeclineEngage" }, t2.ctx);
    for (let i = 0; i < 20 && r.state.window?.kind !== "defense" && r.state.round === 1; i += 1) {
      const pass = legalIntents(r.state, t2.ctx).find((x) => x.type === "Pass" || x.type === "DeclineEngage" || x.type === "ChooseEnemy");
      if (!pass) break;
      r = send(r, pass as never, t2.ctx);
    }
    console.log("check:", dmg(r.state, "ally"), r.state.window?.kind, r.state.phase);
  });
  it("bandit / assassin", () => {
    const t = tableFromLayout(S, { phase: "Encounter", staging: ["05043"], heroResources: 3, threat: [20, 20] });
    const opt = finish(send(start(t.state, t.ctx), { type: "Engage", enemyId: idOf(t.state, "05043") }, t.ctx), t.ctx);
    console.log("bandit optional resources:", ["dh1", "dh2"].map((c) => opt.state.cards[idOf(opt.state, c)]?.resources));
    const a = tableFromLayout(S, { phase: "Encounter", staging: ["05044"], threat: [20, 20] });
    const ao = finish(send(start(a.state, a.ctx), { type: "Engage", enemyId: idOf(a.state, "05044") }, a.ctx), a.ctx);
    console.log("assassin window:", ao.state.window?.kind, JSON.stringify(ao.state.window).slice(0, 120));
  });

  it("travel: market square and city street", () => {
    const t = tableFromLayout(S, { phase: "Travel", staging: ["05039"], heroResources: 1, seats: 2 });
    const r = start(t.state, t.ctx);
    console.log("market travel window", r.state.window?.kind, JSON.stringify(legalIntents(r.state, t.ctx).filter((i) => i.type === "Travel" || i.type === "DeclineTravel")));
    const t2 = tableFromLayout(S, { phase: "Travel", staging: ["05039"], heroResources: 0, seats: 2 });
    console.log("market no resources", JSON.stringify(legalIntents(start(t2.state, t2.ctx).state, t2.ctx).filter((i) => i.type === "Travel")));
    const t3 = tableFromLayout(S, { phase: "Travel", staging: ["05038", "05021", "05038"] });
    console.log("street", JSON.stringify(legalIntents(start(t3.state, t3.ctx).state, t3.ctx).filter((i) => i.type === "Travel").map((i) => (i as never as { locationId: string }).locationId)), t3.state.staging.map((id) => `${id}:${t3.state.cards[id]?.code}`));
  });

  it("stage 2: progress while scroll not on hero, then attach advances", () => {
    const t = tableFromLayout(S, { stage: "05066", progress: 13, staging: ["05019"] });
    const s = run(t, settle({ ...t.state, window: null }, t.ctx, []));
    console.log("stage 2 held:", s.cards[s.questStage ?? ""]?.code, s.cards[s.questStage ?? ""]?.progress);
    // attach scroll to a hero by claiming
    const attached = withScroll(tableFromLayout(S, { stage: "05066", progress: 13 }));
    const s2 = run(attached, settle({ ...attached.state, window: null }, attached.ctx, []));
    console.log("stage 2 with scroll:", s2.cards[s2.questStage ?? ""]?.code, s2.cards[s2.questStage ?? ""]?.progress);
    const held = tableFromLayout(S, { stage: "05066", progress: 13, staging: ["05019"] });
    const claimed = finish(send(start({ ...held.state, ...{ phase: "Planning" as const } }, held.ctx), { type: "Trigger", cardId: idOf(held.state, "05019"), effectId: "05019:action:1" } as never, held.ctx), held.ctx);
    console.log("after claim", claimed.state.cards[claimed.state.questStage ?? ""]?.code, claimed.state.cards[idOf(claimed.state, "05019")]?.host, claimed.state.cards[idOf(claimed.state, "05019")]?.zone);
  });

  it("fish forced at the start of the quest phase", () => {
    const t = withScroll(tableFromLayout(S, { active: "05021", deck: ["05020", "05022", "f0", "f0"], phase: "Planning" }));
    let r = start(t.state, t.ctx);
    for (let i = 0; i < 12 && r.state.phase !== "Quest"; i += 1) {
      const pass = legalIntents(r.state, t.ctx).find((x) => x.type === "Pass" || x.type === "DeclineEngage");
      if (!pass) break;
      r = send(r, pass as never, t.ctx);
    }
    r = finish(r, t.ctx);
    console.log("fish phase", r.state.phase, "staging", r.state.staging.map((id) => r.state.cards[id]?.code), "discard", r.state.encounterDiscard.map((id) => r.state.cards[id]?.code));
  });

  it("local trouble", () => {
    const t = tableFromLayout(S, { staging: ["05041"], threat: [20, 20] });
    const trouble = idOf(t.state, "05041");
    const steps: EngineStep[] = [];
    // attach to hero 1
    const pushed = tableFromLayout(S, { deck: ["05041", "f0"], threat: [20, 20] });
    const revealed = finish({ state: revealFromTop(pushed.state, pushed.ctx, "05041", steps).state, steps }, pushed.ctx, () => pushed.hero2).state;
    const lt = idOf(revealed, "05041");
    console.log("attached to", revealed.cards[lt]?.host === pushed.hero2 ? "hero2" : revealed.cards[lt]?.host, revealed.cards[lt]?.zone);
    const ex = exhaustAnnounced({ ...revealed, window: null }, pushed.hero2, pushed.ctx);
    const after = run(pushed, settle(ex, pushed.ctx, steps));
    console.log("threat after exhaust", after.seats[0]?.threat);
    // ability triggered: hero2 attached; deck.ts pressure announces abilityTriggered?
    void trouble;
  });

  it("pickpocket", () => {
    const f = fightEnemy((l: Layout) => tableFromLayout(S, { ...l, heroResources: 2 }), "f0", "05037", { hand: ["filler", "filler"] }, {});
    console.log("pickpocket attack: resources", [f.made.hero, f.made.hero2].map((id) => f.run.state.cards[id]?.resources), "hand", f.run.state.seats[0]?.hand.length);
    const sh = fightEnemy((l: Layout) => withScroll(tableFromLayout(S, { ...l, attached: [] })), "05037", "05042", {}, {});
    console.log("pickpocket shadow defended: scroll zone", sh.run.state.cards[idOf(sh.run.state, "05019")]?.zone, sh.run.state.cards[idOf(sh.run.state, "05019")]?.host);
    const su = fightEnemy((l: Layout) => withScroll(tableFromLayout(S, { ...l })), "05037", "05042", {}, { undefended: true });
    console.log("pickpocket shadow undefended: scroll zone", su.run.state.cards[idOf(su.run.state, "05019")]?.zone);
  });

  it("lethal", () => {
    const f = fightEnemy((l: Layout) => withScroll(tableFromLayout(S, l), "dh2"), "05024", "05020", {}, { tweak: (state, made) => updateCard(state, made.hero2, { damage: 5 }) });
    const sc = f.run.state.cards[idOf(f.run.state, "05019")];
    console.log("lethal: scroll", sc?.zone, sc?.host ? f.run.state.cards[sc.host]?.code : null, "hero2 zone", f.run.state.cards[f.made.hero2]?.zone);
  });
});
