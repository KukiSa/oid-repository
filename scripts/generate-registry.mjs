import {generateRegistry} from '../lib/registry/generate.mjs'
import {options, run} from '../lib/registry/cli.mjs'

await run(async () => {
    const args = options(['--check'])
    const result = await generateRegistry({check: Boolean(args['--check'])})
    console.log(args['--check'] ? `Generated files are current (${result.files} files).` : `Generated ${result.files} files; ${result.changed} changed.`)
})
