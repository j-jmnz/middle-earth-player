// The form a moderator checks before the issue is made, and the issue itself. The three kinds are the issue templates'
// labels (.github/ISSUE_TEMPLATE): bug, rules and accessibility.
import type { Env } from "./env.ts";
import { TEXT_MAX, type Report } from "./source.ts";

export const KINDS = [
  { value: "bug", label: "App bug", description: "A crash, a layout problem or anything else that is not a rules question" },
  { value: "rules", label: "Rules or card bug", description: "A card, keyword or rule plays differently from what is printed" },
  { value: "accessibility", label: "Accessibility barrier", description: "Something a player cannot see, read, hear, reach or operate" },
] as const;

export type Kind = (typeof KINDS)[number]["value"];

// Discord component types (https://discord.com/developers/docs/components/reference).
const STRING_SELECT = 3;
const TEXT_INPUT = 4;
const LABEL = 18;

/** The modal the command answers with: a title, a kind and the report's text, each one a field the moderator can change. */
export function issueForm(customId: string, report: Report) {
  return {
    custom_id: customId,
    title: "Create GitHub issue",
    components: [
      { type: LABEL, label: "Title", component: { type: TEXT_INPUT, custom_id: "title", style: 1, min_length: 3, max_length: 256, required: true, value: report.title } },
      {
        type: LABEL,
        label: "Type",
        component: {
          type: STRING_SELECT,
          custom_id: "kind",
          min_values: 1,
          max_values: 1,
          options: KINDS.map((kind, i) => ({ value: kind.value, label: kind.label, description: kind.description, default: i === 0 })),
        },
      },
      {
        type: LABEL,
        label: "Report",
        description: "The issue text. Attachments and a link to Discord are added below it.",
        component: { type: TEXT_INPUT, custom_id: "body", style: 2, max_length: TEXT_MAX, required: true, value: report.text || "(No text)" },
      },
    ],
  };
}

export interface FormValues {
  title: string;
  kind: Kind;
  body: string;
}

type Component = { custom_id?: string; value?: string; values?: string[]; component?: Component; components?: Component[] };

// The submitted fields by custom id, wherever they sit: inside a label, or inside an action row in an older client.
function fieldsOf(components: Component[], into = new Map<string, Component>()): Map<string, Component> {
  for (const component of components) {
    if (component.custom_id) into.set(component.custom_id, component);
    if (component.component) fieldsOf([component.component], into);
    if (component.components) fieldsOf(component.components, into);
  }
  return into;
}

/** The submitted form's values, or null when a field is missing or the kind is not one of ours. */
export function readForm(components: Component[]): FormValues | null {
  const fields = fieldsOf(components);
  const title = fields.get("title")?.value?.trim();
  const body = fields.get("body")?.value?.trim();
  const kind = KINDS.find((known) => known.value === fields.get("kind")?.values?.[0])?.value;
  return title && body && kind ? { title, kind, body } : null;
}

/** The issue text: the moderator's edit of the report, its attachments, and where it came from. */
export function issueBody(values: FormValues, report: Report | null, filedBy: string): string {
  const files = report?.attachments ?? [];
  const attachments = files.length
    ? ["", "### Attachments", "", ...files.map((file) => `- [${file.name}](${file.url})`), "", "_Discord attachment links expire after about a day. Save a screenshot into this issue to keep it._"]
    : [];
  const from = report ? `Reported on Discord by **${report.author}** ([message](${report.link})).` : "Reported on Discord.";
  return [values.body, ...attachments, "", "---", `${from} Filed by **${filedBy}** with the Discord issue bot.`].join("\n");
}

/** Creates the issue and returns its number and page. */
export async function createIssue(env: Env, values: FormValues, body: string): Promise<{ number: number; url: string }> {
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/issues`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "user-agent": "middle-earth-player-discord-issues",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify({ title: values.title, body, labels: [values.kind] }),
  });
  if (!response.ok) throw new Error(`GitHub answered ${response.status}: ${await response.text()}`);
  const issue = (await response.json()) as { number: number; html_url: string };
  return { number: issue.number, url: issue.html_url };
}
