import path from 'node:path'
import {archiveRelease} from '../lib/registry/release.mjs'
import {repositoryRoot} from '../lib/registry/paths.mjs'
import {options, run, trustedPublicKey} from '../lib/registry/cli.mjs'

await run(async () => {
    const args = options(['--from', '--public-key'])
    const directory = path.resolve(args['--from'] ?? path.join(repositoryRoot, 'public/registry'))
    const publicKey = await trustedPublicKey(args)
    const id = await archiveRelease(directory, repositoryRoot, {publicKey})
    console.log(`Sealed immutable release ${id}. Shared artifacts retain their original public URLs.`)
})
