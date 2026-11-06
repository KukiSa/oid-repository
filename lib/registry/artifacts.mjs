import {createHash, createPublicKey, X509Certificate} from 'node:crypto'
import path from 'node:path'
import {repositoryRoot, readRegularFile, listFiles} from './paths.mjs'
import {policySourcePath} from './data.mjs'
import {sha256} from './signature.mjs'

export function assertPublicArtifact(filename, bytes) {
    const text = bytes.toString('utf8')
    if (/-----BEGIN [^-]*(?:PRIVATE KEY|SECRET|PKCS12)/.test(text)) throw new Error(`Private material in public artifact: ${filename}`)
    if (!['.pem', '.crt', '.der', '.crl'].includes(path.extname(filename))) throw new Error(`Unexpected public artifact type: ${filename}`)
    if (filename.endsWith('.pem')) {
        const blocks = [...text.matchAll(/-----BEGIN ([^-]+)-----[\s\S]*?-----END \1-----/g)]
        if (!blocks.length || blocks.some(match => !['CERTIFICATE', 'X509 CRL', 'PUBLIC KEY'].includes(match[1])) ||
            blocks.reduce((rest, block) => rest.replace(block[0], ''), text).trim()) {
            throw new Error(`Invalid public PEM content: ${filename}`)
        }
        for (const [block, label] of blocks) {
            if (label === 'CERTIFICATE') new X509Certificate(block)
            if (label === 'PUBLIC KEY') createPublicKey(block)
        }
    } else if (filename.endsWith('.crt')) new X509Certificate(bytes)
    else if (filename.endsWith('.der')) createPublicKey({key: bytes, format: 'der', type: 'spki'})
}

export function localArtifactPath(uri, registry) {
    const base = new URL(registry.registry.canonicalBaseUrl)
    const url = new URL(uri)
    if (url.origin !== base.origin || !url.pathname.startsWith('/artifacts/') || url.search || url.hash) {
        throw new Error(`Binding artifacts must have a local immutable URL: ${uri}`)
    }
    return decodeURIComponent(url.pathname.slice(1))
}

export async function verifySourceArtifacts(registry, root = repositoryRoot) {
    const errors = []
    const publicRoot = path.join(root, 'public')
    const attempt = async (label, work) => {
        try { await work() } catch (error) { errors.push(`${label}: ${error.message}`) }
    }
    for (const policy of registry.policies) await attempt(policy.id, async () => {
        const bytes = await readRegularFile(root, policySourcePath(policy))
        if (policy.sha256 && sha256(bytes) !== policy.sha256) throw new Error('Policy source digest mismatch')
    })
    for (const delegation of registry.delegations) await attempt(delegation.id, () => readRegularFile(root, delegation.instrumentPath))
    for (const filename of await listFiles(publicRoot, 'artifacts')) await attempt(filename, async () => {
        assertPublicArtifact(filename, await readRegularFile(publicRoot, filename))
    })
    for (const anchor of registry.trustAnchors.filter(item => item.bindingStatus === 'verified')) await attempt(anchor.oid, async () => {
        const key = anchor.publicKey
        const spki = await readRegularFile(publicRoot, localArtifactPath(key.artifactUri, registry))
        if (sha256(spki) !== key.digest.value) throw new Error('SPKI SHA-256 mismatch')
        if (!Buffer.from(key.spkiDerBase64, 'base64').equals(spki)) throw new Error('SPKI Base64 mismatch')
        if (key.sha384 && createHash('sha384').update(spki).digest('hex') !== key.sha384) throw new Error('SPKI SHA-384 mismatch')
        const parsedKey = createPublicKey({key: spki, format: 'der', type: 'spki'})
        if (parsedKey.asymmetricKeyType.toLowerCase() !== key.algorithm.toLowerCase()) throw new Error('Public-key algorithm mismatch')
        for (const certificate of anchor.certificates) {
            const der = await readRegularFile(publicRoot, localArtifactPath(certificate.artifactUri, registry))
            if (sha256(der) !== certificate.sha256) throw new Error('Certificate SHA-256 mismatch')
            if (certificate.sha384 && createHash('sha384').update(der).digest('hex') !== certificate.sha384) throw new Error('Certificate SHA-384 mismatch')
            const parsed = new X509Certificate(der)
            if (!parsed.publicKey.export({format: 'der', type: 'spki'}).equals(spki)) throw new Error('Certificate public key does not match its anchor')
            if (BigInt(`0x${parsed.serialNumber}`) !== BigInt(`0x${certificate.serialNumberHex}`)) throw new Error('Certificate serial number mismatch')
            if (Date.parse(parsed.validFrom) !== Date.parse(certificate.notBefore) || Date.parse(parsed.validTo) !== Date.parse(certificate.notAfter)) throw new Error('Certificate validity mismatch')
            if (certificate.pemUri) {
                const pem = await readRegularFile(publicRoot, localArtifactPath(certificate.pemUri, registry))
                if (!new X509Certificate(pem).raw.equals(der)) throw new Error('PEM and DER certificate differ')
            }
        }
    })
    return errors
}
