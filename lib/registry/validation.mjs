import {readFileSync} from 'node:fs'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

const ajv = new Ajv2020({allErrors: true, strict: true})
addFormats(ajv)
const validateSchema = ajv.compile(JSON.parse(readFileSync(new URL('../../registry/schema/registry.schema.json', import.meta.url))))

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
    if (!validateSchema(data)) return validateSchema.errors.map(error => `${error.instancePath || '/'} ${error.message}`)
    const errors = []
    const requiredCollections = ['authorities', 'policies', 'delegations', 'decisions', 'nodes', 'trustAnchors', 'trustAnchorGroups', 'events']

    if (data.schemaVersion !== '1.1.0') errors.push(`Unsupported schemaVersion: ${data.schemaVersion}`)
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

    if (!nodes.has(data.registry.rootOid)) errors.push('The managed root must be registered')

    for (const [collection, property] of [
        [data.authorities, 'id'], [data.policies, 'id'], [data.delegations, 'id'],
        [data.decisions, 'id'], [data.nodes, 'oid'], [data.trustAnchors, 'oid'],
        [data.trustAnchorGroups, 'oid'], [data.events, 'id']
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
        if (!isDescendantOrSelf(node.oid, data.registry.rootOid)) errors.push(`${node.oid} is outside the managed root`)
        if (!node.route?.endsWith('/')) errors.push(`${node.oid} route must end with /`)
        const suffix = node.oid === data.registry.rootOid ? [] : node.oid.slice(data.registry.rootOid.length + 1).split('.')
        const expectedRoute = `/${[data.registry.rootOid, ...suffix].join('/')}/`
        if (node.route !== expectedRoute) errors.push(`${node.oid} route must be ${expectedRoute}`)
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
        } else if (authorities.get(node.allocation.authorityRef)?.type === 'delegated-registration-authority') {
            errors.push(`${node.oid} requires an explicit delegation reference`)
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

    for (const event of data.events) {
        if (!authorities.has(event.authorityRef)) errors.push(`${event.id} has an unknown authority`)
        if (!decisions.has(event.decisionRef)) errors.push(`${event.id} has an unknown decision`)
    }

    const routes = new Set()
    for (const node of data.nodes) {
        if (routes.has(node.route)) errors.push(`Duplicate route: ${node.route}`)
        routes.add(node.route)
        if (node.route.split('/').some(part => ['.', '..'].includes(part))) errors.push(`Unsafe route: ${node.route}`)
        if (node.kind === 'trust-anchor-group-version' && !data.trustAnchorGroups.some(group => group.oid === node.oid)) errors.push(`${node.oid} lacks group membership`)
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
