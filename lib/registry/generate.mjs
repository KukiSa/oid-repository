import {mkdir, readFile, unlink, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {loadRegistry, policySourcePath, serializeJson} from './data.mjs'
import {repositoryRoot, readRegularFile, resolveInside} from './paths.mjs'
import {validateRegistry} from './validation.mjs'
import {verifySourceArtifacts} from './artifacts.mjs'
import {renderPages} from './render.mjs'
import {buildReleaseFiles} from './release.mjs'
import {sha256} from './signature.mjs'

const inventoryPath = 'registry/generated-files.json'

export async function generateRegistry({check = false, root = repositoryRoot} = {}) {
    const registry = await loadRegistry(root)
    const errors = validateRegistry(registry)
    if (errors.length) throw new Error(errors.join('\n'))
    const artifactErrors = await verifySourceArtifacts(registry, root)
    if (artifactErrors.length) throw new Error(artifactErrors.join('\n'))
    const outputs = renderPages(registry)
    for (const policy of registry.policies.filter(item => item.documentRoute)) {
        const source = policySourcePath(policy)
        const text = (await readRegularFile(root, source)).toString('utf8')
        const marker = `{/* Generated from ${source}. Do not edit directly. */}\n\n`
        const content = text.startsWith('---\n')
            ? text.replace(/^(---\n[\s\S]*?\n---\n)/, `$1\n${marker}`)
            : marker + text
        const filename = `app${policy.documentRoute}page.mdx`
        if (outputs.has(filename)) throw new Error(`Policy route collides with generated node: ${filename}`)
        outputs.set(filename, content)
    }
    const releaseFiles = await buildReleaseFiles(registry, root)
    try {
        const descriptor = JSON.parse(await readRegularFile(root, `registry/releases/${registry.release.id}.json`))
        if (descriptor.manifestSha256 !== sha256(releaseFiles.get('manifest.json'))) {
            throw new Error(`Release ${registry.release.id} is sealed; choose a new release ID before changing published content`)
        }
    } catch (error) { if (error.code !== 'ENOENT') throw error }
    outputs.set('registry/registry.json', serializeJson(registry))
    for (const [name, bytes] of releaseFiles) outputs.set(`public/registry/${name}`, bytes)
    const inventory = [...outputs.keys()].sort()
    let previous = []
    try { previous = JSON.parse(await readFile(path.join(root, inventoryPath), 'utf8')) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    const stale = previous.filter(name => !outputs.has(name))
    for (const name of stale) {
        if (!name.startsWith('app/') && !name.startsWith('public/registry/documents/') && !name.startsWith('public/registry/schema/')) {
            throw new Error(`Refusing to prune unexpected generated file: ${name}`)
        }
        const text = (await readRegularFile(root, name)).toString('utf8')
        if (name.startsWith('app/') && !/generated|Generated/.test(text.slice(0, 400))) throw new Error(`Refusing to prune handwritten file: ${name}`)
        if (!check) await unlink(resolveInside(root, name))
    }
    outputs.set(inventoryPath, serializeJson(inventory))
    const changed = [...stale]
    for (const [name, content] of outputs) {
        const expected = Buffer.isBuffer(content) ? content : Buffer.from(content)
        let actual
        try { actual = await readFile(resolveInside(root, name)) } catch (error) { if (error.code !== 'ENOENT') throw error }
        if (actual?.equals(expected)) continue
        changed.push(name)
        if (!check) {
            await mkdir(path.dirname(resolveInside(root, name)), {recursive: true})
            await writeFile(resolveInside(root, name), expected)
        }
    }
    if (check && changed.length) throw new Error(`Generated files are stale:\n${changed.join('\n')}\nRun: pnpm registry:generate`)
    return {files: outputs.size, changed: changed.length, registry}
}
