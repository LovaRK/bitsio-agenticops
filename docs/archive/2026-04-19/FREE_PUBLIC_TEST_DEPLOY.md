# Free Public Testing Deployment

This gives you a shareable public URL with zero infra cost (good for demos).

## Option A: Quick share URL (fastest)

Use local runtime + Cloudflare quick tunnel.

1. Start app locally:

```bash
make local
```

2. Open public tunnel:

```bash
make share-web
```

3. Share the generated `https://*.trycloudflare.com` URL.

Notes:
- Free and immediate.
- URL changes every run.
- Your laptop must stay online while others test.

## Option B: Low-cost always-on deployment (later)

For stable URL and always-on:

- Deploy API + Web to your Vultr server with Docker Compose.
- Put Nginx/Caddy in front with HTTPS.
- Use a DNS name (for example, `demo.bitsio.ai`).

This is the production path once demo validation is complete.

## Required env for live mode

- `SPLUNK_MCP_BASE_URL`
- `SPLUNK_MCP_TOKEN`
- `ANTHROPIC_API_KEY` (if cloud model is used)

Never commit secrets into git. Use environment variables only.

## Health checklist before sharing

```bash
make local-status
curl -fsS http://127.0.0.1:8001/health
curl -fsS http://127.0.0.1:3000 >/dev/null
```

If all pass, share URL confidently.
