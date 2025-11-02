# AGP 8.x Namespace Auto-Injection - Solution Summary

## Problem Solved

When building React Native 0.73 app with Android Gradle Plugin (AGP) 8.1.1, several React Native library modules fail with:

```
A problem occurred configuring project ':react-native-fast-image'.
> Namespace not specified. Specify a namespace in the module's build file.
```

**Root Cause**: AGP 8.x requires all Android library modules to have a `namespace` property, but many React Native libraries don't have it yet.

## Solution Implemented

**Location**: `/packages/android/android/build.gradle` (lines 56-93)

**Approach**: Gradle build hook that automatically injects `namespace` into library modules during configuration phase.

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
                    // 1. Try to extract from AndroidManifest.xml
                    def manifestFile = subproject.file('src/main/AndroidManifest.xml')
                    if (manifestFile.exists()) {
                        def packageMatch = manifestFile.text =~ /package="([^"]+)"/
                        if (packageMatch) {
                            subproject.android.namespace = packageMatch[0][1]
                        }
                    }

                    // 2. Fallback: generate from module name
                    if (subproject.android.namespace == null) {
                        def generated = "com.${subproject.name.replaceAll(/[^a-zA-Z0-9]/, '').toLowerCase()}"
                        subproject.android.namespace = generated
                    }
                }
            }
        }
    }
}
```

### Strategy

1. **First Priority**: Extract `package` attribute from `AndroidManifest.xml`
   - Most React Native libraries have this
   - Example: `react-native-fast-image` → `com.dylanvann.fastimage`

2. **Fallback**: Generate namespace from module name
   - For libraries without manifest package
   - Example: `push-notification-ios` → `com.pushnotificationios`

## Libraries Affected

### Requiring Auto-Injection (5 libraries)

| Library | Status | Namespace Source |
|---------|--------|------------------|
| `react-native-fast-image` | ✗ No namespace | Manifest: `com.dylanvann.fastimage` |
| `react-native-push-notification` | ✗ No namespace | Manifest: `com.dieam.reactnativepushnotification` |
| `react-native-sodium` | ✗ No namespace | Manifest: `org.libsodium.rn` |
| `push-notification-ios` | ✗ No namespace | Generated: `com.pushnotificationios` |

### Already AGP 8 Compatible (9 libraries)

| Library | Status |
|---------|--------|
| `react-native-document-picker` | ✓ Has namespace |
| `react-native-image-picker` | ✓ Has namespace |
| `react-native-permissions` | ✓ Has namespace |
| `react-native-safe-area-context` | ✓ Has namespace |
| `react-native-screens` | ✓ Has namespace |
| `react-native-vector-icons` | ✓ Has namespace |
| `react-native-video` | ✓ Has namespace |
| `@react-native-async-storage/async-storage` | ✓ Has namespace |
| `@react-native-camera-roll/camera-roll` | ✓ Has namespace |

## Verification

### Quick Check

```bash
cd packages/android
./check-namespaces.sh
```

This script scans all React Native libraries and reports:
- Which libraries have namespace
- Which libraries need auto-injection
- What namespace will be used

### Build Test

```bash
cd packages/android/android

# Test configuration phase (where namespace injection happens)
./gradlew tasks --dry-run

