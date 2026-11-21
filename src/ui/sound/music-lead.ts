// How much of the music before a loop's start its file holds, in seconds: the player crossfades one copy's last this-many seconds into
// the next copy's lead, so the repeat has no seam (src/ui/sound/music.ts). scripts/build/pack-music.ts cuts the files to it.
export const MUSIC_LEAD_SECONDS = 1.5;
