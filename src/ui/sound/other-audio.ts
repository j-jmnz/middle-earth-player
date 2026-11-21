// The web, the desktop and the tests have no other-audio module: a page cannot hear another app's audio, so their music never waits for it
// (src/ui/sound/music.ts). The phone reads other-audio.native.ts.
export function otherAudioPlaying(): boolean {
  return false;
}
