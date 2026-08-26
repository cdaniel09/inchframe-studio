# Inchframe Studio

The Inchframe Studio sales site and private client production portal. It runs as a standard Next.js Node application and stores its SQLite database and uploaded media on a persistent disk.

## Customer flow

1. A new customer creates an account with name, email, and password—no invitation code.
2. The customer verifies their email, signs in, and submits a short inquiry without uploads.
3. The customer requests a certified creator, or chooses **Match Me** so the Studio routes the brief to one creator.
4. The creator sends the customer-facing quote. The customer can accept, decline, or make up to two structured counteroffers.
5. Quotes below the platform/creator minimum are rejected automatically. High-value or rush quotes receive an admin exception check, but the admin does not set the price.
6. An accepted quote opens Stripe Checkout for the required project payment: full payment below $500, 50% from $500–$999, and 40% at $1,000+.
7. A signed Stripe webhook records payment, locks the creator assignment, and opens the advanced questionnaire, media, review, and delivery workspace.

The older one-time access-code flow remains available to the admin as a manual exception for legacy inquiries.

## Local setup

1. Install Node 22.14 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Generate the admin hash with `npm run hash-password -- "your-long-password"` and paste the output into `ADMIN_PASSWORD_HASH`.
5. Replace `AUTH_SECRET` with a private random value.
6. Configure the SMTP variables, or set `EMAIL_TRANSPORT=console` for local-only email-link testing.
7. Add Stripe test keys and forward Stripe CLI events to `http://localhost:3000/api/stripe/webhook`.
8. Run `npm run dev` and open `http://localhost:3000`.

The local SQLite database and uploads are created automatically in `data/`.

## Render setup

Create a Blueprint from this repository. `render.yaml` provisions one Starter Node web service and a 1 GB persistent disk mounted at `/var/data`. No separate database service is required for this single-instance MVP.

Add these secret values in Render:

- `ADMIN_PASSWORD_HASH` — generate it locally with the command above.
- `SMTP_PASS` — the mailbox password for `info@inchframe.com`, not the Hostinger account password.
- `STRIPE_SECRET_KEY` — the live secret key for the Inchframe platform account.
- `STRIPE_WEBHOOK_SECRET` — the signing secret for the live Studio webhook endpoint.
- `CREATOR_INVITE_SECRET` — the same signing secret used by the paid Inchframe account service.

The Blueprint supplies `smtp.hostinger.com`, port `465`, `info@inchframe.com`, and the public Studio URL. Render generates `AUTH_SECRET` automatically. Never put real passwords or secret values in Git.

In Stripe Workbench, create a webhook endpoint at `https://studio.inchframe.com/api/stripe/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Deposit Checkout is implemented against the platform account. Connected-account onboarding and automated creator transfers should be enabled only after the production Connect account configuration is approved; until then, creator payout remains an admin accounting step.

After the service is live, add `studio.inchframe.com` as a custom domain and point its DNS record to the value Render provides.

## Access

- Admin: `/login` with `ADMIN_EMAIL` and the password used to create `ADMIN_PASSWORD_HASH`.
- Clients: `/register`, email verification, then `/login`.
- Portal: `/portal`.

This single-instance disk design keeps initial cost and operations low. Move the database to managed Postgres and files to object storage before scaling to multiple instances.

## Paid Pro creator invite contract

The main Inchframe account site issues creator invite keys; Studio only verifies and consumes them. Configure the same long random `CREATOR_INVITE_SECRET` on both services.

Key format: `ifc1.<base64url-json>.<base64url-hmac>`

Payload:

```json
{"v":1,"email":"member@example.com","plan":"pro","purpose":"creator","exp":1770000000,"nonce":"uuid"}
```

Sign the ASCII string `ifc1.<base64url-json>` with HMAC-SHA256 and encode the signature as unpadded base64url. Studio requires the payload email to match the private Inchframe email in the application, rejects expired/non-Pro keys, and stores a SHA-256 hash under a unique constraint so one key cannot establish multiple creator profiles. A seven-day expiry is recommended. Do not put invite keys in URLs; let the member copy and paste the key from their paid account.
