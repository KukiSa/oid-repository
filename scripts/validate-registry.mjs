import {loadRegistry} from '../lib/registry/data.mjs'
import {validateRegistry} from '../lib/registry/validation.mjs'
import {verifySourceArtifacts} from '../lib/registry/artifacts.mjs'
import {run} from '../lib/registry/cli.mjs'

await run(async () => {
    const registry = await loadRegistry()
    const errors = validateRegistry(registry)
    if (!errors.length) errors.push(...await verifySourceArtifacts(registry))
    if (errors.length) throw new Error(errors.join('\n'))
    console.log(`Registry is valid: ${registry.nodes.length} nodes, ${registry.trustAnchors.length} trust anchors, release ${registry.release.id} (${registry.release.status}).`)
})
