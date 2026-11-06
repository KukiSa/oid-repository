import {readFile} from 'node:fs/promises'
import path from 'node:path'

export async function trustedPublicKey(args) {
    const filename = args['--public-key'] ?? process.env.REGISTRY_PUBLIC_KEY_FILE
    return filename ? readFile(path.resolve(filename)) : undefined
}

export function options(names) {
    const result = {}
    const args = process.argv.slice(2).filter(arg => arg !== '--')
    for (let index = 0; index < args.length; index++) {
        const flag = args[index]
        if (!names.includes(flag)) throw new Error(`Unknown option: ${flag}`)
        if (flag === '--all' || flag === '--check') result[flag] = true
        else {
            if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing value: ${flag}`)
            result[flag] = args[++index]
        }
    }
    return result
}

export async function run(work) {
    try { await work() } catch (error) {
        console.error(error.message)
        process.exitCode = 1
    }
}
