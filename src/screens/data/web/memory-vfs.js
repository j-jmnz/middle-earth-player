// The web app's build serves this in place of expo-sqlite's AccessHandlePoolVFS (metro.config.js, when EXPO_PUBLIC_WEBAPP=1). expo-sqlite's worker opens that file
// system when it starts, whatever is asked of it: it takes a sync access handle on each of its files in the origin's private file storage. The web app keeps its
// databases in memory (memory-databases.ts) and never uses those files, and holding them fails a reload on Safari: the page before still holds them for a moment, and
// a second holder is refused with "The object is in an invalid state". So the worker's "persistent" file system is a second memory one, and it touches no storage.
import { MemoryVFS } from "../../../../node_modules/expo-sqlite/web/wa-sqlite/MemoryVFS";

export class AccessHandlePoolVFS {
  static create(name, module) {
    return MemoryVFS.create(name, module);
  }
}
