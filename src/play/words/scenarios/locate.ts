// Rules: dwd.locate-test (data/rules/entries.json); ledger line 04087:B:1. The title of a finished locate test, led by the player who made it when two play, as an escape test's is (escape.ts). Pure.

/** "Locate test passed", or "Player 2's locate test failed" when `named` (two or more play). */
export function locateResultTitle(success: boolean, seat: number, named: boolean): string {
  const result = success ? "passed" : "failed";
  return named ? `Player ${seat + 1}'s locate test ${result}` : `Locate test ${result}`;
}
