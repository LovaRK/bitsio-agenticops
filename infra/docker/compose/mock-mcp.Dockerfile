FROM python:3.12-slim
WORKDIR /app
COPY . .
RUN pip install --no-cache-dir uv && uv sync --all-groups
EXPOSE 8081
CMD ["uv", "run", "uvicorn", "apps.mock_mcp.app.main:app", "--host", "0.0.0.0", "--port", "8081"]
