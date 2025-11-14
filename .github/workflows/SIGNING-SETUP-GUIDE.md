# Android APK Signing Setup Guide

This guide walks you through setting up release signing for your Android Kotlin Multiplatform app.

---

## Prerequisites

- OpenJDK or Android Studio installed (for `keytool`)
- Access to your GitHub repository settings
- Command line access (Terminal/PowerShell)

---

## Part 1: Generate Signing Keystore

### Step 1: Create Release Keystore

Run this command to generate a new keystore:

```bash
keytool -genkey -v \
  -keystore tor-chat-release.jks \
  -alias tor-chat-release \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass YourStrongPassword123! \
  -keypass YourStrongPassword123!
```

**Note:** Replace `YourStrongPassword123!` with a strong, unique password.

You'll be prompted to enter details:

```
What is your first and last name?
  [Unknown]:  Your Name
What is the name of your organizational unit?
  [Unknown]:  Development
What is the name of your organization?
  [Unknown]:  Tor Chat
What is the name of your City or Locality?
  [Unknown]:  Your City
What is the name of your State or Province?
  [Unknown]:  Your State
What is the two-letter country code for this unit?
  [Unknown]:  US
Is CN=Your Name, OU=Development, O=Tor Chat, L=Your City, ST=Your State, C=US correct?
  [no]:  yes
```

This creates: `tor-chat-release.jks`

### Step 2: Verify Keystore

```bash
keytool -list -v -keystore tor-chat-release.jks -storepass YourStrongPassword123!
```

You should see your key details including:
- Alias: `tor-chat-release`
- Creation date
- Valid until: ~27 years from now

### Step 3: Secure the Keystore

**CRITICAL:** Store this file securely!

1. **Backup to secure location:**
   ```bash
   # Copy to encrypted storage, cloud backup, password manager, etc.
   cp tor-chat-release.jks ~/secure-backups/tor-chat-release-$(date +%Y%m%d).jks
   ```

2. **NEVER commit to Git:**
   ```bash
   # Ensure .gitignore contains:
   echo "*.jks" >> .gitignore
   echo "*.keystore" >> .gitignore
   ```

---

## Part 2: Configure GitHub Secrets

### Step 1: Encode Keystore to Base64

```bash
# On Linux/macOS:
base64 -w 0 tor-chat-release.jks > keystore-base64.txt

# On Windows (PowerShell):
[Convert]::ToBase64String([IO.File]::ReadAllBytes("tor-chat-release.jks")) | Out-File -Encoding ASCII keystore-base64.txt
```

This creates a text file with a long base64 string.

### Step 2: Add Secrets to GitHub

1. Go to your repository on GitHub
2. Navigate to: **Settings** → **Secrets and variables** → **Actions**
3. Click: **New repository secret**

Add these **4 secrets**:

#### Secret 1: ANDROID_KEYSTORE_BASE64
```
Name: ANDROID_KEYSTORE_BASE64
Value: [Paste entire contents of keystore-base64.txt]
```

#### Secret 2: KEYSTORE_PASSWORD
```
Name: KEYSTORE_PASSWORD
Value: YourStrongPassword123!
```

#### Secret 3: KEY_ALIAS
```
Name: KEY_ALIAS
Value: tor-chat-release
```

#### Secret 4: KEY_PASSWORD
```
Name: KEY_PASSWORD
Value: YourStrongPassword123!
```

**Note:** In this example, store password and key password are the same. They can be different if you used different values in Step 1.

### Step 3: Verify Secrets

After adding all secrets, you should see:

```
Secrets (4)
├─ ANDROID_KEYSTORE_BASE64
├─ KEY_ALIAS
├─ KEY_PASSWORD
└─ KEYSTORE_PASSWORD
```

---

## Part 3: Update Build Configuration

### Step 1: Update `androidApp/build.gradle.kts`

Add signing configuration to your build file:

```kotlin
android {
    namespace = "com.torchat"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.torchat"
        minSdk = 24
        targetSdk = 35
        versionCode = 4
        versionName = "0.2.0"
    }

    // Add signing configuration
    signingConfigs {
        create("release") {
            val keystoreFile = project.findProperty("RELEASE_STORE_FILE") as String?
            val keystorePassword = project.findProperty("RELEASE_STORE_PASSWORD") as String?
            val keyAlias = project.findProperty("RELEASE_KEY_ALIAS") as String?
            val keyPassword = project.findProperty("RELEASE_KEY_PASSWORD") as String?

            // Only configure signing if all properties are present
            if (keystoreFile != null && file(keystoreFile).exists()) {
                storeFile = file(keystoreFile)
                storePassword = keystorePassword
                this.keyAlias = keyAlias
                this.keyPassword = keyPassword

                println("✓ Release signing configured")
            } else {
                println("⚠ Release signing not configured (unsigned build)")
            }
        }
    }

    buildTypes {
        release {
            // Apply signing config
            signingConfig = signingConfigs.getByName("release")

            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            applicationIdSuffix = ".debug"
            isDebuggable = true
        }
    }

    // ... rest of your configuration
}
```

### Step 2: Test Locally (Optional)

To test signing locally without GitHub Actions:

1. Create `packages/android/local-signing.properties`:

```properties
RELEASE_STORE_FILE=/absolute/path/to/tor-chat-release.jks
RELEASE_STORE_PASSWORD=YourStrongPassword123!
RELEASE_KEY_ALIAS=tor-chat-release
RELEASE_KEY_PASSWORD=YourStrongPassword123!
```

2. Add to `.gitignore`:

```gitignore
local-signing.properties
*.jks
*.keystore
```

