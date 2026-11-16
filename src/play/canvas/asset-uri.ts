// The address a picture's source decodes from. The phone resolves a bundled picture's number through the image registry; the web has no
// `Image.resolveAssetSource`, and its bundler's `require` gives a number from the asset registry or an object with the `uri`, which expo-asset resolves.
import { Asset } from "expo-asset";
import { Image as RNImage, Platform } from "react-native";

import type { PictureSource } from "./table-canvas-types.ts";

export function assetUri(source: PictureSource): string | null {
  if (typeof source !== "number") return source.uri;
  if (Platform.OS === "web") return Asset.fromModule(source).uri;
  return RNImage.resolveAssetSource(source)?.uri ?? null;
}
