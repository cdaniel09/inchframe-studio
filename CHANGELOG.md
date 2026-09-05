# Changelog

## 0.2.1 — 2026-09-04

Studio workflow version: **11**. Signed session format: **3**.

### Security and reliability

- Account-linked profiles use Account sign-in; linking clears old local credentials and invalidates prior sessions.
- Require active server-side sessions and browser-bound SSO callbacks. Validate each linked Studio session against its individual Account grant so password resets, suspension and revocation deny subsequent access.
- Limit native and admin password attempts, bound sign-in request bodies, and cap asynchronous password-check concurrency.
- Bind Stripe Checkout to immutable quote versions and payment attempts. Retry with stable idempotency keys, verify payment identity/amount/currency, and preserve project progress on repeated fulfillment.
- Bound media/profile requests before multipart parsing. Enforce atomic storage reservations, project/client/global quotas and all-or-nothing media batches.
- Preserve the newly saved profile icon when deleting its prior file fails. Retain capacity for failed cleanup and provide a read-only upload-reservation recovery report.

### Product and operations

- Clarify that Studio Partner applications are paused.
- Show the 100 MiB batch limit in the media uploader and fix form reset after successful upload.
- Report the package version in the health endpoint; increment its workflow version from 10 to 11 and correct its session version from 2 to 3.
- Add authentication, login, payment and upload regression commands and documented rollout/recovery procedures.

### Rollout

Deploy the Account changes from commit `25847c3` before this Studio release. Account's session endpoint was reachable and correctly rejected an unauthenticated check before the Studio push; authenticated production SSO still requires release verification. Existing Account-linked Studio sessions must sign in once. Account outages deny linked-session access until validation resumes.

Back up the persistent database before rollout. Reconcile old unbound Checkout sessions before retrying payments. Operational storage defaults are 400 MiB total, 300 MiB per client and 200 MiB per project, with a 512 MiB free-space floor for the existing 1 GB disk. Partner applications remain paused.

See [security and rollout notes](SECURITY_FOLLOWUP_2026-09-04.md) for details.

### Validation

Authentication, login, payment, upload and local workflow regressions passed, as did the production build. Tests use synthetic identities, temporary SQLite/files and mocked external services; no live email or payment was sent.
