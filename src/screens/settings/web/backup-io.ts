// The browser's two halves of a backup: the file the player saves and the file the player picks. Both are made only from a tap that asked for them.

/** Give the bytes to the browser as a download named `name`; the object URL is revoked once the click has been handled. */
export function downloadBytes(bytes: Uint8Array, name: string): void {
  const url = URL.createObjectURL(new Blob([bytes.slice()], { type: "application/octet-stream" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The picked backup, or null when the player closed the picker (the same input trick as the booklet picker, src/screens/booklets/web/pick-file.ts). */
export function pickBackupFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
}
