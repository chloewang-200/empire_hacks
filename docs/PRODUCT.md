# Custos — product overview

**Custos** is spend governance for AI agents: agents call your API to request payments; you assign them to **wallets**, enforce **policies** (limits, approval mode, payee rules, optional automated payout), and **review or auto-process** those requests.

- **Frontend (`custos_fe`)** — Next.js operator dashboard (wallets, payees, agents, transactions, review).
- **Backend (`custos_be`)** — Fastify API, Prisma, SQLite (default), policy evaluation, Stripe integration for funding and optional Connect payouts.

---

## Core concepts

| Concept | Role |
|--------|------|
| **Workspace** | Container for a user’s wallets, agents, transactions, and approved payees. |
| **Wallet** | Prefunded balance (cents), currency, status, and **policy** (JSON) that gates every spend request. |
| **Agent** | Tied to one wallet; authenticates with an **API key** to create transaction requests. |
| **Approved payee** | Vendor directory entry (display name, aliases for matching, default rail, payment notes, optional **Stripe Connect `acct_…`**). |
| **Transaction** | A single spend request: amount, vendor/category, memo, purpose/context, rail, optional evidence, payee resolution, policy outcome, and optional **payout execution** metadata. |

---

## Wallet policy (what gets enforced)

Policy is stored as JSON on the wallet. Typical fields include:

- **Approval mode** — `auto`, `review`, or `strict` (evidence expectations differ in strict mode).
- **Limits** — Per-transaction and daily (in major units in the API; converted to cents server-side).
- **Categories / vendors** — Allowed categories; restricted vendors (substring match).
- **Require approved payee** — If on, the vendor must match a directory payee (or the request must include a valid `payeeId`), otherwise the request is sent to review / flagged appropriately.
- **Auto-execute payout** — If on, after a request is **policy-approved**, the server may attempt a **real transfer** (see below). Also requires **wallet balance ≥ request amount** or the request is blocked (`insufficient_balance`).
- **Allowed payout rails** — Optional allow-list; if set, the requested rail must be listed or the request goes to review (`payout_rail_not_allowed`).

Workspace **spend mode** (e.g. manual real-money mode) can still force human review even when policy would auto-approve.

---

## Agent payment request (high level)

Agents POST a structured body (see backend route and Zod schema in `custos_be/src/index.ts`) including things like:

- Amount, currency, vendor, category, memo, optional purpose and structured `context`
- Optional `payeeId`, `railType`
- Optional `stripeConnectAccountId`, `venmoHandle` (per-request overrides / hints)
- Optional evidence attachments / file references (as implemented)

The server resolves payees, runs **policy evaluation**, persists **policy checks** and **audit events**, sets status/review state, and may invoke **automated payout** when configured and approved.

---

## Money movement

### Funding wallets (inbound)

- **Stripe** — Payment intents / top-up flows for prefunding wallets (test keys supported). See `custos_be/.env.example` for `STRIPE_SECRET_KEY` and related flags.
- **Manual / demo** — Optional env-gated paths for development (e.g. manual fund bump, “Carlos” style credit) — not for production use as-is.

### Payouts (outbound to vendors)

| Rail | Current behavior |
|------|------------------|
| **Stripe Connect** (`stripe_connect` or `merchant_card` with a destination) | When **auto-execute payout** is on, policy is **approved**, balance is sufficient, Stripe is configured, and a valid **`acct_…`** is present (on the matched payee or on the request), the backend can call **`stripe.transfers.create`** (idempotent key per transaction). On success, wallet balance is reduced and the transaction moves toward **settled** as implemented. |
| **Venmo** (`venmo_p2p`, etc.) | **No automated send API** in this codebase. The transaction is marked with an **unsupported rail** style outcome and operators pay manually using payee instructions. |

**Requirements for real Connect payouts:** Platform Stripe account with **available balance**, Connect onboarding for connected accounts, and correct env configuration. Comments in `custos_be/.env.example` call this out.

---

## Operator UI (what exists today)

- **Wallets** — Create/edit, view balance and policy summary, **auto payout** and **allowed rails**, link to agents and transactions, add funds where enabled.
- **Payees** — Directory CRUD; **Stripe Connect account id** on create (and via API for updates); rails include Stripe Connect and Venmo (labeled as manual/unsupported for automation).
- **Agents** — Assign wallet, keys, roles/capabilities as modeled.
- **Transactions** — List and detail / sheet with **policy evaluation**, **audit timeline**, matched payee (including Stripe id when present), and **payout execution** block (status, provider, external id, error, timestamp) when present.
- **Review queue** — Surfaces items needing human attention (depending on status/policy).

---

## What is working end-to-end (today)

1. **Agent → transaction** — Authenticated agent requests create transactions; **policy runs** (limits, vendor/category, optional payee match, strict/review/auto, and with auto payout: balance + rail allow-list).
2. **Payee resolution** — Match by vendor string and/or explicit `payeeId`; policy can **require** a match.
3. **Human-in-the-loop** — Pending review, blocked, and audit/history in the UI.
4. **Wallet funding** — Stripe-backed and optional dev shortcuts, subject to env and workspace mode.
5. **Automated Stripe Connect payout** — **When all gates pass** and Stripe + `acct_…` are valid, a transfer can execute and state fields reflect success or failure/skipped/unsupported.

---

## Known gaps / caveats

- **Venmo (and many rails)** — Not automated; marked for operator follow-up.
- **Payee Stripe field in UI** — Exposed on **create**; editing payees in the UI may not expose every API field (PATCH supports more on the backend).
- **Policy merge** — Wallet edit form merges with existing policy so fields not shown in the form are preserved; new wallets only send what the form includes.
- **SQLite / single-node** — Default database is local SQLite; scale and multi-instance behavior are not the focus of this build.
- **Invoice extraction** — Optional sidecar URL (`CUSTOS_INVOICE_AGENT_URL`); wiring depends on your deployed extract service.

---

## Related files

| Area | Location |
|------|----------|
| API routes & request schemas | `custos_be/src/index.ts` |
| Policy evaluation | `custos_be/src/policy.ts` |
| Transaction creation flow & payout trigger | `custos_be/src/transactionFlow.ts` |
| Stripe payout execution | `custos_be/src/payoutExecution.ts` |
| Env template | `custos_be/.env.example` |
| Frontend README (run instructions) | `custos_fe/README.md` |

---

*Last updated to reflect the automated payout and payee/policy work in this repository. Update this doc when you ship major behavior changes.*
