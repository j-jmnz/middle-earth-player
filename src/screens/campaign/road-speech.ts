// What a screen reader says for a stop on the campaign path (docs/design-system.md, Campaign path and Screen reader): the scenario's name and
// where it stands, whether or not the stop can be pressed. The visible tag (path-road.tsx) stays the short word.
import type { PathNode } from "../../campaign/path";

const WORDS: Record<PathNode["status"], string> = { completed: "Won", current: "Next", locked: "Locked", soon: "Coming soon" };

/** The stop's standing in words: "Won, score 42", "Next", "Locked" or "Coming soon"; "Ended" for the stop of a scenario that ends when its last player falls (`ended`). */
export function stopStanding(status: PathNode["status"], score: string | null | undefined, ended?: boolean): string {
  const done = ended === true ? "Ended" : WORDS.completed;
  return status === "completed" ? (score ? `${done}, score ${score}` : done) : WORDS[status];
}

/** The stop's spoken name: "Flight to the Ford, Won, score 42". */
export function stopLabel(name: string, status: PathNode["status"], score: string | null | undefined, ended?: boolean): string {
  return `${name}, ${stopStanding(status, score, ended)}`;
}

/** The stop's state: dimmed (disabled) while the stop cannot be opened. */
export function stopState(pressable: boolean): { disabled: boolean } {
  return { disabled: !pressable };
}
