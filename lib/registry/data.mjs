import {readFile, readdir} from 'node:fs/promises'
import path from 'node:path'
import {repositoryRoot, resolveInside} from './paths.mjs'

export const collections = {
    authorities: 'authorities.json', policies: 'policies.json', delegations: 'delegations.json',
    decisions: 'decisions.json', nodes: 'nodes.json', trustAnchors: 'trust-anchors.json',
    trustAnchorGroups: 'trust-anchor-groups.json', events: 'events.json', release: 'release.json'
}

export function serializeJson(value) {
    return `${JSON.stringify(value, null, 2)}\n`
}

export async function loadRegistry(root = repositoryRoot) {
    const directory = path.join(root, 'registry/data')
    const allowed = new Set(['metadata.json', ...Object.values(collections)])
    for (const filename of await readdir(directory)) {
        if (filename.endsWith('.json') && !allowed.has(filename)) throw new Error(`Unknown registry source: ${filename}`)
    }
    const registry = JSON.parse(await readFile(path.join(directory, 'metadata.json'), 'utf8'))
    if (Object.keys(registry).some(key => !['$schema', 'schemaVersion', 'registry'].includes(key))) {
        throw new Error('metadata.json may only contain $schema, schemaVersion, and registry')
    }
    for (const [key, filename] of Object.entries(collections)) {
        registry[key] = JSON.parse(await readFile(path.join(directory, filename), 'utf8'))
    }
    return registry
}

export function policySourcePath(policy) {
    const relative = `registry/policies/${policy.family}/${policy.revision}/policy.mdx`
    resolveInside(repositoryRoot, relative)
    return relative
}
