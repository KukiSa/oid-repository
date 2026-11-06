import {brotliCompress, brotliDecompress, constants, gzip, gunzip, zstdCompress, zstdDecompress} from 'node:zlib'
import {promisify} from 'node:util'
import {readFile, writeFile, rm} from 'node:fs/promises'
import path from 'node:path'
import {listFiles, readRegularFile, resolveInside} from '../registry/paths.mjs'

export const encodings = [
    {suffix: '.gz', compress: promisify(gzip), decompress: promisify(gunzip), options: {level: 9}},
    {suffix: '.br', compress: promisify(brotliCompress), decompress: promisify(brotliDecompress), options: {params: {[constants.BROTLI_PARAM_QUALITY]: 11}}},
    {suffix: '.zst', compress: promisify(zstdCompress), decompress: promisify(zstdDecompress), options: {params: {[constants.ZSTD_c_compressionLevel]: 22}}}
]
const extensions = new Set(['.html', '.css', '.js', '.mjs', '.json', '.csv', '.txt', '.xml', '.svg', '.webmanifest', '.md', '.mdx', '.pem', '.map'])

export async function precompress(directory) {
    const files = (await listFiles(directory)).filter(name => extensions.has(path.extname(name)))
    const totals = Object.fromEntries(encodings.map(item => [item.suffix, {files: 0, originalBytes: 0, compressedBytes: 0}]))
    // Two workers bound Brotli/Zstandard memory use on GitHub-hosted runners.
    let index = 0
    await Promise.all(Array.from({length: 2}, async () => {
        while (index < files.length) {
            const filename = files[index++]
            const source = await readRegularFile(directory, filename)
            for (const encoding of encodings) {
                const target = resolveInside(directory, filename + encoding.suffix)
                const compressed = source.length >= 256 ? await encoding.compress(source, encoding.options) : source
                if (compressed.length < source.length) {
                    await writeFile(target, compressed)
                    totals[encoding.suffix].files++
                    totals[encoding.suffix].originalBytes += source.length
                    totals[encoding.suffix].compressedBytes += compressed.length
                } else await rm(target, {force: true})
            }
        }
    }))
    return totals
}

export async function verifyCompression(directory) {
    const errors = []
    for (const filename of await listFiles(directory)) {
        const encoding = encodings.find(item => filename.endsWith(item.suffix))
        if (!encoding) continue
        try {
            const compressed = await readRegularFile(directory, filename)
            const original = await readFile(resolveInside(directory, filename.slice(0, -encoding.suffix.length)))
            if (!(await encoding.decompress(compressed)).equals(original)) errors.push(`Sidecar does not reproduce original bytes: ${filename}`)
        } catch (error) { errors.push(`Invalid compressed sidecar ${filename}: ${error.message}`) }
    }
    return errors
}
