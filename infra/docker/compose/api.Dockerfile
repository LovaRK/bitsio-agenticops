FROM python:3.12-slim
WORKDIR /app
COPY . .
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        curl \
        git \
        gzip \
        libatomic1 \
        libstdc++6 \
        lsof \
        procps \
        tar \
        wget \
        xz-utils \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir uv \
    && uv sync --all-groups
ENV PYTHONPATH=/app:/app/packages/agent-core/src:/app/packages/connectors/splunk-mcp/src:/app/packages/decision-tracing/src
EXPOSE 8001
CMD ["uv", "run", "uvicorn", "apps.api.app.main:app", "--host", "0.0.0.0", "--port", "8001"]
