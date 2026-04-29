#!/bin/bash

echo "📊 Checking production server status..."
echo ""

RESPONSE=$(curl -s http://144.202.48.85:8001/health 2>/dev/null || echo "OFFLINE")

if [ "$RESPONSE" == "OFFLINE" ]; then
  echo "❌ Server is OFFLINE or unreachable"
  exit 1
fi

echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

echo ""
echo "📍 Production URLs:"
echo "   Web UI:        http://144.202.48.85:3000"
echo "   API Health:    http://144.202.48.85:8001/health"
echo "   Telemetry:     http://144.202.48.85:3000/telemetry-value"
echo ""
