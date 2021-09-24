/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

const {nodeResolve} = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const json = require('@rollup/plugin-json');
const preserveShebang = require('rollup-plugin-preserve-shebang');
const sourcemaps = require('rollup-plugin-sourcemaps');

module.exports = {
  // The Angular compiler and CLI should remain external as the browser entry-points
  // like `@angular/localize` or `@angular/localize/init` do not use bundled versions,
  // and we would not want to use different versions of framework packages. Yargs
  // cannot be bundled reliably and remains an external dependency.
  external: ['@angular/compiler', '@angular/compiler-cli/private/localize', 'yargs'],
  onwarn: customWarningHandler,
  plugins: [
    nodeResolve({preferBuiltins: true}),
    // Rollup commonjs by default captures optional dynamic requires (wrapped in a try-catch).
    // This will fail for `supports-color` module used by `@babel/core -> debug`. We explicitly
    // instruct the plugin to not skip over the `supports-color` as we do not want to localize
    // to depend on it transitively.
    commonjs({ignoreTryCatch: ['supports-color']}), json(), sourcemaps(), preserveShebang()
  ]
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
