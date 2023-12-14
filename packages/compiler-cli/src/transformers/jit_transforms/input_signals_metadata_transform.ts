/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {core} from '@angular/compiler';
import ts from 'typescript';

import {isAngularDecorator, tryParseSignalInputMapping} from '../../ngtsc/annotations';
import {PartialEvaluator} from '../../ngtsc/partial_evaluator';
import {ReflectionHost} from '../../ngtsc/reflection';
import {addImports} from '../../ngtsc/transform';
import {ImportManager} from '../../ngtsc/translator';

const decoratorsWithInputs = ['Directive', 'Component'];

const coreModuleName = '@angular/core';

export function getInputSignalsMetadataTransform(
    host: ReflectionHost,
    evaluator: PartialEvaluator,
    isCore: boolean,
    ): ts.TransformerFactory<ts.SourceFile> {
  return (ctx) => {
    return (sourceFile) => {
      const importManager = new ImportManager(undefined, undefined, ctx.factory);

      sourceFile = ts.visitNode<ts.SourceFile, ts.Node>(
                       sourceFile,
                       createTransformVisitor(ctx, host, evaluator, importManager, isCore),
                       ) as ts.SourceFile;

      const newImports = importManager.getAllImports(sourceFile.fileName);
      if (newImports.length > 0) {
        sourceFile = addImports(ctx.factory, importManager, sourceFile);
      }

      return sourceFile;
    };
  };
}

function createTransformVisitor(
    ctx: ts.TransformationContext,
    host: ReflectionHost,
    evaluator: PartialEvaluator,
    importManager: ImportManager,
    isCore: boolean,
    ): ts.Visitor<ts.Node, ts.Node> {
  const visitor: ts.Visitor<ts.Node, ts.Node> = (node: ts.Node): ts.Node => {
    if (ts.isClassDeclaration(node) && node.name !== undefined &&
        needsClassTransform(host, node, isCore)) {
      return visitClassDeclaration(ctx, host, evaluator, importManager, node, isCore);
    }

    return ts.visitEachChild(node, visitor, ctx);
  };
  return visitor;
}

function needsClassTransform(
    host: ReflectionHost,
    clazz: ts.ClassDeclaration,
    isCore: boolean,
    ): boolean {
  return !!host.getDecoratorsOfDeclaration(clazz)?.some(
      (d) => decoratorsWithInputs.some((name) => isAngularDecorator(d, name, isCore)));
}

function visitClassDeclaration(
    ctx: ts.TransformationContext,
    host: ReflectionHost,
    evaluator: PartialEvaluator,
    importManager: ImportManager,
    clazz: ts.ClassDeclaration,
    isCore: boolean,
    ): ts.ClassDeclaration {
  let members = clazz.members.map((member) => {
    if (!ts.isPropertyDeclaration(member)) {
      return member;
    }
    if (!ts.isIdentifier(member.name) && !ts.isStringLiteralLike(member.name)) {
      return member;
    }

    const inputMapping = tryParseSignalInputMapping(
        {name: member.name.text, value: member.initializer ?? null},
        host,
        evaluator,
        isCore ? coreModuleName : undefined,
    );
    if (inputMapping === null) {
      return member;
    }

    const fields: {[f in keyof core.Input]: ts.Expression} = {
      'ɵisSignal': ctx.factory.createTrue(),
      'alias': ctx.factory.createStringLiteral(inputMapping.bindingPropertyName),
      'required': inputMapping.required ? ctx.factory.createTrue() : ctx.factory.createFalse(),
      // Transforms are never captured for signal inputs.
      'transform': ctx.factory.createIdentifier('undefined'),
    };

    return ctx.factory.updatePropertyDeclaration(
        member,
        [
          ctx.factory.createDecorator(
              ctx.factory.createCallExpression(
                  ctx.factory.createPropertyAccessExpression(
                      importManager.generateNamespaceImport(coreModuleName),
                      'Input',
                      ),
                  undefined,
                  [ctx.factory.createObjectLiteralExpression(Object.entries(fields).map(
                      ([name, value]) => ctx.factory.createPropertyAssignment(name, value)))]),
              ),
        ],
        member.name,
        member.questionToken,
        member.type,
        member.initializer,
    );
  });

  return ctx.factory.updateClassDeclaration(
      clazz,
      clazz.modifiers,
      clazz.name,
      clazz.typeParameters,
      clazz.heritageClauses,
      members,
  );
}
