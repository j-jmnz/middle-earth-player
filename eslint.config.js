const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const importX = require("eslint-plugin-import-x");

const packageMessage =
  "src/rules and src/campaign cannot import react-native or expo.";

// no-restricted-imports only visits static import and export nodes.
const bannedSourceMatchers = [
  "='react-native'",
  "=/^react-native\\//",
  "='expo'",
  "=/^expo\\//",
  "=/^expo-/",
];

function bannedSyntax(node, attribute) {
  return bannedSourceMatchers.map((source) => ({
    selector: `${node}[${attribute}${source}]`,
    message: packageMessage,
  }));
}

const packageBan = {
  "no-restricted-imports": [
    "error",
    {
      paths: [
        { name: "react-native", message: packageMessage },
        { name: "expo", message: packageMessage },
      ],
      patterns: [
        {
          group: ["react-native/*", "expo-*", "expo/*"],
          message: packageMessage,
        },
      ],
    },
  ],
  "no-restricted-syntax": [
    "error",
    ...bannedSyntax("ImportExpression", "source.value"),
    ...bannedSyntax(
      "CallExpression[callee.name='require']",
      "arguments.0.value",
    ),
  ],
};

// src/campaign, src/play and src/screens import src/effects directly. src/rules receives effects as an argument,
// so only tests and scripts (allowEffects) may reach into it from there.
function zones(allowEffects) {
  const effects = allowEffects ? ["./effects"] : [];
  const app = ["./effects"];

  return [
    {
      target: "./src/rules",
      from: "./src",
      except: ["./catalog", "./rules", ...effects],
      message: "src/rules may import only src/catalog.",
    },
    {
      target: "./src/campaign",
      from: "./src",
      except: ["./catalog", "./rules", "./campaign", ...app],
      message: "src/campaign may import only src/catalog, src/rules and src/effects.",
    },
    {
      target: "./src/play",
      from: "./src",
      except: ["./rules", "./catalog", "./play", ...app],
      message: "src/play may import only src/rules, src/catalog and src/effects from src/.",
    },
    {
      target: "./src/screens",
      from: "./src",
      except: ["./play", "./campaign", "./catalog", "./screens", ...app],
      message: "src/screens may import only src/play, src/campaign, src/catalog and src/effects.",
    },
    {
      target: "./src/effects",
      from: "./src",
      except: ["./catalog", "./effects"],
      message: "src/effects may import only src/catalog.",
    },
    {
      target: "./src/catalog",
      from: "./src",
      except: allowEffects ? ["./catalog", "./effects"] : ["./catalog"],
      message: "src/catalog may not import other modules under src/.",
    },
  ];
}

const importSettings = {
  "import-x/resolver": {
    typescript: {
      alwaysTryTypes: true,
      project: "./tsconfig.json",
    },
    node: true,
  },
};

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/**", "ios/**", "android/**", ".expo/**", "web-build/**"],
  },
  {
    plugins: {
      "import-x": importX,
    },
    settings: importSettings,
    rules: {
      "import-x/no-restricted-paths": [
        "error",
        { zones: zones(false) },
      ],
    },
  },
  {
    files: [
      "src/rules/**/*.{js,jsx,mjs,cjs,ts,tsx}",
      "src/campaign/**/*.{js,jsx,mjs,cjs,ts,tsx}",
    ],
    rules: packageBan,
  },
  {
    files: [
      "scripts/**/*.{js,jsx,ts,tsx,mjs,cjs}",
      "**/*.{test,spec}.ts",
      "**/*.{test,spec}.tsx",
    ],
    plugins: {
      "import-x": importX,
    },
    settings: importSettings,
    rules: {
      "import-x/no-restricted-paths": [
        "error",
        { zones: zones(true) },
      ],
    },
  },
]);
