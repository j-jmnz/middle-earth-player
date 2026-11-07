// The table tokens of the theme in force (user request, 2026-10-28), solid while the phone's Reduce Transparency is on (tokens.ts, tokensFor).
// Read once at the canvas root and pass down; a piece does not subscribe itself.
import { useReduceTransparency } from "./display-prefs.ts";
import { tokensFor, type TableTokens } from "./tokens.ts";
import { useTheme } from "./theme.ts";

export function useTableTokens(): TableTokens {
  const theme = useTheme();
  const solid = useReduceTransparency();
  return tokensFor(theme, solid);
}
