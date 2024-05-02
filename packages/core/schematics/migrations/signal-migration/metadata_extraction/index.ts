import fs from 'fs';
import path from 'path';
import ts from 'typescript';

import {NodeJSFileSystem, setFileSystem} from '../../../../../compiler-cli/src/ngtsc/file_system';
import {DtsMetadataReader} from '../../../../../compiler-cli/src/ngtsc/metadata';
import {PartialEvaluator} from '../../../../../compiler-cli/src/ngtsc/partial_evaluator';
import {NgtscProgram} from '../../../../../compiler-cli/src/ngtsc/program';
import {TypeScriptReflectionHost} from '../../../../../compiler-cli/src/ngtsc/reflection';
import {isShim} from '../../../../../compiler-cli/src/ngtsc/shims';
import {parseTsconfigFile} from '../../../utils/typescript/parse_tsconfig';

import {
  KnownInputs,
  pass1__IdentifySourceFileAndDeclarationInputs,
} from './passes/1_identify_inputs';
import {pass2_IdentifySourceFileReferences} from './passes/2_find_source_file_references';
import {pass3__migrateTypeScriptReferences} from './passes/3_migrate_ts_references';
import {MigrationResult} from './result';
import {applyReplacements} from './replacement';
import {MigrationHost} from './migration_host';

main(process.argv[2]);

export function main(absoluteTsconfigPath: string) {
  setFileSystem(new NodeJSFileSystem());

  const basePath = path.dirname(absoluteTsconfigPath);
  const tsconfig = parseTsconfigFile(absoluteTsconfigPath, basePath);
  const ngtscProgram = new NgtscProgram(
    tsconfig.fileNames,
    {
      ...tsconfig.options,
      _enableTemplateTypeChecker: true,
      _usePoisonedData: true,
      // We want to migrate non-exported classes too.
      compileNonExportedClasses: true,
      // Avoid checking libraries to speed up the migration.
      skipLibCheck: true,
      skipDefaultLibCheck: true,
    },
    ts.createCompilerHost(tsconfig.options, true),
  );

  // Get template type checker & analyze sync.
  const templateTypeChecker = ngtscProgram.compiler.getTemplateTypeChecker();

  // Generate all type check blocks.
  templateTypeChecker.generateAllTypeCheckBlocks();

  const {refEmitter} = ngtscProgram.compiler['ensureAnalyzed']();
  const userProgram = ngtscProgram.getTsProgram();
  const typeChecker = userProgram.getTypeChecker();
  const reflector = new TypeScriptReflectionHost(typeChecker);
  const evaluator = new PartialEvaluator(reflector, typeChecker, null);
  const metadataReader = new DtsMetadataReader(typeChecker, reflector);
  const knownDecoratorInputs: KnownInputs = new WeakMap();
  const result = new MigrationResult();
  const host = new MigrationHost(
    /* projectDir */ tsconfig.options.rootDir ?? basePath,
    /* singleExecutionMode */ false,
  );

  const sourceFiles = userProgram.getSourceFiles();

  // Pass 1
  sourceFiles.forEach((sf) =>
    pass1__IdentifySourceFileAndDeclarationInputs(
      sf,
      host,
      reflector,
      metadataReader,
      evaluator,
      refEmitter,
      knownDecoratorInputs,
      result,
    ),
  );

  // Pass 2
  sourceFiles.forEach(
    (sf) =>
      !sf.isDeclarationFile &&
      pass2_IdentifySourceFileReferences(
        sf,
        host,
        typeChecker,
        templateTypeChecker,
        knownDecoratorInputs,
        result,
      ),
  );

  // Pass 3
  pass3__migrateTypeScriptReferences(typeChecker, result);

  // print incompatibilities
  console.log(
    Array.from(result.incompatibleInputs.entries()).map(
      ([id, info]) => `${id}: ${info.reason} - ${info.context.getText()}`,
    ),
  );

  // Apply replacements
  updateFilesOnDisk(userProgram, result);

  return result.serialize();
}

function updateFilesOnDisk(userProgram: ts.Program, result: MigrationResult) {
  for (const userFile of userProgram.getSourceFiles().filter((f) => !f.isDeclarationFile)) {
    if (isShim(userFile)) {
      continue;
    }

    console.log(`----- ${userFile.fileName} ------`);
    const newText = applyReplacements(
      userFile.text,
      result.replacements.get(userFile.fileName) ?? [],
    );

    fs.writeFileSync(userFile.fileName, newText, 'utf8');
  }
}
