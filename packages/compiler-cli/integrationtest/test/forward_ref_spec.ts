/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import './init';
import {srcPackage} from "./test-output";

const {CUSTOM} = require(`${srcPackage}/custom_token`);
const {CompWithProviders} = require(`${srcPackage}/features`);

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
