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
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for Google sign-in

3. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Unauthenticated users are redirected to `/login`; after sign-in they land on `/overview`.

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
