import ts from 'typescript';
import {TemplateTypeChecker} from '../../../../../../compiler-cli/src/ngtsc/typecheck/api';
import {MigrationHost} from '../migration_host';
import {Replacement} from '../replacement';
import {MigrationResult} from '../result';
import {TemplateReferenceVisitor} from '../template_reference_visitor';
import {unwrapParent} from '../utils/unwrap_parent';
import {KnownInputs} from './1_identify_inputs';
import {InputReferenceKind} from '../utils/input_reference';
import {traverseAccess} from '../utils/traverse_access';

export function pass2_IdentifySourceFileReferences(
  sf: ts.SourceFile,
  host: MigrationHost,
  checker: ts.TypeChecker,
  templateTypeChecker: TemplateTypeChecker,
  knownDecoratorInputs: KnownInputs,
  result: MigrationResult,
) {
  const visitor = (node: ts.Node) => {
    if (ts.isClassDeclaration(node)) {
      identifyTemplateReferences(
        node,
        host,
        checker,
        templateTypeChecker,
        result,
        knownDecoratorInputs,
      );
    }

    if (
      ts.isIdentifier(node) &&
      !(ts.isPropertyDeclaration(node.parent) && node.parent.name === node)
    ) {
      identifyPotentialTypeScriptReference(node, host, checker, knownDecoratorInputs, result);
    }

    ts.forEachChild(node, visitor);
  };
  ts.forEachChild(sf, visitor);
}

function identifyPotentialTypeScriptReference(
  node: ts.Identifier,
  host: MigrationHost,
  checker: ts.TypeChecker,
  knownDecoratorInputs: KnownInputs,
  result: MigrationResult,
) {
  const target = checker.getSymbolAtLocation(node);
  const targetDecl = target?.declarations?.find((d) => knownDecoratorInputs.has(d));

  if (target === undefined || targetDecl === undefined) {
    return;
  }

  const {inputId} = knownDecoratorInputs.get(targetDecl)!;

  // track accesses from source files to inputs.
  result.references.push({
    kind: InputReferenceKind.TypeScript,
    from: {fileId: host.fileToId(node.getSourceFile()), node},
    target: inputId,
    targetSymbol: target,
  });

  // Append `()` to unwrap the signal.
  result.addReplacement(
    node.getSourceFile().fileName,
    new Replacement(node.getEnd(), node.getEnd(), '()'),
  );

  const accessParent = unwrapParent(traverseAccess(node).parent);

  // TODO: handle all types of assignments
  if (
    ts.isBinaryExpression(accessParent) &&
    accessParent.operatorToken.kind === ts.SyntaxKind.EqualsToken
  ) {
    result.incompatibleInputs.set(inputId, {context: accessParent, reason: 'write-assignment'});
  }
}

function identifyTemplateReferences(
  node: ts.ClassDeclaration,
  host: MigrationHost,
  checker: ts.TypeChecker,
  templateTypeChecker: TemplateTypeChecker,
  result: MigrationResult,
  knownDecoratorInputs: KnownInputs,
) {
  const template = templateTypeChecker.getTemplate(node);
  if (template !== null) {
    const visitor = new TemplateReferenceVisitor(
      checker,
      templateTypeChecker,
      node,
      knownDecoratorInputs,
    );
    template.forEach((node) => node.visit(visitor));

    for (const res of visitor.result) {
      const templateFilePath = res.containingTmplNode.sourceSpan.start.file.url;

      result.references.push({
        kind: InputReferenceKind.Template,
        from: {
          node: res.containingTmplNode,
          originatingTsFileId: host.fileToId(node.getSourceFile()),
          templateFileId: host.fileToId(templateFilePath),
        },
        target: res.targetInputId,
      });

      // TODO: Template control flow?

      // Append `()` to unwrap the signal.
      result.addReplacement(
        templateFilePath,
        new Replacement(res.read.sourceSpan.end, res.read.sourceSpan.end, '()'),
      );
    }
  }
}
