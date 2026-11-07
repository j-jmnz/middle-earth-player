// The URL a screen or the download queue may fetch a card's picture from (docs/brief.md, Card images). The web build bundles no
// pictures, so it shows each card's remote file; the phone's rule is in remote.native.ts.
import { cardImageUrl } from "./policy";

export const REMOTE_PICTURES = true;

export function remotePictureUrl(imagesrc: string): string | null {
  return cardImageUrl(imagesrc);
}
