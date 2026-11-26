// The web backdrop's fog and grit tiles as pictures (src/screens/art/backdrop.tsx; docs/design-system.md, Backdrops). A texture is an SVG whose filter
// (feTurbulence) makes fractal noise. Used as a CSS background itself, the browser runs the filter again for each part of a layer it paints, and a fog layer
// that drifts brings new parts in for as long as it moves: on Safari's engine the filter runs on the page's thread, which held the page for most of each
// second on every screen with fog, for the half minute a layer takes to pass. So each tile is drawn once into a canvas and kept as a PNG the backgrounds
// repeat, which costs a paint nothing. No browser in the store: `Bake` is the page (browserBake), so a test runs the rest.

/** Draws `svg` at `width` × `height` pixels and gives the picture's address; rejects when the page cannot. */
export type Bake = (svg: string, width: number, height: number) => Promise<string>;

export type TileStore = {
  subscribe(listener: () => void): () => void;
  /** The tile as a CSS image, or null while it is made; the first read starts the bake. A tile the page cannot bake is the SVG itself. */
  read(svg: string, width: number, height: number): string | null;
};

const svgUrl = (svg: string): string => `data:image/svg+xml,${encodeURIComponent(svg)}`;

export function tileStore(bake: Bake): TileStore {
  // One entry for each texture at each size, for good: a scene has a few, a few hundred kilobytes each.
  const tiles = new Map<string, string | null>();
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    read(svg, width, height) {
      const key = `${width}x${height} ${svg}`;
      const known = tiles.get(key);
      if (known !== undefined) return known;
      tiles.set(key, null);
      void bake(svg, width, height)
        .catch(() => svgUrl(svg))
        .then((address) => {
          tiles.set(key, `url("${address}")`);
          for (const listener of [...listeners]) listener();
        });
      return null;
    },
  };
}

/** The page as a Bake: the SVG loaded as an image, drawn into a canvas of the tile's size, and kept as a PNG blob. */
export function browserBake(doc: Document): Bake {
  return (svg, width, height) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onerror = () => reject(new Error("the tile's SVG did not load"));
      image.onload = () => {
        try {
          const canvas = doc.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("no 2D canvas");
          context.drawImage(image, 0, 0, width, height);
          canvas.toBlob((blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error("no picture of the tile"))), "image/png");
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      };
      image.src = svgUrl(svg);
    });
}
