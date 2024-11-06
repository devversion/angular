/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import ts from 'typescript';

import {MockAotContext, MockCompilerHost} from '../../../../../test/mocks';
import {isolatedDtsTransform} from '../src';

const TEST_FILE_INPUT = '/test.ts';
const TEST_FILE_OUTPUT = `/test.js`;

describe('isolated dts transform', () => {
  let host: MockCompilerHost;
  let context: MockAotContext;

  beforeEach(() => {
    context = new MockAotContext('/', {});
    host = new MockCompilerHost(context);
  });

  function transform(contents: string) {
    context.writeFile(TEST_FILE_INPUT, contents);

    const program = ts.createProgram(
      [TEST_FILE_INPUT],
      {
        module: ts.ModuleKind.ESNext,
        lib: ['dom', 'es2022'],
        target: ts.ScriptTarget.ES2022,
        noResolve: true,
        isolatedDeclarations: true,
        experimentalDecorators: true,
      },
      host,
    );

    const testFile = program.getSourceFile(TEST_FILE_INPUT);
    const transformers: ts.CustomTransformers = {
      before: [isolatedDtsTransform(program, {})],
    };

    let output: string | null = null;
    const emitResult = program.emit(
      testFile,
      (fileName, outputText) => {
        if (fileName === TEST_FILE_OUTPUT) {
          output = outputText;
        }
      },
      undefined,
      undefined,
      transformers,
    );

    expect(emitResult.diagnostics.length).toBe(0);
    expect(output).not.toBeNull();

    return omitLeadingWhitespace(output!);
  }

  describe('@NgModule', () => {
    it('should should work', () => {
      const result = transform(`
      import {NgModule} from '@angular/core';
      import {A, B} from './comp';

      @NgModule({
        declarations: [A, B, ...x],
      })
      class MyMod {}
    `);

      expect(result).toBe('dd');
    });
  });
});

/** Omits the leading whitespace for each line of the given text. */
function omitLeadingWhitespace(text: string): string {
  return text.replace(/^\s+/gm, '');
}
