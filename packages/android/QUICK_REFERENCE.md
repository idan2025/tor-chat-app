# Android App - Quick Reference

Essential commands and configurations for daily development.

## Development Commands

```bash
# Install dependencies
npm install

# Start Metro bundler
npm start

# Run on Android
npm run android

# Run specific variant
npm run android:debug
npm run android:release

# Clear cache and start
npm run start:reset
```

## Build Commands

```bash
# Build debug APK
npm run build:debug

# Build release APK
npm run build:release

# Clean build
npm run clean

# Bundle JavaScript
npm run bundle:android
```

## Gradle Commands

```bash
cd android

# Build debug
./gradlew assembleDebug

# Build release
./gradlew assembleRelease

# Clean
./gradlew clean

# Print build info
./gradlew printBuildInfo

# List tasks
./gradlew tasks

# Dependencies
./gradlew dependencies

# Refresh dependencies
./gradlew --refresh-dependencies
```

## ADB Commands

```bash
# List devices
adb devices

# Install APK
adb install -r path/to/app.apk

# Uninstall app
adb uninstall com.torchat

# Clear app data
adb shell pm clear com.torchat

# View logs (React Native)
adb logcat | grep ReactNative

# View logs (all)
adb logcat

# Restart ADB
adb kill-server && adb start-server

# Reverse port (for dev server)
adb reverse tcp:8081 tcp:8081
```

## File Locations

```
Debug APK:     android/app/build/outputs/apk/debug/app-debug.apk
Release APK:   android/app/build/outputs/apk/release/app-release.apk
JS Bundle:     android/app/src/main/assets/index.android.bundle
Debug Key:     android/app/debug.keystore
Build Cache:   android/.gradle
Metro Cache:   .metro-cache
```

## Key Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies & scripts |
| `android/app/build.gradle` | App-level build config |
| `android/build.gradle` | Project-level build config |
| `android/gradle.properties` | Gradle settings |
| `android/settings.gradle` | Module includes |
| `metro.config.js` | Metro bundler config |
| `AndroidManifest.xml` | App manifest & permissions |

## Environment Setup

```bash
# Check React Native
npx react-native doctor

# Android SDK location
export ANDROID_HOME=$HOME/Android/Sdk

# Path additions
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
```

## Troubleshooting Quick Fixes

```bash
# Clean everything
npm run clean
rm -rf node_modules
rm -rf .metro-cache
npm install

# Reset Metro
npm run start:reset

# Reset Gradle
cd android
./gradlew clean
./gradlew --stop
rm -rf .gradle
cd ..

# Reinstall app
adb uninstall com.torchat
npm run android
```

## CI/CD Trigger

```bash
# Manual workflow trigger
gh workflow run android-build.yml

# Or create tag
git tag v0.1.3
git push origin v0.1.3
```

## Debug Menu (On Device)

- **Open Dev Menu**: Shake device or `Ctrl+M` (emulator)
- **Reload**: Double-tap `R` or `RR` in Metro terminal
- **Enable Hot Reload**: Dev Menu → Enable Hot Reloading
- **Enable Fast Refresh**: Dev Menu → Enable Fast Refresh
- **Remote Debugging**: Dev Menu → Debug → Chrome DevTools

## Build Variants

| Variant | Command | Signing | Debuggable |
|---------|---------|---------|------------|
| Debug | `assembleDebug` | debug.keystore | Yes |
| Release | `assembleRelease` | release.keystore | No |

## Package Structure

```
com.torchat
├── MainActivity.java          # Main entry point
├── MainApplication.java       # React Native setup
└── ReactNativeFlipper.java   # Debug tools (debug only)
```

## Important Gradle Properties

```properties
# Heap size
org.gradle.jvmargs=-Xmx4096m

# Parallel builds
org.gradle.parallel=true

# Build cache
org.gradle.caching=true

# Hermes engine
hermesEnabled=true

# AndroidX
android.useAndroidX=true
```

## Dependencies Quick Reference

### Core
- React Native 0.73.0
- React 18.2.0

### Navigation
- @react-navigation/native
- @react-navigation/native-stack
- @react-navigation/bottom-tabs

### State & Storage
- zustand
- @react-native-async-storage/async-storage

### Networking
- socket.io-client
- axios

### TOR
- react-native-iptproxy

### Crypto
- react-native-sodium

### UI
- react-native-vector-icons
- react-native-fast-image
- react-native-video

### Notifications
- react-native-push-notification

### Permissions & Files
- react-native-permissions
- react-native-document-picker
- react-native-image-picker

## Version Info

```bash
# Check versions
node --version
npm --version
java -version
./gradlew --version

# React Native info
npx react-native --version
npx react-native info
```

## Performance Monitoring

```bash
# Monitor CPU/Memory
adb shell top | grep com.torchat

# Monitor network
adb shell dumpsys netstats

# Get app size
adb shell pm path com.torchat | xargs adb shell du -h
```

---

**Quick Start:**
```bash
npm install
npm start          # Terminal 1
npm run android    # Terminal 2
```

**Quick Build:**
```bash
npm run build:debug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```
