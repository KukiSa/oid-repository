import path from 'node:path'
import {generateRegistry} from '../lib/registry/generate.mjs'
import {verifyRelease} from '../lib/registry/release.mjs'
import {repositoryRoot} from '../lib/registry/paths.mjs'
import {options, run, trustedPublicKey} from '../lib/registry/cli.mjs'

await run(async () => {
    const args = options(['--public-key'])
    const result = await generateRegistry()
    const publicKey = await trustedPublicKey(args)
    const errors = await verifyRelease(path.join(repositoryRoot, 'public/registry'), {publicKey})
    if (errors.length) throw new Error(errors.join('\n'))
    console.log(`Prepared local release ${result.registry.release.id}; use registry:archive to seal it. No deployment performed.`)
})
