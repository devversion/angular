import path from 'path';
import ts from 'typescript';

export class MigrationHost {
  constructor(
    public projectDir: string,
    public singleExecutionMode: boolean,
  ) {}

  fileToId(file: ts.SourceFile | string): string {
    if (typeof file !== 'string') {
      if (file.isDeclarationFile) {
        file = file.fileName.replace(/\.d\.ts/, '.ts');
      } else {
        file = file.fileName;
      }
    }

    return path.relative(this.projectDir, file);
  }
}
