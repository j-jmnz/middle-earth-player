// The browser's half of a backup: the file the player saves, made only from a tap that asked for it (the file the player picks is src/ui/web/pick-file.ts).

/** Give the bytes to the browser as a download named `name`; the object URL is revoked once the click has been handled. */
export function downloadBytes(bytes: Uint8Array, name: string): void {
  const url = URL.createObjectURL(new Blob([bytes.slice()], { type: "application/octet-stream" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
