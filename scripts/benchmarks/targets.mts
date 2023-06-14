/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import path from 'path';
import {exec} from './utils.mjs';

export async function findBenchmarkTargets(): Promise<string[]> {
  return (
    await exec('bazel', [
      'query',
      '--output=label',
      `'kind("^web_test", //modules/...) intersect attr("name", "perf", //modules/...)'`,
    ])
  )
    .split(/\r?\n/)
    .filter((t) => t !== '');
}

export async function getTestlogPath(target: string): Promise<string> {
  target = await resolveAndExpandTarget(target);
  return path.join(await bazelTestlogDir(), target.substring(2).replace(':', "/"));
}

async function resolveAndExpandTarget(target: string): Promise<string> {
  return (await exec('bazel', ['query', '--output=label', target])).trim();
}

let testlogDir: string | null = null;
async function bazelTestlogDir(): Promise<string> {
  return testlogDir ?? (testlogDir = (await exec('bazel', ['info', 'bazel-testlogs'])).trim());
}
