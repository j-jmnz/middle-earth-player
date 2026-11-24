// The bot end to end, with Discord's signature made by a test key and every outgoing request answered by a stub.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import commands from "./commands.json";
import type { Env } from "./env.ts";
import worker from "./worker.ts";

let keys: CryptoKeyPair;
let env: Env;

beforeAll(async () => {
  keys = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey));
  const publicKey = [...raw].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  env = { DISCORD_PUBLIC_KEY: publicKey, DISCORD_APPLICATION_ID: "100", DISCORD_BOT_TOKEN: "bot", GITHUB_TOKEN: "gh", GITHUB_WEBHOOK_SECRET: "hook", GITHUB_REPO: "owner/repo", GUILD_ID: "1" };
});

afterEach(() => vi.unstubAllGlobals());

async function signed(interaction: unknown, signer = keys.privateKey, timestamp = String(Math.floor(Date.now() / 1000))): Promise<Request> {
  const body = JSON.stringify(interaction);
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, signer, new TextEncoder().encode(timestamp + body)));
  const hex = [...signature].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return new Request("https://bot.example/", { method: "POST", body, headers: { "x-signature-ed25519": hex, "x-signature-timestamp": timestamp } });
}

type Call = { method: string; url: string; body: unknown };

// Answers each request by its method and path; records every call.
function stubFetch(routes: Record<string, unknown>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    const parsed = new URL(url);
    const route = `${method} ${parsed.host === "api.github.com" ? "github" : ""}${parsed.pathname.replace("/api/v10", "")}${parsed.search}`;
    calls.push({ method, url, body: init.body ? JSON.parse(String(init.body)) : undefined });
    if (!(route in routes)) return new Response("not found", { status: 404 });
    return Response.json(routes[route]);
  });
  return calls;
}

async function run(interaction: unknown): Promise<{ response: Response; body: any; waited: Promise<unknown>[] }> {
  const waited: Promise<unknown>[] = [];
  const response = await worker.fetch(await signed(interaction), env, { waitUntil: (promise) => waited.push(promise) });
  await Promise.all(waited);
  return { response, body: response.headers.get("content-type") === "application/json" ? await response.json() : await response.text(), waited };
}

const author = { id: "7", username: "frodo", global_name: "Frodo" };
const report = {
  id: "300",
  channel_id: "200",
  type: 0,
  content: "**Gandalf** costs 4, not 5 <@8>\nSteps: play him",
  author,
  mentions: [{ id: "8", username: "sam" }],
  attachments: [{ filename: "shot.png", url: "https://cdn.discordapp.com/shot.png" }],
};
// A member with Manage Messages (8192) among other permissions.
const moderator = { user: { id: "9", username: "elrond", global_name: null }, permissions: String(8192 + 1024) };
const player = { ...moderator, permissions: "1024" };

const components = [
  { type: 18, component: { type: 4, custom_id: "title", value: "Gandalf costs 5" } },
  { type: 18, component: { type: 3, custom_id: "kind", values: ["rules"] } },
  { type: 18, component: { type: 4, custom_id: "body", value: "Gandalf costs 4." } },
];

