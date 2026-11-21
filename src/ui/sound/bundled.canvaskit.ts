// The web's and the desktop's sound and music files: the phone's own map (bundled.native.ts), served in place of the empty bundled.ts on the web
// platform (metro.config.js). Metro turns each require.context into the files `pnpm assets sounds` and `pnpm assets music` packed, so a web export
// built with them carries them (the desktop installers; docs/releasing.md), and one built without them plays none.
export { bundledMusic, bundledSounds } from "./bundled.native";
