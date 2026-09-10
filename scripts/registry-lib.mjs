import {createHash, createPrivateKey, createPublicKey, sign, verify} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import path from 'node:path'

export const repositoryRoot = path.resolve(import.meta.dirname, '..')
export const registryPath = path.join(repositoryRoot, 'registry/registry.json')

export async function loadRegistry() {
    return JSON.parse(await readFile(registryPath, 'utf8'))
}

export function compareOid(left, right) {
    const a = left.split('.').map(BigInt)
    const b = right.split('.').map(BigInt)
    for (let index = 0; index < Math.max(a.length, b.length); index++) {
        if (a[index] === undefined) return -1
        if (b[index] === undefined) return 1
        if (a[index] < b[index]) return -1
        if (a[index] > b[index]) return 1
    }
    return 0
}

export function sha256(content) {
    return createHash('sha256').update(content).digest('hex')
}

export function createManifestSignature(manifest, privateKeyPem) {
    const privateKey = privateKeyPem?.type === 'private'
        ? privateKeyPem
        : createPrivateKey(privateKeyPem)
    if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('The registry publication key must be Ed25519')
    const publicKey = createPublicKey(privateKey)
    const publicKeyDer = publicKey.export({type: 'spki', format: 'der'})
    return {
        schemaVersion: 1,
        algorithm: 'Ed25519',
        signedArtifact: 'manifest.json',
        artifactSha256: sha256(manifest),
        publicKeySpkiSha256: sha256(publicKeyDer),
        signatureBase64: sign(null, Buffer.from(manifest), privateKey).toString('base64')
    }
}

export function verifyManifestSignature(manifest, envelope, publicKeyPem) {
    const publicKey = publicKeyPem?.type === 'public'
        ? publicKeyPem
        : createPublicKey(publicKeyPem)
    if (publicKey.asymmetricKeyType !== 'ed25519') return false
    const publicKeyDer = publicKey.export({type: 'spki', format: 'der'})
    if (envelope.algorithm !== 'Ed25519') return false
    if (envelope.signedArtifact !== 'manifest.json') return false
    if (envelope.artifactSha256 !== sha256(manifest)) return false
    if (envelope.publicKeySpkiSha256 !== sha256(publicKeyDer)) return false
    return verify(null, Buffer.from(manifest), publicKey, Buffer.from(envelope.signatureBase64, 'base64'))
}

function duplicateValues(records, property) {
    const seen = new Set()
    const duplicates = new Set()
    for (const record of records) {
        const value = record[property]
        if (seen.has(value)) duplicates.add(value)
        seen.add(value)
    }
    return [...duplicates]
}

function isOid(value) {
    return typeof value === 'string' && /^(0|[1-9][0-9]*)(\.(0|[1-9][0-9]*))+$/.test(value)
}

function isDescendantOrSelf(oid, arc) {
    return oid === arc || oid.startsWith(`${arc}.`)
}

