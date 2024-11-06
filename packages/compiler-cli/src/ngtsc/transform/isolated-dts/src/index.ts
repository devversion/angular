import ts from 'typescript';
import {getAngularDecorators} from '../../../annotations';
import {ClassDeclaration, TypeScriptReflectionHost} from '../../../reflection';
import {
  createNgModuleType,
  R3NgModuleMetadataKind,
} from '../../../../../../compiler/src/render3/r3_module_compiler';
import {NgCompilerOptions} from '../../../core/api';
import {PartialEvaluator} from '../../../partial_evaluator';
import {getNgModuleType} from './ng_module';
import {LocalIdentifierStrategy, ReferenceEmitter} from '../../../imports';

export interface TransformContext {
  factoryCtx: ts.TransformationContext;
  singleFileProgram: ts.Program;
  reflectionHost: TypeScriptReflectionHost;
  evaluator: PartialEvaluator;
  isAngularCore: boolean;
  options: NgCompilerOptions;
  refEmitter: ReferenceEmitter;
  diagnostics: ts.Diagnostic[];
}

export function isolatedDtsTransform(
  singleFileProgram: ts.Program,
  options: NgCompilerOptions,
): ts.TransformerFactory<ts.SourceFile> {
  const reflectionHost = new TypeScriptReflectionHost(
    singleFileProgram.getTypeChecker(),
    // TODO: Rename this parameter?!
    /* isLocalCompilation */ true,
  );

  return (ctx) => {
    return (sf) => {
      if (!hasTopLevelAngularCoreImport(sf)) {
        return sf;
      }

      return ts.visitEachChild(
        sf,
        (n) =>
          visitNode(n, {
            singleFileProgram,
            factoryCtx: ctx,
            isAngularCore: false,
            diagnostics: [],
            options,
            reflectionHost,
            refEmitter: new ReferenceEmitter([
              // We only emit imports in the context of the same file.
              // This is the requirement for "isolated dts emit"; as there are
              // no other source files available— Hence this strategy should be sufficient.
              new LocalIdentifierStrategy(),
            ]),
            evaluator: new PartialEvaluator(
              reflectionHost,
              singleFileProgram.getTypeChecker(),
              null,
            ),
          }),
        ctx,
      );
    };
  };
}

function visitNode(node: ts.Node, ctx: TransformContext): ts.Node {
  if (ts.isClassDeclaration(node)) {
    const newClass = visitClassDeclaration(node, ctx);
    if (newClass !== null) {
      return newClass;
    }
  }

  return ts.visitEachChild(node, (n) => visitNode(n, ctx), ctx.factoryCtx);
}

function visitClassDeclaration(node: ts.ClassDeclaration, ctx: TransformContext): ts.Node | null {
  const decorators = ctx.reflectionHost.getDecoratorsOfDeclaration(node);
  if (decorators === null) {
    return null;
  }

  const ngDecorators = getAngularDecorators(
    decorators,
    ['NgModule', 'Directive', 'Component', 'Pipe', 'Injectable'],
    ctx.isAngularCore,
  );

  if (ngDecorators.length === 0) {
    return null;
  }

  if (ngDecorators.length > 1) {
    ctx.diagnostics.push({
      category: ts.DiagnosticCategory.Error,
      code: -1,
      file: node.getSourceFile(),
      messageText: 'Unable to process a class with multiple Angular decorators applied.',
      start: node.getStart(),
      length: 0,
    });
    return null;
  }

  const ngDecorator = ngDecorators[0];
  const onlyPublishPublicTypings = ctx.options.onlyPublishPublicTypingsForNgModules ?? false;

  switch (ngDecorator.name) {
    case 'NgModule':
      getNgModuleType(node as ClassDeclaration, ngDecorator, ctx, onlyPublishPublicTypings);
      break;
  }

  return null;
}

function hasTopLevelAngularCoreImport(sf: ts.SourceFile): boolean {
  for (const node of sf.statements) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === '@angular/core'
    ) {
      return true;
    }
  }
  return false;
}
