import ts from 'typescript';

import {
  AST,
  ImplicitReceiver,
  PropertyRead,
  PropertyWrite,
  RecursiveAstVisitor,
  TmplAstBoundAttribute,
  TmplAstBoundEvent,
  TmplAstBoundText,
  TmplAstNode,
  TmplAstRecursiveVisitor,
} from '../../../../../compiler';
import {SymbolKind, TemplateTypeChecker} from '../../../../../compiler-cli/src/ngtsc/typecheck/api';
import {KnownInputs} from './passes/1_identify_inputs';
import {InputId} from './utils/input_id';

export interface TmplInputExpressionReference {
  target: ts.Node;
  targetInputId: InputId;
  read: PropertyRead;
  containingTmplNode: TmplAstNode;
}

export class TemplateReferenceVisitor extends TmplAstRecursiveVisitor {
  expressionVisitor: TemplateExpressionReferenceVisitor;
  result: TmplInputExpressionReference[] = [];

  constructor(
    typeChecker: ts.TypeChecker,
    templateTypeChecker: TemplateTypeChecker,
    componentClass: ts.ClassDeclaration,
    knownInputs: KnownInputs,
  ) {
    super();
    this.expressionVisitor = new TemplateExpressionReferenceVisitor(
      typeChecker,
      templateTypeChecker,
      componentClass,
      knownInputs,
      this.result,
    );
  }

  override visitBoundText(text: TmplAstBoundText): void {
    this.expressionVisitor.visitTemplateExpression(text, text.value);
  }

  override visitBoundEvent(attribute: TmplAstBoundEvent): void {
    this.expressionVisitor.visitTemplateExpression(attribute, attribute.handler);
  }

  override visitBoundAttribute(attribute: TmplAstBoundAttribute): void {
    this.expressionVisitor.visitTemplateExpression(attribute, attribute.value);
  }
}

export class TemplateExpressionReferenceVisitor extends RecursiveAstVisitor {
  activeTmplAstNode: TmplAstNode | null = null;

  constructor(
    private typeChecker: ts.TypeChecker,
    private templateTypeChecker: TemplateTypeChecker,
    private componentClass: ts.ClassDeclaration,
    private knownInputs: KnownInputs,
    private result: TmplInputExpressionReference[],
  ) {
    super();
  }

  visitTemplateExpression(activeNode: TmplAstNode, expressionNode: AST) {
    this.activeTmplAstNode = activeNode;
    expressionNode.visit(this);
  }

  override visitPropertyRead(ast: PropertyRead) {
    this._inspectPropertyAccess(ast);
  }
  override visitPropertyWrite(ast: PropertyWrite) {
    this._inspectPropertyAccess(ast);
  }

  /**
   * Inspects the property access and attempts to resolve whether they access
   * a known decorator input. If so, the result is captured.
   */
  private _inspectPropertyAccess(ast: PropertyRead | PropertyWrite) {
    this._checkAccessViaTemplateTypeCheckBlock(ast) ||
      this._checkAccessViaOwningComponentClassType(ast);
  }

  private _checkAccessViaTemplateTypeCheckBlock(ast: PropertyRead | PropertyWrite): boolean {
    const symbol = this.templateTypeChecker.getSymbolOfNode(ast, this.componentClass);
    if (symbol?.kind !== SymbolKind.Expression) {
      return false;
    }

    const targetDecl = symbol.tsSymbol?.declarations?.find((d) => this.knownInputs.has(d));
    if (targetDecl == null) {
      return false;
    }

    const targetInputId = this.knownInputs.get(targetDecl)!.inputId;

    this.result.push({
      target: targetDecl,
      targetInputId,
      read: ast,
      containingTmplNode: this.activeTmplAstNode!,
    });

    return true;
  }

  private _checkAccessViaOwningComponentClassType(ast: PropertyRead | PropertyWrite) {
    const target = this.templateTypeChecker.getExpressionTarget(ast, this.componentClass);

    // Skip checking if:
    // - the reference resolves to a template variable or local ref. No way to resolve without TCB.
    // - the access is accessing a non-implicit receiver.
    // - the owning component does not have a name (should not happen technically).
    if (
      target !== null ||
      !(ast.receiver instanceof ImplicitReceiver) ||
      this.componentClass.name === undefined
    ) {
      return;
    }

    const componentType = this.typeChecker.getTypeAtLocation(this.componentClass.name);
    const property = componentType.getProperty(ast.name);
    const matchingTarget = property?.declarations?.find((d) => this.knownInputs.has(d));

    if (matchingTarget === undefined) {
      return;
    }

    const targetInputId = this.knownInputs.get(matchingTarget)!.inputId;

    this.result.push({
      target: matchingTarget,
      targetInputId,
      read: ast,
      containingTmplNode: this.activeTmplAstNode!,
    });
  }
}
