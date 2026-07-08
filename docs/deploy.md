# Deploy — Railway runbook

Single Railway service + a volume. The filesystem artifact store on the volume IS the persistence for this phase (Postgres deferred).

## One-time setup

1. **Create the project** — Railway dashboard → New Project → Deploy from GitHub repo → pick this repo. Railway (nixpacks) detects Node + pnpm; `pnpm build` then `pnpm start` are the defaults it needs (both exist in `package.json`).
2. **Add a volume** — service → right-click / Settings → Attach Volume, mount path `/data`. Artifacts (scrape HTML, parse/research/tags/generate JSON) live here and survive redeploys.
3. **Set environment variables** (service → Variables):

   | Variable | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `ARTIFACTS_DIR` | `/data` |
   | `ACCESS_KEY` | generate one, e.g. `openssl rand -hex 16`; share with teammates |
   | `DEFAULT_LLM` | `openai` |
   | `OPENAI_API_KEY` | from 1Password / local `.env` |
   | `OPENAI_MODEL` | `gpt-5.5` |
   | `OPENAI_MODEL_FAST` | optional; cheaper model for generation calls |
   | `DEFAULT_SCRAPER` | `brightdata-unlocker` |
   | `BRIGHTDATA_UNLOCKER_TOKEN` | from local `.env` |
   | `BRIGHTDATA_UNLOCKER_ZONE` | from local `.env` |

   `PORT` is injected by Railway; the app reads it and binds `0.0.0.0`.

4. **Generate a public domain** — service → Settings → Networking → Generate Domain. The UI is at `https://<domain>/`, the API under the same origin.

## Seeding stored artifacts (nice-to-have)

Local `tmp/` already holds researched/tagged SKUs (`UK_B0C4BG7R2L`, `IN_B07M8H2HR4`, `IN_B0B8PDHRWY`, `IN_B0BLFNYT6Z`) — uploading them avoids re-paying for research. With the Railway CLI linked to the service:

```bash
railway volume files upload tmp --path /
```

(Uploads the contents of local `tmp/` to the volume root, so `/data/tags/...` etc. resolve. Check `railway volume files --help` for your CLI version's exact flags.)

## Post-deploy verification

- [ ] `GET https://<domain>/health` → 200 without a key.
- [ ] `GET https://<domain>/tags?input=B0C4BG7R2L` **without** `x-access-key` → 401.
- [ ] Open `https://<domain>/`, enter the access key, "Load stored tags" for `https://www.amazon.co.uk/dp/B0C4BG7R2L` → tag matrix renders (proves volume + guard + UI).
- [ ] Full `POST /generate` on a fresh SKU through the UI completes (~1–2 min; proves the Railway edge's 5-min silence budget and BrightData/OpenAI egress from Railway).
- [ ] Redeploy the service; stored tags still load (volume persists).

## Platform notes

- Railway's edge closes an HTTP request after **5 minutes of no data** (up to 15 min if data flows). Our longest silent call (research ~75s, generate ~1–2 min) fits. If a long call dies at exactly 5 min, suspect app-level timeouts first — Fastify defaults are fine.
- The volume mounts at runtime at `/data`; app code is at `/app`. Never point `ARTIFACTS_DIR` inside `/app` (wiped every deploy).
- Playwright is a dependency but downloads no browsers on install; if nixpacks trips on it, move it to `optionalDependencies`.
