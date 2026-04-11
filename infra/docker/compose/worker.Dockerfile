FROM python:3.12-slim
WORKDIR /app
COPY . .
RUN pip install --no-cache-dir uv && uv sync --all-groups
CMD ["uv", "run", "python", "apps/workers/worker.py"]
