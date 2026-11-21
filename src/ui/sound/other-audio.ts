// The web, the desktop and the tests have no other-audio module: no other app's audio is ever heard to play, and they play no music yet
// (src/ui/sound/music.ts). The phone reads other-audio.native.ts.
export function otherAudioPlaying(): boolean {
  return false;
}
