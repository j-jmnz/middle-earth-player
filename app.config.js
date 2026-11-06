// The app config is app.json; a release build stamps its version from APP_VERSION, which the release workflow sets from
// the tag (.claude/rules/release-standards.md, Versioning). Without it the build keeps app.json's 0.0.0, a development build.
// Android's versionCode must grow with every release that installs over the last: major, minor and patch each get three
// digits, so 1.2.3 is 1002003 and the largest major that fits Android's limit (2100000000) is 2100.
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function versionCodeOf(version) {
  const match = SEMVER.exec(version);
  if (!match) throw new Error(`APP_VERSION must be <major>.<minor>.<patch>, not "${version}"`);
  const [major, minor, patch] = match.slice(1).map(Number);
  if (minor > 999 || patch > 999) throw new Error(`APP_VERSION ${version}: minor and patch stay under 1000`);
  return major * 1_000_000 + minor * 1_000 + patch;
}

function stamp(config, version) {
  if (!version) return config;
  const versionCode = versionCodeOf(version);
  return {
    ...config,
    version,
    android: { ...config.android, versionCode },
    ios: { ...config.ios, buildNumber: String(versionCode) },
  };
}

module.exports = ({ config }) => stamp(config, process.env.APP_VERSION);
module.exports.stamp = stamp;
module.exports.versionCodeOf = versionCodeOf;
