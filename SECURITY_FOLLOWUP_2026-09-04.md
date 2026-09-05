# Security follow-up — September 4, 2026

Local implementation of the Studio security batches from the Inchframe review. Not deployed.

## Changes

- Account-linked Studio profiles authenticate through Inchframe Account. Linking clears any former local password and verification tokens, invalidates prior Studio sessions on the initial link, and preserves the Studio user ID and existing ownership.
- A verified email cannot reassign a profile already linked to a different Account identity.
- Startup migration `account-linked-credentials-v1` removes local passwords/verification tokens from previously Account-linked profiles and revokes their existing sessions once.
- Signed Studio cookies now require their hashed session ID to resolve to an unexpired server-side session. Legacy opaque cookies use the same current-user validation. Logout deletes that record; replayed cookies no longer authenticate.
- Session validation checks current access status, user existence, admin authority and revocation time. It uses the session record's creation time rather than trusting cookie claims.
- Account SSO requires a matching initiating-browser cookie before consuming its server-side transaction or exchanging a code. The cookie is HttpOnly, SameSite=Lax, Secure in production, host-only, scoped to the Account-auth routes and expires after ten minutes. Callback redirects clear it.
- Studio sign-in copy explains that linked profiles use Account sign-in.

## Deployment behavior

Deploy as one Studio release against the existing persistent SQLite database. Follow the normal database backup procedure before release. Previously linked users must sign in through Account again; unrelated local-only users keep their existing credentials. Projects, ownership and Partner profiles remain in place.

Keep Account SSO configured and available for linked users. A local-only authentication configuration is not a recovery path for linked profiles. Losing the session database now signs users out, as expected for revocable server-side sessions.

Only the most recently initiated Account sign-in in a browser is accepted; starting another sign-in replaces the short-lived binding cookie. A pending pre-release sign-in should be restarted after deployment.

## Verification

- `npm audit --omit=dev --json`: zero reported production-dependency vulnerabilities. The user explicitly authorized sending Studio's dependency metadata to npm. No dependency upgrade was required.
- `npm run test:auth`: passed with real Studio modules and an isolated SQLite database; mocked cookies and Account exchange. Covers retained-password takeover, verification-token cleanup, ownership preservation, conflicting Account identity, old sessions on linking, signed and legacy logout replay, expiry, admin logout, suspension, upgrade migration, SSO browser binding, replay and expiry.
- `npm run build`: passed using an isolated build database.
- `npm run test:workflow`: passed the existing local Account/Studio integration workflow, including customer requests, admin review and internal Partner profile operations.
- Final TypeScript check passed after sign-in copy was updated.
- No live account, email, payment, or deployment was changed.

## Second security batch: payment attempts

Implemented locally; not deployed. Accepted quotes now carry a checkout version that changes when the quote's amount, deposit, partner or status changes. Each checkout attempt stores the accepted version, owner, partner, full quote amount, amount due, currency and immutable Stripe request parameters before contacting Stripe.

Concurrent/retried creation reuses one active attempt and the same Stripe idempotency key. A lost create response cannot immediately generate a different charge. Retrieval errors hold the existing attempt for retry; a confirmed expired session allows a fresh attempt. An ambiguous creation older than 23 hours requires review because Stripe idempotency retention is bounded.

Verified paid sessions must match the attempt, quote version, session ID, amount, currency and payment intent. First fulfillment requires a project waiting for its deposit. Duplicate fulfillment of the same payment succeeds without changing the project, preserving completed or in-production states. A verified webhook arriving before the checkout-create response can bind and fulfill its saved attempt safely.

Once an active payment attempt exists, the quote cannot be declined through the normal quote action until payment is reconciled. Stale or conflicting payments require Studio review and do not automatically unlock production. This follows Stripe's [idempotent request behavior](https://docs.stripe.com/api/idempotent_requests).

### Rollout and recovery

Schema initialization adds `project_quotes.checkout_version`, its update trigger and `project_checkout_attempts`. Back up the persistent database through the normal release process.

Existing unbound pre-release checkouts are held for review rather than silently starting a second payment. Their old webhooks lack the required attempt metadata and will need reconciliation; inspect and expire unpaid sessions or reconcile successful payments in Stripe before releasing them. Stale paid attempts may require a manual refund/reconciliation decision. No automatic refunds, final-balance collection or dispute handling were added.

Validation: `npm run test:payments`, `npm run test:auth`, `npm run test:workflow`, TypeScript and the Studio production build passed. Payment tests use synthetic SQLite and mocked Stripe, including wrong amount/currency/session, unpaid events, duplicate completion, ownership, quote revisions, response loss, retrieval failure, expiry and webhook-before-response timing. No live charges were created.

## Third security batch: native login protection

Implemented locally; not deployed. Native sign-in, including the local admin password, now reserves persistent SQLite capacity before password verification: five attempts per normalized email per 15 minutes and 60 requests per minute across native login. The shared cap runs before body parsing. Limits return HTTP 429 with a friendly message and Retry-After; cooldown expiry allows sign-in again. Successful attempts also count. Account SSO remains a separate sign-in path.

The shared rate-limit helper now reserves capacity in a single conditional SQLite statement, eliminating read-then-write races across processes. Limits assume the existing single persistent database architecture. Login does not derive buckets from caller-supplied forwarded IP headers. Trusted per-client edge limits and admin MFA remain deployment follow-ups; the shared cap protects modest traffic and should be assessed before scaling.

