"""BitsIO Telemetry Value Agent - FastAPI Backend"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import health, telemetry, settings
from app.middleware.auth import AuthMiddleware
from app.middleware.rate_limit import RateLimitMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    print("BitsIO Telemetry Value Agent starting up...")
    yield
    # Shutdown
    print("BitsIO Telemetry Value Agent shutting down...")


app = FastAPI(
    title="BitsIO Telemetry Value Agent",
    description="Local-first AI observability platform for Splunk",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth middleware (disabled in dev mode)
# app.add_middleware(AuthMiddleware)

# Rate limiting middleware
app.add_middleware(RateLimitMiddleware)

# Routers
app.include_router(health.router, tags=["health"])
app.include_router(telemetry.router, prefix="/api/v1", tags=["telemetry"])
app.include_router(settings.router, prefix="/api/v1", tags=["settings"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "BitsIO Telemetry Value Agent",
        "version": "0.1.0",
        "status": "running",
    }