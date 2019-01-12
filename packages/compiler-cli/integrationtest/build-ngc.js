const path = require('path');
const child_process = require('child_process');
const fs = require('fs');
const shx = require('shelljs');

const [
  sourceDir,
  outputDir,
  inputTsconfigPath,
  sourceFilesArg,
  ...importMappingsArg
] = process.argv.slice(2);

const sourceFiles = sourceFilesArg.split(',');
const execRoot = process.cwd();
const tempDir = createTmpDir();
const ngcIndexPath = require.resolve('./ngc_bin');
const tsconfigPath = path.join(tempDir, path.relative(sourceDir, inputTsconfigPath));

// #################################
// Compute runtime import packages
// #################################

const importMappings = importMappingsArg.reduce((result, mapping) => {
  const [importName, packagePath] = mapping.split(',');
  result[importName] = path.join(execRoot, packagePath);
  return result;
}, {});


// #################################
// Prepare the temporary directory
// #################################

sourceFiles.forEach(file => {
  const tempSourcePath = path.join(tempDir, path.relative(sourceDir, file));
  shx.mkdir('-p', path.dirname(tempSourcePath));
  shx.cp(file, tempSourcePath);
});

Object.keys(importMappings).forEach(packageName => {
  const targetPath = path.join(tempDir, 'node_modules', packageName);

  shx.mkdir('-p', path.join(targetPath, '..'));
  fs.symlinkSync(importMappings[packageName], targetPath, 'dir');
});

// #################################
// Run NGC and generate output.
// #################################

child_process.spawnSync(ngcIndexPath, ['-p', tsconfigPath], {stdio: 'inherit'});

// #################################
// Write output to Bazel out
// #################################

shx.rm('-r', path.join(tempDir, 'node_modules'));
shx.cp('-r', `${tempDir}/*`, outputDir);
shx.rm('-r', tempDir);

/** Creates a temporary directory with an unique name. */
function createTmpDir() {
  const tmpDir = path.join(shx.tempdir(), `ng-bazel-${Math.random().toString(32)}`);
  shx.mkdir('-p', tmpDir);
  return tmpDir;
}
