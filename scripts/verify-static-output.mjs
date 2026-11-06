import path from 'node:path'
import {loadRegistry} from '../lib/registry/data.mjs'
import {verifyRelease, verifyArchives} from '../lib/registry/release.mjs'
import {verifyCompression} from '../lib/deployment/compression.mjs'
import {repositoryRoot, readRegularFile} from '../lib/registry/paths.mjs'
import {run, trustedPublicKey} from '../lib/registry/cli.mjs'

await run(async () => {
    const directory = path.join(repositoryRoot, 'out')
    const registry = await loadRegistry()
    const publicKey = await trustedPublicKey({})
    const errors = await verifyRelease(path.join(directory, 'registry'), {publicRoot: directory, publicKey})
    errors.push(...await verifyCompression(directory))
    for (const route of ['/', '/registry/', '/privacy-policy/', ...registry.nodes.map(node => node.route), ...registry.policies.filter(policy => policy.documentRoute).map(policy => policy.documentRoute)]) {
        try { await readRegularFile(directory, `${route.slice(1)}index.html`) }
        catch (error) { errors.push(`Missing exported route ${route}: ${error.message}`) }
    }
    for (const filename of ['404.html', '_pagefind/pagefind.js']) {
        try { await readRegularFile(directory, filename) } catch (error) { errors.push(error.message) }
    }
    // Verify archived packages against the actual exported byte store.
    const archiveErrors = await verifyArchives(repositoryRoot, {publicKey, publicRoot: directory})
    errors.push(...archiveErrors)
    if (errors.length) throw new Error(errors.join('\n'))
    console.log('Static routes, release artifacts and lossless precompressed sidecars verified.')
})
