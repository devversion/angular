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
import {Migration} from '../../src/migrations/migration';
import {UndecoratedClassWithDecoratedFieldsMigration} from '../../src/migrations/undecorated_class_with_decorated_fields_migration';
import {UndecoratedParentMigration} from '../../src/migrations/undecorated_parent_migration';
import {MockLogger} from '../helpers/mock_logger';
import {getRootFiles, makeTestEntryPointBundle} from '../helpers/utils';

runInEachFileSystem(() => {
  describe('UndecoratedClassWithDecoratedFields migration', () => {
    let _: typeof absoluteFrom;
    let INDEX_FILENAME: AbsoluteFsPath;
    beforeEach(() => {
      _ = absoluteFrom;
      INDEX_FILENAME = _('/node_modules//test-package/index.js');
    });

    it('should migrate undecorated class with @Input', () => {
      const {program, analysis, errors} = setUpAndAnalyzeProgram([{
        name: INDEX_FILENAME,
        contents: `
          import {Input} from '@angular/core';
        
          export class MyComponent {}
        
          MyComponent.propDecorators = {
            disabled: [{type: Input, args: []}],
          };`
      }]);

      expect(errors).toEqual([]);
      const file = analysis.get(program.getSourceFile(INDEX_FILENAME)!)!;
      const clazz = file.compiledClasses.find(c => c.name === 'MyComponent');

      expect(clazz).toBeDefined();
      expect(clazz!.decorators).not.toBeNull();
      expect(clazz!.decorators!.length).toBe(1);
      expect(clazz!.decorators![0].name).toBe('Directive');
    });

    it('should migrate undecorated class with lifecycle hook', () => {
      const {program, analysis, errors} = setUpAndAnalyzeProgram([{
        name: INDEX_FILENAME,
        contents: `       
          export class MyComponent {
            ngAfterViewInit() {
              // noop
            }
          }`
      }]);

      expect(errors).toEqual([]);
      const file = analysis.get(program.getSourceFile(INDEX_FILENAME)!)!;
      const clazz = file.compiledClasses.find(c => c.name === 'MyComponent');

      expect(clazz).toBeDefined();
      expect(clazz!.decorators).not.toBeNull();
      expect(clazz!.decorators!.length).toBe(1);
      expect(clazz!.decorators![0].name).toBe('Directive');
    });

    it('should not migrate undecorated class without Angular features', () => {
      const {program, analysis, errors} = setUpAndAnalyzeProgram([{
        name: INDEX_FILENAME,
        contents: `       
          export class MyComponent {
            someMethod() {}
          }`
      }]);

      expect(errors).toEqual([]);
      expect(analysis.get(program.getSourceFile(INDEX_FILENAME)!)).toBeUndefined();
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
    analyzer.migrations = [new UndecoratedClassWithDecoratedFieldsMigration()];
    return {program, analysis: analyzer.analyzeProgram(), errors};
  }
});
