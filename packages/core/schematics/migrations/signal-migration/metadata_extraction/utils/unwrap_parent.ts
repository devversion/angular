import ts from 'typescript';

export function unwrapParent(node: ts.Node): ts.Node {
  if (ts.isParenthesizedExpression(node.parent)) {
    return unwrapParent(node.parent);
  } else if (ts.isAsExpression(node.parent)) {
    return unwrapParent(node.parent);
  }
  return node;
}
