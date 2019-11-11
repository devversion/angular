/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {ProviderLiteral, ProvidersEvaluator} from '@angular/compiler-cli/ngcc/src/migrations/missing_injectable_providers_evaluator';
import * as ts from 'typescript';

import {Reference} from '../../../src/ngtsc/imports';
import {ResolvedValue} from '../../../src/ngtsc/partial_evaluator';
import {ClassDeclaration, Decorator} from '../../../src/ngtsc/reflection';

import {Migration, MigrationHost} from './migration';
import {createInjectableDecorator, isClassDeclaration} from './utils';


/**
 * Ensures that classes that are provided as an Angular service in either `NgModule.providers` or
 * `Directive.providers`/`Component.viewProviders` are decorated with one of the `@Injectable`,
 * `@Directive`, `@Component` or `@Pipe` decorators, adding an `@Injectable()` decorator when none
 * are present.
 *
 * At least one decorator is now mandatory, as otherwise the compiler would not compile an
 * injectable definition for the service. This is unlike View Engine, where having just an unrelated
 * decorator may have been sufficient for the service to become injectable.
 *
 * In essence, this migration operates on classes that are themselves an NgModule, Directive or
 * Component. Their metadata is statically evaluated so that their "providers"/"viewProviders"
 * properties can be analyzed. For any provider that refers to an undecorated class, the class will
 * be migrated to have an `@Injectable()` decorator.
 *
 * This implementation mirrors the "missing-injectable" schematic.
 */
export class MissingInjectableMigration implements Migration {
  apply(clazz: ClassDeclaration, host: MigrationHost): ts.Diagnostic|null {
    const evaluator = new ProvidersEvaluator(host.reflectionHost, host.typeChecker);
    const decorators = host.reflectionHost.getDecoratorsOfDeclaration(clazz);
    if (decorators === null) {
      return null;
    }

    for (const decorator of decorators) {
      const name = getAngularCoreDecoratorName(decorator);
      if (name === 'NgModule') {
        migrateNgModuleProviders(decorator, host, evaluator);
      } else if (name === 'Directive') {
        migrateDirectiveProviders(decorator, host, evaluator, /* isComponent */ false);
      } else if (name === 'Component') {
        migrateDirectiveProviders(decorator, host, evaluator, /* isComponent */ true);
      }
    }

    return null;
  }
}

/**
 * Iterates through all `NgModule.providers` and adds the `@Injectable()` decorator to any provider
 * that is not otherwise decorated.
 */
function migrateNgModuleProviders(
    decorator: Decorator, host: MigrationHost, evaluator: ProvidersEvaluator): void {
  if (decorator.args === null || decorator.args.length !== 1) {
    return;
  }

  const metadata = decorator.args[0];
  if (!metadata || !ts.isObjectLiteralExpression(metadata)) {
    return;
  }

  const providersNode = metadata.properties.filter(ts.isPropertyAssignment)
                            .find(p => getPropertyNameText(p.name) === 'providers');

  if (providersNode !== undefined) {
    const {literals, resolvedValue} = evaluator.evaluate(providersNode.initializer);
    migrateLiteralProviders(literals, host);
    migrateProviders(resolvedValue, host);
  }
}

/**
 * Gets the text of the given property name. Returns null if the property
 * name couldn't be determined statically.
 */
export function getPropertyNameText(node: ts.PropertyName): string|null {
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) {
    return node.text;
  }
  return null;
}

/**
 * Iterates through all `Directive.providers` and if `isComponent` is set to true also
 * `Component.viewProviders` and adds the `@Injectable()` decorator to any provider that is not
 * otherwise decorated.
 */
function migrateDirectiveProviders(
    decorator: Decorator, host: MigrationHost, evaluator: ProvidersEvaluator,
    isComponent: boolean): void {
  if (decorator.args === null || decorator.args.length !== 1) {
    return;
  }

  const metadata = decorator.args[0];
  if (!metadata || !ts.isObjectLiteralExpression(metadata)) {
    return;
  }

  const providersNode = metadata.properties.filter(ts.isPropertyAssignment)
                            .find(p => getPropertyNameText(p.name) === 'providers');


  const viewProvidersNode = metadata.properties.filter(ts.isPropertyAssignment)
                                .find(p => getPropertyNameText(p.name) === 'viewProviders');

  if (providersNode !== undefined) {
    const {literals, resolvedValue} = evaluator.evaluate(providersNode.initializer);
    migrateLiteralProviders(literals, host);
    migrateProviders(resolvedValue, host);
  }

  if (isComponent && viewProvidersNode !== undefined) {
    const {literals, resolvedValue} = evaluator.evaluate(viewProvidersNode.initializer);
    migrateLiteralProviders(literals, host);
    migrateProviders(resolvedValue, host);
  }
}

