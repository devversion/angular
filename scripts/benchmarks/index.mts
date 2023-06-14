/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import yargs from 'yargs';
import {GitClient, green, Log} from '@angular/ng-dev';
import inquirer from 'inquirer';
import {exec} from './utils.mjs';
import {findBenchmarkTargets, getTestlogPath} from './targets.mjs';
import { collectBenchmarkResults } from './results.mjs';

const benchmarkTestFlags = ['--test_output=streamed', '--cache_test_results=no'];

await yargs(process.argv.slice(2))
  .command(
    'run-compare <compare-ref> [bazel-target]',
    'Runs a benchmark Bazel target between two SHAs',
    (argv) =>
      argv
        .option('compare-ref', {description: 'Comparison SHA', string: true, demandOption: true})
        .option('bazel-target', {descripton: 'Bazel target', string: true}),
    (args) => runCompare(args.bazelTarget, args.compareRef)
  )
  .demandCommand()
  .scriptName('$0')
  .help()
  .strict()
  .parseAsync();

async function runCompare(bazelTarget: string | undefined, compareRef: string): Promise<void> {
  const git = await GitClient.get();
  const initialRef = git.getCurrentBranchOrRevision();

  if (bazelTarget === undefined) {
    const targets = await findBenchmarkTargets();

    bazelTarget = (
      await inquirer.prompt<{bazelTarget: string}>({
        name: 'bazelTarget',
        message: "Select benchmark target to run:",
        type: 'list',
        choices: targets.map((t) => ({value: t, name: t})),
      })
    ).bazelTarget;
  }

  // If the target does not specify an explicit browser test target, we attempt
  // to automatically add the Chromium suffix. This is necessary for e.g.
  // resolving testlogs which would reside under the actual test target.
  if (!bazelTarget.endsWith('_chromium')) {
    bazelTarget = `${bazelTarget}_chromium`;
  }

  const testlogPath = await getTestlogPath(bazelTarget);
  Log.log(green('Test log path:', testlogPath))

  // Run benchmark with the current working directory.
  await exec('bazel', ['test', bazelTarget, ...benchmarkTestFlags]);

  const workingDirResults = await collectBenchmarkResults(testlogPath);

  // Stash working directory as we might be in the middle of developing
  // and we wouldn't want to discard changes when checking out the compare SHA.
  git.run(['stash']);

  try {
    Log.log(green('Fetching comparison revision.'));
    git.run(['fetch', git.getRepoGitUrl(), compareRef]);
    Log.log(green('Checking out comparison revision.'));
//    git.run(['checkout', compareRef]);

 //   await exec('yarn');
 //   await exec('bazel', ['test', bazelTarget, ...benchmarkTestFlags]);
  } finally {
    restoreWorkingDirectory(git, initialRef);
  }
}

function restoreWorkingDirectory(git: GitClient, initialRef: string) {
  Log.log(green('Restoring working directory'));
  git.run(['checkout', '-f', initialRef]);
  git.run(['stash', 'apply']);
}
