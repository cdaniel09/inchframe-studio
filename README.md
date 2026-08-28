# Inchframe Studio

The Inchframe Studio sales site and private client production portal. It runs as a standard Next.js Node application and stores its SQLite database and uploaded media on a persistent disk.

## Customer flow

1. A new or returning customer continues through Inchframe Account. Studio receives a verified identity through authorization-code + PKCE SSO and never receives the Account password.
2. Studio links existing local users by verified email, creates a local Studio session, and returns the customer to the requested page.
3. The customer submits a short inquiry without uploads, requests a Studio Partner, or asks Inchframe to route the brief through Pro Studio.
4. The Studio Partner sends the customer-facing quote. The customer can accept, decline, or make up to two structured counteroffers.
5. Quotes below the platform/creator minimum are rejected automatically. High-value or rush quotes receive an admin exception check, but the admin does not set the price.
6. An accepted quote opens Stripe Checkout for the required project payment: full payment below $500, 50% from $500–$999, and 40% at $1,000+.
7. A signed Stripe webhook records payment, locks the creator assignment, and opens the advanced questionnaire, media, review, and delivery workspace.
8. The assigned Studio Partner drafts a versioned production agreement covering the goal, scope, work product, exclusions, dates, milestones, revisions, responsibilities, communication, change control, and final delivery. The client accepts it or requests a recorded amendment before production proceeds.
9. Client, Studio Partner, and Studio use the project activity log for messages, progress, milestones, decisions, blockers, delivery notices, next steps, due dates, and assigned action items. Material conversations outside Studio must be summarized in the log.
10. The client reviews files in place. Accepting a final deliverable records final acceptance, completes the production agreement, and closes delivery action items.

The older one-time access-code flow remains available to the admin as a manual exception for legacy inquiries.

## Local setup

1. Install Node 22.14 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Generate the admin hash with `npm run hash-password -- "your-long-password"` and paste the output into `ADMIN_PASSWORD_HASH`.
5. Replace `AUTH_SECRET` with a private random value.
6. Configure the Account SSO variables. A localhost callback requires a separately registered Account development client; production accepts only the exact production callback.
7. Configure the SMTP variables, or set `EMAIL_TRANSPORT=console` for local-only legacy email-link testing.
8. Add Stripe test keys and forward Stripe CLI events to `http://localhost:3000/api/stripe/webhook`.
9. Run `npm run dev` and open `http://localhost:3000`.

The local SQLite database and uploads are created automatically in `data/`.

## Render setup

Create a Blueprint from this repository. `render.yaml` provisions one Starter Node web service and a 1 GB persistent disk mounted at `/var/data`. No separate database service is required for this single-instance MVP.

Add these secret values in Render:

- `ADMIN_PASSWORD_HASH` — generate it locally with the command above.
- `SMTP_PASS` — the mailbox password for `info@inchframe.com`, not the Hostinger account password.
- `STRIPE_SECRET_KEY` — the live secret key for the Inchframe platform account.
- `STRIPE_WEBHOOK_SECRET` — the signing secret for the live Studio webhook endpoint.
- `CREATOR_INVITE_SECRET` — the same signing secret used by the paid Inchframe account service.
- `STUDIO_SSO_CLIENT_SECRET` — the same confidential SSO client secret configured on Inchframe Account.

The Blueprint supplies `ACCOUNT_SSO_BASE_URL`, client ID, exact callback URI, hybrid rollout mode, `smtp.hostinger.com`, port `465`, `info@inchframe.com`, and the public Studio URL. Render generates `AUTH_SECRET` automatically. Never put real passwords or secret values in Git.

In Stripe Workbench, create a webhook endpoint at `https://studio.inchframe.com/api/stripe/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Deposit Checkout is implemented against the platform account. Connected-account onboarding and automated creator transfers should be enabled only after the production Connect account configuration is approved; until then, creator payout remains an admin accounting step.

After the service is live, add `studio.inchframe.com` as a custom domain and point its DNS record to the value Render provides.

## Access

- Account-first login: `/login` → Inchframe Account → Studio callback.
- Temporary migration fallback: existing Studio credentials remain under the collapsed legacy sign-in while `STUDIO_AUTH_MODE=hybrid`.
- Partner application: `/studio-partners/apply` requests `studio_partner` intent and refreshes paid Pro eligibility from Account.
- Portal: `/portal`.
- Admin operations: `/portal/operations` aggregates all project agreements, action items, blockers, pending reviews, deadlines, and recent activity.
- Admin users: `/portal/users` lists Studio users, Account links, Partner/application status, projects, sessions, and safe Studio access controls.

This single-instance disk design keeps initial cost and operations low. Move the database to managed Postgres and files to object storage before scaling to multiple instances.

## Studio Partner eligibility

Account SSO is the primary source of paid Pro Studio Partner eligibility. The manual invitation key remains only as a migration fallback for legacy Studio identities. Configure the same long random `CREATOR_INVITE_SECRET` on both services until that fallback is retired.

Key format: `ifc1.<base64url-json>.<base64url-hmac>`

Payload:

```json
{"v":1,"email":"member@example.com","plan":"pro","purpose":"creator","exp":1770000000,"nonce":"uuid"}
```

Sign the ASCII string `ifc1.<base64url-json>` with HMAC-SHA256 and encode the signature as unpadded base64url. Studio requires the payload email to match the private Inchframe email in the application, rejects expired/non-Pro keys, and stores a SHA-256 hash under a unique constraint so one key cannot establish multiple creator profiles. A seven-day expiry is recommended. Do not put invite keys in URLs; let the member copy and paste the key from their paid account.
