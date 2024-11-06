import ts from 'typescript';
import {ClassDeclaration, Decorator, reflectObjectLiteral} from '../../../reflection';
import {
  createValueHasWrongTypeError,
  forwardRefResolver,
  toR3Reference,
  unwrapExpression,
  wrapTypeReference,
} from '../../../annotations/common';
import type {TransformContext} from './index';
import {resolveTypeList} from '../../../annotations/ng_module/src/handler';
import {
  createNgModuleType,
  R3NgModuleMetadataKind,
} from '../../../../../../compiler/src/render3/r3_module_compiler';
import {Expression, R3Reference, WrappedNodeExpr} from '../../../../../../compiler/public_api';

export function getNgModuleType(
  clazz: ClassDeclaration,
  decorator: Decorator,
  ctx: TransformContext,
  onlyPublishPublicTypings: boolean,
) {
  if (decorator.args === null) {
    return null;
  }

  // @NgModule can be invoked without arguments. In case it is, pretend as if a blank object
  // literal was specified. This simplifies the code below.
  const meta =
    decorator.args.length === 1
      ? unwrapExpression(decorator.args[0])
      : ts.factory.createObjectLiteralExpression([]);

  if (!ts.isObjectLiteralExpression(meta)) {
    return null;
  }

  const ngModule = reflectObjectLiteral(meta);

  // Do not generate a type for `jit: true` NgModule declarations.
  if (ngModule.has('jit')) {
    return null;
  }

  const sf = clazz.getSourceFile();

  const rawDeclarations: ts.Expression | null = ngModule.get('declarations') ?? null;
  const allDeclarations: R3Reference[] = [];
  const allExports: R3Reference[] = [];
  const allImports: R3Reference[] = [];
  const exportedDeclarations: Expression[] = [];
  const moduleType: R3Reference = wrapTypeReference(ctx.reflectionHost, clazz);

  if (rawDeclarations !== null) {
    const declarationMeta = ctx.evaluator.evaluate(rawDeclarations, forwardRefResolver);
    const declarations = resolveTypeList(
      ctx.reflectionHost,
      rawDeclarations,
      declarationMeta,
      clazz.name.text,
      'declarations',
      0,
      /* allowUnresolvedReferences */ true,
    );

    allDeclarations.push(
      ...declarations.references.map((r) =>
        toR3Reference(r.getOriginForDiagnostics(meta, clazz.name), r, sf, ctx.refEmitter),
      ),
    );

    for (const value of declarations.dynamicValues) {
      if (value.isFromUnknownIdentifier()) {
        allDeclarations.push({
          type: new WrappedNodeExpr(value.node),
          value: new WrappedNodeExpr(value.node),
        });
      } else {
        ctx.diagnostics.push(
          createValueHasWrongTypeError(
            value.node,
            value,
            '`declarations` of module must be statically analyzable (i.e. simple references)',
          ).toDiagnostic(),
        );
      }
    }
  }

  console.error(allDeclarations.length, ctx.diagnostics.length);

  const ngModuleTypeDef = createNgModuleType({
    kind: R3NgModuleMetadataKind.Global,
    includeImportTypes: !onlyPublishPublicTypings,
    publicDeclarationTypes: onlyPublishPublicTypings ? exportedDeclarations : null,
    declarations: allDeclarations,
    exports: allExports,
    imports: allImports,
    type: moduleType,
  });

  return null;
}
