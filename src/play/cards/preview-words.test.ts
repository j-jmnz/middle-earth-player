import { describe, expect, it } from "vitest";

import { chipLabel, listHeading, previewValue, rowName } from "./preview-words.ts";

const earlier = { name: "Three is Company", title: "Stage 1B", detail: "Three is Company", role: "Earlier stage" };
const side = { name: "Flight to the Ford", role: "Attachment" };

describe("the preview's words", () => {
  it("announces an earlier stage with its place, name and position when the card steps", () => {
    expect(previewValue(earlier, 1, 3)).toBe("Stage 1B, Three is Company, 2 of 3");
    expect(previewValue({ name: "Flight to the Ford" }, 0, 2)).toBe("Flight to the Ford, 1 of 2");
    expect(previewValue({ name: "Flight", title: "Flight to the Ford · 2 / 8", detail: "Won some other way" }, 0, 2)).toBe("Flight to the Ford · 2 / 8, Won some other way, 1 of 2");
  });

  it("heads the list for the earlier stages it holds", () => {
    expect(listHeading([{ name: "a" }, earlier], 0)).toBe("This stage and before");
    expect(listHeading([{ name: "a" }, side], 0)).toBe("With it");
    expect(listHeading([{ name: "a" }, side], 1)).toBe("The card and what is with it");
  });

  it("reads an earlier stage's row as its place and name", () => {
    expect(rowName(earlier)).toBe("Stage 1B · Three is Company");
    expect(rowName(side)).toBe("Flight to the Ford");
  });

  it("gives a chip the stage place", () => {
    expect(chipLabel(earlier)).toBe("Stage 1B, Three is Company, Earlier stage");
    expect(chipLabel(side)).toBe("Flight to the Ford, Attachment");
    expect(chipLabel({ name: "Frodo" })).toBe("Frodo");
  });
});
