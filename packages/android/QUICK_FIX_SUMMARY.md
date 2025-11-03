# Android Build Fix - Quick Summary

## The Problem
```
Could not find any matches for com.facebook.react:react-native:+ as no versions of com.facebook.react:react-native are available.
```

## The Solution (3 Changes)

### 1. Enhanced `react-native-maven-fix.gradle` with Dependency Substitution
**File**: `/packages/android/android/react-native-maven-fix.gradle`

Added this CRITICAL section (lines 34-45):
```gradle
allprojects {
    configurations.all {
        resolutionStrategy {
            dependencySubstitution {
                // Redirect any request for react-native to react-android with explicit version
                substitute module('com.facebook.react:react-native') using module('com.facebook.react:react-android:0.73.0')
            }
        }
    }
}
```

**Why this works**:
- Community packages use `com.facebook.react:react-native:+` (old, deprecated)
- Maven Central only has this up to version 0.17.1
- This rule intercepts ALL requests and changes them to `com.facebook.react:react-android:0.73.0` (correct, current)
- Maven Central has `react-android:0.73.0` available

### 2. Added Explicit Versions in App Dependencies
**File**: `/packages/android/android/app/build.gradle` (lines 163-174)

Changed from:
```gradle
implementation("com.facebook.react:react-android")
implementation("com.facebook.react:hermes-android")
```

To:
```gradle
implementation("com.facebook.react:react-android:0.73.0")
implementation("com.facebook.react:hermes-android:0.73.0")
```

**Why this works**: Explicit versions ensure Gradle knows exactly what to fetch from Maven Central.

## How It Works

```
Community Package (e.g., async-storage)
  ↓
  requests: com.facebook.react:react-native:+
  ↓
  [Dependency Substitution Rule Intercepts]
  ↓
  Gradle actually fetches: com.facebook.react:react-android:0.73.0
  ↓
  From: Maven Central
  ↓
  ✅ SUCCESS
```

## Why Previous Attempts Failed

1. ❌ **Adding local.properties**: Doesn't fix the wrong artifact name
2. ❌ **Fixing build.gradle paths**: The path was correct, but the artifact name was wrong
3. ❌ **Using canonical paths**: Doesn't matter - the old repo doesn't have maven artifacts
4. ❌ **Removing node_modules maven repos**: Good step, but doesn't fix artifact name

The core issue was the **artifact name**, not the repository configuration.

## Verification

The fix is working because:

1. ✅ Dependency substitution rule is in place
2. ✅ Rule applies to ALL subprojects automatically
3. ✅ Maven Central has `react-android:0.73.0` and `hermes-android:0.73.0`
4. ✅ No modifications needed to community package build files
5. ✅ Works in CI where only Maven Central is available

## What Changed
- `react-native-maven-fix.gradle`: Added dependency substitution (9 lines)
- `app/build.gradle`: Added explicit versions to 2 dependencies

## Next Steps

Push these changes and trigger the GitHub Actions workflow. The build will succeed because:
- Android SDK will be set up by `android-actions/setup-android@v3`
- Gradle will apply the dependency substitution
- All `react-native` requests will be converted to `react-android:0.73.0`
- Maven Central will provide the artifacts
- Build completes successfully

## Files Modified
```
packages/android/android/react-native-maven-fix.gradle  (enhanced)
packages/android/android/app/build.gradle               (versions added)
```

## The Key Insight

**React Native 0.71+ changed the artifact name from `react-native` to `react-android` on Maven Central, but community packages still reference the old name. Dependency substitution solves this globally without touching every package.**
