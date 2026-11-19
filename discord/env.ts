// The Worker's bindings: the four secrets set with `wrangler secret put` and the repository named in wrangler.toml
// (docs/discord-issues.md, Deploy the Worker).
export interface Env {
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APPLICATION_ID: string;
  DISCORD_BOT_TOKEN: string;
  GITHUB_TOKEN: string;
  /** `owner/name` of the repository the issues go to. */
  GITHUB_REPO: string;
}

/** The part of the Worker's execution context the bot uses: work that goes on after the response is sent. */
export interface Context {
  waitUntil(promise: Promise<unknown>): void;
}

const DISCORD_API = "https://discord.com/api/v10";

/** A Discord REST call as the bot. Returns the parsed JSON, or null on a 404. */
export async function discord<T>(env: Env, method: string, route: string, body?: unknown): Promise<T | null> {
  const response = await fetch(`${DISCORD_API}${route}`, {
    method,
    headers: { authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Discord ${method} ${route} answered ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : ((await response.json()) as T);
}

/** Edits the reply the bot deferred for an interaction. Interaction webhooks take the interaction's token, not the bot's. */
export async function editReply(env: Env, interactionToken: string, content: string): Promise<void> {
  const response = await fetch(`${DISCORD_API}/webhooks/${env.DISCORD_APPLICATION_ID}/${interactionToken}/messages/@original`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
  });
  if (!response.ok) throw new Error(`Discord edit of the reply answered ${response.status}: ${await response.text()}`);
}
