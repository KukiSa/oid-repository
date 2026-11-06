import {createHash, createPrivateKey, createPublicKey, sign, verify} from 'node:crypto'

export function sha256(content) {
    return createHash('sha256').update(content).digest('hex')
}

export function createManifestSignature(manifest, privateKeyPem) {
    const privateKey = privateKeyPem?.type === 'private'
        ? privateKeyPem
        : createPrivateKey(privateKeyPem)
    if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('The registry publication key must be Ed25519')
    const publicKey = createPublicKey(privateKey)
    const publicKeyDer = publicKey.export({type: 'spki', format: 'der'})
    return {
        schemaVersion: 1,
        algorithm: 'Ed25519',
        signedArtifact: 'manifest.json',
        artifactSha256: sha256(manifest),
        publicKeySpkiSha256: sha256(publicKeyDer),
        signatureBase64: sign(null, Buffer.from(manifest), privateKey).toString('base64')
    }
}

export function verifyManifestSignature(manifest, envelope, publicKeyPem) {
    const publicKey = publicKeyPem?.type === 'public'
        ? publicKeyPem
        : createPublicKey(publicKeyPem)
    if (publicKey.asymmetricKeyType !== 'ed25519') return false
    const publicKeyDer = publicKey.export({type: 'spki', format: 'der'})
    if (envelope.algorithm !== 'Ed25519') return false
    if (envelope.signedArtifact !== 'manifest.json') return false
    if (envelope.artifactSha256 !== sha256(manifest)) return false
    if (envelope.publicKeySpkiSha256 !== sha256(publicKeyDer)) return false
    return verify(null, Buffer.from(manifest), publicKey, Buffer.from(envelope.signatureBase64, 'base64'))
}
