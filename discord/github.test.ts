// Issue updates through the Worker's /github route, with GitHub's signature made from a test secret and every outgoing
// request answered by a stub.
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Env } from "./env.ts";
import { closedBy, issueMessage } from "./github.ts";
import worker from "./worker.ts";

const env: Env = {
  DISCORD_PUBLIC_KEY: "00",
  DISCORD_APPLICATION_ID: "100",
  DISCORD_BOT_TOKEN: "bot",
  GITHUB_TOKEN: "gh",
  GITHUB_WEBHOOK_SECRET: "hook",
  GITHUB_REPO: "owner/repo",
};

afterEach(() => vi.unstubAllGlobals());

async function delivery(event: string, payload: unknown, secret = "hook"): Promise<Request> {
  const body = JSON.stringify(payload);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  const signature = `sha256=${[...mac].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  return new Request("https://bot.example/github", { method: "POST", body, headers: { "x-github-event": event, "x-hub-signature-256": signature } });
}

type Call = { method: string; url: string; body: any };

function stubFetch(routes: Record<string, unknown>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    const parsed = new URL(url);
    calls.push({ method, url, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const route = `${method} ${parsed.host}${parsed.pathname.replace("/api/v10", "")}`;
    if (!(route in routes)) return new Response("not found", { status: 404 });
    const answer = routes[route];
    return answer instanceof Response ? answer : Response.json(answer);
  });
  return calls;
}

const fromMessage = { number: 42, title: "Gandalf costs 5", html_url: "https://github.com/owner/repo/issues/42", body: "Text\n<!-- discord issue:m:200:300 -->" };
const fromThread = { ...fromMessage, body: "Text\n<!-- discord issue:t:500:0 -->" };
const run = (request: Request) => worker.fetch(request, env, { waitUntil: () => {} });

describe("issue updates", () => {
  it("refuses a delivery GitHub did not sign with the secret", async () => {
    const response = await run(await delivery("issues", { action: "closed", issue: fromMessage }, "other"));
    expect(response.status).toBe(401);
  });

  it("replies to the report message when its issue is closed as fixed", async () => {
    const calls = stubFetch({ "POST discord.com/channels/200/messages": {} });
    const response = await run(await delivery("issues", { action: "closed", issue: { ...fromMessage, state_reason: "completed" } }));
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toMatchObject({
      content: "Issue [#42](<https://github.com/owner/repo/issues/42>) (Gandalf costs 5) is fixed. The fix comes in the next release.",
      message_reference: { message_id: "300" },
      allowed_mentions: { parse: [] },
    });
  });

  it("posts in the thread when a person comments, quoting the comment", async () => {
    const calls = stubFetch({ "POST discord.com/channels/500/messages": {} });
    const comment = { body: "Fixed on main.\nPlease check.", html_url: "https://github.com/owner/repo/issues/42#c1", user: { login: "j", type: "User" } };
    await run(await delivery("issue_comment", { action: "created", issue: fromThread, comment }));
    expect(calls[0]!.body.content).toBe("**j** commented on [#42](<https://github.com/owner/repo/issues/42>) (Gandalf costs 5):\n> Fixed on main.\n> Please check.\n[Read on GitHub](<https://github.com/owner/repo/issues/42#c1>)");
    expect(calls[0]!.body.message_reference).toBeUndefined();
  });

  it("posts nothing for a bot's comment, a pull request, or an issue the bot did not make", async () => {
    const calls = stubFetch({});
    const bot = { body: "CI", html_url: "x", user: { login: "ci[bot]", type: "Bot" } };
    await run(await delivery("issue_comment", { action: "created", issue: fromThread, comment: bot }));
    await run(await delivery("issues", { action: "closed", issue: { ...fromThread, pull_request: {} } }));
    await run(await delivery("issues", { action: "closed", issue: { ...fromThread, body: "No marker" } }));
    expect(calls).toEqual([]);
  });

  it("tells each report that a published release closes which version has its fix", async () => {
    const calls = stubFetch({
      "GET api.github.com/repos/owner/repo/issues/42": fromMessage,
      "GET api.github.com/repos/owner/repo/issues/7": { ...fromThread, number: 7, body: "Not from Discord" },
      "POST discord.com/channels/200/messages": {},
    });
    const release = { tag_name: "v0.4.0", html_url: "https://github.com/owner/repo/releases/v0.4.0", body: "- Fix Gandalf's cost (closes #42, #7)\n- Other (see #9)", prerelease: false, draft: false };
    await run(await delivery("release", { action: "published", release }));
    const posts = calls.filter((call) => call.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0]!.body.content).toBe("The fix for [#42](<https://github.com/owner/repo/issues/42>) (Gandalf costs 5) is in [v0.4.0](<https://github.com/owner/repo/releases/v0.4.0>). Update the app to get it.");
  });

  it("answers 500 when Discord refuses the post, so GitHub can send it again", async () => {
    stubFetch({ "POST discord.com/channels/200/messages": new Response("Missing Permissions", { status: 403 }) });
    const response = await run(await delivery("issues", { action: "reopened", issue: fromMessage }));
    expect(response.status).toBe(500);
  });

  it("words each closing reason and reads the release notes' issue list", () => {
    expect(issueMessage("issues", { action: "closed", issue: { ...fromMessage, state_reason: "not_planned" } })).toContain("closed as not planned");
    expect(issueMessage("issues", { action: "closed", issue: { ...fromMessage, state_reason: "duplicate" } })).toContain("closed as a duplicate");
    expect(issueMessage("issues", { action: "labeled", issue: fromMessage })).toBeNull();
    expect(closedBy("- A (closes #1, #2; see #3)\n- B (closes #2)")).toEqual([1, 2]);
  });
});
