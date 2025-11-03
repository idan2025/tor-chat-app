# Android Build Fix - React Native 0.73 Dependency Resolution

## Problem Summary

The Android build was failing with the error:
```
Could not find any matches for com.facebook.react:react-native:+ as no versions of com.facebook.react:react-native are available.
Required by: project :@react-native-async-storage_async-storage
```

## Root Cause Analysis

### The Core Issue

React Native made a significant change in version 0.71+ regarding how Android artifacts are distributed:

1. **Pre-0.71**: React Native distributed Android artifacts via npm in `node_modules/react-native/android` as a local Maven repository
2. **Post-0.71**: React Native distributes prebuilt artifacts via Maven Central ONLY

### The Artifact Name Change

Along with this distribution change, the artifact naming also changed:

- **Old (deprecated)**: `com.facebook.react:react-native`
  - Last published to Maven Central: version 0.17.1 (ancient)
  - Used by older React Native versions and community packages

- **New (correct)**: `com.facebook.react:react-android`
  - Available for versions 0.71.0+
  - Properly published to Maven Central
  - Version 0.73.0 and higher available

### Why Community Packages Failed

All React Native community packages (async-storage, document-picker, etc.) have this in their `build.gradle`:

```gradle
repositories {
    maven {
        // All of React Native (JS, Obj-C sources, Android binaries) is installed from npm
        url "${project.ext.resolveModulePath("react-native")}/android"
    }
    google()
    mavenCentral()
}

dependencies {
    implementation 'com.facebook.react:react-native:+' // from node_modules
}
```

**The problem:**
1. They try to load from `node_modules/react-native/android` (doesn't exist anymore - just a README)
2. They fall back to Maven Central
3. They look for `com.facebook.react:react-native:+` (wrong artifact name)
4. Maven Central only has `com.facebook.react:react-native` up to version 0.17.1
5. Build fails with "no versions available"

## The Complete Fix

### 1. Dependency Substitution (CRITICAL)

File: `/packages/android/android/react-native-maven-fix.gradle`

Added a global dependency substitution rule that intercepts ALL requests for `com.facebook.react:react-native` and redirects them to `com.facebook.react:react-android:0.73.0`:

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

This ensures that when async-storage or any other community package requests `com.facebook.react:react-native:+`, Gradle automatically substitutes it with `com.facebook.react:react-android:0.73.0`.

### 2. Repository Cleanup

The same file also removes the non-existent `node_modules/react-native/android` repository from all subprojects:

```gradle
subprojects { subproject ->
    afterEvaluate {
        if (subproject.plugins.hasPlugin('com.android.library')) {
            // Remove the problematic react-native/android repository
            subproject.repositories.removeIf { repo ->
                if (repo.hasProperty('url')) {
                    def repoUrl = repo.url.toString()
                    if (repoUrl.contains('react-native') && repoUrl.contains('android') && repoUrl.contains('node_modules')) {
                        return true
                    }
                }
                return false
            }
        }
    }
}
```

### 3. Explicit Version in App Dependencies

File: `/packages/android/android/app/build.gradle`

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

This ensures the app itself has explicit versions and doesn't rely on version resolution from non-existent local repos.

## Why This Fix Works

1. **Universal Substitution**: Works for ALL community packages without modifying their individual build.gradle files
2. **Maven Central Compatible**: Uses the correct artifact names that exist on Maven Central
3. **Explicit Versions**: Provides concrete versions so Gradle knows exactly what to fetch
4. **CI/CD Ready**: Works in GitHub Actions where only Maven Central is available
5. **No Local Dependencies**: Doesn't rely on any npm-distributed Maven repositories

## Verification

The fix can be verified with:

```bash
cd packages/android/android

# Check if projects load correctly
./gradlew projects

# Check dependency resolution (requires Android SDK)
./gradlew :app:dependencies --configuration debugCompileClasspath
```

In CI (GitHub Actions), the build will now:
1. Install dependencies via npm
2. Set up Android SDK via `android-actions/setup-android@v3`
3. Run Gradle build which will:
   - Apply the substitution rule from `react-native-maven-fix.gradle`
   - Intercept all `react-native` requests → convert to `react-android:0.73.0`
   - Fetch from Maven Central successfully
   - Build completes without errors

## Files Modified

1. `/packages/android/android/react-native-maven-fix.gradle`
   - Added dependency substitution rule
   - Enhanced repository cleanup logic
   - Added comprehensive documentation

2. `/packages/android/android/app/build.gradle`
   - Changed `react-android` dependency to include explicit version `0.73.0`
   - Changed `hermes-android` dependency to include explicit version `0.73.0`

## Testing in CI

The fix is designed to work specifically in CI environments like GitHub Actions where:
- Android SDK is available via setup actions
- Only public Maven repositories (Maven Central, Google) are accessible
- No local npm-based Maven repos exist
- Network access to Maven Central is reliable

## References

- [React Native 0.71-RC0 Android Outage Postmortem](https://reactnative.dev/blog/2023/01/27/71rc1-android-outage-postmortem)
- [Maven Central: react-android versions](https://central.sonatype.com/artifact/com.facebook.react/react-android)
- [React Native New Architecture Discussion #105](https://github.com/reactwg/react-native-new-architecture/discussions/105)

## Expected Results

With this fix in place:
- ✅ All React Native community packages resolve dependencies correctly
- ✅ Build works in GitHub Actions CI
- ✅ No need to modify individual package build.gradle files
- ✅ Future React Native version updates only require changing one version number
- ✅ Build is reproducible and deterministic
