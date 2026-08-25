# Inchframe Studio

The Inchframe Studio sales site and private client production portal. It runs as a standard Next.js Node application and stores its SQLite database and uploaded media on a persistent disk.

## Local setup

1. Install Node 22.14 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Generate the admin hash with `npm run hash-password -- "your-long-password"` and paste the output into `ADMIN_PASSWORD_HASH`.
5. Replace `AUTH_SECRET` and `CLIENT_SIGNUP_CODE` with private random values.
6. Run `npm run dev` and open `http://localhost:3000`.

The local SQLite database and uploads are created automatically in `data/`.

## Render setup

Create a Blueprint from this repository. `render.yaml` provisions one Starter Node web service and a 1 GB persistent disk mounted at `/var/data`. During the first Blueprint sync, Render asks for:

- `ADMIN_PASSWORD_HASH` — generate it locally with the command above.
- `CLIENT_SIGNUP_CODE` — a private code you give approved clients.

Render generates `AUTH_SECRET` automatically. No separate database service is required for this MVP.

After the service is live, add `studio.inchframe.com` as a custom domain and point the DNS record to the value Render provides. Do not put real secret values in Git.

## Access

- Admin: `/login` with `ADMIN_EMAIL` and the password used to create `ADMIN_PASSWORD_HASH`.
- Clients: `/register` with the private `CLIENT_SIGNUP_CODE`, then `/login`.
- Portal: `/portal`.

This single-instance disk design keeps the initial cost and operational setup low. Move the database to managed Postgres and files to object storage before scaling to multiple instances.
