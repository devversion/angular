import ts from 'typescript';

export function traverseAccess(
  access: ts.Identifier,
): ts.Identifier | ts.PropertyAccessExpression | ts.ElementAccessExpression {
  if (ts.isPropertyAccessExpression(access.parent)) {
    return access.parent;
  } else if (ts.isElementAccessExpression(access.parent)) {
    return access.parent;
  }
  return access;
}
