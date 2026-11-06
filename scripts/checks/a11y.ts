import ts from "typescript";

// The static screen reader check (docs/design-system.md, Screen reader): which raw React Native elements in a .tsx file lack a role, a name,
// an action for a long press or a label. The test (a11y.test.ts) runs it over src and holds the exceptions.
//
// It reads the JSX, not the types, so it is a heuristic, and these are its limits:
// - A spread attribute (`{...props}`) is trusted to carry what is missing, except that an `onLongPress` needs a spread of `longPressA11y` or
//   `mergeA11yActions` (or an `accessibilityActions` attribute). An `accessibilityActions` expression that can be undefined (a conditional with an
//   undefined or null branch, `a ?? undefined`, `a && b`) counts as missing: the long press then has no action when it is.
// - "Has text" for the name rule means the element's subtree holds literal text or an expression that is not JSX, a function or null. A
//   `{items.map(...)}` of icons counts as text; a tree of views and icons does not.
// - A picture passes when it is labelled, when it or an ancestor is hidden, or when an ancestor carries an `accessibilityLabel` (the labelled
//   control speaks for it). `CardImage` hides itself when it has no label (src/ui/card-image.tsx), so it is checked only for a bad combination.
// - Only the raw elements are checked: a component from src/ui or src/screens/kit (TextButton, ListRow, ...) sets its own role and name.
// - A name imported from @shopify/react-native-skia (Image, Text drawn inside a Canvas) is not a view, so it is skipped; the Canvas is checked.
// - A press that hides itself (`accessible={false}`, a hidden-from-the-reader scrim) needs no role or name.

export type Rule = "press-role" | "press-name" | "long-press-action" | "input-label" | "picture-label";
export type Finding = { rule: Rule; tag: string; line: number; testID: string | null };

const PRESSABLE = new Set(["Pressable", "TouchableOpacity", "TouchableHighlight", "TouchableWithoutFeedback", "Text"]);
const PICTURES = new Set(["Image", "Canvas"]);
const INPUTS = new Set(["TextInput"]);
const HELPERS = /longPressA11y|mergeA11yActions|accessibilityActions/;

type Opening = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

function attributes(node: Opening): { named: Map<string, ts.JsxAttribute>; spreads: ts.JsxSpreadAttribute[] } {
  const named = new Map<string, ts.JsxAttribute>();
  const spreads: ts.JsxSpreadAttribute[] = [];
  for (const attribute of node.attributes.properties) {
    if (ts.isJsxAttribute(attribute)) named.set(attribute.name.getText(), attribute);
    else spreads.push(attribute);
  }
  return { named, spreads };
}

// The literal string an attribute is set to, or null when it is an expression.
function literal(attribute: ts.JsxAttribute | undefined): string | null {
  const init = attribute?.initializer;
  if (!init) return null;
  if (ts.isStringLiteral(init)) return init.text;
  if (ts.isJsxExpression(init) && init.expression && (ts.isStringLiteral(init.expression) || ts.isNoSubstitutionTemplateLiteral(init.expression))) return init.expression.text;
  return null;
}

// Whether an expression can be undefined or null: a literal one, a conditional with such a branch, `a && b`, or `a ?? b` / `a || b` ending in one.
function canBeUndefined(expression: ts.Expression): boolean {
  if (ts.isParenthesizedExpression(expression)) return canBeUndefined(expression.expression);
  if (ts.isIdentifier(expression)) return expression.text === "undefined";
  if (expression.kind === ts.SyntaxKind.NullKeyword) return true;
  if (ts.isConditionalExpression(expression)) return canBeUndefined(expression.whenTrue) || canBeUndefined(expression.whenFalse);
  if (ts.isBinaryExpression(expression)) {
    const op = expression.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return true;
    if (op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.BarBarToken) return canBeUndefined(expression.right);
  }
  return false;
}

// Whether the element sets `accessibilityActions` to something that is always there.
function hasActions(named: Map<string, ts.JsxAttribute>): boolean {
  const attribute = named.get("accessibilityActions");
  if (!attribute) return false;
  const init = attribute.initializer;
  return !(init && ts.isJsxExpression(init) && init.expression && canBeUndefined(init.expression));
}

// `accessible={false}`, a bare `accessibilityElementsHidden` or `={true}`, or importantForAccessibility "no" / "no-hide-descendants".
function hides(named: Map<string, ts.JsxAttribute>): boolean {
  const accessible = named.get("accessible");
  if (accessible?.initializer && ts.isJsxExpression(accessible.initializer) && accessible.initializer.expression?.kind === ts.SyntaxKind.FalseKeyword) return true;
  const elements = named.get("accessibilityElementsHidden");
  if (elements) {
    const init = elements.initializer;
    if (!init) return true;
    if (ts.isJsxExpression(init) && init.expression?.kind !== ts.SyntaxKind.FalseKeyword) return true;
  }
  const important = literal(named.get("importantForAccessibility"));
  return important === "no" || important === "no-hide-descendants";
}

