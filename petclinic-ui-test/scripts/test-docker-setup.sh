#!/bin/bash

echo "Testing Docker setup..."
echo ""
echo "Checking docker-compose configuration..."

cd "$(dirname "$0")/.." || exit 1

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed"
    exit 1
fi

echo "✅ Docker and docker-compose are installed"

echo ""
echo "Validating docker-compose.test.yml..."

if docker-compose -f docker-compose.test.yml config > /dev/null 2>&1; then
    echo "✅ docker-compose.test.yml is valid"
else
    echo "❌ docker-compose.test.yml has errors"
    exit 1
fi

echo ""
echo "Docker setup validation complete!"
echo ""
echo "To run tests in Docker, execute:"
echo "  npm run test:docker"