/**
 * Analyzes a single provider entry and determines the class that is required to have an
 * `@Injectable()` decorator.
 */
function migrateProviders(value: ResolvedValue, host: MigrationHost): void {
  if (value instanceof Reference) {
    migrateProviderReference(value, host);
  } else if (value instanceof Map) {
    // {provide: ..., useClass: SomeClass, deps: [...]} does not require a decorator on SomeClass,
    // as the provider itself configures 'deps'. Only if 'deps' is missing will this require a
    // factory to exist on SomeClass.
    if (value.has('provide') && value.has('useClass') && value.get('deps') == null) {
      migrateProviders(value.get('useClass') !, host);
    }
  } else if (Array.isArray(value)) {
    for (const v of value) {
      migrateProviders(v, host);
    }
  }
}

/**
 * Migrates object literal providers which do neither use useValue, useClass,
 * useExisting or useFactory. These providers behave differently in Ivy. e.g.
 *
 * ```ts
 *   {provide: X} -> {provide: X, useValue: undefined} // this is how it behaves in VE
 *   {provide: X} -> {provide: X, useClass: X} // this is how it behaves in Ivy
 * ```
 *
 * To ensure forward compatibility, we migrate these empty object literal providers
 * to explicitly use `useValue: undefined`.
 */
function migrateLiteralProviders(literals: ProviderLiteral[], host: MigrationHost) {
  const printer = ts.createPrinter();

  for (let {node, resolvedValue} of literals) {
    // todo: dedupe

    if (!resolvedValue || !(resolvedValue instanceof Map) || !resolvedValue.has('provide') ||
        resolvedValue.has('useClass') || resolvedValue.has('useValue') ||
        resolvedValue.has('useExisting') || resolvedValue.has('useFactory')) {
      continue;
    }

    const sourceFile = node.getSourceFile();
    const newObjectLiteral = ts.updateObjectLiteral(
        node, node.properties.concat(
                  ts.createPropertyAssignment('useValue', ts.createIdentifier('undefined'))));

    host.addTransform(
        sourceFile, (output => {
          output.remove(node.getStart(), node.getEnd());
          output.appendRight(
              node.getStart(),
              printer.printNode(ts.EmitHint.Unspecified, newObjectLiteral, sourceFile))
        }));
  }
}

/**
 * Given a provider class, adds the `@Injectable()` decorator if no other relevant Angular decorator
 * is present on the class.
 */
function migrateProviderReference(reference: Reference, host: MigrationHost): void {
  const clazz = reference.node as ts.Declaration;
  if (isClassDeclaration(clazz) && host.isInScope(clazz) && needsInjectableDecorator(clazz, host)) {
    host.injectSyntheticDecorator(clazz, createInjectableDecorator(clazz));
  }
}

const NO_MIGRATE_DECORATORS = new Set(['Injectable', 'Directive', 'Component', 'Pipe']);

/**
 * Determines if the given class needs to be decorated with `@Injectable()` based on whether it
 * already has an Angular decorator applied.
 */
function needsInjectableDecorator(clazz: ClassDeclaration, host: MigrationHost): boolean {
  const decorators = host.getAllDecorators(clazz);
  if (decorators === null) {
    return true;
  }

  for (const decorator of decorators) {
    const name = getAngularCoreDecoratorName(decorator);
    if (name !== null && NO_MIGRATE_DECORATORS.has(name)) {
      return false;
    }
  }

  return true;
}

/**
 * Determines the original name of a decorator if it is from '@angular/core'. For other decorators,
 * null is returned.
 */
export function getAngularCoreDecoratorName(decorator: Decorator): string|null {
  if (decorator.import === null || decorator.import.from !== '@angular/core') {
    return null;
  }

  return decorator.import.name;
}
