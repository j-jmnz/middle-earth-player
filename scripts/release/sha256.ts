import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

/** The SHA-256 of a file, hex, streamed (an installer is up to gigabytes). Node hashes, so no runner needs sha256sum or shasum. */
export async function fileSha256(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}
