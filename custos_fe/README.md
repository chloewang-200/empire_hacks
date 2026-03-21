# Custos

**Spend governance for AI agents.** Custos is the control layer and decisioning layer for agent payments. Connect AI agents, assign them to wallets, define policies and limits, and review transaction requests.

## Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS** + design tokens aligned with the marketing site (Plaid-inspired fintech)
- **shadcn/ui** (Radix primitives)
- **TanStack Query** for data fetching
- **react-hook-form + zod** for forms and validation
- **next-auth** (Google provider; email sign-in scaffolded)
- **next-themes** for dark mode support

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment**

   Copy `.env.example` to `.env.local` and set:

   - `NEXTAUTH_URL` (e.g. `http://localhost:3000`)
   - `NEXTAUTH_SECRET` (e.g. `openssl rand -base64 32`)
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (see **Google sign-in** below)
   - `NEXT_PUBLIC_ENABLE_AUTH="true"` so the login page uses real Google OAuth (not “skip to overview”)
   - With **custos_be** running: `NEXT_PUBLIC_API_URL`, `CUSTOS_API_URL` (e.g. `http://localhost:4000`), and `CUSTOS_INTERNAL_SECRET` matching the backend

3. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Unauthenticated users are redirected to `/login`; after sign-in they land on `/overview`.

## Google sign-in (OAuth)

1. Open [Google Cloud Console](https://console.cloud.google.com/) → select or create a project.
2. **APIs & Services** → **OAuth consent screen**: choose **External** (or Internal for Workspace-only), add app name, support email, developer contact, then **Save and continue** through scopes (defaults are fine for email/profile) and test users (add your Gmail if the app is in Testing).
3. **Credentials** → **Create credentials** → **OAuth client ID** → Application type **Web application**.
4. Under **Authorized JavaScript origins** add:
   - `http://localhost:3000` (and your production origin later, e.g. `https://yourdomain.com`).
5. Under **Authorized redirect URIs** add:
   - `http://localhost:3000/api/auth/callback/google` (and production: `https://yourdomain.com/api/auth/callback/google`).
6. Create the client and copy **Client ID** and **Client secret** into `.env.local` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
7. Ensure `NEXTAUTH_URL` exactly matches the site origin you use in the browser (e.g. `http://localhost:3000`).

After sign-in, the server calls **custos_be** `/api/internal/bootstrap` to create or update your user and workspace (wallets and agents are **not** auto-created; you add them in the UI).

### Troubleshooting `?error=OAuthSignin` on `/login`

1. Set **`NEXTAUTH_SECRET`** in `.env.local` (e.g. `openssl rand -base64 32`) — empty secret breaks JWT signing.
2. **`GOOGLE_CLIENT_ID`** and **`GOOGLE_CLIENT_SECRET`** must match the OAuth Web client (no extra spaces; paste the secret from Google or reset it).
3. **Redirect URI** in Google Cloud must be exactly: `http://localhost:3000/api/auth/callback/google` (same port as `NEXTAUTH_URL`).
4. If the OAuth consent screen is in **Testing**, add your Gmail under **Test users**.

With `NODE_ENV=development`, NextAuth prints more detail in the **terminal** where `npm run dev` runs.

### Still seeing “Operations Wallet” / “Invoice Agent” after we removed auto-creation?

Bootstrap **no longer** creates those rows. If they still appear, they’re **old rows** in local SQLite from before the change (same Google user → same workspace → data still there). **Dev only:** from `custos_be` run `npm run db:reset` (wipes the local DB), then restart `custos_be` and sign in again — you’ll get an **empty** workspace until you create wallets/agents in the UI. Do **not** use this against a production database.

## Structure

- **`/app`** — Routes: auth (login), dashboard (overview, agents, wallets, transactions, review-queue, templates, invoice, settings).
- **`/components`** — Layout (AppShell, Sidebar, Topbar, AccountMenu), UI (button, card, table, dialog, sheet, form, badges), domain (agents, wallets, transactions, status, empty-state).
- **`/lib`** — Types, API client, validators, constants, auth config.
- **`/providers`** — SessionProvider, QueryClient, ThemeProvider.

## API

The frontend is built against a typed API surface. Route handlers under `/app/api` are **placeholder implementations** that return typed JSON. Replace them with real backend calls by:

- Pointing `NEXT_PUBLIC_API_URL` to your API, or
- Implementing server-side calls inside the same route handlers and returning the same types.

Key endpoints (see `/lib/api` and `/app/api`):

- Agents: `GET/POST /api/agents`, `GET/PATCH/DELETE /api/agents/:id`, `POST /api/agents/:id/api-key`
- Wallets: `GET/POST /api/wallets`, `GET/PATCH/DELETE /api/wallets/:id`, `POST /api/wallets/:id/fund`
- Transactions: `GET /api/transactions`, `GET /api/transactions/:id`, `POST /api/transactions/request`, `PATCH /api/transactions/:id/review`
- Review queue: `GET /api/review-queue`
- Templates: `GET /api/templates`, `GET /api/templates/invoice`
- Invoice: `POST /api/invoice/upload`, `POST /api/invoice/extract`

## Design

Styles follow the marketing site (agent-guard-gate): Inter font, primary blue `hsl(217 91% 60%)`, slate neutrals, subtle shadows, `--radius: 0.625rem`. Use semantic classes: `bg-primary`, `text-foreground`, `border-border`, `rounded-lg`, etc.

## Testing mode

The **Add Funds** flow is explicitly in testing mode: it shows Venmo instructions and a placeholder for a QR code, with no real payment rails. The UI is built so real funding (e.g. Stripe) can replace this later.
