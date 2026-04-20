"""Helpers for local Splunk SSH tunnel management."""

from __future__ import annotations

import os
import socket
import subprocess
from urllib.parse import urlparse


def is_port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((host, port)) == 0


def ensure_local_splunk_tunnel(splunk_base_url: str, *, live_mode: bool) -> tuple[str, str]:
    """
    Best-effort auto-tunnel startup for local live mode.
    Returns (status, message) where status is one of:
    - "not_required"
    - "already_active"
    - "started"
    - "failed"
    """
    if not live_mode:
        return ("not_required", "Live Splunk disabled; tunnel not required.")

    parsed = urlparse(splunk_base_url)
    host = (parsed.hostname or "").strip().lower()
    port = parsed.port or (443 if parsed.scheme == "https" else 80)

    if host not in {"localhost", "127.0.0.1"} or port != 8089:
        return ("not_required", f"Tunnel not required for host={host or 'unknown'} port={port}.")

    if is_port_open("127.0.0.1", 8089):
        return ("already_active", "Tunnel already active on localhost:8089.")

    target = os.getenv("SPLUNK_TUNNEL_SSH_TARGET", "root@144.202.48.85").strip()
    if not target:
        return ("failed", "SPLUNK_TUNNEL_SSH_TARGET is empty.")

    try:
        subprocess.run(
            ["ssh", "-fN", "-L", "8089:localhost:8089", target],
            check=True,
            timeout=15,
        )
    except Exception as exc:  # noqa: BLE001
        return ("failed", f"Failed to start tunnel via ssh: {type(exc).__name__}: {exc}")

    if is_port_open("127.0.0.1", 8089):
        return ("started", f"Tunnel started: localhost:8089 -> {target}:8089")
    return ("failed", "SSH command completed but localhost:8089 is still unreachable.")
