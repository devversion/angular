/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import yargs from 'yargs';
import childProcess from 'child_process';
import path from 'path';
import url from 'url';
import {GitClient} from '@angular/ng-dev';

const scriptDir = path.dirname(url.fileURLToPath(import.meta.url));
const projectDir = path.join(scriptDir, '../..');

await yargs(process.argv.slice(2))
  .command(
    'run-compare <compare-ref> <bazel-target>',
    'Runs a benchmark Bazel target between two SHAs',
    (argv) =>
      argv
        .option('compare-ref', {description: 'Comparison SHA', string: true, demandOption: true})
        .option('bazel-target', {descripton: 'Bazel target', string: true, demandOption: true}),
    (args) => runCompare(args.bazelTarget, args.compareRef)
  )
  .demandCommand()
  .scriptName('$0')
  .help()
  .strict()
  .parseAsync();

async function runCompare(bazelTarget: string, compareRef: string): Promise<void> {
  const git = await GitClient.get();

  git.run(['stash']);

  try {
  git.run(['fetch', git.getRepoGitUrl(), compareRef]);
  git.run(['checkout', compareRef]);
  } finally {
    console.log('Restoring working directory');
    git.run(['stash', 'apply'])
  }
}

function exec(cmd: string, args: string[]): void {
  childProcess.spawnSync(cmd, args, {shell: true, cwd: projectDir});
}
