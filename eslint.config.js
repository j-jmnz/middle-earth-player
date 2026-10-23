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

function zones(allowEffects) {
  const effects = allowEffects ? ["./effects"] : [];

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
      except: ["./catalog", "./rules", "./campaign", ...effects],
      message: "src/campaign may import only src/catalog and src/rules.",
    },
    {
      target: "./src/play",
      from: "./src",
      except: ["./rules", "./catalog", "./play", ...effects],
      message: "src/play may import only src/rules and src/catalog from src/.",
    },
    {
      target: "./src/screens",
      from: "./src",
      except: ["./play", "./campaign", "./catalog", "./screens", ...effects],
      message: "src/screens may import only src/play, src/campaign, and src/catalog.",
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
