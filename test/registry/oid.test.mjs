import test from 'node:test'
import assert from 'node:assert/strict'
import {compareOid} from '../../lib/registry/oid.mjs'

test('OID ordering uses numeric arcs without losing integer precision', () => {
    const values = ['1.3.10', '1.3.2', '1.3', '1.3.9007199254740993', '1.3.9007199254740992']
    assert.deepEqual(values.sort(compareOid), ['1.3', '1.3.2', '1.3.10', '1.3.9007199254740992', '1.3.9007199254740993'])
})
