/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as ts from 'typescript';

import {ErrorCode, makeDiagnostic} from '../../diagnostics';
import {Reference} from '../../imports';
import {InjectableClassRegistry, MetadataReader} from '../../metadata';
import {PartialEvaluator} from '../../partial_evaluator';
import {ClassDeclaration, ReflectionHost} from '../../reflection';
import {LocalModuleScopeRegistry} from '../../scope';

import {makeDuplicateDeclarationError} from './util';

/**
 * Gets the diagnostics for a set of provider classes.
 * @param providerClasses Classes that should be checked.
 * @param providersDeclaration Node that declares the providers array.
 * @param registry Registry that keeps track of the registered injectable classes.
 */
export function getProviderDiagnostics(
    providerClasses: Set<Reference<ClassDeclaration>>, providersDeclaration: ts.Expression,
    registry: InjectableClassRegistry): ts.Diagnostic[] {
  const diagnostics: ts.Diagnostic[] = [];

  for (const provider of providerClasses) {
    if (registry.isInjectable(provider.node)) {
      continue;
    }

    const contextNode = provider.getOriginForDiagnostics(providersDeclaration);
    diagnostics.push(makeDiagnostic(
        ErrorCode.UNDECORATED_PROVIDER, contextNode,
        `The class '${
            provider.node.name
                .text}' cannot be created via dependency injection, as it does not have an Angular decorator. This will result in an error at runtime.

Either add the @Injectable() decorator to '${
            provider.node.name
                .text}', or configure a different provider (such as a provider with 'useFactory').
`,
        [{node: provider.node, messageText: `'${provider.node.name.text}' is declared here.`}]));
  }

  return diagnostics;
}

export function getDirectiveDiagnostics(
    node: ClassDeclaration, scopeRegistry: LocalModuleScopeRegistry, kind: string): ts.Diagnostic[]|
    null {
  const diagnostics: ts.Diagnostic[]|null = [];

  const duplicateDeclarations = scopeRegistry.getDuplicateDeclarations(node);
  if (duplicateDeclarations !== null) {
    diagnostics.push(makeDuplicateDeclarationError(node, duplicateDeclarations, kind));
  }

  return diagnostics;
}

export function getUndecoratedClassWithAngularFeaturesDiagnostic(node: ClassDeclaration):
    ts.Diagnostic {
  return makeDiagnostic(
      ErrorCode.UNDECORATED_CLASS_USING_ANGULAR_FEATURES, node,
      `Class is using Angular features but is not decorated. Please add an explicit ` +
          `@Directive decorator.`);
}
