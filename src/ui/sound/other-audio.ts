// The web, the desktop and the tests have no other-audio module: a page cannot hear or stop another app's audio, so their music never
// waits for it and nothing is stopped (src/ui/sound/music.ts, session.ts). The phone reads other-audio.native.ts.
export function otherAudioPlaying(): boolean {
  return false;
}

export function stopOtherAudio(): void {}

export function allowOtherAudio(): void {}
