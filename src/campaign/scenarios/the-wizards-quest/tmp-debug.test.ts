import { it } from "vitest";
import { EFFECTS } from "../../../effects/index.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { resolve, quest, type Row } from "../../../../test/harness/card-spec.ts";
import { legalIntents } from "../../../../test/harness/scene-kit.ts";

it("debug", () => {
  const row = JSON.parse(process.env.ROW ?? "{}") as Row;
  const done = play("the-wizards-quest", row, EFFECTS, false);
  const s = done.run.state;
  console.log(JSON.stringify({ phase: s.phase, mode: s.mode, lost: s.lost, won: (s as any).won, stage: s.questStage && s.cards[s.questStage]?.code, window: s.window?.kind, steps: done.run.steps.slice(-8).map((x) => JSON.stringify(x).slice(0, 200)) }, null, 1));
  console.log(JSON.stringify(legalIntents(s, done.table.ctx).map((i) => JSON.stringify(i)).slice(0, 12)));void resolve; void quest;
});
