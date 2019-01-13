/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {NgModuleRef} from '@angular/core';
import {ComponentFixture} from '@angular/core/testing';
import {platformServerTesting} from '@angular/platform-server/testing';
import {srcPackage} from "./test-output";

const {MainModuleNgFactory} = require(`${srcPackage}/module.ngfactory`);

let mainModuleRef: NgModuleRef<any> = null !;
beforeEach((done) => {
  platformServerTesting().bootstrapModuleFactory(MainModuleNgFactory).then((moduleRef: any) => {
    mainModuleRef = moduleRef;
    done();
  });
});

export function createModule(): NgModuleRef<any> {
  return mainModuleRef;
}

export function createComponent<C>(comp: {new (...args: any[]): C}): ComponentFixture<C> {
  const moduleRef = createModule();
  const compRef =
      moduleRef.componentFactoryResolver.resolveComponentFactory(comp).create(moduleRef.injector);
  return new ComponentFixture(compRef, null, false);
}
