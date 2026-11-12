import type { Instruction, PickSpec } from "../../../../catalog/boundary.ts";

import { EACH_PLAYER, type Cond } from "../black-gate/shared.ts";

// What the records of Mount Doom share: the cards they name and the conditions and picks several of them print. The conditions of an effect that held a Fortitude test read the last one it made (`lastFortitudeFailed`).
export const MOUNT_DOOM = "146043";
export const THE_ONE_RING = "146065";
export const GOLLUM = "146049";
export const CAMPAIGN_CARD = "146079";
export const STAGE_1 = "146075";
export const STAGE_2 = "146076";
export const STAGE_3 = "146077";
export const STAGE_4 = "146078";
export const MORDOR_ROAD = "146045";

export const IN_STAGING = { kind: "sourceIn", zone: "staging" } satisfies Cond;
export const LAST_FORTITUDE_FAILED = { kind: "lastFortitudeFailed" } satisfies Cond;
export const LAST_FORTITUDE_PASSED = { kind: "lastFortitudePassed" } satisfies Cond;
// "If you failed a Fortitude test this round" (the acting player), and "if a player has failed a Fortitude test this round" (any player).
export const YOU_FAILED_THIS_ROUND = { kind: "fortitudeFailed", scope: "round", who: "actor" } satisfies Cond;
export const A_PLAYER_FAILED_THIS_ROUND = { kind: "fortitudeFailed", scope: "round", who: "any" } satisfies Cond;
export const THE_ONE_RING_IS_EXHAUSTED = { kind: "exhausted", code: THE_ONE_RING, is: true } satisfies Cond;

// "Each player makes a Fortitude test": in player order, each test resolved with what follows it before the next player's.
export const EACH_PLAYER_TESTS = (after: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => EACH_PLAYER([{ verb: "FortitudeTest" }, ...after]);

export const GOLLUM_IN_PLAY: PickSpec = { type: "enemy", control: "any", names: ["Gollum"] };
