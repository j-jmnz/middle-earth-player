const fs = require("node:fs");
const path = require("node:path");

module.exports = function inlineSqlPlugin({ types: t }) {
  return {
    name: "inline-sql",
    visitor: {
      ImportDeclaration(importPath, state) {
        const source = importPath.node.source.value;
        if (typeof source !== "string" || !source.endsWith(".sql")) return;

        const filename = state.file.opts.filename;
        if (typeof filename !== "string" || filename.length === 0) {
          throw new Error(`Cannot inline SQL import ${source} without a filename`);
        }

        const specifier = importPath.node.specifiers[0];
        if (
          importPath.node.specifiers.length !== 1 ||
          !specifier ||
          specifier.type !== "ImportDefaultSpecifier"
        ) {
          throw new Error(`SQL import must be a default import: ${source}`);
        }

        const sqlPath = path.resolve(path.dirname(filename), source);
        const sql = fs.readFileSync(sqlPath, "utf8");
        importPath.replaceWith(
          t.variableDeclaration("const", [
            t.variableDeclarator(t.identifier(specifier.local.name), t.stringLiteral(sql)),
          ]),
        );
      },
    },
  };
};
