import ts from 'typescript';
import {MigrationResult} from '../result';
import {analyzeControlFlow} from '../flow_analysis';
import {Replacement} from '../replacement';
import {InputId} from '../utils/input_id';
import {isTsInputReference} from '../utils/input_reference';
import {traverseAccess} from '../utils/traverse_access';

export function pass3__migrateTypeScriptReferences(
  checker: ts.TypeChecker,
  result: MigrationResult,
) {
  const tsReferences = new Map<InputId, {accesses: ts.Identifier[]; targetType: ts.Type}>();

  for (const reference of result.references) {
    // This pass only deals with TS references.
    if (!isTsInputReference(reference)) {
      continue;
    }

    if (!tsReferences.has(reference.target)) {
      tsReferences.set(reference.target, {
        accesses: [],
        targetType: checker.getTypeOfSymbol(reference.targetSymbol),
      });
    }
    tsReferences.get(reference.target)!.accesses.push(reference.from.node);
  }

  for (const reference of tsReferences.values()) {
    const targetType = reference.targetType;
    const controlFlowResult = analyzeControlFlow(targetType, reference.accesses, checker);

    for (const {id, originalNode, recommendedNode, willBeShared} of controlFlowResult) {
      const sf = originalNode.getSourceFile();

      if (recommendedNode !== 'preserve-not-narrowed') {
        if (willBeShared) {
          throw new Error('Unexpected! Cannot be narrowed while also sharing!');
        }

        const replaceNode = traverseAccess(originalNode);
        result.addReplacement(
          sf.fileName,
          new Replacement(replaceNode.getStart(), replaceNode.getEnd(), `__tmp${recommendedNode}`),
        );
        continue;
      }

      if (willBeShared) {
        let parentBlock = originalNode.parent;
        let previous: ts.Node = originalNode;
        while (!ts.isSourceFile(parentBlock) && !ts.isBlock(parentBlock)) {
          previous = parentBlock;
          parentBlock = parentBlock.parent;
        }

        const replaceNode = traverseAccess(originalNode);
        const leadingSpace = ts.getLineAndCharacterOfPosition(sf, previous.getStart());

        result.addReplacement(
          sf.fileName,
          new Replacement(
            previous.getStart(),
            previous.getStart(),
            `const __tmp${id} = ${replaceNode.getText()}();\n${' '.repeat(leadingSpace.character)}`,
          ),
        );

        result.addReplacement(
          sf.fileName,
          new Replacement(replaceNode.getStart(), replaceNode.getEnd(), `__tmp${id}`),
        );
      }
    }
  }
}
