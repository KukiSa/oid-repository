import path from 'node:path'
import {repositoryRoot} from '../lib/registry/paths.mjs'
import {verifyRelease} from '../lib/registry/release.mjs'
import {options, run, trustedPublicKey} from '../lib/registry/cli.mjs'

await run(async () => {
    const args = options(['--public-key', '--directory', '--signature'])
    const publicKey = await trustedPublicKey(args)
    if (!publicKey) throw new Error('Usage: registry:verify-signature --public-key <trusted-public-key.pem> [--directory <release>] [--signature <signature.json>]')
    const directory = path.resolve(args['--directory'] ?? path.join(repositoryRoot, 'public/registry'))
    const signatureFile = args['--signature'] ? path.resolve(args['--signature']) : undefined
    const errors = await verifyRelease(directory, {publicKey, requireSignature: true, signatureFile})
    if (errors.length) throw new Error(errors.join('\n'))
    console.log('Manifest signature and every release artifact are valid.')
})