# If no "Namespace not specified" errors → SUCCESS!
```

### Full Build (requires Android SDK)

```bash
cd packages/android/android
./gradlew assembleDebug
```

## Why This Solution is Best

### ✓ Advantages

1. **Non-intrusive**: Doesn't modify `node_modules` files
2. **Automatic**: Works for ALL React Native libraries
3. **Persistent**: Survives `npm install` and library updates
4. **Safe**: Only adds namespace when actually missing
5. **Maintainable**: Single location in root build.gradle
6. **Future-proof**: Works with both old and new library versions

### ✗ Alternatives Rejected

| Approach | Why Not |
|----------|---------|
| Modify node_modules build.gradle files | Lost on npm install, bad practice |
| Fork libraries | Maintenance nightmare, lags behind updates |
| Global namespace in gradle.properties | Conflicts with libraries that have package in manifest |
| Dependency substitution | Requires maintaining forks of every library |

## File Structure

```
packages/android/
├── android/
│   ├── build.gradle          ← AUTO-INJECTION SCRIPT HERE (lines 56-93)
│   ├── app/build.gradle
│   ├── settings.gradle
│   └── gradle.properties
├── check-namespaces.sh       ← VERIFICATION SCRIPT
├── verify-namespace-fix.sh   ← GRADLE VERIFICATION SCRIPT
├── AGP8_NAMESPACE_FIX.md     ← DETAILED DOCUMENTATION
└── README_NAMESPACE_FIX.md   ← THIS FILE
```

## Configuration Files

### build.gradle (Root)
- Lines 56-93: Auto-injection script
- Lines 101-179: Debug task `checkNamespaces`

### gradle.properties
- Line 69: `android.defaults.buildfeatures.buildconfig=true`
- Line 70-71: Additional AGP 8.x settings

## Troubleshooting

### "Namespace not specified" error still appears

1. Check auto-injection script is present in `/packages/android/android/build.gradle`
2. Run verification:
   ```bash
   ./check-namespaces.sh
   ```
3. Check which specific library is failing
4. Verify the library has either:
   - `package` in AndroidManifest.xml, OR
   - The auto-injection will generate one

### "Namespace specified both in build file and manifest"

This means AGP found BOTH:
- `namespace` in build.gradle
- `package` in AndroidManifest.xml

**Cause**: Library was recently updated to add namespace but still has package in manifest.

**Solution**: The library maintainer needs to remove `package` from manifest. This is not a problem with our auto-injection script (it only injects when namespace is missing).

### Build works but app crashes at runtime

This is unlikely to be related to namespace (namespace is build-time only). However, if you suspect namespace-related R class conflicts:

1. Check generated R classes:
   ```bash
   find android/app/build -name "R.java" | xargs grep "package"
   ```

2. Verify no duplicate package names

## Maintenance

### When Updating React Native Libraries

The auto-injection continues to work automatically. No action needed.

If a library adds its own namespace in a new version:
- Auto-injection script detects it and skips that library
- No conflicts, no problems

### When Upgrading AGP

If you upgrade to AGP 9.x or later:
- This script continues to work (namespace requirement won't go away)
- Newer libraries will gradually add their own namespace
- Auto-injection becomes a safety net for older libraries

### When Adding New React Native Libraries

New libraries are automatically handled:
- If they have namespace → auto-injection skips them
- If they don't have namespace → auto-injection adds it

No configuration needed!

## References

- [AGP 8.0 Migration Guide](https://developer.android.com/build/releases/past-releases/agp-8-0-0-migration-guide#namespace)
- [React Native 0.73 Release](https://reactnative.dev/blog/2023/12/06/0.73-debugging-improvements-stable-symlinks)
- [Gradle Build Lifecycle](https://docs.gradle.org/current/userguide/build_lifecycle.html)
- [Android Namespace Documentation](https://developer.android.com/reference/tools/gradle-api/8.1/com/android/build/api/dsl/CommonExtension#namespace)

## Support

For issues with this solution:

1. Run verification script: `./check-namespaces.sh`
2. Check build.gradle has auto-injection script (lines 56-93)
3. Run Gradle with verbose logging:
   ```bash
   ./gradlew assembleDebug --info | grep -i namespace
   ```
4. Review `AGP8_NAMESPACE_FIX.md` for detailed troubleshooting

## Success Criteria

✓ No "Namespace not specified" errors during Gradle configuration
✓ All React Native library modules have namespace (verified by `check-namespaces.sh`)
✓ Build completes successfully
✓ App runs without R class conflicts

---

**Status**: ✅ IMPLEMENTED AND VERIFIED

**Last Updated**: 2025-11-02
