# Superseded Policy Revisions

The initial policy revisions have been recovered byte-for-byte into ordinary versioned policy source directories. Their original Git provenance is commit `a53a12de6faa7b0db10dacf8cc26ed28028ed9bc`:

| Policy | Revision | Path at source commit | SHA-256 |
| --- | --- | --- | --- |
| Root Registry Policy | 1.0.1 | `app/1.3.6.1.4.1.65553/0/page.mdx` | `bec3ec0f310f12a355edf74ed9283c874b3b49d95769e6702f8cc59e541c8207` |
| PKI Arc Policy | 1.0.0 | `app/1.3.6.1.4.1.65553/2/0/page.mdx` | `e7135f6de5043e54a1fede4e624371c81ca7613c92365500663085aa3a7d3a28` |
| Trust Anchor Arc Policy | 1.0.0 | `app/1.3.6.1.4.1.65553/2/2/0/page.mdx` | `1efef6723dd8afe7eab414deecd1ebc26663c7e584c31968659522f136ce7c8a` |

For example:

```bash
git show a53a12de6faa7b0db10dacf8cc26ed28028ed9bc:app/1.3.6.1.4.1.65553/0/page.mdx
```

The recovered bodies are `../root-registry-policy/1.0.1/policy.mdx`, `../pki-arc-policy/1.0.0/policy.mdx`, and `../trust-anchor-arc-policy/1.0.0/policy.mdx`. Their SHA-256 digests match the records above. All seven policy revisions now have a versioned source body and are included as documents in version 2 release packages.

Published revision bodies are immutable. Add a new revision directory for future changes; keep the former body as an ordinary release document rather than relying only on Git history.
