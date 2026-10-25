import { describe, expect, it } from "vitest";

import { cardTextParagraphs, traitLine } from "./card-text.ts";

describe("card text on the card screen", () => {
  it("splits one paragraph per line, with the bold timing word and the stat icons as runs", () => {
    const paragraphs = cardTextParagraphs("Permanent.\n<b>Action:</b> Attached hero gets +2 [willpower] until the end of the phase.");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]?.runs).toEqual([{ kind: "text", text: "Permanent.", bold: false, italic: false }]);
    expect(paragraphs[1]?.runs).toEqual([
      { kind: "text", text: "Action:", bold: true, italic: false },
      { kind: "text", text: " Attached hero gets +2 ", bold: false, italic: false },
      { kind: "icon", name: "willpower", word: "willpower" },
      { kind: "text", text: " until the end of the phase.", bold: false, italic: false },
    ]);
  });

  it("marks a line that is italic throughout as flavor", () => {
    const [flavor, rule] = cardTextParagraphs("<i>The road goes ever on.</i>\n<b>Response:</b> Draw a card.");
    expect(flavor?.flavor).toBe(true);
    expect(rule?.flavor).toBe(false);
  });

  it("reads the source's <b.Response:</b> typo as a bold Response", () => {
    expect(cardTextParagraphs("<b.Response:</b> Ready him.")[0]?.runs[0]).toEqual({ kind: "text", text: "Response:", bold: true, italic: false });
  });

  it("keeps an unknown bracket word as text and drops empty lines", () => {
    const paragraphs = cardTextParagraphs("Pay [x] resources.\n\n");
    expect(paragraphs).toEqual([{ runs: [{ kind: "text", text: "Pay [x] resources.", bold: false, italic: false }], flavor: false }]);
    expect(cardTextParagraphs(null)).toEqual([]);
  });
});

describe("traits", () => {
  it("read the catalog's JSON array as the printed sentence", () => {
    expect(traitLine('["Dúnedain","Ranger"]')).toBe("Dúnedain. Ranger.");
    expect(traitLine("[]")).toBeNull();
    expect(traitLine(null)).toBeNull();
    expect(traitLine("Hobbit.")).toBe("Hobbit.");
  });
});
