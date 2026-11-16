// electron-builder's `beforeBuild` hook (desktop/electron-builder.yml): returning false tells it the app's node_modules are handled outside it. The app is one esbuild bundle that
// needs only Electron, so nothing is installed, rebuilt or collected; without this, a pnpm workspace makes electron-builder fall back to the repository's own node_modules and pack all
// of them (a gigabyte of installer, and a universal macOS build that fails on the native modules in it).
module.exports = async () => false;
