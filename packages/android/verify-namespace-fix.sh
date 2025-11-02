#!/bin/bash

# Verification script for AGP 8.x namespace auto-injection
# This script tests that the namespace fix is working correctly

set -e

echo "=========================================="
echo "AGP 8.x Namespace Fix Verification"
echo "=========================================="
echo ""

cd "$(dirname "$0")/android"

echo "1. Testing Gradle configuration (namespace injection happens here)..."
./gradlew tasks --dry-run > /tmp/gradle-tasks.log 2>&1

if grep -q "Namespace not specified" /tmp/gradle-tasks.log; then
    echo "ERROR: Namespace errors still present!"
    grep "Namespace not specified" /tmp/gradle-tasks.log
    exit 1
else
    echo "   SUCCESS: No namespace errors during configuration"
fi

echo ""
echo "2. Checking for namespace warnings/info in verbose output..."
./gradlew tasks --info 2>&1 | grep -i "namespace" | head -20 || echo "   (No explicit namespace messages - this is normal)"

echo ""
echo "3. Verifying library modules are properly configured..."
./gradlew projects | grep -E "react-native-fast-image|react-native-sodium|react-native-document-picker"

echo ""
echo "=========================================="
echo "Verification Complete!"
echo "=========================================="
echo ""
echo "The namespace auto-injection is working correctly."
echo "All React Native library modules should now build with AGP 8.x"
echo ""
echo "To build the app, ensure you have:"
echo "  - ANDROID_HOME environment variable set"
echo "  - OR android/local.properties with sdk.dir configured"
echo ""
