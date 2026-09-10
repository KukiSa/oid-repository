# Registry Governance and Operations

The effective root policy is `POL-ROOT-2.0.0` at `app/1.3.6.1.4.1.65553/0/page.mdx`. This file translates that policy into repository controls.

## Authoritative and Generated Files

- `registry/registry.json` is the canonical public registry dataset.
- `registry/schema/registry.schema.json` defines its interchange structure.
- `registry/instruments/` contains administrative instruments.
- Generated `app/` OID index/detail pages and `public/registry/` artifacts are projections.
- Policy MDX files and administrative instruments are reviewed source documents, not generated views.

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
3. Add the decision, node or object record, and event to `registry/registry.json`.
4. Run `pnpm registry:validate` and `pnpm registry:generate`.
5. Review both canonical data and generated diffs. Trust-anchor and delegation changes require two authorized reviewers.
6. Run `pnpm check` and `pnpm build` before merge.
7. Produce and verify the release manifest. Do not mark a release `authoritative` until its separately governed signature metadata is present.

## Release Signing Bootstrap

The repository intentionally does not create or store the private registry publication key. The Registration Authority must conduct a separate key-provisioning procedure that:

1. generates an offline Ed25519 or equivalently reviewed signing key;
2. records the public key, algorithm, fingerprint, custodian, activation time, rollover procedure, and compromise procedure;
3. stores the private key outside the repository and CI logs;
4. signs the exact bytes of `public/registry/manifest.json`;
5. records signature metadata in the canonical release record before changing release status from `candidate` to `authoritative`.

The detached signing and verification commands are:

```bash
pnpm registry:sign -- --key /secure/offline/registry-signing-key.pem
pnpm registry:verify-signature -- --public-key registry-public-key.pem
```

The public key must be authenticated through a channel independent from the signature file itself.

The first generated migration snapshot remains a candidate until this procedure is completed.

## Legacy Trust-Anchor Reconciliation

For each `legacy-unverified` trust anchor, obtain authoritative ceremony or issuance records and independently derive:

- exact SubjectPublicKeyInfo DER and its digest;
- key identifier;
- canonical trust-anchor name;
- applicable path and policy constraints;
- certificate artifacts and their digests, where used;
- actual activation, retirement, compromise, and replacement state.

Never infer active status from a name or from the existence of an old web page. A different public key requires a new OID.
