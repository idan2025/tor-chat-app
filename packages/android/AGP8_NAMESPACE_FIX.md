# AGP 8.x Namespace Auto-Injection Solution

## Problem

When upgrading to Android Gradle Plugin (AGP) 8.x with React Native 0.73, many third-party React Native library modules fail to build with the error:

```
A problem occurred configuring project ':react-native-fast-image'.
> Namespace not specified. Specify a namespace in the module's build file.
```

This happens because:

1. AGP 8.x **requires** every Android library module to have a `namespace` property
2. Older React Native libraries only have `package` in their AndroidManifest.xml
3. AGP 8.x doesn't allow **BOTH** `namespace` in build.gradle **AND** `package` in manifest
4. You **CANNOT** modify node_modules files (they're temporary and overwritten on npm install)

## Solution Implemented

The solution is a **Gradle build hook** in `/packages/android/android/build.gradle` that automatically injects the `namespace` property for all library modules during the configuration phase.

### How It Works

```groovy
subprojects { subproject ->
    afterEvaluate {
        if (subproject.plugins.hasPlugin('com.android.library')) {
            subproject.android {
                buildFeatures {
                    buildConfig = true
                }

                // Auto-inject namespace for libraries that don't have it
                if (subproject.android.namespace == null) {
                    def manifestFile = subproject.file('src/main/AndroidManifest.xml')

                    if (manifestFile.exists()) {
                        def manifestText = manifestFile.text
                        def packageMatch = manifestText =~ /package="([^"]+)"/

                        if (packageMatch) {
                            // Extract package from manifest and use as namespace
                            def packageName = packageMatch[0][1]
                            subproject.android.namespace = packageName
                            logger.info("AGP 8.x: Set namespace from manifest for ${subproject.name}: ${packageName}")
                        }
                    }

                    // Fallback: generate namespace from module name
                    if (subproject.android.namespace == null) {
                        def generatedNamespace = "com.${subproject.name.replaceAll(/[^a-zA-Z0-9]/, '').toLowerCase()}"
                        subproject.android.namespace = generatedNamespace
                        logger.warn("AGP 8.x: Generated namespace for ${subproject.name}: ${generatedNamespace}")
                    }
                }
            }
        }
    }
}
```

### Strategy

The script follows a two-tier strategy:

1. **First Priority**: Extract `package` attribute from AndroidManifest.xml
   - Most React Native libraries have this
   - Example: `react-native-fast-image` has `package="com.dylanvann.fastimage"`
   - This becomes `namespace = "com.dylanvann.fastimage"`

2. **Fallback**: Generate namespace from module name
   - For libraries without AndroidManifest.xml or package attribute
   - Example: `:react-native-sodium` becomes `namespace = "com.reactnativesodium"`

### Why This Works

1. **Non-intrusive**: Doesn't modify node_modules files
2. **Automatic**: Works for ALL React Native libraries without manual configuration
3. **Safe**: Only adds namespace when it's actually missing
4. **Compatible**: Handles both old and new library versions
5. **Persistent**: Works across npm installs and library updates
6. **AGP 8 compliant**: Satisfies AGP 8.x namespace requirement

## Affected Libraries

Libraries that benefit from this auto-injection:

- `react-native-fast-image` - Has package in manifest, no namespace
- `react-native-sodium` - Old library with no AGP 8 support
- `react-native-push-notification` - Has package in manifest
- `react-native-vector-icons` - Has package in manifest
- `react-native-video` - Has package in manifest
- `react-native-image-picker` - Has package in manifest
- `@react-native-async-storage/async-storage` - Has package in manifest
- `@react-native-community/push-notification-ios` - iOS library with Android stubs

Libraries that already handle AGP 8.x correctly:

- `react-native-document-picker` - Conditionally sets namespace based on AGP version
- `react-native-permissions` - Modern library with namespace already set
- `react-native-screens` - Modern library with namespace already set
- `react-native-safe-area-context` - Modern library with namespace already set

## Verification

To verify the fix is working:

```bash
cd packages/android
./verify-namespace-fix.sh
```

Or manually:

```bash
cd packages/android/android
./gradlew tasks --dry-run
```

If you see "Namespace not specified" errors, the fix is not working.
If the command completes successfully, the namespace injection is working.

## Alternative Solutions (Not Used)

### Why NOT Option A: Gradle buildscript to patch files
```groovy
// ❌ Don't do this - modifies node_modules
tasks.register('patchLibraryBuildFiles') {
    doFirst {
        file('../node_modules').listFiles().each { lib ->
            def buildFile = new File(lib, 'android/build.gradle')
            if (buildFile.exists()) {
                buildFile.text = buildFile.text.replaceFirst(/android \{/, 'android {\n    namespace "com.example"\n')
            }
        }
    }
}
```
**Problems:**
- Modifies node_modules (bad practice)
- Lost on npm install
- Hard to maintain
- Can break library code

### Why NOT Option C: Dependency resolution strategy
```groovy
// ❌ Don't do this - requires maintaining forks
configurations.all {
    resolutionStrategy {
        dependencySubstitution {
            substitute module('react-native-fast-image') with module('com.github.yourfork:react-native-fast-image:agp8-fix')
        }
    }
}
```
**Problems:**
- Requires forking every problematic library
- Maintenance nightmare
- Doesn't scale
- Lags behind upstream updates

### Why NOT Global namespace in gradle.properties
```properties
# ❌ Don't do this - conflicts with libraries that have package in manifest
android.namespace=com.torchat
```
**Problems:**
- AGP 8.x doesn't allow BOTH namespace AND package attribute
- Causes conflicts: "Namespace specified both in build file and manifest"
- Can't set different namespaces for different libraries

## Migration Notes

If you upgrade React Native libraries in the future:

1. The auto-injection script will continue to work automatically
2. Newer versions of libraries may add their own namespace - that's fine, the script only injects when missing
3. No action needed after `npm install` or `npm update`

## Testing

To test the full build (requires Android SDK):

```bash
cd packages/android/android

# Clean build
./gradlew clean

# Build debug APK
./gradlew assembleDebug

# If successful, the namespace fix is working!
```

## References

- [AGP 8.0 Migration Guide](https://developer.android.com/build/releases/past-releases/agp-8-0-0-migration-guide#namespace)
- [React Native 0.73 Breaking Changes](https://reactnative.dev/blog/2023/12/06/0.73-debugging-improvements-stable-symlinks#breaking-changes)
- [Android Gradle Plugin Namespace Documentation](https://developer.android.com/reference/tools/gradle-api/8.1/com/android/build/api/dsl/CommonExtension#namespace)

## Troubleshooting

### Issue: "Namespace specified both in build file and manifest"

This means a library has both:
- `namespace` in its build.gradle
- `package` in its AndroidManifest.xml

**Solution**: The library needs to remove `package` from manifest. If it's a third-party library, this should be fixed in the auto-injection script (check the logic).

### Issue: Build still fails with "Namespace not specified"

1. Check that the script is in `/packages/android/android/build.gradle`
2. Verify the `subprojects` block is present and correct
3. Run with `--info` to see detailed logs:
   ```bash
   ./gradlew assembleDebug --info | grep namespace
   ```
4. Check which module is failing and examine its build.gradle

### Issue: Generated namespace causes R class conflicts

This is rare but can happen if the generated namespace conflicts with existing code.

**Solution**: Manually set the namespace for that specific library:
```groovy
subprojects { subproject ->
    if (subproject.name == 'problematic-library') {
        afterEvaluate {
            subproject.android.namespace = 'com.custom.namespace'
        }
    }
}
```

## License

This solution is provided as-is for use in the TOR Chat Android app project.
