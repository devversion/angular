import ts from 'typescript';
import {MigrationHost} from '../migration_host';

export interface InputId {
  id: string | undefined;
  node: ts.PropertyDeclaration;
}

export function getInputId(host: MigrationHost, node: ts.PropertyDeclaration): InputId {
  const className = node.parent.name ?? `<anonymous>`;
  const inputName = ts.isIdentifier(node.name) ? node.name : '<non-identifier-name>';

  return {
    id: `${host.fileToId(node.getSourceFile())}@@${className}@@${inputName}`,
    node,
  };
}
