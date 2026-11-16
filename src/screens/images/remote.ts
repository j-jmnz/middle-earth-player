// The URL a screen or the download queue may fetch a card's picture from (docs/brief.md, Card images). The browser dev build bundles no
// pictures, so it shows each card's remote file; the desktop build bundles every picture and fetches none (a card without one is drawn
// as its text), like a phone's release build, whose rule is in remote.native.ts.
import { desktopBuild } from "../nav/desktop";
import { cardImageUrl } from "./policy";

export const REMOTE_PICTURES = !desktopBuild();

export function remotePictureUrl(imagesrc: string): string | null {
  return REMOTE_PICTURES ? cardImageUrl(imagesrc) : null;
}
