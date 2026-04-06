#!/bin/bash

set -e

echo "🧪 Running Playwright E2E Tests"
echo "================================"
echo ""

# Check if apps are running
if ! curl -s -f http://localhost:8080/api/owners > /dev/null 2>&1; then
    echo "❌ Backend is not running on port 8080"
    echo ""
    echo "Please start the applications first:"
    echo "  ./start-all.sh"
    echo ""
    exit 1
fi

if ! curl -s -f http://localhost:4200 > /dev/null 2>&1; then
    echo "❌ Frontend is not running on port 4200"
    echo ""
    echo "Please start the applications first:"
    echo "  ./start-all.sh"
    echo ""
    exit 1
fi

echo "✅ Backend is running on port 8080"
echo "✅ Frontend is running on port 4200"
echo ""

# Run tests from qa directory
cd qa
SKIP_SERVER_START=true npm test

echo ""
echo "📸 Screenshots saved to: qa/test-results/screenshots/"
echo "📊 To view HTML report: cd qa && npm run show-report"
