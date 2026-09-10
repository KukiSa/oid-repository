import {readFile, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {createManifestSignature, repositoryRoot} from './registry-lib.mjs'

function option(name) {
    const index = process.argv.indexOf(name)
    return index === -1 ? null : process.argv[index + 1]
}

const keyPath = option('--key')
const outputPath = option('--output') ?? 'public/registry/manifest.sig.json'
if (!keyPath) {
    console.error('Usage: node scripts/sign-manifest.mjs --key <offline-ed25519-private-key.pem> [--output <signature.json>]')
    process.exit(2)
}

const manifestPath = path.join(repositoryRoot, 'public/registry/manifest.json')
const manifest = await readFile(manifestPath)
const privateKey = await readFile(path.resolve(keyPath), 'utf8')
const envelope = createManifestSignature(manifest, privateKey)
await writeFile(path.resolve(outputPath), `${JSON.stringify(envelope, null, 2)}\n`, {mode: 0o644})
console.log(`Signed ${path.relative(repositoryRoot, manifestPath)}; publication-key SPKI SHA-256 is ${envelope.publicKeySpkiSha256}.`)
