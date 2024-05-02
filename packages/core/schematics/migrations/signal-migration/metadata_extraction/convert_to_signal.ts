import assert from 'assert';
import ts from 'typescript';

import {ExtractedInput} from './input_decorator';

const printer = ts.createPrinter({newLine: ts.NewLineKind.LineFeed});

export function convertToSignalInput(
    node: ts.PropertyDeclaration, metadata: ExtractedInput): string {
  assert(ts.isIdentifier(node.name));

  const initialValue = node.initializer;
  const includeUndefinedInType = node.questionToken !== undefined;
  const canBeRequired = node.exclamationToken !== undefined;

  let optionsLiteral: ts.ObjectLiteralExpression|null = null;
  if (metadata.bindingPropertyName !== metadata.classPropertyName || metadata.transform !== null) {
    const properties: ts.ObjectLiteralElementLike[] = [];
    if (metadata.bindingPropertyName !== metadata.classPropertyName) {
      properties.push(ts.factory.createPropertyAssignment(
          'alias', ts.factory.createStringLiteral(metadata.bindingPropertyName)));
    }
    if (metadata.transform !== null) {
      // TODO: is this a fair assert?? I assume yes!
      assert(ts.isExpression(metadata.transform.node), `${metadata.transform.node.getFullText()}`);
      properties.push(ts.factory.createPropertyAssignment('transform', metadata.transform.node));
    }

    optionsLiteral = ts.factory.createObjectLiteralExpression(properties);
  }

  const inputArgs: ts.Expression[] = [];
  const typeArgs: ts.TypeNode[] = [];

  if (node.type !== undefined) {
    typeArgs.push(node.type);

    if (metadata.transform !== null) {
      typeArgs.push(metadata.transform.type.node);
    }
    // TODO: transform type?
  }

  if (!metadata.required && (initialValue !== undefined || optionsLiteral !== null)) {
    // TODO: undefined shorthand support!
    inputArgs.push(initialValue ?? ts.factory.createIdentifier('undefined'));
  }

  if (optionsLiteral !== null) {
    inputArgs.push(optionsLiteral);
  }

  const inputFnRef = metadata.inputDecoratorRef !== null &&
          ts.isPropertyAccessExpression(metadata.inputDecoratorRef) ?
      ts.factory.createPropertyAccessExpression(metadata.inputDecoratorRef.expression, 'input') :
      ts.factory.createIdentifier('input');
  const inputInitializerFn = metadata.required ?
      ts.factory.createPropertyAccessExpression(inputFnRef, 'required') :
      inputFnRef;
  const inputInitializer = ts.factory.createCallExpression(inputInitializerFn, typeArgs, inputArgs);


  // TODO:
  //   - modifiers (but private does not work)
  //   - custom decorators etc.
  const result = ts.factory.updatePropertyDeclaration(
      node,
      undefined,
      node.name,
      undefined,
      undefined,
      inputInitializer,
  )

  return printer.printNode(ts.EmitHint.Unspecified, result, node.getSourceFile());
}
