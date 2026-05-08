from __future__ import annotations

import os
import sys
from pathlib import Path

import uvicorn
from dotenv import load_dotenv


def _bootstrap_pythonpath(repo_root: Path) -> None:
    paths = [
        repo_root,
        repo_root / "apps" / "api",
        repo_root / "packages" / "connectors" / "splunk-mcp" / "src",
        repo_root / "packages" / "decision-tracing" / "src",
        repo_root / "packages" / "agent-core" / "src",
    ]
    for path in paths:
        path_str = str(path)
        if path_str not in sys.path:
            sys.path.insert(0, path_str)


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    load_dotenv(repo_root / ".env")
    _bootstrap_pythonpath(repo_root)

    # Force live defaults for local real-data run.
    os.environ.setdefault("SPLUNK_LIVE_MODE", "true")
    os.environ.setdefault("SPLUNK_ADAPTER_MODE", "native")
    os.environ.setdefault("SPLUNK_MCP_BASE_URL", "https://localhost:8089")
    os.environ.setdefault("SPLUNK_MCP_SSL_VERIFY", "false")
    os.environ.setdefault("WEB_BASE_URL", "http://127.0.0.1:3000")

    uvicorn.run("apps.api.app.main:app", host="127.0.0.1", port=8001, reload=False)


if __name__ == "__main__":
    main()
