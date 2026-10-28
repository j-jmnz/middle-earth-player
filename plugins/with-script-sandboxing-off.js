// Xcode's user script sandboxing lets a build phase write only the outputs it declares. React Native's
// "Bundle React Native code and images" phase writes ip.txt into the app bundle undeclared, so a device build fails
// with "Operation not permitted". Turn the sandbox off for every build configuration of the app project.
const { withXcodeProject } = require("expo/config-plugins");

module.exports = function withScriptSandboxingOff(config) {
  return withXcodeProject(config, (mod) => {
    const configurations = mod.modResults.pbxXCBuildConfigurationSection();
    for (const entry of Object.values(configurations)) {
      if (typeof entry === "object" && entry.buildSettings) entry.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = "NO";
    }
    return mod;
  });
};
