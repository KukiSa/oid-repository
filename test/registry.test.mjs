import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync} from 'node:crypto'
import {compareOid, createManifestSignature, loadRegistry, validateRegistry, verifyManifestSignature} from '../scripts/registry-lib.mjs'

test('registry satisfies structural and semantic invariants', async () => {
    const registry = await loadRegistry()
    assert.deepEqual(validateRegistry(registry), [])
})

test('OID comparison is numeric rather than lexical', () => {
    const values = ['1.3.6.1.4.1.65553.2.2.10', '1.3.6.1.4.1.65553.2.2.2']
    assert.deepEqual(values.sort(compareOid), ['1.3.6.1.4.1.65553.2.2.2', '1.3.6.1.4.1.65553.2.2.10'])
})

test('every active trust anchor has a verified cryptographic binding', async () => {
    const registry = await loadRegistry()
    for (const anchor of registry.trustAnchors.filter(item => item.lifecycle.operationalStatus === 'active')) {
        assert.equal(anchor.bindingStatus, 'verified')
        assert.ok(anchor.publicKey)
        assert.ok(anchor.keyIdentifier)
    }
})

test('release manifests can be signed and verified with Ed25519', () => {
    const {privateKey, publicKey} = generateKeyPairSync('ed25519')
    const manifest = Buffer.from('{"releaseId":"test"}\n')
    const envelope = createManifestSignature(manifest, privateKey)
    assert.equal(verifyManifestSignature(manifest, envelope, publicKey), true)
    assert.equal(verifyManifestSignature(Buffer.from('{"releaseId":"tampered"}\n'), envelope, publicKey), false)
})
