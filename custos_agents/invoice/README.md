# Invoice Agent Local Setup

This service exposes `POST /extract` for invoice extraction. `custos_be` can point to it with:

`CUSTOS_INVOICE_AGENT_URL=http://localhost:4001/extract`

## Local env

1. Copy `.env.example` to `.env`
2. Add your API key

Recommended:

```bash
ANTHROPIC_API_KEY=your_claude_key_here
ANTHROPIC_MODEL=claude-sonnet-4-20250514
ENABLE_LOCAL_PLAYGROUND=true
```

Optional fallback:

```bash
OPENAI_API_KEY=your_openai_key_here
OPENAI_VISION_MODEL=gpt-4o-mini
```

If neither key is set, the service returns mock extraction data.

## Run locally

```bash
cd custos_agents/invoice
export $(grep -v '^#' .env | xargs)
npm run dev
```

The service will start on `http://localhost:4001` by default.

If `ENABLE_LOCAL_PLAYGROUND=true`, you can open:

`http://localhost:4001`

That local page lets you upload an invoice image or PDF and inspect the extraction response without touching `custos_fe` or `custos_be`.

## Notes

- Claude is tried first when `ANTHROPIC_API_KEY` or `CLAUDE_API_KEY` is set.
- OpenAI is used only if no Claude key is present.
- Claude supports both images and PDFs in this local setup.
- OpenAI in this service is still image-oriented, matching the previous behavior.
- The playground is local-only and only enabled when `ENABLE_LOCAL_PLAYGROUND=true`.
