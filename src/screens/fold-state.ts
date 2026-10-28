// The fold state of the screens' sections (phase 28b): a map from a section's id to whether it is folded, kept per viewer in
// user.db `settings` under the key "sections". A section with no entry follows its default (everything open except the
// archived lists). Pure; the store is section-store.ts.
export type Sections = Readonly<Record<string, boolean>>;

/** The stored value as a map; anything that is not a map of booleans reads as no entries. */
export function parseSections(value: unknown): Sections {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"));
}

export function isFolded(sections: Sections, id: string, defaultFolded: boolean): boolean {
  return sections[id] ?? defaultFolded;
}

/** The map with one section set. A section set back to its default is dropped, so the row holds only what the viewer changed. */
export function withFolded(sections: Sections, id: string, folded: boolean, defaultFolded: boolean): Sections {
  const { [id]: _was, ...rest } = sections;
  return folded === defaultFolded ? rest : { ...rest, [id]: folded };
}

/** What a folded header says about its count to a screen reader and in words ("3 hidden"). */
export function foldWords(title: string, folded: boolean, count: number | string | null): string {
  return `${title}${count == null ? "" : `, ${count}`}${folded ? ", folded" : ""}`;
}
