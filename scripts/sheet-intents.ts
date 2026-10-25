// Test helper. The intents a choice sheet can send without the player building anything further: each option of a pick
// (and of the sheet it opens next), the primary and the alternative, an empty and a one-card multi choice, one whole share
// of a distribute sheet, Pass and each free trigger. The sheet tests send each one to the reducer.
import { distributeIntent, multiIntent } from "../src/play/bar-sheets.ts";
import type { Sheet } from "../src/play/sheet-types.ts";
import type { PlayerIntent, ScenarioState } from "../src/rules/reduce.ts";

export function intentsOf(state: ScenarioState, sheet: Sheet): PlayerIntent[] {
  switch (sheet.kind) {
    case "pick": {
      const out: PlayerIntent[] = [];
      for (const option of sheet.options) {
        if ("intent" in option) out.push(option.intent);
        else out.push(...intentsOf(state, option.next));
      }
      if (sheet.primary) out.push(sheet.primary.intent);
      if (sheet.alternative && "intent" in sheet.alternative) out.push(sheet.alternative.intent);
      if (sheet.alternative && "next" in sheet.alternative) out.push(...intentsOf(state, sheet.alternative.next));
      return out;
    }
    case "multi": {
      const out: PlayerIntent[] = [];
      if (sheet.allowEmpty) out.push(multiIntent(sheet, []));
      if (sheet.options[0]) out.push(multiIntent(sheet, [sheet.options[0].id]));
      if (sheet.alternative && "intent" in sheet.alternative) out.push(sheet.alternative.intent);
      return out;
    }
    case "distribute": {
      const first = sheet.options[0];
      return first ? [distributeIntent(sheet, [{ id: first.id, amount: sheet.total }])] : [];
    }
    case "trigger":
      return [
        ...(sheet.pass ? [{ type: "Pass" } as PlayerIntent] : []),
        ...sheet.options.filter((option) => !option.pay).map((option): PlayerIntent => ({ type: "Trigger", cardId: option.cardId, effectId: option.effectId })),
      ];
    case "outcome":
      return [];
  }
}

