import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, rm, writeFile, readFile, access, mkdir} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {precompress, verifyCompression, encodings} from '../../lib/deployment/compression.mjs'
import {assertPublicArtifact} from '../../lib/registry/artifacts.mjs'

test('precompression preserves exact signed JSON bytes and rejects broken sidecars', async t => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'oid-compression-test-'))
    t.after(() => rm(directory, {recursive: true, force: true}))
    const original = Buffer.from(JSON.stringify({data: 'registry release information '.repeat(1000)}) + '\n')
    await writeFile(path.join(directory, 'manifest.json'), original)
    await writeFile(path.join(directory, 'tiny.txt'), 'small')
    await precompress(directory)
    assert.deepEqual(await readFile(path.join(directory, 'manifest.json')), original)
    for (const encoding of encodings) {
        const compressed = await readFile(path.join(directory, 'manifest.json' + encoding.suffix))
        assert.ok(compressed.length < original.length)
        assert.deepEqual(await encoding.decompress(compressed), original)
        await assert.rejects(access(path.join(directory, 'tiny.txt' + encoding.suffix)), {code: 'ENOENT'})
    }
    assert.deepEqual(await verifyCompression(directory), [])
    await writeFile(path.join(directory, 'manifest.json.br'), 'broken')
    assert.match((await verifyCompression(directory)).join('\n'), /Invalid compressed sidecar/)
})

test('remote deploy refuses a broad system directory', () => {
    const result = spawnSync('bash', ['scripts/deploy/remote-deploy.sh'], {
        encoding: 'utf8', env: {...process.env, DEPLOY_PATH: '/', REMOTE_ARCHIVE: '/tmp/no-archive'}
    })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Refusing unsafe deploy path/)
})

test('reference deployment uses resolved hosts, ports, users and paths', async t => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'oid-deploy-test-'))
    t.after(() => rm(directory, {recursive: true, force: true}))
    const bin = path.join(directory, 'bin')
    await mkdir(bin)
    const log = path.join(directory, 'calls.jsonl')
    const targets = [
        {name: 'edge-a', host: 'edge-a.example.test', port: '2222', user: 'deployer', path: '/srv/www/oid'},
        {name: 'edge-b', host: '2001:db8::2', port: '22', user: 'web', path: '/srv/www/oid with space'}
    ]
    const targetsFile = path.join(directory, 'targets.json')
    await writeFile(targetsFile, JSON.stringify(targets))
    const stub = `#!${process.execPath}\n` +
        `const fs = require('node:fs'); fs.appendFileSync(process.env.MOCK_CALLS, JSON.stringify({command: require('node:path').basename(process.argv[1]), args: process.argv.slice(2)}) + '\\n');\n` +
        `if (process.argv[1].endsWith('/ssh')) fs.readFileSync(0);\n`
    for (const name of ['scp', 'ssh']) await writeFile(path.join(bin, name), stub, {mode: 0o755})
    const result = spawnSync('bash', ['scripts/deploy/deploy-to-targets.sh'], {
        encoding: 'utf8',
        env: {...process.env, PATH: `${bin}:${process.env.PATH}`, MOCK_CALLS: log, DEPLOY_TARGETS_FILE: targetsFile, REMOTE_ARCHIVE: '/tmp/oid-test.tar.zst', SSH_KEY_FILE: 'test-key', SSH_KNOWN_HOSTS_FILE: 'test-hosts', SITE_ARCHIVE: 'test-site.tar.zst'}
    })
    assert.equal(result.status, 0, result.stderr)
    const calls = (await readFile(log, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
    assert.equal(calls.length, targets.length * 2)
    for (const [index, target] of targets.entries()) {
        assert.equal(calls[index * 2].command, 'scp')
        const host = target.host.includes(':') ? `[${target.host}]` : target.host
        assert.equal(calls[index * 2].args.at(-1), `${target.user}@${host}:/tmp/oid-test.tar.zst`)
        assert.equal(calls[index * 2].args[calls[index * 2].args.indexOf('-P') + 1], target.port)
        assert.equal(calls[index * 2 + 1].command, 'ssh')
        assert.equal(calls[index * 2 + 1].args.at(-2), `${target.user}@${target.host}`)
        assert.equal(calls[index * 2 + 1].args.at(-1), `DEPLOY_PATH=${target.path.replaceAll(' ', '\\ ')} REMOTE_ARCHIVE=/tmp/oid-test.tar.zst bash -se`)
    }
})

test('public PEM exceptions never allow a private-key payload', () => {
    assert.throws(() => assertPublicArtifact('public.pem', Buffer.from('-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----')), /Private material/)
    assert.throws(() => assertPublicArtifact('public.pem', Buffer.from('plain non-PEM text')), /Invalid public PEM/)
})
