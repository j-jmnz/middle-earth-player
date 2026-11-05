/**
 * Card codes from command-line arguments. Codes are separated by commas, spaces or both, in one argument or several:
 * `12125,12132`, `12125 12132` and `12125, 12132` give the same list. Empty pieces are dropped; the order is kept.
 */
export function splitCodes(args: readonly string[]): string[] {
  return args.flatMap((arg) => arg.split(/[\s,]+/)).filter((code) => code !== "");
}