3. Load properties in `build.gradle.kts`:

```kotlin
// Load local signing properties if present
val localSigningPropsFile = rootProject.file("local-signing.properties")
if (localSigningPropsFile.exists()) {
    val localSigningProps = java.util.Properties()
    localSigningProps.load(java.io.FileInputStream(localSigningPropsFile))
    localSigningProps.forEach { key, value ->
        project.extra.set(key.toString(), value)
    }
}
```

4. Build locally:

```bash
cd packages/android
./gradlew assembleRelease
```

---

## Part 4: Test the Workflow

### Test 1: Manual Release Build

1. Go to: **Actions** → **Android KMP Release**
2. Click: **Run workflow**
3. Enter version: `0.2.1-test`
4. Enable: "Create GitHub Release"
5. Click: **Run workflow**

Wait for the workflow to complete (~5-10 minutes).

### Test 2: Verify Signed APK

After the workflow completes:

1. Go to: **Releases** → Find `v0.2.1-test`
2. Download: `tor-chat-0.2.1-test-release-signed.apk`
3. Verify signature:

```bash
# On Linux/macOS with apksigner:
apksigner verify --verbose tor-chat-0.2.1-test-release-signed.apk

# Expected output:
# Verifies
# Verified using v1 scheme (JAR signing): true
# Verified using v2 scheme (APK Signature Scheme v2): true
# Verified using v3 scheme (APK Signature Scheme v3): true
```

### Test 3: Tag-Based Release

```bash
git tag v0.2.1
git push origin v0.2.1
```

This should automatically trigger the release workflow.

---

## Part 5: Production Release Checklist

Before releasing to production:

- [ ] Verify all 4 secrets are configured correctly
- [ ] Test workflow with a pre-release version (e.g., `v0.2.0-beta`)
- [ ] Verify APK is properly signed
- [ ] Test APK installation on multiple devices
- [ ] Backup keystore to secure location (encrypted)
- [ ] Document keystore password in secure password manager
- [ ] Update `versionCode` and `versionName` in `build.gradle.kts`
- [ ] Update `CHANGELOG.md` with release notes
- [ ] Create release tag with semantic versioning (e.g., `v1.0.0`)

---

## Troubleshooting

### Error: "Keystore was tampered with, or password was incorrect"

**Cause:** Incorrect password or corrupted keystore.

**Solution:**
1. Verify password is correct
2. Re-encode keystore:
   ```bash
   base64 -w 0 tor-chat-release.jks > keystore-base64-new.txt
   ```
3. Update `ANDROID_KEYSTORE_BASE64` secret

### Error: "Keystore file does not exist"

**Cause:** Base64 decoding failed or path is incorrect.

**Solution:**
1. Check workflow logs for decoding errors
2. Verify base64 string has no line breaks:
   ```bash
   # Should be one continuous line:
   wc -l keystore-base64.txt  # Output should be: 1
   ```
3. Re-upload secret

### Error: "APK not signed" after workflow

**Cause:** Signing configuration not applied.

**Solution:**
1. Verify all 4 secrets exist in GitHub
2. Check `build.gradle.kts` has signing config
3. Review workflow logs for signing messages
4. Ensure `signingConfig = signingConfigs.getByName("release")` is set

### Error: "Cannot recover key"

**Cause:** Key alias or key password is incorrect.

**Solution:**
1. List keystore contents:
   ```bash
   keytool -list -v -keystore tor-chat-release.jks
   ```
2. Verify alias matches `KEY_ALIAS` secret
3. Verify key password matches `KEY_PASSWORD` secret

---

## Security Best Practices

### ✅ Do

- Use strong, unique passwords (16+ characters)
- Store keystore in multiple secure locations (encrypted)
- Use different keystores for different apps
- Rotate keystore every few years (with proper migration)
- Limit access to GitHub secrets (use environment protection rules)
- Enable 2FA on GitHub account
- Use secret scanning to detect accidental exposure

### ❌ Don't

- Commit keystores to Git (even in private repos)
- Share keystore or passwords via email/Slack
- Use weak passwords (e.g., "password123")
- Store keystores in public cloud storage without encryption
- Reuse keystores across multiple apps
- Disable signing for production builds

---

## Key Management Strategy

### Backup Plan

1. **Primary:** Secure password manager (e.g., 1Password, Bitwarden)
2. **Secondary:** Encrypted USB drive in safe/vault
3. **Tertiary:** Encrypted cloud backup (Google Drive, Dropbox with encryption)

### Password Recovery

If you lose the keystore or password:

**Impact:**
- Cannot update existing app on Play Store
- Must publish as new app (loses user base, ratings, reviews)

**Prevention:**
- Store keystore in 3+ secure locations
- Document passwords in password manager
- Test password recovery quarterly

### Keystore Rotation (Advanced)

To rotate keystores while maintaining app updates:

1. Google Play App Signing (recommended)
   - Upload keystore to Google Play Console
   - Google manages signing for you
   - You can rotate your upload key without affecting users

2. Manual rotation (not recommended)
   - Requires publishing new app
   - Loses all existing users

---

## Additional Resources

- [Android Developer: Sign your app](https://developer.android.com/studio/publish/app-signing)
- [Google Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756)
- [GitHub Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Keystore Security Best Practices](https://developer.android.com/training/articles/keystore)

---

## Support

For issues with signing setup:
1. Check **Troubleshooting** section above
2. Review workflow logs in GitHub Actions
3. Verify secrets are configured correctly
4. Test signing locally before using CI/CD

---

**Last Updated:** 2025-11-14
**Guide Version:** 1.0.0