Login accepts at most 16 KiB of actual body data, including chunked or misleading Content-Length requests, with a ten-second read deadline. It rejects overlong credentials instead of silently truncating them. Password checks use asynchronous scrypt, with at most two concurrent checks per Node process and no waiting queue; excess work gets HTTP 503 and a one-second retry hint. Unknown, inactive and Account-linked identities use bounded dummy password work and cannot gain a local session.

Verification: `npm run test:login` passed real-route/SQLite/scrypt tests for normal local/admin sign-in, verification requirements, linked-profile rejection, cooldown recovery, email normalization, forwarded-header spoofing, oversized bodies, multipart forms, work saturation and three simultaneous database writers. `npm run test:auth`, `npm run test:workflow`, TypeScript and a production build using an isolated database also passed. No live messages or accounts were touched.

## Fourth security batch: Account revocation and upload capacity

Implemented locally; not deployed.

### Account-linked sessions

Each successful Account exchange now supplies a distinct, seven-day opaque Studio grant. Gateway stores only its keyed hash and the credential stamp. Studio stores that grant server-side on the individual session; it is not copied into the browser cookie. Every use of an Account-linked Studio session checks the authenticated `/api/sso/session` endpoint with a five-second timeout and no positive-result cache.

Password reset, account deletion and explicit Account session revocation invalidate the grants. Credential changes, expiry, suspension and loss of Account verification also fail the check. A new sign-in cannot restore an older revoked Studio cookie. Local-only Studio and native admin sessions keep their existing local authentication behavior.

Account downtime denies linked-session access until checks work again, while retaining the local record for retry. A confirmed inactive grant or identity mismatch removes that Studio session. The endpoint accepts only bounded URL-encoded requests and authenticates the registered Studio client before exposing an account ID.

Deploy Account first, verify its session endpoint, then deploy Studio. Old Account-linked Studio sessions lack grants and must sign in once. The updated Studio callback rejects an older Account service that omits the grant. Use the existing matching SSO client ID/secret; no additional credential is needed. The grant is a server-side secret, so protect Studio database backups as credentials.

### Upload/storage limits

Project media requests are bounded while streaming into the multipart parser: 100 MiB of files plus 128 KiB of form overhead, up to 12 nonempty files and a 60-second request deadline. Existing per-file limits remain: 15 MiB images, 50 MiB audio, 100 MiB video. Profile requests allow a 3 MiB icon plus 64 KiB of form overhead. One upload parses/saves at a time per Node process; excess attempts return a retryable 503. Authenticated upload attempts are limited to 30/hour for project media and 20/hour for profile edits.

Atomic SQLite reservations enforce these configurable operational limits:

| Setting | Default |
|---|---:|
| STUDIO_STORAGE_LIMIT_MB | 400 MiB across Studio |
| STUDIO_OWNER_STORAGE_LIMIT_MB | 300 MiB across a client's projects/profile |
| STUDIO_PROJECT_STORAGE_LIMIT_MB | 200 MiB per project |

The defaults fit the checked-in 1 GB disk blueprint; this change does not enlarge the disk. A 512 MiB free-space floor protects SQLite and operational headroom. Existing assets count immediately; existing profile icons conservatively count as 3 MiB each. Each project can hold up to 1,000 assets, including in-flight reservations. These are storage safeguards, not new subscription entitlements. Review real usage and capacity before raising them. Existing media above a quota stays available, but additional uploads are refused.

Every file is validated before any batch file is written. New files and asset metadata either complete as a batch or roll back; partial writes are removed. Database asset insertion, versioning, project state and reservation release commit together. Profile replacement preserves the committed new icon even if deleting the prior icon fails. Profile updates read the prior icon under the same write transaction to handle simultaneous replacements.

### Recovery

A failed cleanup or worker crash retains its reservation instead of freeing capacity for files that might remain. Reservations include their intended object keys. They deliberately do not expire automatically.

With the intended DATABASE_PATH and UPLOAD_DIR configured, run:

```text
node scripts/review-upload-reservations.mjs
```

This is read-only: it lists held capacity, file existence and whether an asset/profile still references each key. It does not print session grants. Pause new uploads while reconciling a crashed writer; preserve referenced media, inspect and remove only confirmed orphan files, and release the associated reservation only after its files are accounted for. Do not clear all reservations by age. Legacy orphan files that predate reservations still consume physical space; the free-space floor accounts for them, while a full storage inventory remains operational follow-up.

### Verification

67 Gateway tests passed. Studio authentication, login, payment, upload and workflow regressions and the production build passed. Upload regressions use real temporary files/SQLite, injected partial-write/database/cleanup failures, oversized or misleading request lengths, timeout, unauthorized access, profile replacement, the read-only recovery report and three concurrent quota writers. Account tests cover multiple grants per user, reset, fresh sign-in, wrong client credentials, malformed bodies, expiry, suspension, direct password changes and unrelated-account isolation. No live email, account, payment or deployment was changed.

## Remaining work

The Studio batches fix findings 1, 3 and 5, and the Studio portion of finding 2. The Account follow-up fixes Gateway session replay/password-reset revocation and subscription event ordering. Desktop mutation authorization and native Studio login limits are now implemented locally. Studio upload quotas and cross-service revocation are now implemented locally. Trusted edge limiting, admin MFA, storage inventory/restore operations and broader payment operations remain open. Dependency audit results are package-advisory coverage, not evidence that these application-level issues are resolved.
