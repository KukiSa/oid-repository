import {mkdir, readFile, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {compareOid, loadRegistry, repositoryRoot, sha256, validateRegistry} from './registry-lib.mjs'

const checkOnly = process.argv.includes('--check')
const registry = await loadRegistry()
const validationErrors = validateRegistry(registry)
if (validationErrors.length) {
    for (const error of validationErrors) console.error(`- ${error}`)
    process.exit(1)
}

const outputs = new Map()
const nodes = [...registry.nodes].sort((a, b) => compareOid(a.oid, b.oid))
const nodesByParent = Map.groupBy(nodes, node => node.parentOid)
const policies = new Map(registry.policies.map(policy => [policy.id, policy]))
const anchors = new Map(registry.trustAnchors.map(anchor => [anchor.oid, anchor]))

function appPathForRoute(route, filename = 'page.mdx') {
    return path.join(repositoryRoot, 'app', route.replace(/^\//, ''), filename)
}

function formatDate(value) {
    return value ? value.slice(0, 10) : 'Unknown (legacy import)'
}

function allocationLink(node) {
    return `[${node.oid} — ${node.secondaryIdentifier}](${node.route})`
}

function renderArcPage(node) {
    const children = (nodesByParent.get(node.oid) ?? []).sort((a, b) => a.arc - b.arc)
    const policy = policies.get(node.allocation.governingPolicyRef)
    const childLines = children.length
        ? children.map(child => `- ${allocationLink(child)} — ${child.description}`).join('\n')
        : 'There are currently no allocations under this arc.'
    return `---
asIndexPage: true
---

{/* This file is generated from registry/registry.json. Do not edit it directly. */}

# ${node.oid}: ${node.secondaryIdentifier} – ${node.title}

${node.description}

## Allocations

${childLines}

## Registration Metadata

- **Allocation status:** ${node.allocation.status}
- **Registration authority:** ${node.allocation.authorityRef}
- **Decision:** ${node.allocation.decisionRef}
- **Recorded:** ${formatDate(node.allocation.recordedAt)}
- **Governing policy:** ${policy?.documentRoute ? `[${policy.id}](${policy.documentRoute})` : policy?.id ?? node.allocation.governingPolicyRef}

The machine-readable record is available in the [registry dataset](/registry/registry.json).
`
}

function renderTrustAnchorPage(node) {
    const anchor = anchors.get(node.oid)
    const policy = policies.get(node.allocation.governingPolicyRef)
    const binding = anchor.bindingStatus === 'verified'
        ? `- **SPKI digest:** \`${anchor.publicKey.digest.algorithm}:${anchor.publicKey.digest.value}\`\n- **Key identifier:** \`${anchor.keyIdentifier.value}\``
        : '- **Cryptographic binding:** Not yet recorded. This legacy entry must not be treated as verified from its subject name alone.'
    return `---
asIndexPage: true
---

{/* This file is generated from registry/registry.json. Do not edit it directly. */}

# ${node.oid}: ${node.secondaryIdentifier}

## Trust Anchor

- **Display name:** ${node.title}
- **Subject:** \`${anchor.subjectRfc4514}\`
- **Binding status:** \`${anchor.bindingStatus}\`
- **Operational status:** \`${anchor.lifecycle.operationalStatus}\`
${binding}

The subject name is descriptive metadata, not a unique cryptographic identity. A record becomes active only after its SubjectPublicKeyInfo and key identifier have been independently verified.

## Registration Metadata

- **OID allocation status:** ${node.allocation.status}
- **Registration authority:** ${node.allocation.authorityRef}
- **Decision:** ${node.allocation.decisionRef}
- **Recorded:** ${formatDate(node.allocation.recordedAt)}
- **Governing policy:** [${policy.id}](${policy.documentRoute})

See the [machine-readable record](/registry/registry.json) for the complete binding and lifecycle fields.
`
}

function renderMeta(node) {
    const children = (nodesByParent.get(node.oid) ?? []).sort((a, b) => a.arc - b.arc)
    const entries = children.map(child => `    '${child.arc}': '${child.arc} - ${child.secondaryIdentifier}'`)
    return `// This file is generated from registry/registry.json. Do not edit it directly.\nexport default {\n${entries.join(',\n')}\n};\n`
}

for (const node of nodes) {
    if (node.kind === 'arc') {
        outputs.set(appPathForRoute(node.route), renderArcPage(node))
        if ((nodesByParent.get(node.oid) ?? []).length) {
            outputs.set(appPathForRoute(node.route, '_meta.js'), renderMeta(node))
        }
    } else if (node.kind === 'trust-anchor') {
        outputs.set(appPathForRoute(node.route), renderTrustAnchorPage(node))
    }
}

const publicRegistry = `${JSON.stringify(registry, null, 2)}\n`
const csvColumns = ['oid', 'parent_oid', 'arc', 'kind', 'secondary_identifier', 'allocation_status', 'authority', 'decision', 'governing_policy', 'route']
const csvEscape = value => `"${String(value ?? '').replaceAll('"', '""')}"`
const csvRows = nodes.map(node => [
    node.oid, node.parentOid, node.arc, node.kind, node.secondaryIdentifier, node.allocation.status,
    node.allocation.authorityRef, node.allocation.decisionRef, node.allocation.governingPolicyRef, node.route
].map(csvEscape).join(','))
const publicCsv = `${csvColumns.join(',')}\n${csvRows.join('\n')}\n`
const schema = await readFile(path.join(repositoryRoot, 'registry/schema/registry.schema.json'), 'utf8')

outputs.set(path.join(repositoryRoot, 'public/registry/registry.json'), publicRegistry)
outputs.set(path.join(repositoryRoot, 'public/registry/registry.csv'), publicCsv)
outputs.set(path.join(repositoryRoot, 'public/registry/schema/registry.schema.json'), schema)

const artifacts = [
    ['registry.json', publicRegistry],
    ['registry.csv', publicCsv],
    ['schema/registry.schema.json', schema]
].map(([artifactPath, content]) => ({path: artifactPath, sha256: sha256(content), bytes: Buffer.byteLength(content)}))
const manifest = {
    schemaVersion: 1,
    releaseId: registry.release.id,
    releaseStatus: registry.release.status,
    publishedAt: registry.release.publishedAt,
    signatureRequiredForAuthoritativeRelease: registry.release.signingRequiredForAuthoritativeRelease,
    artifacts
}
outputs.set(path.join(repositoryRoot, 'public/registry/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

const kindCounts = Object.groupBy(nodes, node => node.kind)
const registryPage = `---
asIndexPage: true
---

{/* This file is generated from registry/registry.json. Do not edit it directly. */}

# Registry Data

The structured registry is the authoritative source for allocation, delegation, decision, binding, lifecycle, and release metadata. Human-readable OID pages are generated from the same dataset.

## Current Candidate Release

- **Release:** \`${registry.release.id}\`
- **Status:** \`${registry.release.status}\`
- **OID nodes:** ${nodes.length}
- **Trust anchors:** ${(kindCounts['trust-anchor'] ?? []).length}
- **Verified trust-anchor bindings:** ${registry.trustAnchors.filter(anchor => anchor.bindingStatus === 'verified').length}

A candidate release is not an authoritative signed release. It becomes authoritative only after the Registration Authority verifies its manifest and records signature metadata.

## Downloads

- [Registry JSON](/registry/registry.json)
- [Registry CSV](/registry/registry.csv)
- [JSON Schema](/registry/schema/registry.schema.json)
- [Release manifest](/registry/manifest.json)

See the [governance policy](/1.3.6.1.4.1.65553/0/) for allocation and publication rules.
`
outputs.set(path.join(repositoryRoot, 'app/registry/page.mdx'), registryPage)

const changed = []
for (const [filename, expected] of outputs) {
    let actual = null
    try {
        actual = await readFile(filename, 'utf8')
    } catch (error) {
        if (error.code !== 'ENOENT') throw error
    }
    if (actual === expected) continue
    changed.push(path.relative(repositoryRoot, filename))
    if (!checkOnly) {
        await mkdir(path.dirname(filename), {recursive: true})
        await writeFile(filename, expected)
    }
}

if (checkOnly && changed.length) {
    console.error('Generated registry files are stale:')
    for (const filename of changed) console.error(`- ${filename}`)
    console.error('Run: pnpm registry:generate')
    process.exitCode = 1
} else if (checkOnly) {
    console.log(`Generated registry files are current (${outputs.size} files).`)
} else {
    console.log(`Generated ${outputs.size} registry files; ${changed.length} changed.`)
}
