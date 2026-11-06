import test from 'node:test'
import assert from 'node:assert/strict'
import {appendFile, readFile, writeFile, mkdir} from 'node:fs/promises'
import path from 'node:path'
import {generateKeyPairSync} from 'node:crypto'
import {archiveRelease, verifyRelease, verifyArchives, buildReleaseFiles} from '../../lib/registry/release.mjs'
import {loadRegistry, serializeJson} from '../../lib/registry/data.mjs'
import {createManifestSignature, sha256} from '../../lib/registry/signature.mjs'
import {fixture} from '../helpers/fixture.mjs'

test('release seals documents and shared artifacts and refuses overwrite', async t => {
    const {root, directory, publicRoot} = await fixture(t)
    assert.deepEqual(await verifyRelease(directory, {publicRoot}), [])
    const id = await archiveRelease(directory, root)
    assert.deepEqual(await verifyArchives(root), [])
    await assert.rejects(archiveRelease(directory, root), /Refusing to overwrite/)
    const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json')))
    assert.ok(manifest.artifacts.some(item => item.path.endsWith('policy.mdx')))
    assert.ok(manifest.artifacts.some(item => item.path.includes('instruments/')))
    assert.ok(manifest.artifacts.some(item => item.path.endsWith('.crl')))
    await appendFile(path.join(publicRoot, 'artifacts/g6/20261015/server-root-ec384-01.spki.der'), 'tampered')
    assert.match((await verifyArchives(root)).join('\n'), /digest\/size mismatch/)
    const archived = path.join(publicRoot, 'registry/releases', id, 'registry.csv')
    await appendFile(archived, 'tampered')
    assert.match((await verifyArchives(root)).join('\n'), /registry.csv/)
})

test('manifest cannot escape its release directory or silently drop policies', async t => {
    const {directory, publicRoot} = await fixture(t)
    const filename = path.join(directory, 'manifest.json')
    const manifest = JSON.parse(await readFile(filename))
    manifest.artifacts.push({path: '../outside', scope: 'package', sha256: '0'.repeat(64), bytes: 0})
    manifest.artifacts = manifest.artifacts.filter(item => !item.path.endsWith('/policy.mdx'))
    await writeFile(filename, serializeJson(manifest))
    const errors = (await verifyRelease(directory, {publicRoot})).join('\n')
    assert.match(errors, /Unsafe relative path/)
    assert.match(errors, /Missing policy document/)
})

test('valid signatures do not conceal tampered release documents', async t => {
    const {root, directory, publicRoot} = await fixture(t)
    const registry = await loadRegistry(root)
    const {privateKey, publicKey} = generateKeyPairSync('ed25519')
    registry.release.status = 'authoritative'
    registry.release.signature = {algorithm: 'Ed25519', publicKeySpkiSha256: sha256(publicKey.export({type: 'spki', format: 'der'})), signaturePath: 'manifest.sig.json'}
    for (const [name, bytes] of await buildReleaseFiles(registry, root)) {
        await mkdir(path.dirname(path.join(directory, name)), {recursive: true})
        await writeFile(path.join(directory, name), bytes)
    }
    const manifest = await readFile(path.join(directory, 'manifest.json'))
    await writeFile(path.join(directory, 'manifest.sig.json'), serializeJson(createManifestSignature(manifest, privateKey)))
    assert.deepEqual(await verifyRelease(directory, {publicRoot, publicKey, requireSignature: true}), [])
    assert.match((await verifyRelease(directory, {publicRoot})).join('\n'), /trusted public key/)
    const document = JSON.parse(manifest).artifacts.find(item => item.path.endsWith('/policy.mdx'))
    await appendFile(path.join(directory, document.path), 'tampered')
    assert.match((await verifyRelease(directory, {publicRoot, publicKey})).join('\n'), /digest\/size mismatch/)
})
