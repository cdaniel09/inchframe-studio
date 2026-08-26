# Inchframe Studio

The Inchframe Studio sales site and private client production portal. It runs as a standard Next.js Node application and stores its SQLite database and uploaded media on a persistent disk.

## Customer flow

1. A new customer creates an account with name, email, and password—no invitation code.
2. The customer verifies their email, signs in, and submits a short inquiry without uploads.
3. The Studio admin reviews the inquiry in `/portal` and accepts or declines it.
4. Acceptance emails a one-time, project-specific code that expires after 14 days.
5. The customer enters the code once to unlock that project’s detailed questionnaire, image seeds, audio, reviews, and delivery area.

## Local setup

1. Install Node 22.14 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Generate the admin hash with `npm run hash-password -- "your-long-password"` and paste the output into `ADMIN_PASSWORD_HASH`.
5. Replace `AUTH_SECRET` with a private random value.
6. Configure the SMTP variables, or set `EMAIL_TRANSPORT=console` for local-only email-link testing.
7. Run `npm run dev` and open `http://localhost:3000`.

The local SQLite database and uploads are created automatically in `data/`.

## Render setup

Create a Blueprint from this repository. `render.yaml` provisions one Starter Node web service and a 1 GB persistent disk mounted at `/var/data`. No separate database service is required for this single-instance MVP.

Add these secret values in Render:

- `ADMIN_PASSWORD_HASH` — generate it locally with the command above.
- `SMTP_PASS` — the mailbox password for `info@inchframe.com`, not the Hostinger account password.

The Blueprint supplies `smtp.hostinger.com`, port `465`, `info@inchframe.com`, and the public Studio URL. Render generates `AUTH_SECRET` automatically. Never put real passwords or secret values in Git.

After the service is live, add `studio.inchframe.com` as a custom domain and point its DNS record to the value Render provides.

## Access

- Admin: `/login` with `ADMIN_EMAIL` and the password used to create `ADMIN_PASSWORD_HASH`.
- Clients: `/register`, email verification, then `/login`.
- Portal: `/portal`.

This single-instance disk design keeps initial cost and operations low. Move the database to managed Postgres and files to object storage before scaling to multiple instances.
