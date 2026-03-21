# Custos Backend + Invoice Agent: Local CLI Testing

This guide shows how to run the services locally and test an agent end-to-end **from the CLI** (using `curl`).

---

## 0. Prerequisites

- Node.js and npm installed
- From the repo root, you have these folders:
  - `custos_be` (backend API)
  - `custos_fe` (Next.js frontend – optional for CLI tests)
  - `custos_agents/invoice` (invoice extraction agent)

Make sure `custos_be/.env` is set up (you can copy `.env.example` as a starting point):

```bash
cd custos_be
cp .env.example .env
```

Key env vars for local dev:

- `DATABASE_URL="file:./dev.db"` (SQLite file in custos_be)
- `CUSTOS_ALLOW_UNAUTHENTICATED_DEMO="true"` (lets you hit most user APIs without logging in)
- `CUSTOS_INVOICE_AGENT_URL="http://localhost:4001/extract"` (points to the invoice agent)

---

## 1. Install dependencies

From the repo root:

```bash
cd custos_be
npm install

cd ../custos_agents/invoice
npm install

cd ../custos_fe
npm install # or yarn, if you prefer
```

---

## 2. Run the services

Use three terminals.

### 2.1 Invoice agent

```bash
cd custos_agents/invoice
npm run dev
```

- Listens on `PORT` (default `4001`).
- Exposes:
  - `POST /extract` (multipart field `file`)
  - `GET /health`

### 2.2 Backend API

```bash
cd custos_be
npm run dev
```

- Listens on `PORT` from `.env` (default `4000`).
- Provides all `/api/*` endpoints used by the dashboard and agents.

### 2.3 Frontend (optional for CLI-only testing)

```bash
cd custos_fe
npm run dev
```

- Runs at `http://localhost:3000` (not required if you only use the CLI).

---

## 3. Seed / initialize the database (optional but recommended)

You can let the API calls create users/workspaces automatically, but for completeness you can run:

```bash
cd custos_be
npx prisma generate
npx prisma db push
npm run db:seed # optional demo data, if provided
```

---

## 4. Get a dev JWT (user token) via CLI

From `custos_be` with the server running on `http://localhost:4000`:

```bash
curl -X POST http://localhost:4000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Response example:

```json
{
  "token": "<JWT>",
  "userId": "...",
  "workspaceId": "..."  // if present
}
```

Export the token so subsequent commands are easier:

```bash
export CUSTOS_TOKEN="<paste token here>"
```

Most user-facing endpoints require:

```bash
-H "Authorization: Bearer $CUSTOS_TOKEN"
```

Because `CUSTOS_ALLOW_UNAUTHENTICATED_DEMO="true"` in `.env`, some endpoints will also auto-pick the first user in the DB for convenience.

---

## 5. Create a wallet via API

Create a wallet that your agent will spend from:

```bash
curl -X POST http://localhost:4000/api/wallets \
  -H "Authorization: Bearer $CUSTOS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Wallet",
    "currency": "USD",
    "policy": {
      "approvalMode": "review",
      "limits": {}
    }
  }'
```

Grab the `id` from the response and export it:

```bash
export WALLET_ID="<wallet id from response>"
```

---

## 6. Create an agent attached to that wallet

```bash
curl -X POST http://localhost:4000/api/agents \
  -H "Authorization: Bearer $CUSTOS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"My Test Agent\",\
    \"assignedWalletId\": \"$WALLET_ID\",\
    \"capabilities\": [\"spend\"]
  }"
```

The response includes the new agent `id`:

```bash
export AGENT_ID="<agent id from response>"
```

---

## 7. Issue an API key for the agent

```bash
curl -X POST http://localhost:4000/api/agents/$AGENT_ID/api-key \
  -H "Authorization: Bearer $CUSTOS_TOKEN"
```

You’ll get something like:

```json
{
  "keyPrefix": "custos_abc123…",
  "fullKey": "custos_abc123...",
  "createdAt": "2026-03-21T...Z"
}
```

Export the full key for convenience:

```bash
export AGENT_API_KEY="custos_abc123..."  # fullKey
```

This is what a real external agent would use as its Bearer token.

---

## 8. Make the agent request a transaction (CLI-only)

Now call the agent endpoint directly using its API key:

```bash
curl -X POST http://localhost:4000/api/transactions/request \
  -H "Authorization: Bearer $AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10.5,
    "currency": "USD",
    "vendor": "Test Vendor Inc",
    "category": "software",
    "memo": "Test spend",
    "purpose": "Try out Custos via CLI",
    "evidence": [],
    "railType": "merchant_card"
  }'
```

The response is a transaction object. Key fields to look at:

- `status`: `approved`, `blocked`, or `pending_review`
- `policyResult`: high-level reason (e.g. `within_policy`, `over_limit`, `agent_inactive`, etc.)
- `policyEvaluation`: list of checks from wallet + agent gates
- `amount`, `currency`, `vendor`, `memo`, `purpose`, etc.

This shows exactly **what the agent is doing** from the backend’s point of view.

---

## 9. Inspect what your agent has done

List transactions created by this agent:

```bash
curl "http://localhost:4000/api/agents/$AGENT_ID/transactions?page=1" \
  -H "Authorization: Bearer $CUSTOS_TOKEN"
```

List all transactions in the workspace:

```bash
curl "http://localhost:4000/api/transactions?page=1&pageSize=20" \
  -H "Authorization: Bearer $CUSTOS_TOKEN"
```

Fetch one transaction by id:

```bash
export TX_ID="<transaction id>"

curl "http://localhost:4000/api/transactions/$TX_ID" \
  -H "Authorization: Bearer $CUSTOS_TOKEN"
```

---

## 10. Test the invoice agent + extraction flow

These steps hit the backend, which in turn uses the invoice agent running at `CUSTOS_INVOICE_AGENT_URL`.

### 10.1 Upload an invoice file

(Replace the path with a real file on your machine.)

```bash
curl -X POST http://localhost:4000/api/invoice/upload \
  -H "Authorization: Bearer $CUSTOS_TOKEN" \
  -F "file=@/absolute/path/to/invoice.png"
```

Response example:

```json
{
  "fileId": "inv_1711040000000",
  "url": null
}
```

Export `fileId`:

```bash
export INVOICE_FILE_ID="inv_1711040000000"
```

### 10.2 Run extraction (this will call the invoice agent)

```bash
curl -X POST http://localhost:4000/api/invoice/extract \
  -H "Authorization: Bearer $CUSTOS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"fileId\": \"$INVOICE_FILE_ID\"}"
```

- If `CUSTOS_INVOICE_AGENT_URL` is set and the agent is running, the backend will POST the file to your invoice agent and return its JSON.
- If it’s not set, you’ll get a mock extraction from the backend instead.

The extraction result includes fields like:

- `vendor`
- `invoiceNumber`
- `amount`
- `dueDate`
- `memo`
- `confidence`
- `railType`

You can then use those values to construct a `/api/transactions/request-as-user` or `/api/transactions/request` call.

---

## 11. Quick sanity checks

- Backend health:

  ```bash
  curl http://localhost:4000/health
  ```

- Invoice agent health:

  ```bash
  curl http://localhost:4001/health
  ```

If both return `{ "ok": true }`, your local environment is ready for CLI-based testing. <3
