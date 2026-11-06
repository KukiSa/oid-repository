import path from 'node:path'
import {lstat, readdir, readFile} from 'node:fs/promises'

export const repositoryRoot = path.resolve(import.meta.dirname, '../..')

export function resolveInside(root, relative) {
    if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.includes('\0') ||
        path.isAbsolute(relative) || relative.split('/').some(part => !part || part === '.' || part === '..')) {
        throw new Error(`Unsafe relative path: ${relative}`)
    }
    return path.join(root, relative)
}

export async function readRegularFile(root, relative) {
    const filename = resolveInside(root, relative)
    let current = root
    for (const part of relative.split('/')) {
        current = path.join(current, part)
        if ((await lstat(current)).isSymbolicLink()) throw new Error(`Symlinks are not release artifacts: ${relative}`)
    }
    if (!(await lstat(filename)).isFile()) throw new Error(`Not a regular file: ${relative}`)
    return readFile(filename)
}

export async function listFiles(root, prefix = '') {
    const entries = await readdir(prefix ? resolveInside(root, prefix) : root, {withFileTypes: true})
    const files = []
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
        if (entry.name === '.DS_Store') continue
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name
        if (entry.isSymbolicLink()) throw new Error(`Symlink in published files: ${relative}`)
        if (entry.isDirectory()) files.push(...await listFiles(root, relative))
        else if (entry.isFile()) files.push(relative)
    }
    return files
}
