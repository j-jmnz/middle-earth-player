// The images the backdrops draw: each (theme, scene, size) is rendered once (the fog's noise and the grit are the costly part) and every
// Screen that shows it draws the same image, so a push no longer runs them again. Pure: the renderer and the release are handed in
// (backdrop.native.tsx gives Skia's drawAsImage and dispose).
//
// A lease is one screen showing an image. An image is released when it is no longer wanted:
// - it belongs to another group than the one last asked for (the theme or the size changed), as soon as no screen shows it;
// - or it is idle (no screen shows it) and more than `idleKept` newer images are idle too.
// A render that finishes after its entry was dropped releases its image at once.

export type ImageCache<I> = {
  /**
   * Shows the image of `key` (rendered if it is not): `image` settles to it, or null when it could not be rendered. `group` names
   * what makes an image obsolete when it changes (the theme and the size). Call `release` when the screen stops showing it.
   */
  lease: (key: string, group: string) => { image: Promise<I | null>; release: () => void };
  /** How many images are held (shown, idle or rendering). */
  size: () => number;
};

type Entry<I> = { group: string; users: number; image: Promise<I | null>; held: I | null; dropped: boolean; idleAt: number };

export function createImageCache<I>(render: (key: string) => Promise<I | null>, dispose: (image: I) => void, idleKept: number): ImageCache<I> {
  const entries = new Map<string, Entry<I>>();
  let current = "";
  let tick = 0;

  const drop = (key: string, entry: Entry<I>) => {
    entries.delete(key);
    entry.dropped = true;
    if (entry.held) dispose(entry.held);
    entry.held = null;
  };
  // The idle images beyond `idleKept`, the longest idle first.
  const trim = () => {
    const idle = [...entries].filter(([, entry]) => entry.users === 0).sort((a, b) => a[1].idleAt - b[1].idleAt);
    for (const [key, entry] of idle.slice(0, Math.max(0, idle.length - idleKept))) drop(key, entry);
  };

  return {
    lease: (key, group) => {
      if (group !== current) {
        current = group;
        for (const [other, entry] of [...entries]) if (entry.group !== group && entry.users === 0) drop(other, entry);
      }
      let entry = entries.get(key);
      if (!entry) {
        const made: Entry<I> = { group, users: 0, image: Promise.resolve(null), held: null, dropped: false, idleAt: 0 };
        made.image = render(key).then(
          (image) => {
            if (made.dropped) {
              if (image) dispose(image);
              return null;
            }
            made.held = image;
            return image;
          },
          () => null,
        );
        entries.set(key, made);
        entry = made;
      }
      const leased = entry;
      leased.users += 1;
      let released = false;
      return {
        image: leased.image,
        release: () => {
          if (released) return;
          released = true;
          leased.users -= 1;
          if (leased.users > 0 || leased.dropped) return;
          tick += 1;
          leased.idleAt = tick;
          if (leased.group !== current) drop(key, leased);
          else trim();
        },
      };
    },
    size: () => entries.size,
  };
}
