import { appendFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { resolveDeployTargets } from '../../lib/deployment/targets.mjs';

const targets = resolveDeployTargets(process.env);
const targetsFile = path.join(
  process.env.RUNNER_TEMP ?? '.',
  'deploy-targets.json',
);
const remoteArchive =
  `/tmp/oid-repository-${process.env.GITHUB_RUN_ID ?? 'local'}-`
  + `${process.env.GITHUB_RUN_ATTEMPT ?? '1'}.tar.zst`;

await writeFile(targetsFile, `${JSON.stringify(targets, null, 2)}\n`);
if (!process.env.GITHUB_ENV) {
  throw new Error('GITHUB_ENV is required when resolving deployment targets');
}
await appendFile(
  process.env.GITHUB_ENV,
  [
    `DEPLOY_TARGETS_FILE=${targetsFile}`,
    `DEPLOY_TARGET_COUNT=${targets.length}`,
    `DEPLOY_TARGET_NAMES=${targets.map((target) => target.name).join(',')}`,
    `REMOTE_ARCHIVE=${remoteArchive}`,
    '',
  ].join('\n'),
);
