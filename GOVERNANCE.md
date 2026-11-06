# Registry Governance and Operations

The effective root policy is `POL-ROOT-2.0.0`, sourced from `registry/policies/root-registry-policy/2.0.0/policy.mdx` and generated at its existing site route. This file translates that policy into repository controls.

## Authoritative and Generated Files

- `registry/data/` is the single editable source of structured records; each business collection has one JSON file.
- `registry/registry.json` is the assembled public registry dataset, generated deterministically from those collections.
- `registry/schema/` defines dataset and manifest interchange structures. Schema validation, date/time format assertions, semantic validation and artifact verification all run before publication.
- `registry/instruments/` contains administrative instruments.
- `registry/policies/<family>/<revision>/policy.mdx` contains reviewed immutable policy originals. The `app/` policy pages are generated copies with source notices.
- `registry/generated-files.json` tracks current projections and permits removal of obsolete generated files. Handwritten pages cannot be pruned as generated content.
- `public/registry/` contains current projections and immutable historical release packages. `registry/releases/` seals each package's manifest digest.
- `public/artifacts/` contains immutable public cryptographic evidence shared by release packages. Changing bytes requires a new artifact URL.

## Change Classes

| Change | Required authority | Required record |
| --- | --- | --- |
| New OID or reservation | RA for the containing arc | Approved allocation decision |
| Trust-anchor activation or identity data | Delegated PKI RA plus independent reviewer | Decision and verification event |
| Clerical metadata correction | RA for the containing arc | Correction event preserving old and new values |
| Policy revision | Applicable Policy Authority | Policy-adoption decision and immutable revision |
| Delegation change | Delegator and delegate | Delegation instrument and event |
| Generated-view change only | Repository Operator | Reproducible generator output |

No pull request, Git commit, or deployment substitutes for the required registration decision.

## Review Procedure

1. Open or reference the administrative request and identify the applicable authority and policy.
2. Establish whether the change is clerical or changes an identity-defining property.
3. Add the decision, node or object record, and event to the corresponding files in `registry/data/`; assign a new release ID if the previous package is sealed.
4. Run `pnpm registry:validate` and `pnpm registry:generate`.
5. Review both canonical data and generated diffs. Trust-anchor and delegation changes require two authorized reviewers.
6. Run `pnpm check` and `pnpm build` before merge.
7. Run `pnpm registry:release`, then `pnpm registry:verify-release --all` to verify package bytes and all shared artifacts. Seal the reviewed package with `pnpm registry:archive`; this command never overwrites an existing package or descriptor.
8. Authoritative status requires an independently authenticated signing key and a valid signature over the final manifest. A local candidate integrity check alone does not establish authority.

CODEOWNERS covers all source collections, policy revisions, publication artifacts, shared implementation, scripts, tests and CI.

## Release Signing Bootstrap

The repository intentionally does not create or store the private registry publication key. The Registration Authority must conduct a separate key-provisioning procedure that:

1. generates an offline Ed25519 or equivalently reviewed signing key;
2. records the public key, algorithm, fingerprint, custodian, activation time, rollover procedure, and compromise procedure;
3. stores the private key outside the repository and CI logs;
4. records `signature: {algorithm: "Ed25519", publicKeySpkiSha256: "<trusted-key-digest>", signaturePath: "manifest.sig.json"}` and the intended final status in `registry/data/release.json`, under a new unsealed release ID;
5. generates the final dataset and manifest with `pnpm registry:generate`, then signs the exact manifest bytes;
6. verifies both signature and every listed artifact using the independently authenticated public key, before archiving or deploying.

Never change release status or signing metadata after signing: either change modifies the signed bytes. Staging authoritative metadata is not a completed authoritative publication; verification and production builds reject it until the signature is present and trusted.

The detached signing and verification commands are:

```bash
pnpm registry:sign --key /secure/offline/registry-signing-key.pem
pnpm registry:verify-signature --public-key registry-public-key.pem
pnpm registry:archive --public-key registry-public-key.pem
```

The public key must be authenticated through a channel independent from the signature file itself.

Set `REGISTRY_PUBLIC_KEY_FILE` to the path of that authenticated public key when running `pnpm check` or `pnpm build` against signed releases. Release commands also accept `--public-key`; this overrides the environment variable. CI must provision the trusted key through its independently maintained configuration before authoritative releases are enabled.

Use `--directory public/registry/releases/<id>` when verifying a particular archive. Signing refuses to replace an existing signature. Each publication-key rollover requires a new release and independent key authentication.

Candidate releases, including the repository-organization migration, remain candidates until this procedure is completed. Version 1 historical packages retain their original schema and known legacy limitations; their bytes and manifest hashes are verified without retroactively changing or enforcing the old schema. New version 2 releases enforce their embedded schema and include policy, instrument and shared-artifact coverage.

## Legacy Trust-Anchor Reconciliation

For each `legacy-unverified` trust anchor, obtain authoritative ceremony or issuance records and independently derive:

- exact SubjectPublicKeyInfo DER and its digest;
- key identifier;
- canonical trust-anchor name;
- applicable path and policy constraints;
- certificate artifacts and their digests, where used;
- actual activation, retirement, compromise, and replacement state.

Never infer active status from a name or from the existence of an old web page. A different public key requires a new OID.
