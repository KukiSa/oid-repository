import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {loadRegistry} from '../../lib/registry/data.mjs'
import {validateRegistry} from '../../lib/registry/validation.mjs'
import {verifySourceArtifacts} from '../../lib/registry/artifacts.mjs'

test('split sources compose the published dataset and satisfy all checks', async () => {
    const registry = await loadRegistry()
    assert.deepEqual(registry, JSON.parse(await readFile(new URL('../../registry/registry.json', import.meta.url))))
    assert.deepEqual(validateRegistry(registry), [])
    assert.deepEqual(await verifySourceArtifacts(registry), [])
})

test('schema and referential checks reject malformed governance records', async t => {
    const source = await loadRegistry()
    const cases = [
        ['missing required title', data => delete data.nodes[0].title, /title/],
        ['invalid allocation status', data => data.nodes[0].allocation.status = 'available', /allowed values/],
        ['invalid timestamp', data => data.events[0].occurredAt = '2026-99-99', /date-time/],
        ['unknown event decision', data => data.events[0].decisionRef = 'MISSING', /unknown decision/],
        ['unknown event authority', data => data.events[0].authorityRef = 'MISSING', /unknown authority/],
        ['missing SPKI digest', data => delete data.trustAnchors.find(anchor => anchor.bindingStatus === 'verified').publicKey.digest, /digest/],
        ['missing delegation', data => delete data.nodes.find(node => node.allocation.delegationRef).allocation.delegationRef, /delegation reference/],
        ['duplicate group', data => data.trustAnchorGroups.push(data.trustAnchorGroups[0]), /Duplicate oid/],
        ['unsafe route', data => data.nodes[0].route = '/..\/outside/', /route/]
    ]
    for (const [label, mutate, message] of cases) await t.test(label, () => {
        const registry = structuredClone(source)
        mutate(registry)
        assert.match(validateRegistry(registry).join('\n'), message)
    })
})
