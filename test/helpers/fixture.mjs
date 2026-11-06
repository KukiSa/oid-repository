import {cp, mkdir, mkdtemp, rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {repositoryRoot} from '../../lib/registry/paths.mjs'
import {generateRegistry} from '../../lib/registry/generate.mjs'

export async function fixture(t) {
    const root = await mkdtemp(path.join(os.tmpdir(), 'oid-registry-test-'))
    t.after(() => rm(root, {recursive: true, force: true}))
    await mkdir(path.join(root, 'registry'), {recursive: true})
    for (const name of ['data', 'policies', 'instruments', 'schema']) {
        await cp(path.join(repositoryRoot, 'registry', name), path.join(root, 'registry', name), {recursive: true})
    }
    await mkdir(path.join(root, 'public'), {recursive: true})
    await cp(path.join(repositoryRoot, 'public/artifacts'), path.join(root, 'public/artifacts'), {recursive: true})
    await generateRegistry({root})
    return {root, directory: path.join(root, 'public/registry'), publicRoot: path.join(root, 'public')}
}
