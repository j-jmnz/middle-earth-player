// The sound effects kept as samples of Android's SoundPool (modules/sound-pool; docs/design-system-table.md, Sound): a slot's file is
// decoded once into memory, and each play starts it with no player, no seek and no wait for the phone's main thread. A sample stays
// loaded: there are no more than the slots (slots.ts), and each is a short sound. pool.native.ts gives it the module and the files.
import type { SoundSlot } from "./slots.ts";

/** What the samples need of the native module (modules/sound-pool, SoundPoolModule). */
export type SampleModule = { load(uri: string): number; play(sample: number, volume: number): void };

export type SamplePool = {
  /** Loads the slot's file when it is not loaded or loading. It plays nothing. */
  prime(slot: SoundSlot, source: number): void;
  /** Plays the slot's sound at a volume from 0 to 1, loading it first when it must. */
  play(slot: SoundSlot, source: number, volume: number): void;
};

// A play asked for before its file is found is played once it is, this soon after; later, the sound's moment has gone. The module
// holds the same wait for a sample that still decodes.
const LATE_MS = 700;

// `sample`: the module's id, 0 while the file is being found. `wanted`: the play asked for meanwhile.
type Entry = { sample: number; wanted: { at: number; volume: number } | null };

/**
 * The samples over one native module. `fileOf` finds the local file of a bundled sound (null: there is none); `failed` takes an
 * error the player never sees. A slot whose file or load failed is forgotten, so its next play asks again.
 */
export function samplePool(native: SampleModule, fileOf: (source: number) => Promise<string | null>, failed: (error: unknown) => void): SamplePool {
  const entries = new Map<SoundSlot, Entry>();

  function entryOf(slot: SoundSlot, source: number): Entry {
    const known = entries.get(slot);
    if (known) return known;
    const entry: Entry = { sample: 0, wanted: null };
    entries.set(slot, entry);
    fileOf(source)
      .then((uri) => {
        const sample = uri == null ? 0 : native.load(uri);
        if (sample === 0) {
          entries.delete(slot);
          return;
        }
        entry.sample = sample;
        const { wanted } = entry;
        entry.wanted = null;
        if (wanted && Date.now() - wanted.at <= LATE_MS) native.play(sample, wanted.volume);
      })
      .catch((error: unknown) => {
        entries.delete(slot);
        failed(error);
      });
    return entry;
  }

  return {
    prime(slot, source) {
      entryOf(slot, source);
    },
    play(slot, source, volume) {
      const entry = entryOf(slot, source);
      if (entry.sample > 0) native.play(entry.sample, volume);
      else entry.wanted = { at: Date.now(), volume };
    },
  };
}
