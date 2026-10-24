import { describe, expect, it } from "vitest";

import { goBack } from "./go-back.ts";

function fake(canGoBack: boolean) {
  const calls: string[] = [];
  return { calls, router: { canGoBack: () => canGoBack, back: () => calls.push("back"), replace: (href: unknown) => calls.push(`replace ${JSON.stringify(href)}`) } };
}

describe("goBack", () => {
  it("goes back when there is a screen below", () => {
    const { router, calls } = fake(true);
    goBack(router, "/");
    expect(calls).toEqual(["back"]);
  });

  it("replaces with the fallback when nothing is below", () => {
    const { router, calls } = fake(false);
    goBack(router, { pathname: "/path/[saveId]", params: { saveId: "s" } });
    expect(calls).toEqual(['replace {"pathname":"/path/[saveId]","params":{"saveId":"s"}}']);
  });
});
