import assert from 'assert';
import ts from 'typescript';

import {getAngularDecorators} from '../../../../../compiler-cli/src/ngtsc/annotations';
import {parseDecoratorInputTransformFunction} from '../../../../../compiler-cli/src/ngtsc/annotations/directive';
import {FatalDiagnosticError} from '../../../../../compiler-cli/src/ngtsc/diagnostics';
import {Reference, ReferenceEmitter} from '../../../../../compiler-cli/src/ngtsc/imports';
import {
  DecoratorInputTransform,
  DtsMetadataReader,
  InputMapping,
} from '../../../../../compiler-cli/src/ngtsc/metadata';
import {
  DynamicValue,
  PartialEvaluator,
} from '../../../../../compiler-cli/src/ngtsc/partial_evaluator';
import {
  ClassDeclaration,
  DecoratorIdentifier,
  ReflectionHost,
} from '../../../../../compiler-cli/src/ngtsc/reflection';
import {CompilationMode} from '../../../../../compiler-cli/src/ngtsc/transform';

export interface ExtractedInput extends InputMapping {
  inSourceFile: boolean;
  inputDecoratorRef: DecoratorIdentifier | null;
}

export function extractDecoratorInput(
  node: ts.Node,
  host: ReflectionHost,
  metadataReader: DtsMetadataReader,
  evaluator: PartialEvaluator,
  refEmitter: ReferenceEmitter,
): ExtractedInput | null {
  return (
    extractSourceCodeInput(node, host, evaluator, refEmitter) ??
    extractDtsInput(node, metadataReader)
  );
}

function extractDtsInput(node: ts.Node, metadataReader: DtsMetadataReader): ExtractedInput | null {
  if (
    !ts.isPropertyDeclaration(node) ||
    !ts.isIdentifier(node.name) ||
    !node.getSourceFile().isDeclarationFile
  ) {
    return null;
  }
  if (
    !ts.isClassDeclaration(node.parent) ||
    node.parent.name === undefined ||
    !ts.isIdentifier(node.parent.name)
  ) {
    return null;
  }

  const directiveMetadata = metadataReader.getDirectiveMetadata(
    new Reference(node.parent as ClassDeclaration),
  );
  const inputMapping = directiveMetadata?.inputs.getByClassPropertyName(node.name.text);

  return inputMapping == null
    ? null
    : {
        ...inputMapping,
        inputDecoratorRef: null,
        inSourceFile: false,
      };
}

// TODO: Support `@Directive#inputs`
function extractSourceCodeInput(
  node: ts.Node,
  host: ReflectionHost,
  evaluator: PartialEvaluator,
  refEmitter: ReferenceEmitter,
): ExtractedInput | null {
  if (
    !ts.isPropertyDeclaration(node) ||
    !ts.isIdentifier(node.name) ||
    node.getSourceFile().isDeclarationFile
  ) {
    return null;
  }
  const decorators = host.getDecoratorsOfDeclaration(node);
  if (decorators === null) {
    return null;
  }
  const ngDecorators = getAngularDecorators(decorators, ['Input'], /* isCore */ true);
  if (ngDecorators.length === 0) {
    return null;
  }
  const inputDecorator = ngDecorators[0];

  let publicName = node.name.text;
  let isRequired = false;
  let transformResult: DecoratorInputTransform | null = null;

  if (inputDecorator.args?.length === 1) {
    const evaluatedInputOpts = evaluator.evaluate(inputDecorator.args[0]);
    if (typeof evaluatedInputOpts === 'string') {
      publicName = evaluatedInputOpts;
    } else if (evaluatedInputOpts instanceof Map) {
      if (evaluatedInputOpts.has('alias') && typeof evaluatedInputOpts.get('alias') === 'string') {
        publicName = evaluatedInputOpts.get('alias')! as string;
      }
      if (
        evaluatedInputOpts.has('required') &&
        typeof evaluatedInputOpts.get('required') === 'boolean'
      ) {
        isRequired = !!evaluatedInputOpts.get('required');
      }
      if (evaluatedInputOpts.has('transform') && evaluatedInputOpts.get('transform') != null) {
        const transformValue = evaluatedInputOpts.get('transform');
        if (transformValue instanceof DynamicValue || transformValue instanceof Reference) {
          assert(
            ts.isClassDeclaration(node.parent),
            'input cannot be part a child of an interface',
          );
          assert(
            node.parent.name !== undefined && ts.isIdentifier(node.parent.name),
            'containing input class to have a name',
          );

          try {
            transformResult = parseDecoratorInputTransformFunction(
              node.parent as ClassDeclaration,
              node.name.text,
              transformValue,
              host,
              refEmitter,
              CompilationMode.FULL,
            );
          } catch (e: unknown) {
            if (!(e instanceof FatalDiagnosticError)) {
              throw e;
            }

            // TODO: error handling??
            // See failing case: e.g. inherit_definition_feature_spec.ts
            console.error(`${e.node.getSourceFile().fileName}: ${e.toString()}`);
          }
        }
      }
    }
  }

  return {
    bindingPropertyName: publicName,
    classPropertyName: node.name.text,
    required: isRequired,
    isSignal: false,
    inSourceFile: true,
    transform: transformResult,
    inputDecoratorRef: inputDecorator.identifier,
  };
}
