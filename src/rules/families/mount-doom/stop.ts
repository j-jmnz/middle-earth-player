import type { Instruction } from "../../../catalog/boundary.ts";

// Test helper. A choice nobody answers: an effect that ends in it leaves the game in a window, so the game does not run on into the next phases while a test reads the table.
export const STOP: Instruction = { verb: "Choose", who: "actor", options: [{ id: "stay", instructions: [{ verb: "RaiseThreat", amount: 1 }] }, { id: "go", instructions: [{ verb: "RaiseThreat", amount: 2 }] }] };
