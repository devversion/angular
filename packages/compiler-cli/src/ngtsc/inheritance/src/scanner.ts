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

import {readBaseClass} from './base_class';

/** Enum that describes types of possible declarations in Angular. */
export enum DeclarationType {
  Directive,
  Component,
  Pipe,
  Injectable
}

/** Type that groups a class declaration and its Angular declaration type. */
type NgDeclaration = {
  type: DeclarationType,
  node: ClassDeclaration
};

/**
 * Declaration inheritance scanner that can be consumed to check inheritance
 * of Angular declarations while producing diagnostics as needed.
 *
 * Inheritance cannot be checked in individual decorator handlers as base
 * classes could be depended on multiple times, and we don't want to produce
 * duplicate diagnostics. The inheritance scanner checks for the following
 * unsupported patterns and produces diagnostics when consumed via `getDiagnostics`:
 *
 *   1. Error when a declaration inherits a constructor from an undecorated base class.
 *   2. Error when a non-component declaration inherits from an component declaration.
 *   3. Error when an injectable inherits inherits from a directive, component
 *      or pipe declaration.
 *   4. Error when a declaration inherits from another declaration, but intermediary
 *      classes are not decorated. As per mental model, classes which inherit Angular
 *      behavior, should also be decorated.
 */
export class DeclarationInheritanceScanner {
  private diagnostics: ts.Diagnostic[] = [];
  private undecoratedBaseClasses = new Map<ClassDeclaration, NgDeclaration>();
  private declarations = new WeakMap<ClassDeclaration, NgDeclaration>();

  constructor(
      private injectableClassRegistry: InjectableClassRegistry,
      private metadataReader: MetadataReader, private reflector: ReflectionHost,
      private evaluator: PartialEvaluator) {}

  /**
   * Checks the inheritance of the given class declaration. If the class
   * relies on unsupported inheritance patterns, diagnostics will be produced.
   */
  checkInheritance(node: ClassDeclaration) {
    const decl = this._findDeclarationOfClass(node);

    // Do nothing if the specified class declaration does not
    // resolve to any known Angular declaration.
    if (decl === null) {
      return;
    }

    const isConstructorInherited = this.reflector.getConstructorParameters(node) === null;

    let inheritanceChain: ClassDeclaration[] = [];
    let foundConstructorBaseClass: ClassDeclaration|null = null;
    let currentClass: ClassDeclaration|null = node;

    while (true) {
      const baseClassRef = readBaseClass(currentClass, this.reflector, this.evaluator);
      // If there is no base class, or it is not statically resolvable, we
      // exit the loop as there cannot be any more base classes we can detect.
      if (baseClassRef === null || baseClassRef === 'dynamic') {
        // If no more base classes could be found and we found a class before that
        // defines the inherited constructor, we create a diagnostic as inheriting
        // a constructor from an undecorated base class is not supported.
        if (foundConstructorBaseClass !== null) {
          this.diagnostics.push(
              getInheritedUndecoratedCtorDiagnostic(decl, foundConstructorBaseClass));
        }
        break;
      }
      const baseClass = baseClassRef.node;
      const baseClassDecl = this._findDeclarationOfClass(baseClass);

      // If the base class has Angular features (i.e. is a known declaration), all
      // intermediary undecorated classes need to be decorated. We do this because
      // we want to enforce a simple mental model where all classes in an Angular
      // inheritance chain are active participants.
      if (baseClassDecl !== null) {
        if (this._checkInheritanceCompatibility(decl, baseClassDecl)) {
          inheritanceChain.forEach(i => this.undecoratedBaseClasses.set(i, baseClassDecl));
        }
        break;
      }

      // If an constructor is inherited, and the current base class defines an explicit
      // constructor, we keep track of that base class. If the scanned class does not inherit
      // from any other classes with Angular features, a diagnostic will be produced for the
      // undecorated base class that defines the inherited constructor. In the other case we
      // don't create a constructor inheritance diagnostic as the class w/ constructor needs
      // to be decorated anyway (due to being intermediary class inheriting Angular features).
      if (isConstructorInherited && foundConstructorBaseClass === null &&
          this._hasConstructor(baseClass)) {
        foundConstructorBaseClass = baseClass;
      }

      // Update the inheritance chain and the current class so that followed
      // base classes are checked in the next iteration.
      inheritanceChain.push(baseClass);
      currentClass = baseClass;
    }
  }

  /**
   * Gets all diagnostics for unsupported inheritance patterns detected
   * in the scanned declarations.
   */
  getDiagnostics(): ts.Diagnostic[] {
    const diagnostics: ts.Diagnostic[] = [...this.diagnostics];
    this.undecoratedBaseClasses.forEach((base, clazz) => {
      diagnostics.push(getUndecoratedClassInheritsAngularFeaturesDiagnostic(clazz, base));
    });
    return diagnostics;
  }

