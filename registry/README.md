# Registry source conventions

Edit JSON files in `data/`. `metadata.json` contains only `$schema`, `schemaVersion` and registry metadata. The other files contain the named collections or the release object. `lib/registry/data.mjs` assembles them in a fixed order; it rejects unrecognized JSON collection files. `registry.json` is a generated interchange view, not a second editable source.

Schemas validate types, required fields, enumerations and date/time formats before semantic checks run. Semantic checks cover OID parents, canonical routes, authorities, delegation references, decisions, events, immutable group versions and lifecycle prerequisites. A secondary identifier is a human-facing registry alias; existing digit-leading aliases are retained and are not asserted to be ASN.1 identifier tokens.

Policies live at `policies/<family>/<revision>/policy.mdx`. The path is derived from the policy record, so every record has one source body. A published revision's bytes are immutable. For a policy revision, add a new version directory and update the reviewed policy records. The generator publishes the effective document at its existing `documentRoute`; old source revisions remain available in release document downloads.

Administrative prose lives in `instruments/`. The release manifest includes every policy and instrument file, as well as the dataset and schemas. `generated-files.json` records only current derived files; it does not own historical release packages or public cryptographic artifacts.

## Public cryptographic evidence

`public/artifacts/` is the authoritative byte store for public certificates, SPKI, certificate chains and historical CRL snapshots. Existing URLs are immutable. `.crt` files contain DER certificates; `.spki.der` contains DER SubjectPublicKeyInfo; `.pem` contains only public CERTIFICATE, PUBLIC KEY or X509 CRL blocks. Private key blocks and unexpected file types fail validation. Certificate PEM and DER references are checked for byte-equivalent certificate content.

Verified trust anchors must reference local immutable artifact URLs. Validation recomputes SPKI/certificate digests, compares embedded and downloaded SPKI bytes, and checks certificate public keys, serial numbers and validity periods against their records. The release manifest additionally inventories every shared artifact, including chains and CRL snapshots not directly referenced by anchor records.

Historical CRL files are evidence of a past publication. Live revocation distribution remains the responsibility of the PKI service at its CRL distribution-point URLs; new live CRLs must not overwrite these historical snapshots. Git permits public PEM files under this directory, while PEM elsewhere remains ignored.

See [releases/README.md](releases/README.md) for release preparation and verification, and [../GOVERNANCE.md](../GOVERNANCE.md) for administrative controls.
