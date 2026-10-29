// Letters only, without accents: "Nibin-Dûm" and "Nibin-DÛm", "Gandalf's" and "Gandalfs" read the same.
export function lettersOf(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}
