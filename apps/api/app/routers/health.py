"""Health check endpoints."""

import os
from fastapi import APIRouter, status

router = APIRouter()


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """Basic health check."""
    return {
        "status": "healthy",
        "service": "bitsio-telemetry-agent",
        "version": "0.1.0",
    }


@router.get("/health/ready", status_code=status.HTTP_200_OK)
async def readiness_check():
    """Readiness check with service dependencies."""
    return {
        "status": "ready",
        "services": {
            "api": "ok",
            "ollama": _check_ollama(),
            "database": "ok",  # TODO: Check actual DB
            "redis": "ok",      # TODO: Check actual Redis
        },
    }


@router.get("/health/live", status_code=status.HTTP_200_OK)
async def liveness_check():
    """Liveness check."""
    return {"status": "alive"}


def _check_ollama() -> str:
    """Check if Ollama is available."""
    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    # TODO: Actually check Ollama
    return "unknown"