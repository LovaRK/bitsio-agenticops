# ACCESS_AND_DEPENDENCY_CHECKLIST

Updated: 2026-04-13
Project: BitsIO AgenticOps (Pro Core+UI + Phase 8 + Live Native Splunk)

## Already Provided
- `SPLUNK_MCP_BASE_URL`: provided
- `SPLUNK_MCP_TOKEN`: provided
- Splunk environment/license: available
- Vultr server host:
  - IP: `144.202.48.85`
  - SSH user: `root`
  - SSH access: key-based preferred for stable tunneling

## Still Required to Complete Team Workflow
- GitHub remote repository URL (to push and open PRs)
- Confirmation token scope policy:
  - read/search on `index=tutorial`
  - no admin write on production indexes
- Optional: dedicated read-only service account token for demos

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
- Rotate any credential shared in chat channels.
