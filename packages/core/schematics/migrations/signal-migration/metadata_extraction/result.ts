import ts from 'typescript';
import {Replacement} from './replacement';
import {InputId} from './utils/input_id';
import {InputReference} from './utils/input_reference';

export class MigrationResult {
  sourceInputs = new Set<InputId>();
  references: InputReference[] = [];
  incompatibleInputs = new Map<InputId, {reason: 'write-assignment'; context: ts.Node}>();

  replacements = new Map<string, Replacement[]>();

  addReplacement(file: string, replacement: Replacement) {
    if (this.replacements.has(file)) {
      this.replacements.get(file)!.push(replacement);
    } else {
      this.replacements.set(file, [replacement]);
    }
  }

  serialize() {
    // TODO
  }
}
