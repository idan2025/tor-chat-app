#!/bin/bash

# Simple script to check namespace configuration in React Native library modules
# This scans the file system to verify AGP 8.x compatibility

echo "=========================================="
echo "AGP 8.x Namespace Configuration Checker"
echo "=========================================="
echo ""

NODE_MODULES="../../node_modules"
TOTAL_LIBS=0
WITH_NAMESPACE=0
WITHOUT_NAMESPACE=0
ISSUES=()

# Function to check if a library has namespace in build.gradle
check_library() {
    local lib_path="$1"
    local lib_name=$(basename "$lib_path")

    if [ ! -f "$lib_path/android/build.gradle" ]; then
        return
    fi

    TOTAL_LIBS=$((TOTAL_LIBS + 1))

    local build_gradle="$lib_path/android/build.gradle"
    local manifest="$lib_path/android/src/main/AndroidManifest.xml"

    local has_namespace=$(grep -E "^\s*namespace\s+" "$build_gradle" || echo "")
    local package_in_manifest=""

    if [ -f "$manifest" ]; then
        package_in_manifest=$(grep -oP 'package="\K[^"]+' "$manifest" || echo "")
    fi

    if [ -n "$has_namespace" ]; then
        WITH_NAMESPACE=$((WITH_NAMESPACE + 1))
        namespace_value=$(echo "$has_namespace" | sed -E 's/.*namespace\s*[=:]\s*"?([^"]+)"?.*/\1/')
        echo "✓ $lib_name"
        echo "  Namespace: $namespace_value"
        [ -n "$package_in_manifest" ] && echo "  Manifest:  $package_in_manifest"
    else
        WITHOUT_NAMESPACE=$((WITHOUT_NAMESPACE + 1))
        echo "✗ $lib_name"
        echo "  NO NAMESPACE in build.gradle"
        if [ -n "$package_in_manifest" ]; then
            echo "  Manifest:  $package_in_manifest (auto-injection will use this)"
            ISSUES+=("$lib_name: will use manifest package '$package_in_manifest'")
        else
            echo "  Manifest:  (no package attribute)"
            ISSUES+=("$lib_name: will generate namespace from module name")
        fi
    fi
    echo ""
}

# Check common React Native libraries
echo "Checking React Native library modules..."
echo ""

for lib in "$NODE_MODULES"/react-native-* "$NODE_MODULES"/@react-native-*/*/; do
    if [ -d "$lib" ]; then
        check_library "$lib"
    fi
done

# Also check @react-native-community
for lib in "$NODE_MODULES"/@react-native-community/*/; do
    if [ -d "$lib" ]; then
        check_library "$lib"
    fi
done

echo "=========================================="
echo "Summary"
echo "=========================================="
echo "Total React Native libraries: $TOTAL_LIBS"
echo "With namespace in build.gradle: $WITH_NAMESPACE"
echo "Without namespace (needs auto-injection): $WITHOUT_NAMESPACE"
echo ""

if [ $WITHOUT_NAMESPACE -gt 0 ]; then
    echo "Libraries requiring auto-injection:"
    for issue in "${ISSUES[@]}"; do
        echo "  - $issue"
    done
    echo ""
    echo "The AGP 8.x auto-injection script in build.gradle will handle these automatically."
else
    echo "All libraries have namespace configured!"
    echo "No auto-injection needed (but script remains as safety net)."
fi
echo "=========================================="