describe("Discord issue bot", () => {
  it("refuses a request that Discord did not sign", async () => {
    const other = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const response = await worker.fetch(await signed({ type: 1 }, other.privateKey), env, { waitUntil: () => {} });
    expect(response.status).toBe(401);
  });

  it("refuses a signed request whose timestamp is more than five minutes old", async () => {
    const old = String(Math.floor(Date.now() / 1000) - 301);
    const response = await worker.fetch(await signed({ type: 1 }, keys.privateKey, old), env, { waitUntil: () => {} });
    expect(response.status).toBe(401);
  });

  it("answers Discord's ping", async () => {
    expect((await run({ type: 1, token: "t" })).body).toEqual({ type: 1 });
  });

  it("opens a form filled from the message the command was run on", async () => {
    stubFetch({ "GET /channels/200/messages/300": report });
    const { body } = await run({ type: 2, token: "t", guild_id: "1", member: moderator, channel: { id: "200", type: 0 }, data: { type: 3, name: "Create GitHub issue", target_id: "300" } });
    expect(body.type).toBe(9);
    expect(body.data.custom_id).toBe("issue:m:200:300");
    expect(body.data.components[0].component.value).toBe("Gandalf costs 4, not 5 @sam");
    expect(body.data.components[2].component.value).toBe("**Gandalf** costs 4, not 5 @sam\nSteps: play him");
  });

  it("tells the moderator to use a thread when /issue runs in a channel", async () => {
    const { body } = await run({ type: 2, token: "t", guild_id: "1", member: moderator, channel: { id: "200", type: 0 }, data: { type: 1, name: "issue" } });
    expect(body.type).toBe(4);
    expect(body.data.flags).toBe(64);
  });

  it("reads a thread made from a channel message, with its replies when asked", async () => {
    stubFetch({
      "GET /channels/500": { name: "Gandalf costs too much" },
      "GET /channels/500/messages?after=0&limit=51": [
        { id: "502", channel_id: "500", type: 0, content: "Same here\nin Mirkwood", author: { id: "8", username: "sam" } },
        { id: "501", channel_id: "500", type: 21, content: "", author, message_reference: { channel_id: "200", message_id: "300" } },
      ],
      "GET /channels/200/messages/300": report,
    });
    const { body } = await run({ type: 2, token: "t", guild_id: "1", member: moderator, channel: { id: "500", type: 11 }, data: { type: 1, name: "issue", options: [{ name: "replies", value: true }] } });
    expect(body.data.custom_id).toBe("issue:t:500:1");
    expect(body.data.components[0].component.value).toBe("Gandalf costs too much");
    expect(body.data.components[2].component.value).toBe("**Gandalf** costs 4, not 5 @sam\nSteps: play him\n\n> **sam:** Same here\n> in Mirkwood");
  });

  it("creates the labelled issue on submit, links it in a thread on the report and tells the moderator", async () => {
    const calls = stubFetch({
      "GET /channels/200": { id: "200", guild_id: "1" },
      "GET /channels/200/messages/300": report,
      "POST github/repos/owner/repo/issues": { number: 42, html_url: "https://github.com/owner/repo/issues/42" },
      "POST /channels/200/messages/300/threads": { id: "300" },
      "POST /channels/300/messages": {},
      "PATCH /webhooks/100/t/messages/@original": {},
    });
    const { body } = await run({ type: 5, token: "t", guild_id: "1", member: moderator, data: { custom_id: "issue:m:200:300", components } });
    expect(body).toEqual({ type: 5, data: { flags: 64 } });
    const issue = calls.find((call) => call.url.includes("api.github.com"))!;
    expect(issue.body).toEqual({
      title: "Gandalf costs 5",
      labels: ["rules"],
      body: expect.stringContaining("Gandalf costs 4.\n\n### Attachments\n\n- [shot.png](https://cdn.discordapp.com/shot.png)"),
    });
    expect((issue.body as { body: string }).body).toContain("---\nReported by **Frodo** on [Discord](https://discord.com/channels/1/200/300) · filed by **elrond**\n");
    expect((issue.body as { body: string }).body).toMatch(/<!-- discord issue:m:200:300 -->$/);
    const thread = calls.find((call) => call.url.endsWith("/channels/200/messages/300/threads"))!;
    expect(thread.body).toEqual({ name: "#42 Gandalf costs 5", auto_archive_duration: 10080 });
    const link = calls.find((call) => call.method === "POST" && call.url.endsWith("/channels/300/messages"))!;
    expect(link.body).toEqual({
      content: "Thanks for the report, **Frodo**! It's now tracked as **[#42](<https://github.com/owner/repo/issues/42>)** on GitHub. I'll post updates here.",
      flags: 4,
      allowed_mentions: { parse: [] },
    });
    const told = calls.find((call) => call.method === "PATCH")!;
    expect(told.body).toMatchObject({ content: expect.stringContaining("Done! I created **[#42](<https://github.com/owner/repo/issues/42>)** and posted it in a thread on the report.") });
  });

  it("tells the moderator when GitHub refuses the issue", async () => {
    const calls = stubFetch({ "GET /channels/200": { id: "200", guild_id: "1" }, "GET /channels/200/messages/300": report, "PATCH /webhooks/100/t/messages/@original": {} });
    const components = [{ custom_id: "title", value: "A bug" }, { custom_id: "kind", values: ["bug"] }, { custom_id: "body", value: "Text" }];
    await run({ type: 5, token: "t", guild_id: "1", member: moderator, data: { custom_id: "issue:m:200:300", components } });
    expect(calls.find((call) => call.method === "PATCH")!.body).toMatchObject({ content: "Sorry, I couldn't create the issue: I couldn't find the repository, or the GitHub token can't see it." });
  });

  it("refuses a command from another server, and every command while GUILD_ID is unset", async () => {
    const calls = stubFetch({ "GET /channels/200/messages/300": report });
    const command = { type: 2, token: "t", member: moderator, channel: { id: "200", type: 0 }, data: { type: 3, name: "Create GitHub issue", target_id: "300" } };
    const elsewhere = await run({ ...command, guild_id: "2" });
    expect(elsewhere.body).toMatchObject({ type: 4, data: { flags: 64 } });
    const guild = env.GUILD_ID;
    delete env.GUILD_ID;
    const unset = await run({ ...command, guild_id: "1" }).finally(() => (env.GUILD_ID = guild));
    expect(unset.body.type).toBe(4);
    // A direct message has no server and no member.
    expect((await run({ ...command, member: undefined })).body.type).toBe(4);
    expect(calls).toEqual([]);
  });

  it("refuses a command and a submitted form from a member who may not manage messages", async () => {
    const calls = stubFetch({ "GET /channels/200/messages/300": report });
    const command = await run({ type: 2, token: "t", guild_id: "1", member: player, channel: { id: "200", type: 0 }, data: { type: 3, name: "Create GitHub issue", target_id: "300" } });
    expect(command.body).toMatchObject({ type: 4, data: { content: expect.stringContaining("Manage Messages"), flags: 64 } });
    const submit = await run({ type: 5, token: "t", guild_id: "1", member: player, data: { custom_id: "issue:m:200:300", components } });
    expect(submit.body.type).toBe(4);
    expect((await run({ type: 5, token: "t", guild_id: "1", member: { ...player, permissions: undefined }, data: { custom_id: "issue:m:200:300", components } })).body.type).toBe(4);
    expect(calls).toEqual([]);
    // An administrator needs no Manage Messages bit.
    expect((await run({ type: 2, token: "t", guild_id: "1", member: { ...player, permissions: "8" }, channel: { id: "200", type: 0 }, data: { type: 3, name: "Create GitHub issue", target_id: "300" } })).body.type).toBe(9);
  });

  it("creates no issue when the submitted form names a channel of another server", async () => {
    const calls = stubFetch({
      "GET /channels/200": { id: "200", guild_id: "2" },
      "GET /channels/200/messages/300": report,
      "POST github/repos/owner/repo/issues": { number: 42, html_url: "https://github.com/owner/repo/issues/42" },
      "POST /channels/200/messages": {},
      "PATCH /webhooks/100/t/messages/@original": {},
    });
    await run({ type: 5, token: "t", guild_id: "1", member: moderator, data: { custom_id: "issue:m:200:300", components } });
    expect(calls.map((call) => call.method)).toEqual(["GET", "PATCH"]);
    expect(calls[1]!.body).toMatchObject({ content: expect.stringContaining("isn't in a channel of this server") });
    // So is a channel the bot may not see (403).
    calls.length = 0;
    vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
      calls.push({ method: init.method ?? "GET", url, body: init.body ? JSON.parse(String(init.body)) : undefined });
      return init.method === "PATCH" ? Response.json({}) : new Response("Missing Access", { status: 403 });
    });
    await run({ type: 5, token: "t", guild_id: "1", member: moderator, data: { custom_id: "issue:m:200:300", components } });
    expect(calls.map((call) => call.method)).toEqual(["GET", "PATCH"]);
    expect(calls[1]!.body).toMatchObject({ content: expect.stringContaining("isn't in a channel of this server") });
    // A thread the bot cannot find is refused the same way.
    const missing = stubFetch({ "PATCH /webhooks/100/t/messages/@original": {} });
    await run({ type: 5, token: "t", guild_id: "1", member: moderator, data: { custom_id: "issue:t:999:0", components } });
    expect(missing.map((call) => call.method)).toEqual(["GET", "PATCH"]);
  });

  it("posts the link in the report's channel, not in another channel whose id the form gave as the message", async () => {
    const calls = stubFetch({
      "GET /channels/200": { id: "200", guild_id: "1" },
      // The "message" id names a channel of another server.
      "GET /channels/300": { id: "300", type: 0, guild_id: "2" },
      "POST github/repos/owner/repo/issues": { number: 42, html_url: "https://github.com/owner/repo/issues/42" },
      "POST /channels/300/messages": {},
      "POST /channels/200/messages": {},
      "PATCH /webhooks/100/t/messages/@original": {},
    });
    await run({ type: 5, token: "t", guild_id: "1", member: moderator, data: { custom_id: "issue:m:200:300", components } });
    const posts = calls.filter((call) => call.method === "POST" && call.url.includes("discord.com")).map((call) => new URL(call.url).pathname);
    expect(posts).toEqual(["/api/v10/channels/200/messages"]);
  });

  it("registers the two commands the worker answers", () => {
    expect(commands.map((command) => [command.name, command.type])).toEqual([
      ["issue", 1],
      ["Create GitHub issue", 3],
    ]);
  });
});
