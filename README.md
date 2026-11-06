# Signaliks OID Repository

An Object Identifier (OID) registration authority repository for the Signaliks Private Enterprise Number `1.3.6.1.4.1.65553`.

`registry/data/` contains the authoritative editable records for allocations, authorities, delegations, decisions, object bindings, lifecycle states, events, and releases. `registry/registry.json` is their deterministic assembled view. Policies are versioned source documents under `registry/policies/`. The site, downloadable JSON/CSV, policy pages, and release manifest are generated from these sources.

## Repository layout

| Path | Responsibility |
| --- | --- |
| `registry/data/` | Editable records, one file per business collection |
| `registry/policies/<family>/<revision>/policy.mdx` | Immutable policy revisions, including recovered historical originals |
| `registry/instruments/` | Administrative instruments |
| `registry/schema/` | Dataset and release-manifest contracts |
| `registry/releases/` | Sealed release descriptors containing manifest digests |
| `lib/registry/` | Data loading, validation, rendering, signing, artifact and release logic |
| `scripts/` | Command-line entrypoints |
| `test/registry/` | Validation, generation, signing and release regression tests |
| `app/` | Website routes; OID and policy pages are generated |
| `public/registry/` | Current exports, document copies and immutable release packages |
| `public/artifacts/` | Immutable public certificates, SPKI, chains and historical CRLs |

See [registry/README.md](registry/README.md) for source and artifact conventions.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/)
- **Documentation Engine:** [Nextra](https://nextra.site/)
- **Search:** [Pagefind](https://pagefind.app/)

## Registry workflow

Validate the registry and generated views:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
```

After an approved registration decision changes the relevant collection in `registry/data/`, regenerate projections and review the diff:

```bash
pnpm registry:generate
pnpm check
```

`registry/registry.json`, `registry/generated-files.json`, generated MDX, and the current `public/registry/` exports must not be edited directly. Policy source bytes are copied to their existing site routes; published URLs remain stable. See [GOVERNANCE.md](GOVERNANCE.md).

## Preparing and archiving a release

Set a new candidate ID and publication time in `registry/data/release.json`, then prepare and verify the local package:

```bash
pnpm registry:release
pnpm check
pnpm build
pnpm registry:archive
pnpm registry:verify-release --all
```

`registry:release` prepares local publication files; it does not deploy. `registry:archive` seals the current package under `public/registry/releases/<id>/` and creates its descriptor under `registry/releases/`. Existing IDs cannot be overwritten. Any subsequent change to release content requires a new ID.

The manifest hashes the dataset, schemas, all policy/instrument documents, and every public artifact. Shared certificates and historical CRLs retain their original URLs; archives reference their immutable bytes without duplicating them. Version 1 archives are preserved byte-for-byte and verified against their original manifest and sealed descriptor. Version 2 packages additionally undergo embedded-schema, document-coverage and binding-reference checks.

Signing and independently authenticated publication keys are described in [GOVERNANCE.md](GOVERNANCE.md). A candidate integrity check does not constitute signature verification.

## Development

### Local Development

Install dependencies:
```bash
corepack enable
pnpm install --frozen-lockfile
```

Start the development server:
```bash
pnpm dev
```

The project uses Next.js 16.3.x with Turbopack for development and production builds.

`patches/nextra-theme-docs@4.6.1.patch` contains a minimal audited workaround for the upstream Layout schema bug that requires a `children` property after Nextra has already removed it from the validated object. Remove the patch after upgrading to a release containing the upstream fix.

`pnpm-workspace.yaml` temporarily overrides vulnerable transitive dependencies still selected by Nextra 4.6.1. Re-evaluate and remove those overrides when Nextra updates its dependency graph; keep `pnpm audit --prod` clean during that upgrade.
Open http://localhost:3000 with your browser to see the result.

### Production Build

To generate a static export:
```bash
pnpm build
```

The static site is exported to `out/`, including its search index and precompressed assets.

## LICENSE

This repository is licensed under a dual-licensing model:

Software source code, configuration, schemas, scripts, and build tools are licensed under the MIT License. Policy documents and descriptive content in `.md` and `.mdx` files are licensed under CC BY-SA 4.0. See the texts and path-level clarification in [`LICENSES/`](LICENSES/).
