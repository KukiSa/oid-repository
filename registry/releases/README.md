# Release descriptors and immutable packages

Each `<release-id>.json` descriptor pins the SHA-256 digest of the exact manifest under `public/registry/releases/<release-id>/`. `format: "legacy"` denotes an original version 1 package; `format: "complete"` denotes a version 2 package with document and shared-artifact coverage.

The organization migration preserved candidate `2026-10-16.2` before generating `2026-11-06.1`. Earlier archives were sealed without modifying their bytes. Their old schemas contained an over-restrictive alias pattern that had never been enforced. Legacy verification preserves that history and checks manifest metadata, file sizes, digests and descriptor seals; it does not assert retrospective schema conformance or publication signatures.

## Commands

1. Edit approved records and policy/instrument sources. Choose a new ID and publication time in `registry/data/release.json`.
2. Run `pnpm registry:release` to prepare current local projections and their manifest. This performs no remote publication.
3. Run `pnpm check` and `pnpm build` to check source contracts, generated views, artifacts, historical packages and the website.
4. Complete any required publication signature using the procedure in `GOVERNANCE.md`.
5. Run `pnpm registry:archive` to seal the current package and create a descriptor. `--from <directory>` can archive an already prepared local package. Signed packages also require `--public-key <trusted-key.pem>`.
6. Run `pnpm registry:verify-release --all` and review/commit the package and descriptor. Signed verification requires `--public-key <trusted-key.pem>`.

An existing ID, package or descriptor is never overwritten. The generator also rejects changes under an already sealed current release ID. New bytes require a new candidate ID even if the previous package was unsigned.

Version 2 manifests distinguish `scope: "package"` files within the release directory from `scope: "public"` immutable files under `public/artifacts/`. Shared artifact paths are constrained to that directory. Verification rejects traversal, symlinks, omitted binding artifacts and missing policy/instrument documents. Version 2 packages include an embedded schema, and signatures are checked only against an independently supplied trusted public key.
