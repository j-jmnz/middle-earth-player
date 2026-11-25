// The test site's store of meter logs (webapp/meter.ts) over a stand-in for the KV namespace: a post is kept, a read gives the newest first, and a body that is
// no log is refused.
import { describe, expect, it } from "vitest";

import { handleMeter, meterKey, type MeterStore } from "./meter.ts";

function store(): MeterStore & { rows: Map<string, string>; ttl: number[] } {
  const rows = new Map<string, string>();
  const ttl: number[] = [];
  return {
    rows,
    ttl,
    put: async (key, value, options) => {
      rows.set(key, value);
      if (options) ttl.push(options.expirationTtl);
    },
    get: async (key) => rows.get(key) ?? null,
    // A KV list is in key order.
    list: async ({ prefix, limit }) => ({ keys: [...rows.keys()].filter((name) => name.startsWith(prefix)).sort().slice(0, limit).map((name) => ({ name })) }),
  };
}

const post = (body: string) => new Request("https://app.example/_meter", { method: "POST", body });
const read = (query = "") => new Request(`https://app.example/_meter${query}`);

describe("the test site's meter logs", () => {
  it("sorts a later log before an earlier one", () => {
    expect(meterKey(2000, "a") < meterKey(1000, "a")).toBe(true);
    expect(meterKey(1000, "a")).not.toBe(meterKey(1000, "b"));
  });

  it("keeps a posted log for a week and reads the newest first", async () => {
    const kv = store();
    expect((await handleMeter(post("first"), kv, 1000, "a")).status).toBe(204);
    expect((await handleMeter(post("second"), kv, 2000, "b")).status).toBe(204);
    expect(kv.ttl).toEqual([604800, 604800]);
    const answer = await handleMeter(read(), kv, 3000, "c");
    expect(answer.headers.get("cache-control")).toBe("no-store");
    expect(await answer.text()).toBe("second\n\n----\n\nfirst\n");
    expect(await (await handleMeter(read("?n=1"), kv, 3000, "c")).text()).toBe("second\n");
  });

  it("says so when there is no log", async () => {
    expect(await (await handleMeter(read(), store(), 1, "a")).text()).toBe("no logs\n");
  });

  it("refuses an empty body, one too large and another method", async () => {
    const kv = store();
    expect((await handleMeter(post(""), kv, 1, "a")).status).toBe(413);
    expect((await handleMeter(post("x".repeat(64 * 1024 + 1)), kv, 1, "a")).status).toBe(413);
    expect((await handleMeter(new Request("https://app.example/_meter", { method: "DELETE" }), kv, 1, "a")).status).toBe(405);
    expect(kv.rows.size).toBe(0);
  });
});
