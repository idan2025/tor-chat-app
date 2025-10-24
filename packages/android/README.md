# TOR Chat Android App

React Native Android application for TOR Chat.

## Prerequisites

- Node.js 18+
- Java Development Kit (JDK) 17
- Android Studio
- Android SDK
- React Native CLI

## Setup

```bash
# Install dependencies
npm install

# Install pods (iOS only)
cd ios && pod install && cd ..
```

## Running

```bash
# Start Metro bundler
npm start

# Run on Android
npm run android

# Run on iOS (macOS only)
npm run ios
```

## Building for Release

### Android

```bash
cd android
./gradlew assembleRelease

# APK will be at:
# android/app/build/outputs/apk/release/app-release.apk
```

### Generate Signed APK

1. Generate keystore:
```bash
keytool -genkeypair -v -storetype PKCS12 -keystore tor-chat.keystore -alias tor-chat -keyalg RSA -keysize 2048 -validity 10000
```

2. Place keystore in `android/app/`

3. Create `android/gradle.properties`:
```
TORCHAT_UPLOAD_STORE_FILE=tor-chat.keystore
TORCHAT_UPLOAD_KEY_ALIAS=tor-chat
TORCHAT_UPLOAD_STORE_PASSWORD=yourpassword
TORCHAT_UPLOAD_KEY_PASSWORD=yourpassword
```

4. Build:
```bash
cd android && ./gradlew assembleRelease
```

## Configuration

Edit `src/store/authStore.ts` to change the API URL:

```typescript
const API_URL = 'http://your-server:3000/api';
```

For Android emulator, use `10.0.2.2` instead of `localhost`.

## Features

- Native Android/iOS UI
- Push notifications support
- Background sync
- Offline message queue
- Biometric authentication (optional)
- End-to-end encryption
