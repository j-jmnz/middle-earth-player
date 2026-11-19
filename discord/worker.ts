// The Discord issue bot: a Cloudflare Worker that Discord calls at its Interactions Endpoint URL. A moderator runs
// /issue in a thread, or Apps > Create GitHub issue on a message; the bot answers with a form filled from the report,
// and on submit it creates the issue in GITHUB_REPO and links it in the channel. GitHub's webhook calls /github, and the
// bot posts each issue update beside the report (docs/discord-issues.md).
import { editReply, type Context, type Env } from "./env.ts";
import { handleGitHub } from "./github.ts";
import { createIssue, failureReason, issueBody, issueForm, readForm } from "./issue.ts";
import { loadReport, nameOf, postAt, sourceFromId, sourceToId, type SourceRef } from "./source.ts";
import { verifyDiscordRequest } from "./verify.ts";

// Interaction and response types (https://discord.com/developers/docs/interactions/receiving-and-responding).
const PING = 1;
const APPLICATION_COMMAND = 2;
const MODAL_SUBMIT = 5;
const PONG = 1;
const CHANNEL_MESSAGE = 4;
const DEFERRED_CHANNEL_MESSAGE = 5;
const MODAL = 9;
const EPHEMERAL = 64;
// A slash command's type, and the message command's.
const CHAT_INPUT = 1;
const MESSAGE_COMMAND = 3;
// Channel types of a thread: announcement, public and private.
const THREADS = new Set([10, 11, 12]);

interface Interaction {
  type: number;
  token: string;
  guild_id?: string;
  channel?: { id: string; type: number };
  member?: { user: { id: string; username: string; global_name?: string | null } };
  data?: {
    type?: number;
    name?: string;
    target_id?: string;
    custom_id?: string;
    options?: { name: string; value: unknown }[];
    components?: Parameters<typeof readForm>[0];
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** A reply only the moderator sees. */
function note(content: string): Response {
  return json({ type: CHANNEL_MESSAGE, data: { content, flags: EPHEMERAL, allowed_mentions: { parse: [] } } });
}

// The command's source: the message it was run on, or the thread it was run in.
function sourceOf(interaction: Interaction): SourceRef | null {
  const { data, channel } = interaction;
  if (data?.type === MESSAGE_COMMAND && data.target_id && channel) return { kind: "message", channelId: channel.id, messageId: data.target_id };
  if (data?.type === CHAT_INPUT && channel && THREADS.has(channel.type)) {
    const replies = data.options?.find((option) => option.name === "replies")?.value === true;
    return { kind: "thread", threadId: channel.id, replies };
  }
  return null;
}

// The command opens the form. It must answer within three seconds, so it reads the report once and does no more.
async function openForm(env: Env, interaction: Interaction): Promise<Response> {
  const source = sourceOf(interaction);
  if (!source || !interaction.guild_id) return note("`/issue` only works inside a thread or forum post. To report a single message, right-click it and choose **Apps → Create GitHub issue**.");
  const report = await loadReport(env, interaction.guild_id, source);
  if (!report) return note("I couldn't read that message. Check that I can see this channel and that the Message Content intent is on in the Developer Portal.");
  return json({ type: MODAL, data: issueForm(sourceToId(source), report) });
}

// After the deferred answer: read the report again for its attachments, create the issue, link it where the report is,
// and tell the moderator. A failure is told to the moderator only.
async function fileIssue(env: Env, interaction: Interaction, source: SourceRef, values: NonNullable<ReturnType<typeof readForm>>): Promise<void> {
  try {
    const report = await loadReport(env, interaction.guild_id!, source);
    const filedBy = interaction.member ? nameOf(interaction.member.user) : "a moderator";
    const issue = await createIssue(env, values, issueBody(values, report, filedBy, source));
    const number = `**[#${issue.number}](<${issue.url}>)**`;
    const thanks = report ? `Thanks for the report, **${report.author}**!` : "Thanks for the report!";
    const posted = await postLink(env, source, `${thanks} It's now tracked as ${number} on GitHub. I'll post updates here.`, `#${issue.number} ${values.title}`);
    await editReply(env, interaction.token, doneMessage(number, posted));
  } catch (error) {
    console.error("Creating the issue failed", error);
    await editReply(env, interaction.token, `Sorry, I couldn't create the issue: ${failureReason(error)}`);
  }
}

// What the moderator hears once the issue exists, by where the link went.
function doneMessage(number: string, posted: "thread" | "reply" | null): string {
  if (posted === "thread") return `Done! I created ${number} and posted it in a thread on the report.`;
  if (posted === "reply") return `Done! I created ${number} and posted it as a reply to the report.`;
  return `I created ${number}, but I couldn't post in that channel. Check that I have Send Messages there.`;
}

// The issue link beside the report. A channel the bot cannot post in still keeps the issue.
async function postLink(env: Env, source: SourceRef, content: string, threadName: string): Promise<"thread" | "reply" | null> {
  try {
    return await postAt(env, source, content, threadName);
  } catch {
    return null;
  }
}

function submitForm(env: Env, interaction: Interaction, context: Context): Response {
  const source = sourceFromId(interaction.data?.custom_id ?? "");
  const values = readForm(interaction.data?.components ?? []);
  if (!source || !values || !interaction.guild_id) return note("Something was missing from the form. Please run the command again.");
  context.waitUntil(fileIssue(env, interaction, source, values));
  return json({ type: DEFERRED_CHANNEL_MESSAGE, data: { flags: EPHEMERAL } });
}

export default {
  async fetch(request: Request, env: Env, context: Context): Promise<Response> {
    if (request.method !== "POST") return new Response("The Discord issue bot answers Discord interactions only.", { status: 405 });
    if (new URL(request.url).pathname === "/github") return handleGitHub(request, env);
    const body = await request.text();
    const signed = await verifyDiscordRequest(env.DISCORD_PUBLIC_KEY, request.headers.get("x-signature-ed25519"), request.headers.get("x-signature-timestamp"), body);
    if (!signed) return new Response("Bad request signature.", { status: 401 });
    const interaction = JSON.parse(body) as Interaction;
    if (interaction.type === PING) return json({ type: PONG });
    if (interaction.type === APPLICATION_COMMAND) return openForm(env, interaction);
    if (interaction.type === MODAL_SUBMIT) return submitForm(env, interaction, context);
    return new Response("Unknown interaction type.", { status: 400 });
  },
};
