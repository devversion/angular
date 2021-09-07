/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

const {nodeResolve} = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const preserveShebang = require('rollup-plugin-preserve-shebang');
const sourcemaps = require('rollup-plugin-sourcemaps');

module.exports = {
  // TypeScript is controlled by the consumer and is a peer dependency. All other
  // dependencies cannot be bundled reliably and remain external dependencies.
  // TODO: Include Angular compiler here; but remove all deep-imports in the CLI.
  external: ['typescript', 'chokidar', 'yargs', 'semver'],
  onwarn: customWarningHandler,
  plugins: [nodeResolve({preferBuiltins: true}), commonjs(), sourcemaps(), preserveShebang()],
};

/** Custom warning handler for Rollup. */
function customWarningHandler(warning, defaultHandler) {
  // If rollup is unable to resolve an import, we want to throw an error
  // instead of silently treating the import as external dependency.
  // https://rollupjs.org/guide/en/#warning-treating-module-as-external-dependency
  if (warning.code === 'UNRESOLVED_IMPORT') {
    throw Error(`Unresolved import: ${warning.message}`);
  }

  defaultHandler(warning);
}
