// The freshness check on Discord's signed timestamp, with the clock passed in.
import { describe, expect, it } from "vitest";

import { freshTimestamp, verifyDiscordRequest } from "./verify.ts";

const NOW = 1_700_000_000_000;

describe("Discord request timestamp", () => {
  it("accepts a timestamp within five minutes of the clock, either way", () => {
    expect(freshTimestamp("1700000000", NOW)).toBe(true);
    expect(freshTimestamp("1699999700", NOW)).toBe(true);
    expect(freshTimestamp("1700000300", NOW)).toBe(true);
  });

  it("refuses an older or later one, and one that is not a number of seconds", () => {
    expect(freshTimestamp("1699999699", NOW)).toBe(false);
    expect(freshTimestamp("1700000301", NOW)).toBe(false);
    expect(freshTimestamp("", NOW)).toBe(false);
    expect(freshTimestamp("1700000000.5", NOW)).toBe(false);
    expect(freshTimestamp("-1700000000", NOW)).toBe(false);
    expect(freshTimestamp("1e9", NOW)).toBe(false);
  });

  it("refuses a rightly signed request once its timestamp is stale", async () => {
    const keys = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const publicKey = hex(await crypto.subtle.exportKey("raw", keys.publicKey));
    const signature = hex(await crypto.subtle.sign({ name: "Ed25519" }, keys.privateKey, new TextEncoder().encode("1700000000{}")));
    expect(await verifyDiscordRequest(publicKey, signature, "1700000000", "{}", NOW)).toBe(true);
    expect(await verifyDiscordRequest(publicKey, signature, "1700000000", "{}", NOW + 301_000)).toBe(false);
  });
});
