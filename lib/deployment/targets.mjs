import net from 'node:net';
import path from 'node:path';

export const UNSAFE_DEPLOY_PATHS = new Set([
  '',
  '/',
  '/.',
  '/..',
  '/bin',
  '/boot',
  '/dev',
  '/etc',
  '/home',
  '/lib',
  '/lib64',
  '/opt',
  '/proc',
  '/root',
  '/run',
  '/sbin',
  '/srv',
  '/sys',
  '/tmp',
  '/usr',
  '/var',
]);

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function requiredText(value, label, index) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (!text) {
    throw new Error(
      `Deploy target #${index + 1} is missing required field: ${label}`,
    );
  }
  return text;
}

export function normalizeDeployTarget(target, index) {
  if (!target || typeof target !== 'object' || Array.isArray(target)) {
    throw new Error(`Deploy target #${index + 1} must be an object`);
  }

  const host = requiredText(target.host, 'host', index);
  const port = String(target.port ?? target.ssh_port ?? '22').trim();
  const user = requiredText(target.user ?? target.ssh_user, 'user', index);
  const rawPath = requiredText(target.path ?? target.deploy_path, 'path', index);
  const name = String(target.name ?? `target-${index + 1}`).trim();

  if (!/^[0-9]+$/.test(port)) {
    throw new Error(`Invalid SSH port for deploy target #${index + 1}: ${port}`);
  }
  const portNumber = Number(port);
  if (
    !Number.isSafeInteger(portNumber)
    || portNumber < 1
    || portNumber > 65_535
  ) {
    throw new Error(
      `SSH port is outside 1-65535 for deploy target #${index + 1}: ${port}`,
    );
  }
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    throw new Error(
      `Invalid deploy target name for target #${index + 1}: ${name}`,
    );
  }
  if (
    net.isIP(host) === 0
    && (
      !/^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(host)
      || host.includes('..')
    )
  ) {
    throw new Error(
      `Invalid IP address or DNS host for deploy target #${index + 1}: ${host}`,
    );
  }
  if (!/^[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(user)) {
    throw new Error(
      `Invalid SSH user for deploy target #${index + 1}: ${user}`,
    );
  }
  if (/[\0\r\n\t]/.test(rawPath) || !rawPath.startsWith('/')) {
    throw new Error(
      `Deploy path must be a clean absolute path for target #${index + 1}: ${rawPath}`,
    );
  }

  const deployPath = path.posix.normalize(rawPath).replace(/\/+$/, '') || '/';
  const comparableRawPath = rawPath.replace(/\/+$/, '') || '/';
  if (deployPath !== comparableRawPath) {
    throw new Error(
      `Deploy path must not contain repeated, dot, or parent segments for target #${index + 1}: ${rawPath}`,
    );
  }
  if (UNSAFE_DEPLOY_PATHS.has(deployPath)) {
    throw new Error(
      `Refusing unsafe deploy path for deploy target #${index + 1}: ${deployPath}`,
    );
  }

  return {
    name,
    host,
    port: String(portNumber),
    user,
    path: deployPath,
  };
}

export function resolveDeployTargets(environment) {
  const targetsJson = firstNonEmpty(
    environment.INPUT_DEPLOY_TARGETS,
    environment.VAR_DEPLOY_TARGETS,
    environment.SECRET_DEPLOY_TARGETS,
  );
  let targets;

  if (targetsJson) {
    let parsed;
    try {
      parsed = JSON.parse(targetsJson);
    } catch (error) {
      throw new Error(`Invalid LINUX_DEPLOY_TARGETS JSON: ${error.message}`);
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('LINUX_DEPLOY_TARGETS must be a non-empty JSON array');
    }
    targets = parsed.map(normalizeDeployTarget);
  } else {
    const singleTarget = {
      name: 'default',
      host: firstNonEmpty(
        environment.INPUT_DEPLOY_HOST,
        environment.VAR_DEPLOY_HOST,
        environment.SECRET_DEPLOY_HOST,
      ),
      port: firstNonEmpty(
        environment.INPUT_DEPLOY_PORT,
        environment.VAR_DEPLOY_PORT,
        environment.SECRET_DEPLOY_PORT,
        '22',
      ),
      user: firstNonEmpty(
        environment.INPUT_DEPLOY_USER,
        environment.VAR_DEPLOY_USER,
        environment.SECRET_DEPLOY_USER,
      ),
      path: firstNonEmpty(
        environment.INPUT_DEPLOY_PATH,
        environment.VAR_DEPLOY_PATH,
        environment.SECRET_DEPLOY_PATH,
      ),
    };
    targets = [normalizeDeployTarget(singleTarget, 0)];
  }

  const names = new Set();
  for (const target of targets) {
    if (names.has(target.name)) {
      throw new Error(`Duplicate deploy target name: ${target.name}`);
    }
    names.add(target.name);
  }
  return targets;
}
