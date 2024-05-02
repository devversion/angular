import ts from 'typescript';
import {TypeScriptReflectionHost} from '../../../../../../compiler-cli/src/ngtsc/reflection';
import {DtsMetadataReader} from '../../../../../../compiler-cli/src/ngtsc/metadata';
import {PartialEvaluator} from '../../../../../../compiler-cli/src/ngtsc/partial_evaluator';
import {ReferenceEmitter} from '../../../../../../compiler-cli/src/ngtsc/imports';
import {MigrationResult} from '../result';
import {ExtractedInput, extractDecoratorInput} from '../input_decorator';
import assert from 'assert';
import {Replacement} from '../replacement';
import {convertToSignalInput} from '../convert_to_signal';
import {InputId, getInputId} from '../utils/input_id';
import {MigrationHost} from '../migration_host';

export type KnownInputs = WeakMap<ts.Node, ExtractedInput & {inputId: InputId}>;

export function pass1__IdentifySourceFileAndDeclarationInputs(
  sf: ts.SourceFile,
  host: MigrationHost,
  reflector: TypeScriptReflectionHost,
  metadataReader: DtsMetadataReader,
  evaluator: PartialEvaluator,
  refEmitter: ReferenceEmitter,
  knownDecoratorInputs: KnownInputs,
  result: MigrationResult,
) {
  const visitor = (node: ts.Node) => {
    const decoratorInput = extractDecoratorInput(
      node,
      reflector,
      metadataReader,
      evaluator,
      refEmitter,
    );
    if (decoratorInput !== null) {
      assert(ts.isPropertyDeclaration(node));
      const inputId = getInputId(host, node);

      // track all inputs, even from declarations for reference resolution.
      knownDecoratorInputs.set(node, {...decoratorInput, inputId});

      // track source file inputs in the result of this target.
      if (decoratorInput.inSourceFile) {
        result.sourceInputs.add(inputId);
        result.addReplacement(
          sf.fileName,
          new Replacement(
            node.getStart(),
            node.getEnd(),
            convertToSignalInput(node, decoratorInput),
          ),
        );
      }
    }

    // remove all imports to `Input`.
    if (
      ts.isImportSpecifier(node) &&
      (node.propertyName ?? node.name).text === 'Input' &&
      ts.isStringLiteral(node.parent.parent.parent.moduleSpecifier) &&
      node.parent.parent.parent.moduleSpecifier.text === '@angular/core'
    ) {
      result.addReplacement(sf.fileName, new Replacement(node.getStart(), node.getEnd(), 'input'));
    }

    ts.forEachChild(node, visitor);
  };
  ts.forEachChild(sf, visitor);
}
