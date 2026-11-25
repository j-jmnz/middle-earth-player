import type { Condition, Instruction } from "../../../catalog/boundary.ts";

type ChooseOption = Extract<Instruction, { verb: "Choose" }>["options"][number];

// The "remove 1 time counter from the current quest" option that several Ring-maker cards print ("Either ... or remove 1 time counter from the current quest"): shared by The Fords of Isen and To Catch an Orc.
// Rules: rm.time-x (data/rules/entries.json).
// A time counter can come off only while the current quest stage holds one (rm.time-x: the counters are its resources).
export const HAS_TIME: Condition = { kind: "less", left: 0, right: { stat: "resources", of: "questStage" } };
// "Remove 1 time counter from the current quest" (rm.time-x).
export const REMOVE_TIME: Instruction = { verb: "RemoveTimeFromQuest", amount: 1 };
// The Choose option `time`: offered only while a time counter is there to remove (rm.time-x).
export const timeOption = (): ChooseOption => ({ id: "time", requires: HAS_TIME, instructions: [REMOVE_TIME] });
