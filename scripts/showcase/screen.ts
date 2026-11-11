// What a Maestro hierarchy (`maestro hierarchy`) shows, for the capture's log after a failed flow (capture.ts).

/** The ids and words a hierarchy shows, in screen order, each once: what a log line can say about the screen a flow failed on. */
export function screenWords(tree: unknown): string[] {
  const found: string[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const attributes = (node as { attributes?: Record<string, unknown> }).attributes ?? {};
    const id = attributes["resource-id"];
    const words = attributes["text"] || attributes["accessibilityText"] || attributes["hintText"];
    if (typeof id === "string" && id !== "") found.push(`#${id}`);
    if (typeof words === "string" && words.trim() !== "") found.push(JSON.stringify(words.trim().slice(0, 60)));
    for (const child of (node as { children?: unknown[] }).children ?? []) visit(child);
  };
  visit(tree);
  return [...new Set(found)];
}
