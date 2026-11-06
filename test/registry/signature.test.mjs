import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync} from 'node:crypto'
import {createManifestSignature, verifyManifestSignature} from '../../lib/registry/signature.mjs'

test('Ed25519 verification rejects tampered bytes and wrong publication keys', () => {
    const {privateKey, publicKey} = generateKeyPairSync('ed25519')
    const manifest = Buffer.from('{"releaseId":"test"}\n')
    const envelope = createManifestSignature(manifest, privateKey)
    assert.equal(verifyManifestSignature(manifest, envelope, publicKey), true)
    assert.equal(verifyManifestSignature(Buffer.from('{}\n'), envelope, publicKey), false)
    assert.equal(verifyManifestSignature(manifest, envelope, generateKeyPairSync('ed25519').publicKey), false)
})
