# ACCESS_AND_DEPENDENCY_CHECKLIST

Updated: 2026-04-08
Project: BitsIO AgenticOps (Pro Core+UI, Phases 0-7)

## Already Provided
- `SPLUNK_MCP_BASE_URL`: provided (live endpoint available)
- Splunk environment/license: available
- Vultr server host:
  - IP: `144.202.48.85`
  - SSH user: `root`
  - SSH password: provided out-of-band (do not store in repo)

## Pending (Tomorrow)
- `SPLUNK_MCP_TOKEN`
- `ANTHROPIC_API_KEY` (needed only for live model calls; mock mode already works)

## Still Required to Complete Team Workflow
- GitHub remote repository URL (to push and open PRs)
- Confirmation that Splunk token has read-only role and access to index `tutorial`

## Optional Later (Post-MVP / Hardening)
- OIDC settings:
  - `OIDC_ISSUER`
  - `OIDC_AUDIENCE`
- Vault/secret manager settings:
  - `VAULT_ADDR`
  - `VAULT_TOKEN`
- Cloud deployment credentials (if promoting beyond local Docker)

## Security Rules
- Never commit secrets to git.
- Keep all runtime secrets in environment variables or vault.
- Rotate any credential that was shared in chat.
