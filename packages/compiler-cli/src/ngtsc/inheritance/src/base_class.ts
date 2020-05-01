/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Reference} from '../../imports';
import {PartialEvaluator} from '../../partial_evaluator';
import {ClassDeclaration, ReflectionHost} from '../../reflection';

export function readBaseClass(
    node: ClassDeclaration, reflector: ReflectionHost,
    evaluator: PartialEvaluator): Reference<ClassDeclaration>|'dynamic'|null {
  const baseExpression = reflector.getBaseClassExpression(node);
  if (baseExpression !== null) {
    const baseClass = evaluator.evaluate(baseExpression);
    if (baseClass instanceof Reference && reflector.isClass(baseClass.node)) {
      return baseClass as Reference<ClassDeclaration>;
    } else {
      return 'dynamic';
    }
  }

  return null;
}
