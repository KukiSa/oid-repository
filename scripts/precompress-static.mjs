import path from 'node:path'
import {precompress} from '../lib/deployment/compression.mjs'
import {repositoryRoot} from '../lib/registry/paths.mjs'
import {run} from '../lib/registry/cli.mjs'

await run(async () => {
    const totals = await precompress(path.join(repositoryRoot, 'out'))
    for (const [encoding, stats] of Object.entries(totals)) console.log(`${encoding}: ${stats.files} sidecars, ${stats.originalBytes} -> ${stats.compressedBytes} bytes`)
})
