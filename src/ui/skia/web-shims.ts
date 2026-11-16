// What the phone's Skia has and CanvasKit's web build lacks, supplied once CanvasKit is loaded so the phone's table files (the `.native.ts(x)`
// files under src/play) run unchanged on the web. Imported by skia-web.ts's loader only, never evaluated on the phone.
import { Skia, type SkTypeface } from "@shopify/react-native-skia";
import { JsiSkImage } from "@shopify/react-native-skia/lib/module/skia/web/JsiSkImage";
import { Asset } from "expo-asset";
import { Image, type ImageResolvedAssetSource } from "react-native";

import { deferDispose } from "./image-free.ts";

// `Image.resolveAssetSource` is what the phone resolves a bundled picture's number with (play/canvas/table-images.native.ts); react-native-web has
// none. A web bundler's `require` of a picture is a number from the asset registry, which expo-asset resolves.
function installAssetSource(): void {
  if (typeof Image.resolveAssetSource === "function") return;
  const resolve = (source: number | ImageResolvedAssetSource): ImageResolvedAssetSource =>
    typeof source === "number" ? { uri: Asset.fromModule(source).uri, width: 0, height: 0, scale: 1 } : source;
  Object.assign(Image, { resolveAssetSource: resolve });
}

// `matchFont` asks the system font manager for a face, which CanvasKit does not implement ("Not implemented on React Native Web"). The answer is
// no face (`undefined`, which `Skia.Font` takes for none): a font with no typeface draws no text, until the table's bundled files load
// (play/canvas/table-fonts.native.ts).
function installSystemFont(): void {
  const none = {
    countFamilies: () => 0,
    getFamilyName: () => "",
    matchFamilyStyle: () => undefined as unknown as SkTypeface,
    dispose: () => undefined,
  };
  Object.assign(Skia.FontMgr, { System: () => none });
}

// The burn's runtime shader needs `Skia.RuntimeShaderBuilder`, which CanvasKit lacks, so its SkSL compiles to nothing here: the spotlight
// then fades and drops the target (play/spotlight/burn.native.tsx). The burn is the only runtime effect the app compiles (src/ui/skia/web-shims.test.ts
// pins that), and every one of them is for that image filter, so the web compiles none.
function installBurnFallback(): void {
  Object.assign(Skia.RuntimeEffect, { Make: () => null });
}

function installImageFree(): void {
  const waiting = new WeakSet<object>();
  JsiSkImage.prototype.dispose = function dispose(this: JsiSkImage) {
    deferDispose(setTimeout, this, waiting);
  };
}

/** Installs every shim; run once, after CanvasKit has loaded and before any `.native` Skia file is imported. */
export function installWebShims(): void {
  installAssetSource();
  installSystemFont();
  installBurnFallback();
  installImageFree();
}
