import {loadRegistry, validateRegistry} from './registry-lib.mjs'

const registry = await loadRegistry()
const errors = validateRegistry(registry)

if (errors.length) {
    console.error(`Registry validation failed with ${errors.length} error(s):`)
    for (const error of errors) console.error(`- ${error}`)
    process.exitCode = 1
} else {
    console.log(`Registry is valid: ${registry.nodes.length} nodes, ${registry.trustAnchors.length} trust anchors, release ${registry.release.id} (${registry.release.status}).`)
}
