// Shared pieces of the screens (docs/design-system.md, Components). They are views and text: they do not fetch, and they read
// src/play only for icons, surfaces and tokens. Each family lives in its own file; this one is the door every screen imports.
export * from "./chrome-buttons";
export * from "./chrome-frame";
export * from "./chrome-marks";
export * from "./chrome-text";
export * from "./tab-bar";
export { markedSphere, sphereWord, type MarkedSphere } from "./sphere-mark";