export function validateRegistry(data) {
    const errors = []
    const requiredCollections = ['authorities', 'policies', 'delegations', 'decisions', 'nodes', 'trustAnchors', 'trustAnchorGroups', 'events']

    if (data.schemaVersion !== '1.0.0') errors.push(`Unsupported schemaVersion: ${data.schemaVersion}`)
    if (!data.registry || !isOid(data.registry.rootOid)) errors.push('registry.rootOid must be a valid OID')
    for (const collection of requiredCollections) {
        if (!Array.isArray(data[collection])) errors.push(`${collection} must be an array`)
    }
    if (errors.length) return errors

    const authorities = new Map(data.authorities.map(record => [record.id, record]))
    const policies = new Map(data.policies.map(record => [record.id, record]))
    const delegations = new Map(data.delegations.map(record => [record.id, record]))
    const decisions = new Map(data.decisions.map(record => [record.id, record]))
    const nodes = new Map(data.nodes.map(record => [record.oid, record]))
    const trustAnchors = new Map(data.trustAnchors.map(record => [record.oid, record]))

    for (const [collection, property] of [
        [data.authorities, 'id'], [data.policies, 'id'], [data.delegations, 'id'],
        [data.decisions, 'id'], [data.nodes, 'oid'], [data.trustAnchors, 'oid'], [data.events, 'id']
    ]) {
        for (const duplicate of duplicateValues(collection, property)) errors.push(`Duplicate ${property}: ${duplicate}`)
    }

    if (!policies.has(data.registry.governingPolicyRef)) {
        errors.push(`Unknown registry governing policy: ${data.registry.governingPolicyRef}`)
    }

    for (const policy of data.policies) {
        if (!policy.id || !policy.family || !policy.revision || !policy.status) errors.push(`Incomplete policy: ${policy.id ?? '<unknown>'}`)
        if (policy.supersedes && !policies.has(policy.supersedes)) errors.push(`${policy.id} supersedes unknown policy ${policy.supersedes}`)
        if (policy.supersededBy && !policies.has(policy.supersededBy)) errors.push(`${policy.id} is superseded by unknown policy ${policy.supersededBy}`)
    }

    for (const delegation of data.delegations) {
        if (!isOid(delegation.arc)) errors.push(`${delegation.id} has an invalid arc`)
        if (!authorities.has(delegation.delegatorRef)) errors.push(`${delegation.id} has an unknown delegator`)
        if (!authorities.has(delegation.delegateRef)) errors.push(`${delegation.id} has an unknown delegate`)
        if (!policies.has(delegation.governingPolicyRef)) errors.push(`${delegation.id} has an unknown governing policy`)
        if (!decisions.has(delegation.decisionRef)) errors.push(`${delegation.id} has an unknown registration decision`)
    }

    for (const decision of data.decisions) {
        if (!authorities.has(decision.authorityRef)) errors.push(`${decision.id} has an unknown authority`)
        if (decision.policyRef && !policies.has(decision.policyRef)) errors.push(`${decision.id} has an unknown policy`)
        for (const approval of decision.approvals ?? []) {
            if (!authorities.has(approval.authorityRef)) errors.push(`${decision.id} has approval from unknown authority ${approval.authorityRef}`)
        }
        if (decision.status === 'approved' && !(decision.approvals?.length)) errors.push(`${decision.id} is approved without an approval record`)
        const allocatesTrustData = decision.type === 'allocation' && decision.affectedOids.some(oid =>
            oid.startsWith(`${data.registry.rootOid}.2.2.`) || oid.startsWith(`${data.registry.rootOid}.2.5`)
        )
        if (['policy-adoption', 'delegation-ratification'].includes(decision.type) || allocatesTrustData) {
            const distinctAuthorities = new Set((decision.approvals ?? []).map(approval => approval.authorityRef))
            if (distinctAuthorities.size < 2 && !decision.reviewException) errors.push(`${decision.id} requires two authority roles or a recorded exception`)
        }
        for (const oid of decision.affectedOids ?? []) {
            if (!isOid(oid)) errors.push(`${decision.id} contains invalid OID ${oid}`)
        }
    }

    for (const node of data.nodes) {
        if (!isOid(node.oid)) errors.push(`Invalid node OID: ${node.oid}`)
        if (!isOid(node.parentOid)) errors.push(`${node.oid} has an invalid parent OID`)
        const components = node.oid.split('.')
        if (Number(components.at(-1)) !== node.arc) errors.push(`${node.oid} arc does not match its last component`)
        if (node.oid !== data.registry.rootOid) {
            const expectedParent = components.slice(0, -1).join('.')
            if (node.parentOid !== expectedParent) errors.push(`${node.oid} parent should be ${expectedParent}`)
            const parent = nodes.get(node.parentOid)
            if (!parent) errors.push(`${node.oid} has an unregistered parent ${node.parentOid}`)
            else if (parent.kind !== 'arc' && parent.kind !== 'trust-anchor-group') errors.push(`${node.oid} has non-container parent ${node.parentOid}`)
        }
        if (!node.oid.startsWith(data.registry.rootOid)) errors.push(`${node.oid} is outside the managed root`)
        if (!node.route?.endsWith('/')) errors.push(`${node.oid} route must end with /`)
        if (!authorities.has(node.allocation?.authorityRef)) errors.push(`${node.oid} has an unknown allocation authority`)
        if (!decisions.has(node.allocation?.decisionRef)) errors.push(`${node.oid} has an unknown decision`)
        if (!policies.has(node.allocation?.governingPolicyRef)) errors.push(`${node.oid} has an unknown governing policy`)
        const decision = decisions.get(node.allocation?.decisionRef)
        if (decision && !decision.affectedOids.includes(node.oid)) errors.push(`${node.oid} is not covered by decision ${decision.id}`)

        if (node.allocation?.delegationRef) {
            const delegation = delegations.get(node.allocation.delegationRef)
            if (!delegation) errors.push(`${node.oid} has an unknown delegation`)
            else {
                if (delegation.status !== 'active') errors.push(`${node.oid} relies on inactive delegation ${delegation.id}`)
                if (delegation.delegateRef !== node.allocation.authorityRef) errors.push(`${node.oid} authority does not match ${delegation.id}`)
                if (!isDescendantOrSelf(node.oid, delegation.arc)) errors.push(`${node.oid} is outside delegation ${delegation.id}`)
            }
        }

        if (node.kind === 'trust-anchor' && !trustAnchors.has(node.oid)) errors.push(`${node.oid} lacks a trust-anchor binding`)
        if (node.kind !== 'trust-anchor' && trustAnchors.has(node.oid)) errors.push(`${node.oid} has an unexpected trust-anchor binding`)
    }

    for (const anchor of data.trustAnchors) {
        const node = nodes.get(anchor.oid)
        if (!node || node.kind !== 'trust-anchor') errors.push(`${anchor.oid} is not a trust-anchor node`)
        if (anchor.bindingStatus === 'verified' && (!anchor.publicKey || !anchor.keyIdentifier)) {
            errors.push(`${anchor.oid} is verified without a public key and key identifier`)
        }
        if (anchor.lifecycle?.operationalStatus === 'active' && anchor.bindingStatus !== 'verified') {
            errors.push(`${anchor.oid} cannot be active before its cryptographic binding is verified`)
        }
        if (anchor.lifecycle?.supersededBy && !trustAnchors.has(anchor.lifecycle.supersededBy)) {
            errors.push(`${anchor.oid} is superseded by an unknown trust anchor`)
        }
    }

    const groupsByParent = new Map()
    for (const group of data.trustAnchorGroups) {
        const node = nodes.get(group.oid)
        if (!node || node.kind !== 'trust-anchor-group-version') errors.push(`${group.oid} is not a trust-anchor-group-version node`)
        for (const member of group.members) {
            if (!trustAnchors.has(member)) errors.push(`${group.oid} contains unknown trust anchor ${member}`)
        }
        const parentOid = group.oid.split('.').slice(0, -1).join('.')
        const versions = groupsByParent.get(parentOid) ?? []
        versions.push(group.version)
        groupsByParent.set(parentOid, versions)
        if (Number(group.oid.split('.').at(-1)) !== group.version) errors.push(`${group.oid} version does not match its last component`)
    }
    for (const [parentOid, versions] of groupsByParent) {
        const sorted = [...versions].sort((a, b) => a - b)
        for (let index = 0; index < sorted.length; index++) {
            if (sorted[index] !== index) errors.push(`${parentOid} group versions must be contiguous from 0`)
        }
    }

    if (data.release.status === 'authoritative' && data.release.signingRequiredForAuthoritativeRelease && !data.release.signature) {
        errors.push(`Authoritative release ${data.release.id} has no signature metadata`)
    }

    return errors
}
