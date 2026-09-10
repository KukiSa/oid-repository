import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {repositoryRoot, verifyManifestSignature} from './registry-lib.mjs'

function option(name) {
    const index = process.argv.indexOf(name)
    return index === -1 ? null : process.argv[index + 1]
}

const publicKeyPath = option('--public-key')
const signaturePath = option('--signature') ?? 'public/registry/manifest.sig.json'
if (!publicKeyPath) {
    console.error('Usage: node scripts/verify-manifest.mjs --public-key <trusted-ed25519-public-key.pem> [--signature <signature.json>]')
    process.exit(2)
}

const [manifest, signatureText, publicKey] = await Promise.all([
    readFile(path.join(repositoryRoot, 'public/registry/manifest.json')),
    readFile(path.resolve(signaturePath), 'utf8'),
    readFile(path.resolve(publicKeyPath), 'utf8')
])
const envelope = JSON.parse(signatureText)
if (!verifyManifestSignature(manifest, envelope, publicKey)) {
    console.error('Registry manifest signature verification failed.')
    process.exit(1)
}
console.log(`Registry manifest signature is valid for publication key ${envelope.publicKeySpkiSha256}.`)