  /**
   * Checks whether it is supported that the given declaration inherits from the
   * specified base declaration.
   */
  private _checkInheritanceCompatibility(decl: NgDeclaration, base: NgDeclaration) {
    // Directives, pipes or injectables cannot inherit from a component.
    if (decl.type !== DeclarationType.Component && base.type === DeclarationType.Component) {
      this.diagnostics.push(
          getIncompatibleComponentBaseClassDiagnostic(decl.node, base.node.name.text));
      return false;
    }

    // Injectables are not allowed to inherit from directives, pipes or components. We
    // will create an error. There aren't any diagnostics for intermediary classes.
    if (decl.type === DeclarationType.Injectable && base.type !== DeclarationType.Injectable) {
      this.diagnostics.push(getIncompatibleBaseClassForInjectableDiagnostic(decl.node, base));
      return false;
    }

    return true;
  }

  /** Checks whether the given class declaration has a constructor. */
  private _hasConstructor(node: ClassDeclaration): boolean {
    return this.reflector.getConstructorParameters(node) !== null;
  }

  /** Gets the Angular declaration of a given class declaration. */
  private _findDeclarationOfClass(node: ClassDeclaration): NgDeclaration|null {
    if (this.declarations.has(node)) {
      return this.declarations.get(node)!;
    }

    let decl: NgDeclaration|null = null;

    const reference = new Reference(node);
    const directiveMetadata = this.metadataReader.getDirectiveMetadata(reference);

    if (directiveMetadata !== null) {
      decl = {
        node,
        type: directiveMetadata.isComponent ? DeclarationType.Component : DeclarationType.Directive,
      };
    } else if (this.metadataReader.getPipeMetadata(reference) !== null) {
      decl = {node, type: DeclarationType.Pipe};
    } else if (this.injectableClassRegistry.isInjectable(node)) {
      decl = {node, type: DeclarationType.Injectable};
    }

    if (decl !== null) {
      this.declarations.set(node, decl);
    }
    return decl;
  }
}

function getIncompatibleComponentBaseClassDiagnostic(
    node: ClassDeclaration, inheritedFromName: string) {
  return makeDiagnostic(
      ErrorCode.INCOMPATIBLE_COMPONENT_BASE_CLASS, node.name,
      `Class ${node.name.text} inherits from ${inheritedFromName}. Classes using ` +
          `@Directive, @Pipe or @Injectable cannot inherit from components.`);
}

function getIncompatibleBaseClassForInjectableDiagnostic(
    node: ClassDeclaration, base: NgDeclaration): ts.Diagnostic {
  return makeDiagnostic(
      ErrorCode.INCOMPATIBLE_BASE_CLASS_FOR_INJECTABLE, node.name,
      `Class ${node.name.text} inherits from ${base.node.name.text}. Classes using ` +
          `@Injectable cannot inherit from directives, components or pipes.`);
}

function getUndecoratedClassInheritsAngularFeaturesDiagnostic(
    node: ClassDeclaration, base: NgDeclaration): ts.Diagnostic {
  return makeDiagnostic(
      ErrorCode.UNDECORATED_CLASS_INHERITING_ANGULAR_FEATURES, node.name,
      `Class ${node.name.text} uses Angular features as it extends from ${base.node.name.text}. ` +
          `Classes which inherit Angular features from other classes need to be decorated. ` +
          `Add a @${DeclarationType[base.type]} decorator.`);
}

function getInheritedUndecoratedCtorDiagnostic(decl: NgDeclaration, baseClass: ClassDeclaration) {
  const typeName = DeclarationType[decl.type];
  // If the constructor is inherited in an @Injectable class, we do not want to propose
  // adding `@Directive` to the base class as injectable's cannot access the node injector.
  const proposedType = decl.type === DeclarationType.Injectable ? DeclarationType.Injectable :
                                                                  DeclarationType.Directive;
  const proposedTypeName = DeclarationType[proposedType];
  const baseClassName = baseClass.name.text;

  return makeDiagnostic(
      ErrorCode.DECLARATION_INHERITS_UNDECORATED_CTOR, decl.node.name,
      `The ${typeName.toLowerCase()} ${decl.node.name.text} inherits its constructor from ` +
          `${baseClassName}, but the latter does not have an Angular decorator of its own. ` +
          `Dependency injection will not be able to resolve the parameters of ${baseClassName}'s ` +
          `constructor. Either add a @${proposedTypeName} decorator to ${baseClassName}, or add ` +
          `an explicit constructor to ${decl.node.name.text}.`);
}
