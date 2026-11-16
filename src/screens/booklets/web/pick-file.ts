// "Add booklet" on the web: the browser's own file picker through an <input type="file">. It must be opened from the tap that asked for it.

/** The picked PDF, or null when the player closed the picker. */
export function pickPdfFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,.pdf";
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
}
