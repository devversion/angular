/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';

import {absoluteFrom, AbsoluteFsPath, getFileSystem} from '../../../src/ngtsc/file_system';
import {runInEachFileSystem, TestFile} from '../../../src/ngtsc/file_system/testing';
import {loadFakeCore, loadTestFiles} from '../../../test/helpers';
import {DecorationAnalyzer} from '../../src/analysis/decoration_analyzer';
import {NgccReferencesRegistry} from '../../src/analysis/ngcc_references_registry';
import {Esm2015ReflectionHost} from '../../src/host/esm2015_host';
import {MockLogger} from '../helpers/mock_logger';
import {getRootFiles, makeTestEntryPointBundle} from '../helpers/utils';

runInEachFileSystem(() => {
  describe('all migrations integration', () => {
    let _: typeof absoluteFrom;
    let INDEX_FILENAME: AbsoluteFsPath;
    beforeEach(() => {
      _ = absoluteFrom;
      INDEX_FILENAME = _('/node_modules//test-package/index.js');
    });

    it('undecorated parent migration should not conflict with undecorated class with ' +
           'decorated fields migration',
       () => {
         const {program, analysis, errors} = setUpAndAnalyzeProgram([{
           name: INDEX_FILENAME,
           contents: `
          import {Directive} from '@angular/core';
        
          export class MyComponent {
            ngOnInit() {}
          }
          
          export class MyComp extends MyComponent {}
          
          MyComp.decorators = [
            { type: Directive, args: [{ selector: '[dir]' }] }
          ];`
         }]);

         expect(errors).toEqual([]);
         const file = analysis.get(program.getSourceFile(INDEX_FILENAME)!)!;
         const clazz = file.compiledClasses.find(c => c.name === 'MyComponent');

         expect(clazz).toBeDefined();
         expect(clazz!.decorators).not.toBeNull();
         expect(clazz!.decorators!.length).toBe(1, 'Expected only a single synthetic decorator.');

         const decorator = clazz!.decorators![0]!;
         expect(decorator.name).toBe('Directive');
         expect(decorator.args!.length).toBe(0, 'Expected an abstract directive.');
       });

    it('undecorated child migration should not conflict with undecorated class with ' +
           'decorated fields migration',
       () => {
         const baseFilePath = _('/node_modules//test-package/base.js');
         const {program, analysis, errors} = setUpAndAnalyzeProgram([
           {
             name: INDEX_FILENAME,
             contents: `
          import {NgModule} from '@angular/core';
          import {MyComp} from './base';
        
          export class DerivedComp extends MyComp {
            ngOnInit() {}
          }
          
          export class TestModule {}
          TestModule.decorators = [
            {type: NgModule, args: [{declarations: [DerivedComp]}],
          ];
          `
           },
           {
             name: baseFilePath,
             contents: `
          import {Directive} from '@angular/core';
          
          export class MyComp {}
          
          MyComp.decorators = [
            { type: Directive, args: [{ selector: '[dir]' }] }
          ];`
           }
         ]);

         expect(errors).toEqual([]);
         const file = analysis.get(program.getSourceFile(INDEX_FILENAME)!)!;
         const clazz = file.compiledClasses.find(c => c.name === 'DerivedComp');

         expect(clazz).toBeDefined();
         expect(clazz!.decorators).not.toBeNull();
         expect(clazz!.decorators!.length).toBe(1);

         const decorator = clazz!.decorators![0]!;
         expect(decorator.name).toBe('Directive');
         // This would be an abstract directive (i.e. no selector) if the undecorated
         // classes with decorated fields migration would migrate first.
         expect(decorator.args!.length).toBe(1, 'Expected a non-abstract directive.');
         expect(decorator.args![0].getText()).toBe(`{ selector: "[dir]" }`);
       });
  });

  function setUpAndAnalyzeProgram(testFiles: TestFile[]) {
    loadTestFiles(testFiles);
    loadFakeCore(getFileSystem());
    const errors: ts.Diagnostic[] = [];
    const rootFiles = getRootFiles(testFiles);
    const bundle = makeTestEntryPointBundle('test-package', 'esm2015', false, rootFiles);
    const program = bundle.src.program;

    const reflectionHost = new Esm2015ReflectionHost(new MockLogger(), false, bundle.src);
    const referencesRegistry = new NgccReferencesRegistry(reflectionHost);
    const analyzer = new DecorationAnalyzer(
        getFileSystem(), bundle, reflectionHost, referencesRegistry, error => errors.push(error));
    return {program, analysis: analyzer.analyzeProgram(), errors};
  }
});
