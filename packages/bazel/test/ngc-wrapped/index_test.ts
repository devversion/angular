/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {onlyInIvy} from '@angular/private/testing';
import * as path from 'path';

import {setup} from './test_support';

describe('ngc_wrapped', () => {

  it('should work', () => {
    const {read, write, runOneBuild, writeConfig, shouldExist, basePath, typesRoots} = setup();

    write('some_project/index.ts', `
      import {Component} from '@angular/core';
      import {a} from 'ambient_module';
      console.log('works: ', Component);
    `);

    const typesFile = path.resolve(basePath, typesRoots, 'thing', 'index.d.ts');

    write(typesFile, `
      declare module "ambient_module" {
        declare const a = 1;
      }
    `);

    writeConfig({
      srcTargetPath: 'some_project',
      depPaths: [path.dirname(typesFile)],
    });

    // expect no error
    expect(runOneBuild()).toBe(true);

    shouldExist('bazel-bin/some_project/index.js');

    expect(read('bazel-bin/some_project/index.js'))
        .toContain(`console.log('works: ', core_1.Component);`);
  });

  onlyInIvy('Strict template type checking only available with Ivy')
      .it('should be able to enable strict template type checking in user tsconfig', () => {
        const {write, runOneBuild, writeConfig} = setup();

        write('some_project/index.ts', `
          import {Component, Input, NgModule, Directive} from '@angular/core';
          
          @Directive({selector: 'other-dir'})
          export class OtherDir {
            @Input() disabled: boolean;
          }
          
          @Component({
            template: '<other-dir disabled></other-dir>'
          })
          export class MyComp {}
          
          @NgModule({declarations: [OtherDir, MyComp]})
          export class MyModule {}
        `);

        write(
            'base-config.json', JSON.stringify({angularCompilerOptions: {strictTemplates: true}}));

        writeConfig({
          srcTargetPath: 'some_project',
          depPaths: [],
          extendedTsconfigFilePath: './base-config.json',
          fullTemplateTypeCheck: true
        });

        spyOn(console, 'error').and.callThrough();

        // expect an error for the strict input type checking.
        expect(runOneBuild()).toBe(false);

        expect(console.error)
            .toHaveBeenCalledWith(
                jasmine.stringMatching(/Type 'string' is not assignable to type 'boolean'/))
      });
});
