// The URL a screen or the download queue may fetch a card's picture from (docs/brief.md, Card images). A release build fetches none:
// every card's picture is bundled (scripts/build/pack-scans.ts) and a card without one is drawn as its text, so the RingsDB deck import
// is the app's only network request (PRIVACY.md). A development build, which may run without `pnpm scans:pack`, downloads the rest.
import { cardImageUrl } from "./policy";

export const REMOTE_PICTURES = __DEV__;

export function remotePictureUrl(imagesrc: string): string | null {
  return REMOTE_PICTURES ? cardImageUrl(imagesrc) : null;
}
