import ts from 'typescript';
import {InputId} from './input_id';
import {TmplAstNode} from '../../../../../../compiler/public_api';

export enum InputReferenceKind {
  Template,
  TypeScript,
}

export interface TemplateInputReference {
  kind: InputReferenceKind.Template;
  from: {
    templateFileId: string;
    originatingTsFileId: string;
    node: TmplAstNode;
  };
  target: InputId;
}

export interface TsInputReference {
  kind: InputReferenceKind.TypeScript;
  from: {
    fileId: string;
    node: ts.Identifier;
  };
  target: InputId;
  targetSymbol: ts.Symbol;
}

export type InputReference = TsInputReference | TemplateInputReference;

export function isTsInputReference(ref: InputReference): ref is TsInputReference {
  return (ref as Partial<TsInputReference>).targetSymbol !== undefined;
}
