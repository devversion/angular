/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {NodeJSFileSystem, setFileSystem} from './src/ngtsc/file_system';

export {AotCompilerHost, AotCompilerHost as StaticReflectorHost, StaticReflector, StaticSymbol} from '@angular/compiler';

// Exposed for advanced consumers that intend to invoke the CLI entry-points
// programmatically (e.g. allowing configuration of custom TS transformers).
export {mainXi18n} from './src/extract_i18n';
export {main} from './src/main';
export {VERSION} from './src/version';

export * from './src/metadata';
export * from './src/transformers/api';
export * from './src/transformers/entry_points';

export * from './src/perform_compile';

// TODO(tbosch): remove this once usages in G3 are changed to `CompilerOptions`
export {CompilerOptions as AngularCompilerOptions} from './src/transformers/api';

export {ngToTsDiagnostic} from './src/transformers/util';

// Internal exports needed for packages relying on the compiler-cli.
// TODO: Consider moving into `@angular/compiler-cli/private`. This would
// help with a consistent pattern for cross package imports for Angular.
export * from './src/tooling';

// Exposed as they are needed for relying on the `linker`.
export * from './src/ngtsc/logging';
export * from './src/ngtsc/file_system';

// Exports for dealing with the `ngtsc` program.
export {NgTscPlugin} from './src/ngtsc/tsc_plugin';
export {NgtscProgram} from './src/ngtsc/program';
export {OptimizeFor} from './src/ngtsc/typecheck/api';

export * from './src/ngtsc/file_system';
export * from './src/ngtsc/logging';

setFileSystem(new NodeJSFileSystem());
