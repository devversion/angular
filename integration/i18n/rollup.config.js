const {nodeResolve} = require('@rollup/plugin-node-resolve');
const {babel} = require('@rollup/plugin-babel');
const {ConsoleLogger, NodeJSFileSystem, LogLevel} = require('@angular/compiler-cli');
const {createEs2015LinkerPlugin} = require('@angular/compiler-cli/linker/babel');

/** File system used by the Angular linker plugin. */
const fileSystem = new NodeJSFileSystem();
/** Logger used by the Angular linker plugin. */
const logger = new ConsoleLogger(LogLevel.info);
/** Linker babel plugin. */
const linkerPlugin = createEs2015LinkerPlugin({
  fileSystem,
  logger,
  linkerJitMode: false,
});

module.exports = {
  input: './built/src/main.js',
  output: {
    file: './built/bundle.js',
    format: 'iife'
  },
  plugins: [
    nodeResolve(),
    babel({plugins: [linkerPlugin]}),
  ]
}