# Empire Hacks — Custos

**Custos** is spend governance for AI agents: connect agents to wallets, enforce policies and limits, review payment requests, and expose a machine API so external agents can submit spend requests with API keys.

This repo is a **monorepo**:

| Directory | Purpose |
|-----------|---------|
| [`custos_fe/`](custos_fe/) | Next.js 14 dashboard (agents, wallets, transactions, review queue, invoice template UI). |
| [`custos_be/`](custos_be/) | Fastify + Prisma API: auth bootstrap, CRUD, policy checks, `POST /api/transactions/request` for agent API keys. |
| [`custos_agents/invoice/`](custos_agents/invoice/) | Optional template worker: sync invoice image extract (mock or OpenAI); `custos_be` can proxy to it via `CUSTOS_INVOICE_AGENT_URL`. |

Detailed frontend setup (Google OAuth, env vars, troubleshooting) lives in [`custos_fe/README.md`](custos_fe/README.md).

## Prerequisites

- **Node.js** 18+ (20+ recommended)
- **npm** (or use your preferred package manager per package)

## Local development (minimal)

Run services in separate terminals.

### 1. Backend API

```bash
cd custos_be
cp .env.example .env
# Edit .env: DATABASE_URL, CUSTOS_INTERNAL_SECRET, etc.

npx prisma db push
npm run dev
```

Default API: `http://localhost:4000` (see `PORT` in `.env`).

### 2. Frontend

```bash
cd custos_fe
cp .env.example .env.local
# Edit .env.local: NEXTAUTH_*, GOOGLE_*, NEXT_PUBLIC_API_URL, CUSTOS_API_URL, CUSTOS_INTERNAL_SECRET

npm install
npm run dev
```

App: `http://localhost:3000`.

### 3. Invoice extract agent (optional)

```bash
cd custos_agents/invoice
npm install
npm run dev
```

Set `CUSTOS_INVOICE_AGENT_URL=http://localhost:4001/extract` in `custos_be/.env` if you use OpenAI or the mock extractor.

## Data

Local development uses **SQLite** (`custos_be/dev.db`). The file is gitignored. To wipe local data only: from `custos_be` run `npm run db:reset` (destructive; never use on production).

## License

Private / hackathon — add a license if you open-source the project.
