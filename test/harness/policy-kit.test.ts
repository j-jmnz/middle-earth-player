// Rules: rr.the-word-choose (data/rules/entries.json). The play policy kit (test/harness/policy-kit.ts): its rules answer only their own window, a policy is the first rule that answers, and The Morgul Vale's policy
// written with the kit picks the intent of the scenario's own policy (test/scenarios/the-morgul-vale/game.ts) at every step of two of its goldens, read from golden.json (nothing is played or written again).
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { expectOk } from "../../src/rules/core/test-fixture.ts";
import { reduce, startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";
import { ROOT } from "../../scripts/data/paths.ts";
import {
  attackAllTogether, chooseFirstOrLast, chooseOption, commitAllBut, declineTravel, defendFirst, engageUpTo, passCommitWhile, policyIntent, travelFewestQuestPoints, triggerActions, type Policy,
} from "./policy-kit.ts";
import { BODYGUARD, CAPTAINS, DEFAULT_POLICY, MURZAG, ROAD, TOKENS, VALE_POLICY, valeIntent, valeStart, valeWorld, type ValePolicy } from "../scenarios/the-morgul-vale/game.ts";

const windowOf = (window: object): ScenarioState => ({ window, seats: [], activeSeat: 0 }) as unknown as ScenarioState;
const NO_CTX = {} as ReduceContext;

describe("a rule answers its own window only", () => {
  it("takes the first or the last option of a Choose, or the one the scenario names when it is offered", () => {
    const state = windowOf({ kind: "choose", options: ["a", "b", "c"] });
    expect(chooseFirstOrLast("first")(state, NO_CTX, new Set())).toEqual({ type: "Choose", optionId: "a" });
    expect(chooseFirstOrLast("last")(state, NO_CTX, new Set())).toEqual({ type: "Choose", optionId: "c" });
    expect(chooseOption((_state, options) => (options.includes("b") ? "b" : undefined))(state, NO_CTX, new Set())).toEqual({ type: "Choose", optionId: "b" });
    expect(chooseOption(() => "z", "last")(state, NO_CTX, new Set())).toEqual({ type: "Choose", optionId: "c" });
    expect(chooseFirstOrLast("first")(windowOf({ kind: "pass" }), NO_CTX, new Set())).toBeNull();
  });

  it("declines a travel window, passes the commit while its condition holds, and leaves every other window alone", () => {
    expect(declineTravel()(windowOf({ kind: "travel" }), NO_CTX, new Set())).toEqual({ type: "DeclineTravel" });
    expect(declineTravel()(windowOf({ kind: "pass" }), NO_CTX, new Set())).toBeNull();
    const commit = { mode: "questCommit", window: { kind: "pass" }, round: 2 } as unknown as ScenarioState;
    expect(passCommitWhile((state) => state.round <= 2)(commit, NO_CTX, new Set())).toEqual({ type: "Pass" });
    expect(passCommitWhile((state) => state.round <= 1)(commit, NO_CTX, new Set())).toBeNull();
    for (const rule of [commitAllBut(1), travelFewestQuestPoints(), defendFirst(1), attackAllTogether(), engageUpTo(3)]) expect(rule(windowOf({ kind: "mulligan" }), NO_CTX, new Set())).toBeNull();
  });

  it("is the first rule that answers, in order (the auto-player's answer for a window no rule owns is checked by the goldens below)", () => {
    const state = windowOf({ kind: "mulligan" });
    const first: PlayerIntent = { type: "Pass" };
    const policy: Policy = [() => null, () => first, () => ({ type: "Keep" })];
    expect(policyIntent(policy, { scout: "", prefer: "", protect: "" }, state, NO_CTX, new Set())).toBe(first);
  });
});

// The Morgul Vale's policy as a list of the kit's rules, in the order valeIntent tries its own: the choices, Morgul Road's Response, the travel, the defense, the commit, the attack, the engagement, the auto-player.
const codeOf = (state: ScenarioState, id: string | null | undefined): string => state.cards[id ?? ""]?.code ?? "";
const rank = (state: ScenarioState, id: string): number => (CAPTAINS.includes(codeOf(state, id)) ? 0 : codeOf(state, id) === BODYGUARD ? 1 : 2);
const valeWithKit = (policy: ValePolicy): Policy => [
  chooseOption((_state, options) => (options.includes("place") ? policy.sorcerer : options.includes("tokens") ? policy.fog : options.includes("discard") ? policy.malice : options.includes("remove") ? policy.road || undefined : undefined), policy.choose),
  ...(policy.road ? [triggerActions([`${ROAD}:response:1`])] : []),
  travelFewestQuestPoints(),
  defendFirst(policy.defend),
  commitAllBut(policy.reserve),
  attackAllTogether(rank),
  engageUpTo(policy.engage, { allow: (state, id) => policy.captain || !CAPTAINS.includes(codeOf(state, id)), rank }),
];

type Golden = { name: string; seatCount: 1 | 2; seed: number; difficulty: "Easy" | "Normal"; decks: "strong" | "steady" | "weak" | "brittle"; policy?: Partial<ValePolicy>; intents: PlayerIntent[] };
const GOLDENS = JSON.parse(readFileSync(path.join(ROOT, "src/campaign/scenarios/the-morgul-vale/golden.json"), "utf8")) as Golden[];

describe("The Morgul Vale's policy written with the kit", () => {
  // The two goldens: a solo win on the default policy and the loss that places tokens (the policy names the Sorcerer's, Fog's, Malice's and Road's answers).
  it.each(["solo win", "solo loss: 10 tokens on To the Tower"])("picks the intent of valeIntent at every step of the golden %s", async (name) => {
    const golden = GOLDENS.find((entry) => entry.name === name)!;
    const policy: ValePolicy = { ...DEFAULT_POLICY, ...(name === "solo win" ? {} : TOKENS), ...golden.policy };
    const { ctx } = await valeWorld(golden.decks);
    const kit = valeWithKit(policy);
    const ownMemory = new Set<string>();
    const kitMemory = new Set<string>();
    let state = expectOk(reduce(startScenario(valeStart(golden.seatCount, golden.seed, golden.difficulty), ctx), { type: "Keep" }, ctx)).state;
    const wrong: string[] = [];
    golden.intents.forEach((intent, at) => {
      const own = valeIntent(state, ctx, ownMemory, policy);
      const kitted = policyIntent(kit, { ...VALE_POLICY, play: policy.play, act: policy.act }, state, ctx, kitMemory);
      if (JSON.stringify(own) !== JSON.stringify(intent) || JSON.stringify(kitted) !== JSON.stringify(intent)) wrong.push(`${at}: golden ${JSON.stringify(intent)}, own ${JSON.stringify(own)}, kit ${JSON.stringify(kitted)}`);
      state = expectOk(reduce(state, intent, ctx)).state;
    });
    expect(wrong).toEqual([]);
    expect(golden.intents.length).toBeGreaterThan(40);
    expect(MURZAG).toBe("06151");
  }, 60_000);
});
