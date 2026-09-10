# Signaliks OID Repository

An Object Identifier (OID) registration authority repository for the Signaliks Private Enterprise Number `1.3.6.1.4.1.65553`.

`registry/registry.json` is the canonical source for allocations, authorities, delegations, decisions, object bindings, lifecycle states, events, and release metadata. OID index pages, trust-anchor pages, JSON, CSV, and the release manifest are generated from that source.

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

After an approved registration decision changes `registry/registry.json`, regenerate projections and review the diff:

```bash
pnpm registry:generate
pnpm check
```

Generated files contain a warning and must not be edited directly. See [GOVERNANCE.md](GOVERNANCE.md) and the [root registry policy](app/1.3.6.1.4.1.65553/0/page.mdx).

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

## LICENSE

This repository is licensed under a dual-licensing model:

Software source code, configuration, schemas, scripts, and build tools are licensed under the MIT License. Policy documents and descriptive content in `.md` and `.mdx` files are licensed under CC BY-SA 4.0. See the texts and path-level clarification in [`LICENSES/`](LICENSES/).
