/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as ts from 'typescript';

import {isAngularDecorator} from '../../../src/ngtsc/annotations/src/util';
import {ClassDeclaration, ClassMemberKind} from '../../../src/ngtsc/reflection';

import {Migration, MigrationHost} from './migration';
import {createDirectiveDecorator, hasDirectiveDecorator} from './utils';

const FIELD_DECORATORS = [
  'Input', 'Output', 'ViewChild', 'ViewChildren', 'ContentChild', 'ContentChildren', 'HostBinding',
  'HostListener'
];

const LIFECYCLE_HOOKS = new Set([
  'ngOnChanges', 'ngOnInit', 'ngOnDestroy', 'ngDoCheck', 'ngAfterViewInit', 'ngAfterViewChecked',
  'ngAfterContentInit', 'ngAfterContentChecked'
]);

/**
 * TODO: fill out
 */
export class UndecoratedClassWithDecoratedFieldsMigration implements Migration {
  apply(clazz: ClassDeclaration, host: MigrationHost): ts.Diagnostic|null {
    if (_isUndecoratedClassWithDecoratedFields(clazz, host)) {
      host.injectSyntheticDecorator(clazz, createDirectiveDecorator(clazz));
    }
    return null;
  }
}

function _isUndecoratedClassWithDecoratedFields(clazz: ClassDeclaration, host: MigrationHost) {
  if (hasDirectiveDecorator(host, clazz)) {
    return false;
  }

  return host.reflectionHost.getMembersOfClass(clazz).some(member => {
    if (!member.isStatic && member.kind === ClassMemberKind.Method &&
        LIFECYCLE_HOOKS.has(member.name)) {
      return true;
    }
    if (member.decorators) {
      return member.decorators.some(
          decorator => FIELD_DECORATORS.some(
              decoratorName => isAngularDecorator(decorator, decoratorName, host.isCore)));
    }
    return false;
  });
}
