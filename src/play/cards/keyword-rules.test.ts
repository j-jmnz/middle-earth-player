// Rules: rr.keywords, rr.surge, mec109.archery, mec113.archery, trg.secrecy, bts.valour (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { FLAGS, NUMBERED } from "../../catalog/keyword-line.ts";
import { ruleDoc, ruleTitle } from "./ledger.ts";
import { KEYWORD_RULES, pickRule, TIMING_RULES, timingOf } from "./keyword-rules.ts";

describe("keyword rules", () => {
  it("name an existing span for every candidate", () => {
    // Burn X is defined by the Quest Companion, which data/rules holds no span of (docs/brief.md, The Battle of Lake-town): its chip names no rule.
    for (const word of [...Object.values(KEYWORD_RULES), ...Object.values(TIMING_RULES)]) {
      if (word.word !== "Burn") expect(word.rules.length, word.word).toBeGreaterThan(0);
      for (const id of word.rules) expect(ruleTitle(id), id).not.toBeNull();
    }
  });

  it("cover every keyword the catalog reads, grapple included", () => {
    const keys = new Set<string>([...Object.values(FLAGS), ...Object.values(NUMBERED), "grapple"]);
    for (const key of keys) expect(key in KEYWORD_RULES, key).toBe(true);
  });

  it("read the timing label of a bold run", () => {
    expect(timingOf("Forced:")).toBe("forced");
    expect(timingOf("When Revealed:")).toBe("whenRevealed");
    expect(timingOf("Planning Action:")).toBe("action");
    expect(timingOf("Valour Response:")).toBe("valour");
    expect(timingOf("Valour Action:")).toBe("valour");
    expect(timingOf("Quest")).toBeNull();
  });

  it("pick the open scenario's own book, then the Rules Reference, then Learn to Play", () => {
    const archery = KEYWORD_RULES.archery.rules;
    expect(pickRule(archery, "mec113")).toBe("mec113.archery");
    expect(pickRule(archery, "mec109")).toBe("mec109.archery");
    expect(pickRule(KEYWORD_RULES.surge.rules, "mec113")).toBe("rr.surge");
    expect(pickRule(KEYWORD_RULES.surge.rules, null)).toBe("rr.surge");
    expect(pickRule(["ltp.surge", "hon.archery"], null)).toBe("ltp.surge");
    expect(pickRule(["hon.siege"], "mec109")).toBe("hon.siege");
    expect(pickRule([], null)).toBeNull();
    expect(ruleDoc("ltp.surge")).toBe("learn-to-play");
  });
});
