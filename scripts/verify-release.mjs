import path from 'node:path'
import {verifyRelease, verifyArchives} from '../lib/registry/release.mjs'
import {repositoryRoot} from '../lib/registry/paths.mjs'
import {options, run, trustedPublicKey} from '../lib/registry/cli.mjs'

await run(async () => {
    const args = options(['--directory', '--public-key', '--all'])
    const publicKey = await trustedPublicKey(args)
    const directory = path.resolve(args['--directory'] ?? path.join(repositoryRoot, 'public/registry'))
    const errors = await verifyRelease(directory, {publicKey})
    if (args['--all']) errors.push(...await verifyArchives(repositoryRoot, {publicKey}))
    if (errors.length) throw new Error(errors.join('\n'))
    console.log(`Release integrity verified${args['--all'] ? ', including all sealed archives' : ''}.`)
})
