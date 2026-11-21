// A web-only slot in the Settings tab's rows: the desktop build's Settings view provides a group of its own (src/screens/settings/view.canvaskit.tsx) and the web variant of
// the shared rows draws it after the last group (src/play/chrome/setting-rows.canvaskit.tsx). The phone's files never read it, so its bundle does not carry it.
import { createContext, type ReactNode } from "react";

export const ExtraSettingsRows = createContext<ReactNode>(null);
