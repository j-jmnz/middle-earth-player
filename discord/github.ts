// Issue updates from GitHub to Discord. The repository's webhook posts to /github; each delivery is signed with
// GITHUB_WEBHOOK_SECRET (HMAC-SHA256 of the raw body). An issue the bot made carries its Discord source in its body
// (sourceMarker), so the update goes beside the report: closed, reopened, a new comment, and the release that ships
// the fix, after which the bot stops following the issue (docs/discord-issues.md, Issue updates).
import { github, type Env } from "./env.ts";
import { postAt, retiredBody, sourceInBody } from "./source.ts";
import { bytesOfHex } from "./verify.ts";

interface Issue {
  number: number;
  title: string;
  html_url: string;
  body?: string | null;
  state_reason?: string | null;
  pull_request?: unknown;
}

interface Delivery {
  action?: string;
  issue?: Issue;
  comment?: { body: string; html_url: string; user: { login: string; type: string } };
  release?: { tag_name: string; html_url: string; body?: string | null; prerelease: boolean; draft: boolean };
  sender?: { login: string };
}

// The longest piece of a comment the bot quotes.
const QUOTE_MAX = 600;

/** Whether GitHub signed `body` with the shared secret. `crypto.subtle.verify` compares in constant time. */
export async function verifyGitHubDelivery(secret: string, signatureHeader: string | null, body: string): Promise<boolean> {
  const signature = signatureHeader?.startsWith("sha256=") ? bytesOfHex(signatureHeader.slice("sha256=".length)) : null;
  if (!secret || !signature) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("HMAC", key, signature, new TextEncoder().encode(body));
}

function quote(text: string): string {
  const clipped = text.length <= QUOTE_MAX ? text.trim() : `${text.slice(0, QUOTE_MAX - 1).trimEnd()}…`;
  return clipped.split("\n").map((line) => `> ${line}`).join("\n");
}

// The thread the bot starts on a report message for its issue.
function threadName(issue: Issue): string {
  return `#${issue.number} ${issue.title}`;
}

// The issue's number in a message, bold and linked without a preview card. The thread is named for the issue already.
function named(issue: Issue): string {
  return `**[#${issue.number}](<${issue.html_url}>)**`;
}

/** The message an issue event posts, or null for an event the bot does not report. */
export function issueMessage(event: string, delivery: Delivery): string | null {
  const { action, issue, comment } = delivery;
  if (!issue || issue.pull_request) return null;
  if (event === "issues" && action === "closed") {
    if (issue.state_reason === "not_planned") return `${named(issue)} has been closed without a change for now. The issue on GitHub explains why.`;
    if (issue.state_reason === "duplicate") return `${named(issue)} was already reported in another issue, so it's closed as a duplicate. Follow the link on GitHub for updates.`;
    return `🎉 Good news: ${named(issue)} is fixed! The fix will be in the next app update, and I'll let you know here when it's out.`;
  }
  if (event === "issues" && action === "reopened") return `${named(issue)} has been reopened. We're taking another look.`;
  // Comments from people only: a bot's comment (a CI report, this bot's own) is not news for the reporter.
  if (event === "issue_comment" && action === "created" && comment && comment.user.type !== "Bot") {
    return `💬 **${comment.user.login}** replied on GitHub:\n${quote(comment.body)}\n[Read the full comment](<${comment.html_url}>)`;
  }
  return null;
}

/** The issues a release's notes say it closes (`closes #4, #7`: scripts/release/notes.ts). */
export function closedBy(notes: string): number[] {
  const numbers = [...notes.matchAll(/closes ((?:#\d+(?:, )?)+)/gi)].flatMap((match) => [...match[1]!.matchAll(/#(\d+)/g)].map((found) => Number(found[1])));
  return [...new Set(numbers)];
}

// A published release: each issue it closes that the bot made hears which version has the fix. That is the report's
// last post: the issue's marker is retired, so the bot follows it no further (retiredBody).
async function postRelease(env: Env, release: NonNullable<Delivery["release"]>): Promise<void> {
  if (release.draft || release.prerelease) return;
  for (const number of closedBy(release.body ?? "")) {
    const issue = await github<Issue>(env, "GET", `/repos/${env.GITHUB_REPO}/issues/${number}`);
    const source = sourceInBody(issue?.body);
    if (!issue?.body || !source) continue;
    const message = `🚀 The fix for ${named(issue)} is out in **${release.tag_name}**! Update the app to get it. [Release notes](<${release.html_url}>)`;
    await postAt(env, source, message, threadName(issue));
    await github(env, "PATCH", `/repos/${env.GITHUB_REPO}/issues/${number}`, { body: retiredBody(issue.body) });
  }
}

/** Handles one webhook delivery. A failure answers 500, so GitHub's Recent Deliveries shows it and can send it again. */
export async function handleGitHub(request: Request, env: Env): Promise<Response> {
  const body = await request.text();
  if (!(await verifyGitHubDelivery(env.GITHUB_WEBHOOK_SECRET, request.headers.get("x-hub-signature-256"), body))) {
    return new Response("Bad delivery signature.", { status: 401 });
  }
  const event = request.headers.get("x-github-event") ?? "";
  const delivery = JSON.parse(body) as Delivery;
  try {
    if (event === "release" && delivery.action === "published" && delivery.release) {
      await postRelease(env, delivery.release);
      return new Response("Posted the release.");
    }
    const message = issueMessage(event, delivery);
    const source = sourceInBody(delivery.issue?.body);
    if (!message || !source) return new Response("Nothing to post.");
    await postAt(env, source, message, threadName(delivery.issue!));
    return new Response("Posted.");
  } catch (error) {
    return new Response(error instanceof Error ? error.message : String(error), { status: 500 });
  }
}
