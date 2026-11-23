// The web app's test controls (src/ui/web/render-scale.ts): which drawing scale and whether the frame meter, from the address and the stored choice.
import { describe, expect, it } from "vitest";

import { chosenScale, errorLine, meterChosen, meterLine } from "./render-scale.ts";

describe("the web app's drawing scale", () => {
  it("takes the address's scale before the stored one", () => {
    expect(chosenScale("?scale=1", null, 2)).toBe(1);
    expect(chosenScale("?scale=1.5", "1", 2)).toBe(1.5);
    expect(chosenScale("", "1", 2)).toBe(1);
    expect(chosenScale("", null, 2)).toBeNull();
  });

  it("keeps the device's own for a scale that is off, too small, not under the device's, or no number", () => {
    expect(chosenScale("?scale=0", "1", 2)).toBeNull();
    expect(chosenScale("?scale=0.5", null, 2)).toBeNull();
    expect(chosenScale("?scale=2", null, 2)).toBeNull();
    expect(chosenScale("?scale=1", null, 1)).toBeNull();
    expect(chosenScale("?scale=fast", null, 2)).toBeNull();
  });

  it("shows the meter when asked, and the address turns a stored one off", () => {
    expect(meterChosen("?fps=1", null)).toBe(true);
    expect(meterChosen("", "1")).toBe(true);
    expect(meterChosen("?fps=0", "1")).toBe(false);
    expect(meterChosen("", null)).toBe(false);
  });

  it("says the frame rate, the worst frame and the scale", () => {
    expect(meterLine([16, 16, 18, 50], 2)).toBe("40 fps  worst 50 ms  x2");
    expect(meterLine([], 1.5)).toBe("-- fps  x1.5");
  });

  it("says an error's name, message and first frames without the site's address", () => {
    const error = new Error("The object is in an invalid state.");
    error.name = "InvalidStateError";
    error.stack = "f@https://site.example/_expo/static/js/web/entry-abc.js:1:2\ng@https://site.example/_expo/static/js/web/table-def.js:3:4";
    expect(errorLine(error)).toBe("InvalidStateError: The object is in an invalid state.\nf@entry-abc.js:1:2\ng@table-def.js:3:4");
    expect(errorLine("plain")).toBe("plain");
  });
});
