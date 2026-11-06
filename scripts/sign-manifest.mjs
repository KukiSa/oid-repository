import {readFile, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {createPublicKey} from 'node:crypto'
import {createManifestSignature} from '../lib/registry/signature.mjs'
import {repositoryRoot} from '../lib/registry/paths.mjs'
import {verifyRelease} from '../lib/registry/release.mjs'
import {options, run} from '../lib/registry/cli.mjs'

await run(async () => {
    const args = options(['--key', '--directory', '--output'])
    if (!args['--key']) throw new Error('Usage: registry:sign --key <offline-private-key.pem> [--directory <release>] [--output <signature.json>]')
    const directory = path.resolve(args['--directory'] ?? path.join(repositoryRoot, 'public/registry'))
    const manifest = await readFile(path.join(directory, 'manifest.json'))
    const metadata = JSON.parse(manifest)
    const privateKey = await readFile(path.resolve(args['--key']))
    const envelope = createManifestSignature(manifest, privateKey)
    if (metadata.schemaVersion === 2 && metadata.signing?.publicKeySpkiSha256 !== envelope.publicKeySpkiSha256) {
        throw new Error('Record the publication key fingerprint and signature path in registry/data/release.json before generating and signing')
    }
    const errors = await verifyRelease(directory, {publicKey: createPublicKey(privateKey), allowUnsignedPreparation: true})
    if (errors.length) throw new Error(errors.join('\n'))
    const output = path.resolve(args['--output'] ?? path.join(directory, 'manifest.sig.json'))
    await writeFile(output, JSON.stringify(envelope, null, 2) + '\n', {mode: 0o644, flag: 'wx'})
    console.log(`Signed manifest with publication key ${envelope.publicKeySpkiSha256}.`)
})
