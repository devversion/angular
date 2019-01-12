const path = require('path');
const child_process = require('child_process');
const fs = require('fs');
const shx = require('shelljs');

const [outputDir, tsconfigPath, ...importMappings] = process.argv.slice(2);
const execRoot = process.cwd();
const tempDir = createTmpDir();
const tsconfigFileName = 'tsconfig-build.json';
const sourceDir = path.dirname(tsconfigPath);
const ngcIndexPath = require.resolve('./ngc_bin');

// #################################
// Compute runtime import packages
// #################################

const BUILD_NODE_MODULES = importMappings.reduce((result, mapping) => {
  const [importName, packagePath] = mapping.split(',');
  result[importName] = path.join(execRoot, packagePath);
  return result;
}, {});


// #################################
// Prepare the temporary directory
// #################################

shx.cp('-r', `${sourceDir}/*`, tempDir);

Object.keys(BUILD_NODE_MODULES).forEach(packageName => {
  const targetPath = path.join(tempDir, 'node_modules', packageName);

  shx.mkdir('-p', path.join(targetPath, '..'));
  fs.symlinkSync(BUILD_NODE_MODULES[packageName], targetPath, 'dir');
});

// #################################
// Run NGC and generate output.
// #################################

child_process.spawnSync(
  ngcIndexPath, ['-p', path.join(tempDir, tsconfigFileName)], {stdio: 'inherit'});

// #################################
// Write output to Bazel out
// #################################

shx.cp('-r', `${tempDir}/dist/*`, outputDir);
shx.rm('-r', tempDir);

/** Creates a temporary directory with an unique name. */
function createTmpDir() {
  const tmpDir = path.join(shx.tempdir(), `ng-bazel-${Math.random().toString(32)}`);
  shx.mkdir('-p', tmpDir);
  return tmpDir;
}
