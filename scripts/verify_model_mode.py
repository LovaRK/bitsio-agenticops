#!/usr/bin/env python3
"""Verify local-first model configuration.

Usage:
    python scripts/verify_model_mode.py

Output:
    - Runtime mode configuration
    - Ollama availability
    - Cloud provider configuration
    - Privacy guarantee status
"""

import os
import sys
from enum import Enum
from pathlib import Path

import httpx


class RuntimeMode(str, Enum):
    """Privacy/security modes for model selection."""

    LOCAL_ONLY = "local_only"
    LOCAL_FIRST = "local_first"
    CLOUD_ALLOWED = "cloud_allowed"


def check_ollama() -> dict:
    """Check if Ollama is running and accessible."""
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    try:
        response = httpx.get(f"{base_url}/api/tags", timeout=5.0)
        response.raise_for_status()
        data = response.json()
        models = [m["name"] for m in data.get("models", [])]
        return {"running": True, "url": base_url, "models": models, "error": None}
    except Exception as exc:
        return {
            "running": False,
            "url": base_url,
            "models": [],
            "error": f"{type(exc).__name__}: {exc}",
        }


def check_cloud_api_keys() -> dict:
    """Check if cloud API keys are configured."""
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    return {
        "anthropic_configured": bool(anthropic_key),
        "openai_configured": bool(openai_key),
    }


def get_runtime_mode() -> RuntimeMode:
    """Get configured runtime mode."""
    mode_str = os.getenv("RUNTIME_MODE", "local_first").strip().lower()
    try:
        return RuntimeMode(mode_str)
    except ValueError:
        return RuntimeMode.LOCAL_FIRST


def main():
    """Run verification."""
    print("\n" + "=" * 70)
    print("🔍 BitsIO AgenticOps - Model Mode Verification")
    print("=" * 70 + "\n")

    # Get configuration
    runtime_mode = get_runtime_mode()
    ollama_status = check_ollama()
    cloud_keys = check_cloud_api_keys()

    # Print runtime mode
    print(f"📋 Runtime Mode: {runtime_mode.value.upper()}\n")

    if runtime_mode == RuntimeMode.LOCAL_ONLY:
        print("🔒 LOCAL_ONLY MODE - Maximum Security")
        print("   • Cloud models are disabled at system level")
        print("   • All data stays on your infrastructure")
        print("   • Perfect for regulated industries\n")
    elif runtime_mode == RuntimeMode.LOCAL_FIRST:
        print("✅ LOCAL_FIRST MODE - Recommended Default")
        print("   • Data stays local by default")
        print("   • Cloud models available ONLY if user opts-in")
        print("   • Full user control over data exposure\n")
    else:  # CLOUD_ALLOWED
        print("☁️  CLOUD_ALLOWED MODE")
        print("   • Cloud models available but not default")
        print("   • Users can choose their preferred provider\n")

    # Print local model config
    print("-" * 70)
    print("🖥️  Local Model Configuration (Ollama)")
    print("-" * 70)
    ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
    print(f"   URL: {ollama_status['url']}")
    print(f"   Model: {ollama_model}")

    if ollama_status["running"]:
        print(f"   Status: ✅ Running")
        if ollama_status["models"]:
            print(f"   Available models: {', '.join(ollama_status['models'][:3])}")
            if len(ollama_status["models"]) > 3:
                print(f"                     (+{len(ollama_status['models']) - 3} more)")
    else:
        print(f"   Status: ❌ Not accessible")
        print(f"   Error: {ollama_status['error']}")
    print()

    # Print cloud config
    print("-" * 70)
    print("☁️  Cloud Model Configuration")
    print("-" * 70)

    if cloud_keys["anthropic_configured"] or cloud_keys["openai_configured"]:
        print("   Status: ✅ Configured")
        if cloud_keys["anthropic_configured"]:
            anthropic_model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
            print(f"   • Anthropic: {anthropic_model}")
        if cloud_keys["openai_configured"]:
            openai_model = os.getenv("OPENAI_MODEL", "gpt-4")
            print(f"   • OpenAI: {openai_model}")
    else:
        print("   Status: NOT CONFIGURED (no API keys)")
        print("   ℹ️  Cloud models unavailable even with user opt-in")
    print()

    # Privacy guarantee
    print("-" * 70)
    print("🔒 Privacy Guarantee Status")
    print("-" * 70)

    if runtime_mode == RuntimeMode.LOCAL_ONLY:
        print("   ✅ MAXIMUM PRIVACY")
        print("   • Default: local model only")
        print("   • Cloud disabled at system level")
    elif runtime_mode == RuntimeMode.LOCAL_FIRST:
        if ollama_status["running"]:
            if cloud_keys["anthropic_configured"] or cloud_keys["openai_configured"]:
                print("   ✅ HIGH PRIVACY (with cloud opt-in available)")
                print("   • Default: local model only")
                print("   • Cloud available if user explicitly enables")
            else:
                print("   ✅ MAXIMUM PRIVACY")
                print("   • Default: local model only")
                print("   • Cloud not configured (cannot be used)")
        else:
            print("   ⚠️  Local model not accessible")
            print("   • Ollama should be running for privacy guarantee")
            print("   • Fix: ollama serve")
    else:  # CLOUD_ALLOWED
        print("   ✅ CLOUD OPTIONAL")
        print("   • Cloud models available")
        print("   • Users can choose preferred provider")

    print("\n" + "=" * 70 + "\n")

    # Exit code
    if not ollama_status["running"] and runtime_mode in (
        RuntimeMode.LOCAL_ONLY,
        RuntimeMode.LOCAL_FIRST,
    ):
        print("⚠️  Warning: Ollama not accessible. Please start it:")
        print("   $ ollama serve\n")
        return 1

    print("✅ Configuration is valid\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
