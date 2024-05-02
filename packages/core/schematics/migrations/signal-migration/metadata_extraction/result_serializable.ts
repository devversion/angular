import ts from 'typescript';
import {Replacement} from './replacement';

export enum SerializableNodeKind {
  External = 'external',
  Source = 'source',
}

export interface SerializableNodeExternal {
  kind: SerializableNodeKind.External;
  workspaceRelativeFilename: string;
  exportAccessId: string;
}

export interface SerializableNodeSource {
  kind: SerializableNodeKind.Source;
  workspaceRelativeFilename: string;
  fromTemplate: boolean;
  start: number;
  end: number;
}

export type SerializableNode = SerializableNodeSource | SerializableNodeExternal;

export interface SerializableMigrationResult {
  inputs: SerializableNode[];
  references: Array<{
    from: SerializableNode;
    to: SerializableNode;
  }>;
  replacementsPerFile: Record<string, Replacement[]>;
}

function serializeExportNodeId(node: ts.Node): string {
  let id = '';
  let current = node;
  do {
    let currentId: string | null = null;
    if (
      (ts.isClassDeclaration(current) ||
        ts.isInterfaceDeclaration(current) ||
        ts.isFunctionLike(current) ||
        ts.isVariableDeclaration(current) ||
        ts.isPropertyDeclaration(current)) &&
      current.name !== undefined &&
      ts.isIdentifier(current.name)
    ) {
      currentId = current.name.text;
    }
    id = `${currentId ?? current.kind}${id !== '' ? `@${id}` : ''}`;
    current = current.parent;
  } while (!ts.isSourceFile(current));

  return id;
}

export function serializeNode(node: ts.Node): SerializableNode {
  if (node.getSourceFile().isDeclarationFile) {
    return {
      kind: SerializableNodeKind.External,
      workspaceRelativeFilename: node.getSourceFile().fileName,
      exportAccessId: serializeExportNodeId(node),
    };
  }
  return {
    kind: SerializableNodeKind.Source,
    workspaceRelativeFilename: node.getSourceFile().fileName,
    start: node.getStart(),
    end: node.getEnd(),
    fromTemplate: false,
  };
}
