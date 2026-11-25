// The phone's sample pool for the sound effects (pool-samples.ts): Android's SoundPool, when this build has the module
// (modules/sound-pool). An iPhone has none, and neither does a development client built before the module: there the sounds play
// through expo-audio's players (sound.ts). The tests, the web and the desktop read pool.ts.
import { Asset } from "expo-asset";
import { Platform } from "react-native";
import { soundPool } from "sound-pool";

import { samplePool, type SamplePool } from "./pool-samples.ts";
import { audioFailed } from "./session.ts";

// The bundled sound as a file: a release keeps it as a resource of the app, and a development build serves it from Metro, so
// expo-asset copies it to the cache once.
async function fileOf(source: number): Promise<string | null> {
  const asset = await Asset.fromModule(source).downloadAsync();
  return asset.localUri;
}

const native = Platform.OS === "android" ? soundPool() : null;

export const pool: SamplePool | null = native ? samplePool(native, fileOf, audioFailed) : null;
