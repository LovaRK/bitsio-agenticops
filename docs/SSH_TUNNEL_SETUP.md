# SSH Tunnel Setup (Vultr + Splunk)

Use this when Splunk management/API is private and only reachable through SSH.

## Goal

Forward local port `8089` to remote Splunk `8089`:

`localhost:8089 -> 144.202.48.85:8089`

## Vultr Console Steps (for Teja/Rama)

1. Open [https://my.vultr.com](https://my.vultr.com)
2. Go to `Products` / `Instances`
3. Select instance `144.202.48.85`
4. Click `View Console` (or `Launch Web Console`)
5. Login as `root`
6. Ensure SSH key exists in `~/.ssh/authorized_keys` for the machine running AgenticOps

## Local Tunnel Commands

From local machine:

```bash
cd /Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops
make tunnel-start
make tunnel-status
```

Manual alternative:

```bash
ssh -N -L 8089:localhost:8089 root@144.202.48.85
```

Keep that terminal open.

## Verify Tunnel

```bash
curl -k -m 8 https://localhost:8089/services/server/info?output_mode=json
```

Expected: JSON response from Splunk server info (not timeout).

## Recommended SSH Config (Optional)

Add to `~/.ssh/config`:

```text
Host bitsio-splunk
  HostName 144.202.48.85
  User root
  LocalForward 8089 localhost:8089
```

Then:

```bash
ssh bitsio-splunk
```

## Common Errors

### `Permission denied`

- Root password auth disabled or wrong key.
- Add proper public key via Vultr console.

### `Connection timed out`

- Instance/network/firewall issue.
- Check instance state and firewall rules for SSH.

### Tunnel active but app gets 401

- Tunnel is fine; token is invalid/expired.
- Regenerate `SPLUNK_MCP_TOKEN` and retry.
