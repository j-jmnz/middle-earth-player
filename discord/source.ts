// Where a report comes from: one message (the message command) or a thread (the /issue command), read through the
// Discord REST API as the bot. Reading message text this way needs the Message Content intent (docs/discord-issues.md,
// Create the Discord application).
import { discord, type Env } from "./env.ts";

/** The source of a report, as it travels in the form's custom id between the command and the submit. */
export type SourceRef = { kind: "message"; channelId: string; messageId: string } | { kind: "thread"; threadId: string; replies: boolean };

interface User {
  id: string;
  username: string;
  global_name?: string | null;
}

export interface Message {
  id: string;
  channel_id: string;
  type: number;
  content: string;
  author: User;
  mentions?: User[];
  attachments?: { filename: string; url: string }[];
  message_reference?: { message_id?: string; channel_id?: string };
}

export interface Report {
  /** A title to start the form with. */
  title: string;
  /** The report's text, as Markdown, to start the form with. */
  text: string;
  /** The display name of the player who wrote the report. */
  author: string;
  /** A link to the report on Discord. */
  link: string;
  attachments: { name: string; url: string }[];
}

// A thread made from a channel message opens with a message of this type that points at the original.
const THREAD_STARTER = 21;
// A text input in a form holds at most this many characters.
export const TEXT_MAX = 4000;
// The most replies a thread report reads.
const REPLIES_MAX = 50;

export function nameOf(user: User): string {
  return user.global_name || user.username;
}

