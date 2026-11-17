// The browser's own file picker, through an <input type="file">, for the web and the desktop: "Add booklet" and "Restore from a backup". It must be opened from the
// tap that asked for it.

/** The picked file, or null when the player closed the picker. `accept` limits what the picker offers (`application/pdf,.pdf`); without it every file is offered. */
export function pickFile(accept?: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    if (accept) input.accept = accept;
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
}
