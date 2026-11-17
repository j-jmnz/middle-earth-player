// The app:// handler: serves the web export from disk with the headers of serve.ts. desktop/main.ts registers the scheme (before ready) and installs this once the app is ready.
import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";

import { protocol } from "electron";

import { APP_HOST, APP_SCHEME } from "./identity.ts";
import { answerFor, parseRange, responseHeaders } from "./serve.ts";

/** The scheme's privileges: a standard, secure origin (crypto.subtle and OPFS need a secure context), with fetch and streamed bodies. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([{ scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
}

function plain(status: number, text: string): Response {
  return new Response(text, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

/** Answers every app:// request from the export in `root`; any other host of the scheme is refused. */
export function serveApp(root: string): void {
  protocol.handle(APP_SCHEME, (request) => {
    const url = new URL(request.url);
    if (url.hostname !== APP_HOST) return plain(404, "Not found");
    let pathname: string;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return plain(400, "Bad request");
    }
    const { file, status } = answerFor(root, pathname);
    const size = statSync(file).size;
    const range = parseRange(request.headers.get("range"), size);
    const headers = responseHeaders(file, range ? range.end - range.start + 1 : size);
    if (range) headers["content-range"] = `bytes ${range.start}-${range.end}/${size}`;
    // A HEAD request opens no stream: nothing would read it and the file handle would stay open.
    const body = request.method === "HEAD" ? null : (Readable.toWeb(createReadStream(file, range ?? undefined)) as ReadableStream);
    return new Response(body, { status: range ? 206 : status, headers });
  });
}
