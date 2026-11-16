// The shared settings rows on the web and the desktop (setting-rows.tsx is the phone's, unchanged; metro.config.js serves this file in its place on the web platform
// only). It draws the phone's rows and then the group the Settings tab provides through ExtraSettingsRows (backup and restore), after the last group of whichever column holds it.
import { useContext } from "react";

import { ExtraSettingsRows } from "../../ui/web/extra-settings-rows.ts";
import { SettingsRows as PhoneSettingsRows } from "./setting-rows";

export { ChoiceRow, SettingChoice, SettingGroup, type SettingGroupId } from "./setting-rows";

type Props = Parameters<typeof PhoneSettingsRows>[0];

export function SettingsRows(props: Props) {
  const extra = useContext(ExtraSettingsRows);
  const last = props.groups === undefined || props.groups.includes("table");
  return (
    <>
      <PhoneSettingsRows {...props} />
      {last ? extra : null}
    </>
  );
}
