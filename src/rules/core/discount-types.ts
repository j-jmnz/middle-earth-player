import type { PickSpec } from "../../catalog/boundary.ts";

// "Reduce the cost of the next Silvan ally you play this phase by 1": spent by the first card that matches.
// `anySeat`: any player's next matching card spends it. The card that spends it gains Doomed `doomed`, needs no resource match
// (`noMatch`) and cannot quest this round (`cannotQuest`). `used`: it lasts until spent.
export type Discount = {
  seat: number;
  sourceId: string;
  pick: PickSpec;
  amount: number;
  until: "endOfPhase" | "endOfRound" | "used";
  min?: number;
  anySeat?: true;
  doomed?: number;
  noMatch?: true;
  cannotQuest?: true;
};