function openingOf(node: ts.Node): Opening | null {
  if (ts.isJsxSelfClosingElement(node)) return node;
  if (ts.isJsxElement(node)) return node.openingElement;
  return null;
}

// Whether an ancestor hides the element or is a labelled control that speaks for it.
function coveredByAncestor(node: ts.Node): boolean {
  for (let up = node.parent; up; up = up.parent) {
    const opening = openingOf(up);
    if (!opening) continue;
    const { named } = attributes(opening);
    if (hides(named) || named.has("accessibilityLabel")) return true;
  }
  return false;
}

// Whether an expression child shows text: a JSX element is read for its own text, null and a bare `false` show none, a function is read for what
// it returns (a Pressable's render prop), a conditional or logical expression for its branches; anything else (a name, a call, a template) is text.
function expressionText(expression: ts.Expression): boolean {
  if (ts.isJsxElement(expression) || ts.isJsxSelfClosingElement(expression) || ts.isJsxFragment(expression)) return containsText(expression);
  if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) return ts.isBlock(expression.body) ? containsText(expression.body) : expressionText(expression.body);
  if (ts.isParenthesizedExpression(expression)) return expressionText(expression.expression);
  if (ts.isConditionalExpression(expression)) return expressionText(expression.whenTrue) || expressionText(expression.whenFalse);
  if (ts.isBinaryExpression(expression)) {
    const op = expression.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return expressionText(expression.right);
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) return expressionText(expression.left) || expressionText(expression.right);
  }
  return expression.kind !== ts.SyntaxKind.NullKeyword && expression.kind !== ts.SyntaxKind.FalseKeyword && expression.kind !== ts.SyntaxKind.TrueKeyword;
}

// Whether a subtree holds text. Attributes are not read: only children are.
function containsText(node: ts.Node): boolean {
  let found = false;
  ts.forEachChild(node, (child) => {
    if (found || ts.isJsxAttributes(child)) return;
    if (ts.isJsxText(child)) found = child.text.trim() !== "";
    else if (ts.isJsxExpression(child)) found = child.expression != null && expressionText(child.expression);
    else found = containsText(child);
  });
  return found;
}

function textChildren(node: ts.Node): boolean {
  return ts.isJsxElement(node) && containsText(node);
}

// The names a file imports from Skia: they draw into a Canvas and are not views a screen reader reaches.
function skiaNames(tree: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const statement of tree.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== "@shopify/react-native-skia") continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements) names.add(element.name.text);
  }
  names.delete("Canvas");
  return names;
}

/** The findings in one source text. */
export function a11yFindings(text: string, file = "x.tsx"): Finding[] {
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: Finding[] = [];
  const add = (rule: Rule, node: Opening, tag: string, named: Map<string, ts.JsxAttribute>): void => {
    found.push({ rule, tag, line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1, testID: literal(named.get("testID")) });
  };
  const skia = skiaNames(tree);
  const visit = (node: ts.Node): void => {
    const opening = openingOf(node);
    if (opening && !skia.has(opening.tagName.getText(tree))) {
      const tag = opening.tagName.getText(tree);
      const { named, spreads } = attributes(opening);
      const spreadsHelper = spreads.some((spread) => HELPERS.test(spread.expression.getText(tree)));
      if (PRESSABLE.has(tag)) {
        const seen = !hides(named);
        if (seen && named.has("onPress") && !named.has("accessibilityRole") && spreads.length === 0) add("press-role", opening, tag, named);
        if (seen && named.has("onPress") && !named.has("accessibilityLabel") && spreads.length === 0 && !textChildren(node)) add("press-name", opening, tag, named);
        if (named.has("onLongPress") && !hasActions(named) && !spreadsHelper) add("long-press-action", opening, tag, named);
      }
      if (INPUTS.has(tag) && !named.has("accessibilityLabel") && spreads.length === 0) add("input-label", opening, tag, named);
      if (PICTURES.has(tag) && !named.has("accessibilityLabel") && !hides(named) && spreads.length === 0 && !coveredByAncestor(node)) add("picture-label", opening, tag, named);
      if (tag === "CardImage" && named.has("accessibilityLabel") && hides(named)) add("picture-label", opening, tag, named);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return found;
}