/** Discord's markup for mentions and custom emoji, made readable outside Discord. */
export function plainText(message: Message): string {
  const names = new Map((message.mentions ?? []).map((user) => [user.id, nameOf(user)]));
  return message.content
    .replace(/<@!?(\d+)>/g, (_, id: string) => `@${names.get(id) ?? "user"}`)
    .replace(/<#\d+>/g, "#channel")
    .replace(/<@&\d+>/g, "@role")
    .replace(/<a?:(\w+):\d+>/g, ":$1:")
    .trim();
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** The report's first line, short enough for a title. */
function titleFrom(text: string, fallback: string): string {
  const first = text.split("\n").find((line) => line.trim() !== "")?.replace(/[*_`#>~]/g, "").trim() ?? "";
  return clip(first || fallback, 100);
}

function linkTo(guildId: string, channelId: string, messageId?: string): string {
  return `https://discord.com/channels/${guildId}/${channelId}${messageId ? `/${messageId}` : ""}`;
}

function attachmentsOf(messages: Message[]): Report["attachments"] {
  return messages.flatMap((message) => (message.attachments ?? []).map((file) => ({ name: file.filename, url: file.url })));
}

async function messageReport(env: Env, guildId: string, channelId: string, messageId: string): Promise<Report | null> {
  const message = await discord<Message>(env, "GET", `/channels/${channelId}/messages/${messageId}`);
  if (!message) return null;
  const text = plainText(message);
  return {
    title: titleFrom(text, `Bug report from ${nameOf(message.author)}`),
    text: clip(text, TEXT_MAX),
    author: nameOf(message.author),
    link: linkTo(guildId, channelId, messageId),
    attachments: attachmentsOf([message]),
  };
}

// A thread's messages, oldest first. Snowflakes grow with time, so they sort by length and then as text.
async function threadMessages(env: Env, threadId: string): Promise<Message[]> {
  const messages = (await discord<Message[]>(env, "GET", `/channels/${threadId}/messages?after=0&limit=${REPLIES_MAX + 1}`)) ?? [];
  return [...messages].sort((a, b) => a.id.length - b.id.length || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

async function threadReport(env: Env, guildId: string, threadId: string, replies: boolean): Promise<Report | null> {
  const thread = await discord<{ name: string }>(env, "GET", `/channels/${threadId}`);
  if (!thread) return null;
  const messages = await threadMessages(env, threadId);
  const [first, ...rest] = messages;
  let starter: Message | null = first ?? null;
  // A thread made from a channel message: the report is that message, in the parent channel.
  const original = starter?.type === THREAD_STARTER ? starter.message_reference : undefined;
  if (original?.channel_id && original.message_id) {
    starter = await discord<Message>(env, "GET", `/channels/${original.channel_id}/messages/${original.message_id}`);
  }
  if (!starter) return null;
  const read = replies ? [starter, ...rest] : [starter];
  const parts = [plainText(starter), ...(replies ? rest.map((reply) => `> **${nameOf(reply.author)}:** ${plainText(reply).replace(/\n/g, "\n> ")}`) : [])];
  return {
    title: clip(thread.name, 100),
    text: clip(parts.filter(Boolean).join("\n\n"), TEXT_MAX),
    author: nameOf(starter.author),
    link: linkTo(guildId, threadId),
    attachments: attachmentsOf(read),
  };
}

/** Reads the report a source names, or null when the message or thread is gone or the bot cannot see it. */
export function loadReport(env: Env, guildId: string, source: SourceRef): Promise<Report | null> {
  return source.kind === "message" ? messageReport(env, guildId, source.channelId, source.messageId) : threadReport(env, guildId, source.threadId, source.replies);
}

/** The source as a form custom id (at most 100 characters: three snowflakes fit). */
export function sourceToId(source: SourceRef): string {
  return source.kind === "message" ? `issue:m:${source.channelId}:${source.messageId}` : `issue:t:${source.threadId}:${source.replies ? 1 : 0}`;
}

export function sourceFromId(customId: string): SourceRef | null {
  const message = /^issue:m:(\d+):(\d+)$/.exec(customId);
  if (message) return { kind: "message", channelId: message[1]!, messageId: message[2]! };
  const thread = /^issue:t:(\d+):([01])$/.exec(customId);
  if (thread) return { kind: "thread", threadId: thread[1]!, replies: thread[2] === "1" };
  return null;
}

// The issue body keeps its Discord source in a comment GitHub does not show, so an issue event can find where to post.
const MARKER = /<!-- discord (issue:[mt]:\d+:\d+) -->/;

/** The comment the issue body carries for its source. */
export function sourceMarker(source: SourceRef): string {
  return `<!-- discord ${sourceToId(source)} -->`;
}

/**
 * The issue body with its marker retired, once the release that ships the fix is posted: the bot follows the issue no
 * further, so a later comment or reopen does not post in a thread whose report is done.
 */
export function retiredBody(body: string): string {
  return body.replace(/<!-- discord (issue:)/, "<!-- discord released $1");
}

/** The source an issue body names, or null for an issue the bot did not make or no longer follows. */
export function sourceInBody(body: string | null | undefined): SourceRef | null {
  const found = body ? MARKER.exec(body) : null;
  return found ? sourceFromId(found[1]!) : null;
}

// A week: the longest a thread stays open with no message before Discord archives it. A post opens it again.
const THREAD_ARCHIVE_MINUTES = 10080;

// Channel types of a thread: announcement, public and private.
const THREAD_TYPES = new Set([10, 11, 12]);

// The thread on a report message: the one already there (a thread started on a message has the message's id), or a new
// one named `threadName`. The message id is only as good as the form or the marker it came from, so a channel found
// under it counts only when it is a thread of the report's own channel: any other channel is never posted in. Null when there can be none: the message is itself in a thread or a forum post, or the bot
// may not create threads in the channel (Create Public Threads).
async function threadOn(env: Env, channelId: string, messageId: string, threadName: string): Promise<string | null> {
  try {
    const found = await discord<{ type?: number; parent_id?: string | null }>(env, "GET", `/channels/${messageId}`);
    if (found) return found.type !== undefined && THREAD_TYPES.has(found.type) && found.parent_id === channelId ? messageId : null;
    const thread = await discord<{ id: string }>(env, "POST", `/channels/${channelId}/messages/${messageId}/threads`, {
      name: clip(threadName, 100),
      auto_archive_duration: THREAD_ARCHIVE_MINUTES,
    });
    return thread?.id ?? null;
  } catch {
    return null;
  }
}

// Discord's message flag that hides the preview cards of the links in a message.
const SUPPRESS_EMBEDS = 1 << 2;

/**
 * Posts where the report is: in the thread on the report message (started as `threadName` when there is none), else
 * as a reply to the message; for a thread report, in the thread. Mentions never ping, and links show no preview card.
 */
export async function postAt(env: Env, source: SourceRef, content: string, threadName: string): Promise<"thread" | "reply"> {
  const message = { content, flags: SUPPRESS_EMBEDS, allowed_mentions: { parse: [] } };
  if (source.kind === "thread") {
    await discord(env, "POST", `/channels/${source.threadId}/messages`, message);
    return "thread";
  }
  const thread = await threadOn(env, source.channelId, source.messageId, threadName);
  if (thread) {
    await discord(env, "POST", `/channels/${thread}/messages`, message);
    return "thread";
  }
  await discord(env, "POST", `/channels/${source.channelId}/messages`, { ...message, message_reference: { message_id: source.messageId, fail_if_not_exists: false } });
  return "reply";
}
