# Android App - Setup & Build Guide

Complete guide for setting up and building the TOR Chat Android application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Structure](#project-structure)
3. [Initial Setup](#initial-setup)
4. [Development](#development)
5. [Building](#building)
6. [CI/CD](#cicd)
7. [Troubleshooting](#troubleshooting)
8. [Next Steps](#next-steps)

---

## Prerequisites

### Required Software

1. **Node.js 18+** and **npm 9+**
   ```bash
   node --version  # Should be 18.0.0 or higher
   npm --version   # Should be 9.0.0 or higher
   ```

2. **Java Development Kit (JDK) 17**
   ```bash
   java -version   # Should be 17.x.x
   ```

3. **Android SDK**
   - Android SDK Platform 34
   - Android SDK Build-Tools 34.0.0
   - Android SDK Platform-Tools
   - Android SDK Tools
   - Android NDK 25.1.8937393

4. **Android Studio** (recommended for development)
   - Latest stable version
   - Android SDK Manager
   - Android Virtual Device (AVD) Manager

### Environment Variables

Add these to your `~/.bashrc`, `~/.zshrc`, or system environment:

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

Verify with:
```bash
echo $ANDROID_HOME
adb --version
```

---

## Project Structure

```
packages/android/
├── android/                      # Native Android project
│   ├── app/
│   │   ├── src/
│   │   │   ├── main/
│   │   │   │   ├── java/com/torchat/
│   │   │   │   │   ├── MainActivity.java
│   │   │   │   │   └── MainApplication.java
│   │   │   │   ├── res/           # Android resources
│   │   │   │   └── AndroidManifest.xml
│   │   │   ├── debug/              # Debug-specific code
│   │   │   └── release/            # Release-specific code
│   │   ├── build.gradle            # App-level build config
│   │   ├── debug.keystore          # Debug signing key
│   │   └── proguard-rules.pro      # ProGuard config
│   ├── gradle/
│   │   └── wrapper/
│   │       └── gradle-wrapper.properties
│   ├── build.gradle                # Project-level build config
│   ├── gradle.properties           # Gradle configuration
│   └── settings.gradle             # Project settings
├── src/                            # React Native source code
│   ├── components/
│   ├── screens/
│   ├── services/
│   ├── store/
│   └── types/
├── App.tsx                         # Root component
├── index.js                        # Entry point
├── metro.config.js                 # Metro bundler config
├── babel.config.js                 # Babel configuration
├── tsconfig.json                   # TypeScript config
└── package.json                    # Dependencies & scripts
```

---

## Initial Setup

### 1. Install Dependencies

From the project root:

```bash
# Navigate to Android package
cd packages/android

# Install Node.js dependencies
npm install

# If using workspace (monorepo)
cd ../..
npm install
```

### 2. Verify Android Setup

```bash
# Check Android SDK installation
npx react-native doctor

# Should show all green checkmarks
```

### 3. Download Gradle Dependencies

```bash
cd packages/android/android
./gradlew --version
./gradlew dependencies
```

This will download all required Gradle dependencies (first run may take 10-15 minutes).

---

## Development

### Start Metro Bundler

In one terminal:

```bash
cd packages/android
npm start
# Or with cache reset:
npm run start:reset
```

### Run on Android Emulator

1. **Start an Android emulator:**
   ```bash
   # List available AVDs
   emulator -list-avds

   # Start specific AVD
   emulator -avd <AVD_NAME>
   ```

2. **Run the app:**
   ```bash
   npm run android
   # Or specifically:
   npm run android:debug
   ```

### Run on Physical Device

1. **Enable USB Debugging** on your Android device:
   - Settings → About Phone → Tap "Build Number" 7 times
   - Settings → Developer Options → Enable "USB Debugging"

2. **Connect device via USB and verify:**
   ```bash
   adb devices
   # Should list your device
   ```

3. **Run the app:**
   ```bash
   npm run android
   ```

### Development Tips

- **Hot Reload**: Shake device or press `Ctrl+M` (emulator) / `Cmd+M` (physical) → Enable Hot Reloading
- **Dev Menu**: `Ctrl+M` / `Cmd+M`
- **Reload**: `RR` in Metro terminal or double-tap `R` in dev menu
- **Debug**: Chrome DevTools via `chrome://inspect`

---

## Building

### Debug Build

```bash
cd packages/android
npm run build:debug
```

**Output:** `android/app/build/outputs/apk/debug/app-debug.apk`

### Release Build

1. **Generate or use signing key:**
   ```bash
   # Generate release keystore (if not exists)
   keytool -genkeypair -v -keystore android/app/release.keystore \
     -alias release-key -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Create gradle.properties with signing config:**
   ```bash
   # Create ~/.gradle/gradle.properties (or add to android/gradle.properties)
   SIGNING_STORE_FILE=release.keystore
   SIGNING_STORE_PASSWORD=your_store_password
   SIGNING_KEY_ALIAS=release-key
   SIGNING_KEY_PASSWORD=your_key_password
   ```

3. **Build release APK:**
   ```bash
   npm run build:release
   ```

**Output:** `android/app/build/outputs/apk/release/app-release.apk`

### Bundle JavaScript Manually

If needed:

```bash
npm run bundle:android
```

This creates `android/app/src/main/assets/index.android.bundle`

### Clean Build

```bash
npm run clean
# Then rebuild
npm run build:debug
```

---

## CI/CD

### GitHub Actions Workflow

The project includes `.github/workflows/android-build.yml` which:

1. Runs on:
   - Push to tags (`v*.*.*`)
   - Pull requests affecting Android code
   - Manual trigger (workflow_dispatch)

2. Build process:
   - Sets up Node.js with caching
   - Sets up Java 17 and Android SDK
   - Installs dependencies
   - Bundles JavaScript
   - Builds Debug and Release APKs
   - Uploads artifacts

3. Caching:
   - Gradle packages (~/.gradle)
   - Metro bundler cache
   - Node modules (npm cache)

### Environment Secrets

Configure these in GitHub Settings → Secrets and variables → Actions:

- `SIGNING_KEY_ALIAS` - Release key alias
- `SIGNING_KEY_PASSWORD` - Release key password
- `SIGNING_STORE_PASSWORD` - Release keystore password

### Manual Workflow Trigger

```bash
# Via GitHub CLI
gh workflow run android-build.yml

# Or via GitHub UI
Actions → Android Build → Run workflow
```

---

## Troubleshooting

### Common Issues

#### 1. "SDK location not found"

**Solution:**
```bash
# Create local.properties
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
```

#### 2. "Execution failed for task ':app:installDebug'"

**Solution:**
```bash
# Check device connection
adb devices

# If device shows "unauthorized", accept on device
# If "offline", restart adb
adb kill-server
adb start-server
```

#### 3. "Unable to load script from assets 'index.android.bundle'"

**Solution:**
```bash
# Bundle JavaScript manually
npm run bundle:android

# Then rebuild
npm run android
```

#### 4. "Out of memory" during build

**Solution:**
```bash
# Increase Gradle heap size in android/gradle.properties
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m
```

#### 5. Metro bundler cache issues

**Solution:**
```bash
# Clear Metro cache
npm run start:reset

# Or manually
rm -rf .metro-cache
rm -rf node_modules/.cache
```

#### 6. Gradle sync fails

**Solution:**
```bash
cd android
./gradlew clean
./gradlew --stop
rm -rf .gradle
./gradlew assembleDebug --refresh-dependencies
```

### Debug Commands

```bash
# Check React Native environment
npx react-native doctor

# Check device connection
adb devices

# View device logs
adb logcat | grep ReactNative

# Install APK manually
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# Uninstall app
adb uninstall com.torchat

# Clear app data
adb shell pm clear com.torchat

# Check app info
adb shell dumpsys package com.torchat
```

---

## Next Steps

### Phase 2: Implement Core Features

1. **TOR Integration**
   - Implement TorService using react-native-iptproxy
   - Test .onion connectivity
   - Add bootstrap progress indicator

2. **Multi-Server Management**
   - Create ServerStorage service
   - Build server list UI
   - Implement server switching

3. **Authentication**
   - Update login/register screens
   - Add server selection
   - Implement secure token storage

4. **Chat Features**
   - Build room list screen
   - Implement chat screen
   - Add Socket.IO integration
   - Implement E2E encryption

5. **Admin Panel**
   - Create admin dashboard
   - Add user management
   - Add room management

6. **Push Notifications**
   - Set up notification service
   - Integrate with Socket.IO events
   - Handle notification actions

### Development Workflow

1. Create feature branch
2. Implement feature following ANDROID_REDESIGN_PLAN.md
3. Test on emulator and physical device
4. Submit PR with screenshots/videos
5. Address review comments
6. Merge to main

### Testing Checklist

- [ ] App builds successfully (debug & release)
- [ ] Runs on Android emulator
- [ ] Runs on physical device (Android 8+)
- [ ] No crash on startup
- [ ] Hot reload works
- [ ] Navigation works
- [ ] All screens render correctly

---

## Resources

- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [Android Developer Guide](https://developer.android.com/guide)
- [ANDROID_REDESIGN_PLAN.md](./ANDROID_REDESIGN_PLAN.md) - Full redesign specification
- [Gradle Build Guide](https://docs.gradle.org/current/userguide/userguide.html)

---

## Support

For issues:
1. Check this guide's [Troubleshooting](#troubleshooting) section
2. Review GitHub Issues
3. Check React Native community forums
4. Create new issue with:
   - Error message
   - Steps to reproduce
   - Environment info (`npx react-native doctor`)

---

**Last Updated:** October 30, 2025
**Version:** 0.1.2
**Status:** Phase 1 Complete - Ready for Development
