const path = require('path');
const child_process = require('child_process');
const fs = require('fs');
const shx = require('shelljs');

const [
  sourceDir,
  outputDir,
  sourceTsconfigPath,
  sourceFilesArg,
  ...importMappingsArg
] = process.argv.slice(2);

const sourceFiles = sourceFilesArg.split(',');
const execRoot = process.cwd();
const ngcIndexPath = require.resolve('./ngc_bin');
const outputTsconfigPath = path.join(outputDir, path.relative(sourceDir, sourceTsconfigPath));
const tsconfigContent = JSON.parse(fs.readFileSync(sourceTsconfigPath, 'utf8'));

// #################################
// Compute runtime import packages
// #################################

const importMappings = importMappingsArg.reduce((result, mapping) => {
  const [importName, packagePath] = mapping.split(',');
  result[importName] = path.join(execRoot, packagePath);
  return result;
}, {});

// Copy source files to output directory.
sourceFiles.forEach(file => {
  const filePath = path.join(outputDir, path.relative(sourceDir, file));

  shx.mkdir('-p', path.dirname(filePath));
  shx.cp(file, filePath)
});


// #################################
// Prepare the temporary directory
// #################################

tsconfigContent['compilerOptions'] = tsconfigContent['compilerOptions'] || {};
tsconfigContent['compilerOptions']['paths'] = tsconfigContent['compilerOptions']['paths'] || {};

Object.keys(importMappings).forEach(packageName => {
  tsconfigContent['compilerOptions']['paths'][`${packageName}`] = [
    importMappings[packageName],
  ];
  tsconfigContent['compilerOptions']['paths'][`${packageName}/*`] = [
    importMappings[packageName] + '/*'
  ];
});

//tsconfigContent.compilerOptions.outDir = path.relative(outputDir, execRoot);
tsconfigContent.compilerOptions.rootDir = path.relative(outputDir, execRoot);

tsconfigContent.compilerOptions.typeRoots = [
  path.resolve(execRoot, 'external/ngdeps/node_modules/@types')
];

fs.writeFileSync(outputTsconfigPath, JSON.stringify(tsconfigContent, null, 2));

// #################################
// Run NGC and generate output.
// #################################

const ngcProcess = child_process.spawnSync(ngcIndexPath, ['-p', outputTsconfigPath], {stdio: 'inherit'});

if (ngcProcess.status !== 0) {
  process.exit(1);
}

// Cleanup source files which were just needed for compiling in a flattened way.
sourceFiles.filter(file => file.endsWith('.ts')).forEach(file => {
  shx.rm(path.join(outputDir, path.relative(sourceDir, file)));
});
