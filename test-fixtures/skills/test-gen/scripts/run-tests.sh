#!/usr/bin/env bash
# run-tests.sh - Execute tests with coverage reporting

set -e

echo "🧪 Running test suite with coverage..."

# Run tests with Vitest
bun run test --coverage

# Check coverage thresholds
echo "✅ Coverage report generated"
echo "📊 View coverage: open coverage/index.html"
