# SSH Tunnel Setup for Splunk MCP

Since port 8089 on the Splunk server is not directly accessible from your local machine, you need an SSH tunnel.

## Prerequisites

You have SSH access to `144.202.48.85` as `root`.

## Setup Options

### Option A: Password-Based SSH (One-Time Setup)

1. **Add your SSH key to the server** (if not already done):
   ```bash
   ssh-copy-id -i ~/.ssh/id_rsa root@144.202.48.85
   ```
   (You'll be prompted for the SSH password once)

2. **Test the connection:**
   ```bash
   ssh root@144.202.48.85 "echo 'Connected!'"
   ```

3. **Start the tunnel:**
   ```bash
   make tunnel-start
   ```

### Option B: Manual SSH Tunnel (No Setup Needed)

Run this in one terminal and keep it open:

```bash
ssh -N -L 8089:localhost:8089 root@144.202.48.85
```

(You'll be prompted for the password once)

### Option C: SSH Config (Recommended Long-Term)

Add this to `~/.ssh/config`:

```
Host splunk-mcp
  HostName 144.202.48.85
  User root
  IdentityFile ~/.ssh/id_rsa
  LocalForward 8089 localhost:8089
```

Then connect with:
```bash
ssh splunk-mcp
```

(Keep this terminal open while using the app)

## Verification

Once tunnel is active (in a **new terminal**):

```bash
# Test connection
curl -k -H "Authorization: Bearer $SPLUNK_MCP_TOKEN" \
  https://localhost:8089/services/mcp/server/info

# Should return: {"status": "ok", ...}
```

## Starting the App with Tunnel

**Terminal 1** — Keep SSH tunnel open:
```bash
# Option A: Using make
make tunnel-start

# Option B: Direct SSH
ssh -N -L 8089:localhost:8089 root@144.202.48.85

# Option C: Using SSH config
ssh splunk-mcp
```

**Terminal 2** — Start the dev stack:
```bash
make dev
```

**Terminal 3** — Optional: Monitor API logs
```bash
docker compose logs -f api
```

## Troubleshooting SSH Connection

### "Permission denied (publickey)"

You don't have SSH key auth set up. Use password auth:
```bash
ssh root@144.202.48.85  # Will ask for password
```

Then set up key-based auth as described above.

### "Connection timed out"

The server is not reachable. Check:
1. Network connectivity: `ping 144.202.48.85`
2. Firewall rules: SSH (port 22) must be open
3. Server status: Is Splunk running?

### Tunnel shows "active" but API still fails

1. Verify tunnel is forwarding:
   ```bash
   netstat -an | grep 8089
   ```
   Should show: `LISTEN 127.0.0.1:8089`

2. Check API logs:
   ```bash
   docker compose logs api | grep -i splunk
   ```

3. Verify Splunk MCP token is correct in `.env`

## Keeping Tunnel Alive

SSH tunnels can disconnect. To auto-reconnect:

```bash
# Create a wrapper script
cat > ~/bin/splunk-tunnel-keep-alive.sh << 'EOF'
#!/bin/bash
while true; do
  ssh -N -L 8089:localhost:8089 root@144.202.48.85
  echo "Tunnel disconnected, reconnecting..."
  sleep 5
done
EOF

chmod +x ~/bin/splunk-tunnel-keep-alive.sh

# Run in background
nohup ~/bin/splunk-tunnel-keep-alive.sh > /tmp/splunk-tunnel.log 2>&1 &
```

## One-Liner for Quick Start

If you have password-based SSH configured:

```bash
# Terminal 1: Start tunnel
ssh -v -N -L 8089:localhost:8089 root@144.202.48.85

# Terminal 2: Start app (after tunnel is active)
cd /Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops && make dev
```

## Next Steps

Once tunnel is working:
1. ✅ Verify API can reach Splunk MCP
2. ✅ Test live incident fetch: `curl http://localhost:8001/api/v1/incidents`
3. ✅ Open web UI: http://localhost:3000
4. 📋 Proceed to Phase 8 hardening
