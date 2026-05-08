#!/bin/bash
set -e

echo "🚀 Starting bitsio-agenticops locally..."
echo ""
echo "   Web UI:  http://localhost:3000"
echo "   API:     http://localhost:8001"
echo "   Ollama:  http://localhost:11434"
echo ""

cd "$(dirname "$0")/.."

echo "📦 Installing dependencies..."
make bootstrap

echo ""
echo "🎯 Starting services (Ollama + API + Web)..."
make local
