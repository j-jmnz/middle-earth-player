// The table tokens of the theme in force (user request, 2026-10-28). Read once at the canvas root and pass down; a piece does not subscribe itself.
import { tableTokensByTheme, type TableTokens } from "./tokens.ts";
import { useTheme } from "./theme.ts";

export function useTableTokens(): TableTokens {
  return tableTokensByTheme[useTheme()];
}
