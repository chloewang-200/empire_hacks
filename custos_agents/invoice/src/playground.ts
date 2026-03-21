import type { Express } from "express";

export function registerPlayground(app: Express) {
  app.get("/", (_req, res) => {
    res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Custos Invoice Agent Playground</title>
    <style>
      :root {
        color-scheme: light;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body {
        margin: 0;
        background: linear-gradient(180deg, #f7f8f4 0%, #eef2e8 100%);
        color: #1f2a1f;
      }
      .wrap {
        max-width: 860px;
        margin: 0 auto;
        padding: 40px 20px 64px;
      }
      .card {
        background: rgba(255, 255, 255, 0.88);
        border: 1px solid #d6ddcf;
        border-radius: 20px;
        padding: 24px;
        box-shadow: 0 10px 30px rgba(53, 71, 53, 0.08);
        backdrop-filter: blur(6px);
      }
      h1 {
        margin: 0 0 8px;
        font-size: 32px;
      }
      p {
        margin: 0 0 16px;
        line-height: 1.5;
      }
      .muted {
        color: #556255;
      }
      form {
        display: grid;
        gap: 14px;
        margin-top: 20px;
      }
      input[type="file"] {
        display: block;
        width: 100%;
        padding: 14px;
        border: 1px dashed #9aac95;
        border-radius: 14px;
        background: #f8fbf6;
      }
      button {
        width: fit-content;
        border: 0;
        border-radius: 999px;
        padding: 12px 18px;
        background: #2f6c4f;
        color: white;
        font-weight: 600;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.6;
        cursor: progress;
      }
      pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        background: #101812;
        color: #dff3e4;
        border-radius: 16px;
        padding: 18px;
        min-height: 180px;
        overflow: auto;
      }
      .row {
        display: grid;
        gap: 20px;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border-radius: 999px;
        background: #edf5ea;
        color: #35523f;
        font-size: 13px;
        font-weight: 600;
      }
      @media (min-width: 860px) {
        .row {
          grid-template-columns: 0.95fr 1.05fr;
          align-items: start;
        }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="pill">Local Playground Enabled</div>
        <h1>Invoice Agent Playground</h1>
        <p class="muted">
          Upload an invoice image or PDF to test the local extraction service without touching the main app.
        </p>
        <div class="row">
          <div>
            <form id="extract-form">
              <input id="file" name="file" type="file" accept="image/*,application/pdf" required />
              <button id="submit" type="submit">Run extraction</button>
            </form>
            <p class="muted" style="margin-top: 16px;">
              This posts directly to <code>/extract</code> on the same local service.
            </p>
          </div>
          <pre id="result">Choose a file and run extraction.</pre>
        </div>
      </div>
    </div>
    <script>
      const form = document.getElementById("extract-form");
      const fileInput = document.getElementById("file");
      const submit = document.getElementById("submit");
      const result = document.getElementById("result");

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;

        submit.disabled = true;
        result.textContent = "Running extraction...";

        try {
          const data = new FormData();
          data.append("file", file);

          const response = await fetch("/extract", {
            method: "POST",
            body: data,
          });

          const json = await response.json();
          result.textContent = JSON.stringify(json, null, 2);
        } catch (error) {
          result.textContent = JSON.stringify(
            { message: error instanceof Error ? error.message : "Request failed" },
            null,
            2
          );
        } finally {
          submit.disabled = false;
        }
      });
    </script>
  </body>
</html>`);
  });
}
