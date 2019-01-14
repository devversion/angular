/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import './init';

import {CUSTOM} from 'src/custom_token';
import {CompWithProviders} from 'src/features';

import {createComponent, createModule} from './util';

describe('template codegen output', () => {
  it('should support forwardRef with useValue in components', () => {
    const compFixture = createComponent(CompWithProviders);
    expect((compFixture.componentInstance as any).ctxProp).toBe('strValue');
  });

  it('should support forwardRef with useValue in modules', () => {
    const modRef = createModule();
    expect(modRef.injector.get(CUSTOM).name).toBe('some name');
  });
});
