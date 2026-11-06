import {readFileSync} from 'node:fs'
import {access, mkdir, readFile, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import {compareOid} from './oid.mjs'
import {serializeJson, policySourcePath} from './data.mjs'
import {repositoryRoot, listFiles, readRegularFile, resolveInside} from './paths.mjs'
import {assertPublicArtifact, localArtifactPath} from './artifacts.mjs'
import {sha256, verifyManifestSignature} from './signature.mjs'

const ajv = new Ajv2020({allErrors: true})
addFormats(ajv)
const checkManifest = ajv.compile(JSON.parse(readFileSync(new URL('../../registry/schema/manifest.schema.json', import.meta.url))))

export async function buildReleaseFiles(registry, root = repositoryRoot) {
    const files = new Map()
    files.set('registry.json', Buffer.from(serializeJson(registry)))
    const columns = ['oid', 'parent_oid', 'arc', 'kind', 'secondary_identifier', 'allocation_status', 'authority', 'decision', 'governing_policy', 'route']
    const escape = value => `"${String(value ?? '').replaceAll('"', '""')}"`
    const rows = [...registry.nodes].sort((a, b) => compareOid(a.oid, b.oid)).map(node => [
        node.oid, node.parentOid, node.arc, node.kind, node.secondaryIdentifier, node.allocation.status,
        node.allocation.authorityRef, node.allocation.decisionRef, node.allocation.governingPolicyRef, node.route
    ].map(escape).join(','))
    files.set('registry.csv', Buffer.from(`${columns.join(',')}\n${rows.join('\n')}\n`))
    for (const name of ['registry.schema.json', 'manifest.schema.json']) {
        files.set(`schema/${name}`, await readRegularFile(root, `registry/schema/${name}`))
    }
    for (const directory of ['registry/policies', 'registry/instruments']) {
        for (const name of await listFiles(root, directory)) files.set(`documents/${name}`, await readRegularFile(root, name))
    }
    const artifacts = [...files].map(([name, bytes]) => ({path: name, scope: 'package', sha256: sha256(bytes), bytes: bytes.length}))
    const publicRoot = path.join(root, 'public')
    for (const name of await listFiles(publicRoot, 'artifacts')) {
        const bytes = await readRegularFile(publicRoot, name)
        assertPublicArtifact(name, bytes)
        artifacts.push({path: name, scope: 'public', sha256: sha256(bytes), bytes: bytes.length})
    }
    artifacts.sort((a, b) => `${a.scope}/${a.path}`.localeCompare(`${b.scope}/${b.path}`, 'en'))
    files.set('manifest.json', Buffer.from(serializeJson({
        schemaVersion: 2, releaseId: registry.release.id, releaseStatus: registry.release.status,
        publishedAt: registry.release.publishedAt,
        signatureRequiredForAuthoritativeRelease: registry.release.signingRequiredForAuthoritativeRelease,
        signing: registry.release.signature, artifacts
    })))
    return files
}

export async function verifyRelease(directory, {publicRoot = path.join(repositoryRoot, 'public'), publicKey, requireSignature = false, expectedManifestSha256, signatureFile, allowUnsignedPreparation = false} = {}) {
    const errors = []
    let manifest, manifestBytes
    try {
        manifestBytes = await readRegularFile(directory, 'manifest.json')
        manifest = JSON.parse(manifestBytes)
        if (expectedManifestSha256 && sha256(manifestBytes) !== expectedManifestSha256) errors.push('Archived manifest differs from its sealed descriptor')
        if (!checkManifest(manifest)) return [...errors, ...checkManifest.errors.map(error => `Manifest ${error.instancePath}: ${error.message}`)]
    } catch (error) { return [`Cannot read manifest: ${error.message}`] }
    const listed = new Set()
    for (const artifact of manifest.artifacts) {
        const scope = artifact.scope ?? 'package'
        const id = `${scope}/${artifact.path}`
        if (listed.has(id)) errors.push(`Duplicate manifest artifact: ${id}`)
        listed.add(id)
        try {
            if (scope === 'public' && !artifact.path.startsWith('artifacts/')) throw new Error('Shared artifacts must be in artifacts/')
            if (scope === 'package' && ['manifest.json', 'manifest.sig.json'].includes(artifact.path)) throw new Error('Manifest cannot hash itself or its signature')
            const bytes = await readRegularFile(scope === 'public' ? publicRoot : directory, artifact.path)
            if (bytes.length !== artifact.bytes || sha256(bytes) !== artifact.sha256) errors.push(`Artifact digest/size mismatch: ${id}`)
            if (scope === 'public') assertPublicArtifact(artifact.path, bytes)
        } catch (error) { errors.push(`${id}: ${error.message}`) }
    }
    for (const name of ['registry.json', 'registry.csv', 'schema/registry.schema.json']) {
        if (!listed.has(`package/${name}`)) errors.push(`Missing mandatory artifact: ${name}`)
    }
    try {
        const registry = JSON.parse(await readRegularFile(directory, 'registry.json'))
        if (registry.release.id !== manifest.releaseId || registry.release.status !== manifest.releaseStatus ||
            registry.release.publishedAt !== manifest.publishedAt ||
            registry.release.signingRequiredForAuthoritativeRelease !== manifest.signatureRequiredForAuthoritativeRelease) {
            errors.push('Manifest and dataset release metadata differ')
        }
        if (manifest.schemaVersion === 2) {
            const schema = JSON.parse(await readRegularFile(directory, 'schema/registry.schema.json'))
            const validator = new Ajv2020({allErrors: true, strict: false})
            addFormats(validator)
            const check = validator.compile(schema)
            if (!check(registry)) errors.push(...check.errors.map(error => `Dataset ${error.instancePath}: ${error.message}`))
            if (serializeJson(manifest.signing) !== serializeJson(registry.release.signature)) errors.push('Manifest signing metadata differs from dataset')
            for (const policy of registry.policies) {
                if (!listed.has(`package/documents/${policySourcePath(policy)}`)) errors.push(`Missing policy document: ${policy.id}`)
            }
            for (const delegation of registry.delegations) {
                if (!listed.has(`package/documents/${delegation.instrumentPath}`)) errors.push(`Missing delegation instrument: ${delegation.id}`)
            }
            const inspect = value => {
                if (!value || typeof value !== 'object') return
                for (const [key, item] of Object.entries(value)) {
                    if (['artifactUri', 'pemUri'].includes(key) && typeof item === 'string') {
                        const name = localArtifactPath(item, registry)
                        if (!listed.has(`public/${name}`)) errors.push(`Unlisted binding artifact: ${name}`)
                    } else inspect(item)
                }
            }
            inspect(registry.trustAnchors)
        }
    } catch (error) { errors.push(`Dataset verification: ${error.message}`) }
    const signatureRequired = requireSignature || (manifest.releaseStatus === 'authoritative' && manifest.signatureRequiredForAuthoritativeRelease)
    if (signatureRequired && !publicKey) errors.push('An independently trusted public key is required for signature verification')
    let signatureBytes
    try { signatureBytes = signatureFile ? await readFile(signatureFile) : await readRegularFile(directory, 'manifest.sig.json') }
    catch (error) { if (error.code !== 'ENOENT' || (signatureRequired && !allowUnsignedPreparation)) errors.push(`Signature: ${error.message}`) }
    if (signatureBytes) {
        if (!publicKey) errors.push('A trusted public key is required to verify the present signature')
        else try {
            const envelope = JSON.parse(signatureBytes)
            if (!verifyManifestSignature(manifestBytes, envelope, publicKey)) errors.push('Manifest signature is invalid')
            if (manifest.signing && envelope.publicKeySpkiSha256 !== manifest.signing.publicKeySpkiSha256) errors.push('Signature key differs from declared publication key')
        } catch (error) { errors.push(`Signature: ${error.message}`) }
    } else if (manifest.signing && !allowUnsignedPreparation) errors.push('Declared publication signature is missing')
    return errors
}

export async function verifyArchives(root = repositoryRoot, {publicKey, publicRoot = path.join(root, 'public')} = {}) {
    const errors = []
    const descriptors = await listFiles(root, 'registry/releases')
    const described = new Set()
    for (const filename of descriptors.filter(name => name.endsWith('.json'))) {
        try {
            const descriptor = JSON.parse(await readRegularFile(root, filename))
            if (!/^\d{4}-\d{2}-\d{2}\.[1-9]\d*$/.test(descriptor.id) || filename !== `registry/releases/${descriptor.id}.json` ||
                !['legacy', 'complete'].includes(descriptor.format) || !/^[a-f0-9]{64}$/.test(descriptor.manifestSha256)) {
                throw new Error('Invalid release descriptor')
            }
            described.add(descriptor.id)
            const directory = resolveInside(publicRoot, `registry/releases/${descriptor.id}`)
            const manifest = JSON.parse(await readRegularFile(directory, 'manifest.json'))
            if (manifest.releaseId !== descriptor.id || (manifest.schemaVersion === 2) !== (descriptor.format === 'complete')) throw new Error('Release descriptor metadata mismatch')
            const found = await verifyRelease(directory, {publicRoot, publicKey, expectedManifestSha256: descriptor.manifestSha256})
            errors.push(...found.map(error => `${descriptor.id}: ${error}`))
        } catch (error) { errors.push(`${filename}: ${error.message}`) }
    }
    for (const filename of await listFiles(publicRoot, 'registry/releases')) {
        if (!described.has(filename.split('/')[2])) errors.push(`Undescribed archive artifact: ${filename}`)
    }
    return errors
}

export async function archiveRelease(directory, root = repositoryRoot, {publicKey} = {}) {
    const errors = await verifyRelease(directory, {publicRoot: path.join(root, 'public'), publicKey})
    if (errors.length) throw new Error(errors.join('\n'))
    const bytes = await readRegularFile(directory, 'manifest.json')
    const manifest = JSON.parse(bytes)
    const descriptor = {id: manifest.releaseId, format: manifest.schemaVersion === 2 ? 'complete' : 'legacy', manifestSha256: sha256(bytes)}
    const destination = resolveInside(root, `public/registry/releases/${descriptor.id}`)
    const descriptorPath = resolveInside(root, `registry/releases/${descriptor.id}.json`)
    for (const name of [destination, descriptorPath]) {
        try { await access(name) } catch (error) { if (error.code === 'ENOENT') continue; throw error }
        throw new Error(`Refusing to overwrite sealed release: ${descriptor.id}`)
    }
    await mkdir(path.dirname(destination), {recursive: true})
    await mkdir(path.dirname(descriptorPath), {recursive: true})
    await mkdir(destination)
    try {
        const names = ['manifest.json', ...manifest.artifacts.filter(item => (item.scope ?? 'package') === 'package').map(item => item.path)]
        try { await access(path.join(directory, 'manifest.sig.json')); names.push('manifest.sig.json') } catch (error) { if (error.code !== 'ENOENT') throw error }
        for (const name of names) {
            const target = resolveInside(destination, name)
            await mkdir(path.dirname(target), {recursive: true})
            await writeFile(target, await readRegularFile(directory, name), {flag: 'wx'})
        }
        await writeFile(descriptorPath, serializeJson(descriptor), {flag: 'wx'})
    } catch (error) {
        await rm(destination, {recursive: true, force: true})
        throw error
    }
    return descriptor.id
}
