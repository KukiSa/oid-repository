import path from 'node:path'
import {compareOid} from './oid.mjs'

export function renderPages(registry) {
const outputs = new Map()
const nodes = [...registry.nodes].sort((a, b) => compareOid(a.oid, b.oid))
const nodesByParent = Map.groupBy(nodes, node => node.parentOid)
const policies = new Map(registry.policies.map(policy => [policy.id, policy]))
const anchors = new Map(registry.trustAnchors.map(anchor => [anchor.oid, anchor]))
const appPathForRoute = (route, filename = 'page.mdx') => path.join('app', route.replace(/^\//, ''), filename)
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

{/* This file is generated from registry/data/. Do not edit it directly. */}

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

{/* This file is generated from registry/data/. Do not edit it directly. */}

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

function renderIdentifierPage(node) {
    const policy = policies.get(node.allocation.governingPolicyRef)
    return `---
asIndexPage: true
---

{/* This file is generated from registry/data/. Do not edit it directly. */}

# ${node.oid}: ${node.secondaryIdentifier} – ${node.title}

${node.description}

## Identifier Semantics

This identifier records the stable semantics described above. A document revision or CA generation does not redefine the numeric OID.

For the protocol field, issuance requirements and scope, see [${policy.id}](${policy.documentRoute}).

## Registration Metadata

- **Allocation status:** ${node.allocation.status}
- **Registration authority:** ${node.allocation.authorityRef}
- **Decision:** ${node.allocation.decisionRef}
- **Recorded:** ${formatDate(node.allocation.recordedAt)}
- **Governing policy:** [${policy.id}](${policy.documentRoute})

See the [registry dataset](/registry/registry.json) for the complete registration record.
`
}

function renderGroupVersionPage(node) {
    const group = registry.trustAnchorGroups.find(record => record.oid === node.oid)
    const policy = policies.get(node.allocation.governingPolicyRef)
    const members = group.members.map(oid => {
        const member = nodes.find(record => record.oid === oid)
        return `- [${oid} — ${member.title}](${member.route})`
    }).join('\n')
    return `---
asIndexPage: true
---

{/* This file is generated from registry/data/. Do not edit it directly. */}

# ${node.oid}: ${node.title}

${node.description}

## Immutable Group Version

- **Version:** ${group.version}
- **Member count:** ${group.members.length}

${members}

Membership is immutable for this version. A future membership change requires a new contiguous version; this OID must not be reassigned.

## Registration Metadata

- **Allocation status:** ${node.allocation.status}
- **Registration authority:** ${node.allocation.authorityRef}
- **Decision:** ${node.allocation.decisionRef}
- **Recorded:** ${formatDate(node.allocation.recordedAt)}
- **Governing policy:** [${policy.id}](${policy.documentRoute})

The machine-readable membership is available in the [registry dataset](/registry/registry.json).
`
}

function renderMeta(node) {
    const children = (nodesByParent.get(node.oid) ?? []).sort((a, b) => a.arc - b.arc)
    const entries = children.map(child => `    '${child.arc}': '${child.arc} - ${child.secondaryIdentifier}'`)
    return `// This file is generated from registry/data/. Do not edit it directly.\nexport default {\n${entries.join(',\n')}\n};\n`
}

for (const node of nodes) {
    if (node.kind === 'arc' || node.kind === 'trust-anchor-group') {
        outputs.set(appPathForRoute(node.route), renderArcPage(node))
        if ((nodesByParent.get(node.oid) ?? []).length) {
            outputs.set(appPathForRoute(node.route, '_meta.js'), renderMeta(node))
        }
    } else if (node.kind === 'trust-anchor') {
        outputs.set(appPathForRoute(node.route), renderTrustAnchorPage(node))
    } else if (node.kind === 'identifier') {
        outputs.set(appPathForRoute(node.route), renderIdentifierPage(node))
    } else if (node.kind === 'trust-anchor-group-version') {
        outputs.set(appPathForRoute(node.route), renderGroupVersionPage(node))
    }
}

const kindCounts = Object.groupBy(nodes, node => node.kind)
const registryPage = `---
asIndexPage: true
---

{/* This file is generated from registry/data/. Do not edit it directly. */}

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
outputs.set('app/registry/page.mdx', registryPage)

return outputs
}
