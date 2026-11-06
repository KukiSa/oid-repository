import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile, writeFile, access, mkdir} from 'node:fs/promises'
import path from 'node:path'
import {generateRegistry} from '../../lib/registry/generate.mjs'
import {archiveRelease} from '../../lib/registry/release.mjs'
import {serializeJson} from '../../lib/registry/data.mjs'
import {fixture} from '../helpers/fixture.mjs'

test('generation is deterministic and detects changed policy views', async t => {
    const {root} = await fixture(t)
    assert.equal((await generateRegistry({root})).changed, 0)
    const page = path.join(root, 'app/1.3.6.1.4.1.65553/0/page.mdx')
    await writeFile(page, 'stale policy')
    await assert.rejects(generateRegistry({root, check: true}), /Generated files are stale/)
    await generateRegistry({root})
    assert.match(await readFile(page, 'utf8'), /Generated from registry\/policies/)
})

test('generated inventory prunes stale views and protects handwritten pages', async t => {
    const {root} = await fixture(t)
    const name = 'app/obsolete/page.mdx'
    const page = path.join(root, name)
    await mkdir(path.dirname(page), {recursive: true})
    const inventoryPath = path.join(root, 'registry/generated-files.json')
    const inventory = JSON.parse(await readFile(inventoryPath))
    await writeFile(inventoryPath, serializeJson([...inventory, name]))
    await writeFile(page, 'handwritten content')
    await assert.rejects(generateRegistry({root}), /Refusing to prune handwritten/)
    await writeFile(page, '{/* Generated from registry/data/. */}\n')
    await generateRegistry({root})
    await assert.rejects(access(page), {code: 'ENOENT'})
})

test('sealed releases require a new ID for changed published content', async t => {
    const {root, directory} = await fixture(t)
    await archiveRelease(directory, root)
    const filename = path.join(root, 'registry/data/nodes.json')
    const nodes = JSON.parse(await readFile(filename))
    nodes[0].description += ' amended'
    await writeFile(filename, serializeJson(nodes))
    await assert.rejects(generateRegistry({root}), /is sealed; choose a new release ID/)
})
