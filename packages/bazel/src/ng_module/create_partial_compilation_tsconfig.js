/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

const fs = require('fs');

function main(inputExecPath, outputExecPath) {
  const data = JSON.parse(fs.readFileSync(inputExecPath, 'utf8'));
  const {angularCompilerOptions} = data;

  angularCompilerOptions['enableIvy'] = true;
  angularCompilerOptions['compilationMode'] = 'partial';
  angularCompilerOptions['expectedOut'] =
      angularCompilerOptions['expectedOut'].map(f => f.replace(/\.(m)?js$/, '.ivy-partial.js'));

  // Write the new tsconfig to the specified output path.
  fs.writeFileSync(outputExecPath, JSON.stringify(data, null, 2));
}

if (require.main === module) {
  const [inputExecPath, outputExecPath] = process.argv.slice(2);
  main(inputExecPath, outputExecPath);
}
