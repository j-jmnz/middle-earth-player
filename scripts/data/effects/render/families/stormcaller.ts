// The Stormcaller's pieces (src/catalog/families/stormcaller.ts, the Dream-chaser box): the Stormcaller's area, quest deck and progress: templates and samples.
import { amt, type Samples, type Templates } from "../family-kit.ts";
import { joinAnd, str } from "../kit.ts";

export const STORMCALLER_TEMPLATES: Templates = {
  MoveToStormcallerArea: (i) => ({ text: `${i.target === "picked" ? "the last picked card" : "this card"} goes into the Stormcaller's area, instead of the players' staging area`, read: ["target"] }),
  CatchUpWins: (i) => ({ text: `(the stage's definition carries the number; nothing runs when the record is resolved) defeating this stage while the Stormcaller is at stage ${str(i.stage)} means the players have caught up to the Stormcaller and win the game`, read: ["stage"] }),
  StormcallerProgress: () => ({ text: "the top card of the encounter deck is discarded, and the Stormcaller's current stage takes progress equal to the Stormcaller's Threat, the printed Threat of that card and the Threat of each card in the area that says it contributes; a full stage advances", read: [] }),
  MoveProgressToStormcaller: (i, ctx) => ({ text: `up to ${amt(i.amount, ctx)} progress comes off the current quest card and goes on the Stormcaller's current quest stage, which advances when it is full (nothing moves when the quest holds none)`, read: ["amount"] }),
  FlipStormcaller: () => ({ text: "Campaign Setup: the Stormcaller flips to its 'Campaign Mode only' side B, with the stats and text printed there", read: [] }),
  PrepareStormcallerArea: (i) => ({ text: `Setup: the set-aside quest cards with codes ${joinAnd((Array.isArray(i.stages) ? i.stages : []).map(str))} become the Stormcaller's quest deck in this order, the top one is its current quest stage (stage ${str(i.number)}), side D up (its Setup does not reveal it), and the set-aside Stormcaller is placed beside it, in the area`, read: ["stages", "number"] }),
};

export const STORMCALLER_SAMPLES: Samples = {
  MoveToStormcallerArea: [{ verb: "MoveToStormcallerArea", target: "picked" }],
  CatchUpWins: [{ verb: "CatchUpWins", stage: 2 }],
  StormcallerProgress: [{ verb: "StormcallerProgress" }],
  MoveProgressToStormcaller: [{ verb: "MoveProgressToStormcaller", amount: 2 }],
  FlipStormcaller: [{ verb: "FlipStormcaller" }],
  PrepareStormcallerArea: [{ verb: "PrepareStormcallerArea", stages: ["12016", "12017"], number: 2 }],
};
