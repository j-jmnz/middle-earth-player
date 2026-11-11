// What the two table routes share for the stale sheet (docs/design-system.md, Table opens stale): the choice the player made, the sentence a refused one
// leaves on the sheet, and the count that opens the game again. A choice runs after the next paint, so the route shows the table's loading frame first,
// and a second press while one runs is ignored.
import { useEffect, useRef, useState } from "react";

import { afterPaint } from "../nav/after-paint";
import type { StaleChoice } from "./stale-words";

export type StaleChoices = { continue: () => StaleChoice; restart: () => StaleChoice };

export type StaleChoiceState = {
  /** How many choices were carried out: the session hook opens the game again for a new count. */
  attempt: number;
  /** Why the last choice was refused, or null. */
  refused: string | null;
  /** Whether a choice is running: the route shows the loading frame. */
  running: boolean;
  onContinue: () => void;
  onRestart: () => void;
};

export function useStaleChoice(choices: StaleChoices): StaleChoiceState {
  const [attempt, setAttempt] = useState(0);
  const [refused, setRefused] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  // Set at the press, before the state has re-rendered: a second tap in the same frame is ignored.
  const busy = useRef(false);
  const cancel = useRef<(() => void) | null>(null);
  // A hidden table's effects are torn down and run again on show (Activity): a choice still waiting for its paint is cancelled and the sheet is pressable again.
  useEffect(
    () => () => {
      if (!cancel.current) return;
      cancel.current();
      cancel.current = null;
      busy.current = false;
      setRunning(false);
    },
    [],
  );
  const choose = (run: () => StaleChoice) => {
    if (busy.current) return;
    busy.current = true;
    setRunning(true);
    cancel.current = afterPaint(() => {
      cancel.current = null;
      busy.current = false;
      const choice = run();
      setRunning(false);
      if (choice.ok) {
        setRefused(null);
        setAttempt((count) => count + 1);
      } else {
        setRefused(choice.message);
      }
    });
  };
  return { attempt, refused, running, onContinue: () => choose(choices.continue), onRestart: () => choose(choices.restart) };
}
