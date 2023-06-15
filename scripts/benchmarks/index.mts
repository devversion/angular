/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import yargs from 'yargs';
import {bold, yellow, GitClient, green, Log} from '@angular/ng-dev';
import inquirer from 'inquirer';
import {exec} from './utils.mjs';
import {ResolvedTarget, findBenchmarkTargets, getTestlogPath, resolveTarget} from './targets.mjs';
import {collectBenchmarkResults} from './results.mjs';
import {setOutput} from '@actions/core';

const benchmarkTestFlags = [
  '--cache_test_results=no',
  '--color=yes',
  '--curses=no',
  // We may have RBE set up, but test should run locally on the same machine to
  // reduce fluctuation. Output streamed ensures that deps can build with RBE, but
  // tests run locally while also providing useful for debugging.
  '--test_output=streamed',
];

await yargs(process.argv.slice(2))
  .command(
    'run-compare <compare-ref> [bazel-target]',
    'Runs a benchmark between two SHAs',
    (argv) =>
      argv
        .option('compare-ref', {description: 'Comparison SHA', type: 'string', demandOption: true})
        .option('bazel-target', {description: 'Bazel target', type: 'string'}),
    (args) => runCompare(args.bazelTarget, args.compareRef)
  )
  .command(
    'run [bazel-target]',
    'Runs a benchmark',
    (argv) => argv.option('bazel-target', {description: 'Bazel target', type: 'string'}),
    (args) => runBenchmarkCmd(args.bazelTarget)
  )
  .command(
    'extract-compare-comment <comment-body>',
    false, // Do not show in help.
    (argv) => argv.positional('comment-body', {demandOption: true, type: 'string'}),
    (args) => extractCompareComment(args.commentBody)
  )
  .demandCommand()
  .scriptName('$0')
  .help()
  .strict()
  .parseAsync();

async function promptForBenchmarkTarget(): Promise<string> {
  const targets = await findBenchmarkTargets();

  return (
    await inquirer.prompt<{bazelTarget: string}>({
      name: 'bazelTarget',
      message: 'Select benchmark target to run:',
      type: 'list',
      choices: targets.map((t) => ({value: t, name: t})),
    })
  ).bazelTarget;
}

async function extractCompareComment(commentBody: string): Promise<void> {
  const matches = /\/[^ ]+ ([^ ]+) ([^ ]+)/.exec(commentBody);
  if (matches === null) {
    Log.error('Could not extract information from comment', commentBody);
    process.exit(1);
  }

  setOutput('compareRef', matches[1]);
  setOutput('benchmarkTarget', matches[2]);
}

async function runBenchmarkCmd(bazelTargetRaw: string | undefined): Promise<void> {
  if (bazelTargetRaw === undefined) {
    bazelTargetRaw = await promptForBenchmarkTarget();
  }
  await runBenchmarkTarget(await resolveTarget(bazelTargetRaw));
}

async function runBenchmarkTarget(bazelTarget: ResolvedTarget): Promise<void> {
  await exec('bazel', ['test', bazelTarget, ...benchmarkTestFlags]);
}

async function runCompare(bazelTargetRaw: string | undefined, compareRef: string): Promise<void> {
  const git = await GitClient.get();
  const initialRef = git.getCurrentBranchOrRevision();

  if (bazelTargetRaw === undefined) {
    bazelTargetRaw = await promptForBenchmarkTarget();
  }

  const bazelTarget = await resolveTarget(bazelTargetRaw);
  const testlogPath = await getTestlogPath(bazelTarget);

  Log.log(green('Test log path:', testlogPath));

  // Run benchmark with the current working directory.
  await runBenchmarkTarget(bazelTarget);

  const workingDirResults = await collectBenchmarkResults(testlogPath);

  // Stash working directory as we might be in the middle of developing
  // and we wouldn't want to discard changes when checking out the compare SHA.
  git.run(['stash']);

  try {
    Log.log(green('Fetching comparison revision.'));
    git.run(['fetch', git.getRepoGitUrl(), compareRef]);
    Log.log(green('Checking out comparison revision.'));
    git.run(['checkout', 'FETCH_HEAD']);

    await exec('yarn');
    await runBenchmarkTarget(bazelTarget);
  } finally {
    restoreWorkingDirectory(git, initialRef);
  }

  // Re-install dependencies for `HEAD`.
  await exec('yarn');

  const comparisonResults = await collectBenchmarkResults(testlogPath);

  if (process.env.GITHUB_ACTION !== undefined) {
    setOutput('comparisonResultsText', comparisonResults.textSummary);
    setOutput('workingDirResultsText', workingDirResults.textSummary);
  }

  console.log('\n\n\n');
  console.log(green(bold('Results!')));

  console.log(bold(yellow('Comparison results')), '\n');
  console.log(comparisonResults.textSummary);

  console.log(bold(yellow('Working directory results')), '\n');
  console.log(workingDirResults.textSummary);
}

function restoreWorkingDirectory(git: GitClient, initialRef: string) {
  Log.log(green('Restoring working directory'));
  git.run(['checkout', '-f', initialRef]);

  // Stash apply could fail if there were not changes in the working dir.
  git.runGraceful(['stash', 'apply']);
}
