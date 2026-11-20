// The form a moderator checks before the issue is made, and the issue itself. The three kinds are the issue templates'
// labels (.github/ISSUE_TEMPLATE): bug, rules and accessibility.
import { github, GitHubError, type Env } from "./env.ts";
import { sourceMarker, TEXT_MAX, type Report, type SourceRef } from "./source.ts";

export const KINDS = [
  { value: "bug", label: "App bug", description: "A crash, a layout glitch, or anything that isn't about the rules" },
  { value: "rules", label: "Rules or card bug", description: "A card, keyword or rule doesn't work the way it's printed" },
  { value: "accessibility", label: "Accessibility barrier", description: "Something a player can't see, read, hear, reach or use" },
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
    title: "Report a bug on GitHub",
    components: [
      { type: LABEL, label: "Issue title", component: { type: TEXT_INPUT, custom_id: "title", style: 1, min_length: 3, max_length: 256, required: true, value: report.title } },
      {
        type: LABEL,
        label: "What kind of problem is it?",
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
        label: "Details",
        description: "Edit this as you like. Screenshots and a link back to Discord are added for you.",
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

/** The issue text: the moderator's edit of the report, its attachments, where it came from, and the marker that issue updates follow. */
export function issueBody(values: FormValues, report: Report | null, filedBy: string, source: SourceRef): string {
  const files = report?.attachments ?? [];
  const attachments = files.length
    ? ["", "### Attachments", "", ...files.map((file) => `- [${file.name}](${file.url})`), "", "_Discord attachment links expire after about a day. Drag a screenshot into a comment here to keep it._"]
    : [];
  const from = report ? `Reported by **${report.author}** on [Discord](${report.link})` : "Reported on Discord";
  return [values.body, ...attachments, "", "---", `${from} · filed by **${filedBy}**`, sourceMarker(source)].join("\n");
}

/** Creates the issue and returns its number and page. */
export async function createIssue(env: Env, values: FormValues, body: string): Promise<{ number: number; url: string }> {
  const issue = await github<{ number: number; html_url: string }>(env, "POST", `/repos/${env.GITHUB_REPO}/issues`, { title: values.title, body, labels: [values.kind] });
  if (!issue) throw new GitHubError(404, `no repository ${env.GITHUB_REPO}, or the token cannot see it`);
  return { number: issue.number, url: issue.html_url };
}

/** Why the issue could not be made, in a line for the moderator. The full error goes to the Worker log. */
export function failureReason(error: unknown): string {
  if (!(error instanceof GitHubError)) return "something went wrong on my side. The Worker log has the details.";
  if (error.status === 401) return "the GitHub token has expired or is wrong.";
  if (error.status === 403) return "the GitHub token isn't allowed to create issues in this repository.";
  if (error.status === 404) return "I couldn't find the repository, or the GitHub token can't see it.";
  if (error.status === 422) return "GitHub didn't accept the title or a label. Check that the bug, rules and accessibility labels exist.";
  return `GitHub answered with an error (${error.status}). The Worker log has the details.`;
}
