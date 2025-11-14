# Android KMP GitHub Actions Workflows

This directory contains two GitHub Actions workflows for building and releasing the Kotlin Multiplatform Android application.

## Workflows Overview

### 1. `android-kmp-build.yml` - Build & Test

**Purpose:** Continuous integration for Android app builds and tests.

**Triggers:**
- Push to `main` branch (affecting `packages/android/**`)
- Pull requests (affecting `packages/android/**`)
- Manual dispatch via GitHub Actions UI

**What it does:**
1. Sets up JDK 17 and Android SDK
2. Caches Gradle dependencies and Kotlin/Native compiler
3. Builds debug APK using `./gradlew assembleDebug`
4. Runs unit tests (if present) using `./gradlew test`
5. Analyzes APK size and generates report
6. Uploads debug APK as artifact (30-day retention)
7. Posts build summary on PRs with APK details

**Artifacts:**
- `android-debug-apk` - Debug APK (retained for 30 days)
- `test-reports` - Test results and reports (retained for 7 days)

**Performance Optimizations:**
- Gradle build cache enabled
- Kotlin/Native compiler cache
- Parallel builds with `--scan` for build insights
- Concurrency control to cancel outdated builds

---

### 2. `android-kmp-release.yml` - Release Build

**Purpose:** Production release builds with optional signing and GitHub release creation.

**Triggers:**
- Git tags matching `v*.*.*` (e.g., `v1.0.0`, `v2.1.3`)
- Manual dispatch with custom version input

**What it does:**
1. Extracts version from tag or manual input
2. Sets up JDK 17 and Android SDK
3. Decodes signing keystore from GitHub Secrets (if configured)
4. Configures signing properties in `gradle.properties`
5. Builds release APK using `./gradlew assembleRelease`
6. Verifies and analyzes the APK
7. Renames APK with version (e.g., `tor-chat-1.0.0-release-signed.apk`)
8. Uploads APK as artifact (90-day retention)
9. Creates GitHub Release with APK attachment and detailed notes
10. Securely cleans up keystore file

**Artifacts:**
- `android-release-apk` - Signed/unsigned release APK (retained for 90 days)

**Security Features:**
- Keystore decoded from base64 secret (never committed to repo)
- Signing credentials passed via environment variables
- Automatic cleanup of keystore after build
- Secure handling of sensitive data

---

## Configuration Guide

### Prerequisites

1. **JDK 17** - Required by Kotlin 2.1.0
2. **Android SDK 35** - Target SDK for Android 15
3. **Gradle 8.11.1** - Defined in `gradle-wrapper.properties`

### GitHub Secrets Configuration

For **release signing**, you need to configure the following secrets in your GitHub repository:

#### Step 1: Generate a Signing Keystore (if you don't have one)

```bash
keytool -genkey -v \
  -keystore release-keystore.jks \
  -alias tor-chat-release \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass YOUR_STORE_PASSWORD \
  -keypass YOUR_KEY_PASSWORD
```

**Important:** Store this keystore securely! You'll need it for all future releases.

#### Step 2: Encode Keystore to Base64

```bash
base64 -w 0 release-keystore.jks > keystore-base64.txt
```

This creates a single-line base64-encoded string of your keystore.

#### Step 3: Add Secrets to GitHub

Go to your repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add the following secrets:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded keystore file | Content of `keystore-base64.txt` |
| `KEYSTORE_PASSWORD` | Keystore password | The password you used with `-storepass` |
| `KEY_ALIAS` | Key alias name | `tor-chat-release` |
| `KEY_PASSWORD` | Key password | The password you used with `-keypass` |

#### Step 4: Update `build.gradle.kts` for Signing

Add the signing configuration to `packages/android/androidApp/build.gradle.kts`:

```kotlin
android {
    // ... existing config ...

    signingConfigs {
        create("release") {
            // These properties are set by the workflow from secrets
            val keystoreFile = project.findProperty("RELEASE_STORE_FILE") as String?
            val keystorePassword = project.findProperty("RELEASE_STORE_PASSWORD") as String?
            val keyAlias = project.findProperty("RELEASE_KEY_ALIAS") as String?
            val keyPassword = project.findProperty("RELEASE_KEY_PASSWORD") as String?

            if (keystoreFile != null && file(keystoreFile).exists()) {
                storeFile = file(keystoreFile)
                storePassword = keystorePassword
                this.keyAlias = keyAlias
                this.keyPassword = keyPassword
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}
```

---

## Usage Examples

### Triggering a Build on Push

Simply push changes to `main` or create a PR:

```bash
git add packages/android/
git commit -m "feat: add new feature to Android app"
git push origin main
```

The `android-kmp-build.yml` workflow will automatically run.

---

### Creating a Release

#### Option 1: Using Git Tags (Recommended)

```bash
# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0
```

This will trigger `android-kmp-release.yml` automatically.

#### Option 2: Manual Dispatch

1. Go to GitHub → **Actions** tab
2. Select **"Android KMP Release"** workflow
3. Click **"Run workflow"**
4. Enter version (e.g., `1.0.0`)
5. Choose whether to create a GitHub Release
6. Click **"Run workflow"**

---

### Downloading APKs

#### From GitHub Actions (Artifacts)

1. Go to **Actions** tab
2. Click on the workflow run
3. Scroll to **Artifacts** section
4. Download `android-debug-apk` or `android-release-apk`

#### From GitHub Releases

1. Go to **Releases** tab
2. Find your version (e.g., `v1.0.0`)
3. Download the attached APK file

---

## Build Optimization Tips

### 1. Gradle Daemon Configuration

Add to `packages/android/gradle.properties`:

```properties
# Gradle daemon configuration for CI
org.gradle.daemon=false
org.gradle.parallel=true
org.gradle.caching=true
org.gradle.configureondemand=false
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError

# Kotlin compiler configuration
kotlin.compiler.execution.strategy=in-process
kotlin.incremental=false
```

### 2. Dependency Locking

Enable dependency locking for reproducible builds:

```bash
cd packages/android
./gradlew dependencies --write-locks
```

Commit the generated `*.lockfile` files.

### 3. Build Scan Analysis

Both workflows use `--scan` flag. After a build:

1. Check the workflow logs
2. Look for "Publishing build scan..." message
3. Click the URL to view detailed build metrics on scans.gradle.com

---

## Troubleshooting

### Issue: APK not found after build

**Solution:** Verify the output path in your `build.gradle.kts`:

```kotlin
android {
    // Ensure output directory is standard
    applicationVariants.all {
        outputs.all {
            outputFileName = "app-${variant.name}.apk"
        }
    }
}
```

### Issue: Signing fails with "Keystore was tampered with"

**Causes:**
- Incorrect `KEYSTORE_PASSWORD`
- Corrupted base64 encoding

**Solution:**
1. Re-encode keystore: `base64 -w 0 release-keystore.jks`
2. Update `ANDROID_KEYSTORE_BASE64` secret
3. Verify password is correct

### Issue: Out of memory during build

**Solution:** Increase JVM memory in workflow:

```yaml
env:
  GRADLE_OPTS: -Dorg.gradle.jvmargs="-Xmx6144m -XX:MaxMetaspaceSize=1536m"
```

### Issue: Gradle cache not working

**Solution:**
1. Ensure `gradle.properties` has `org.gradle.caching=true`
2. Clear cache manually: Go to Actions → Caches → Delete old caches
3. Re-run workflow

### Issue: Tests failing in CI but passing locally

**Possible causes:**
- Timezone differences
- Missing test resources
- Environment-specific configurations

**Solution:**
```bash
# Run tests with same settings as CI
./gradlew test --no-daemon --stacktrace
```

---

## Security Best Practices

### ✅ Do

- Store signing keys in GitHub Secrets
- Use different keystores for debug and release
- Rotate signing keys periodically (with proper planning)
- Limit access to secrets (repository settings)
- Enable "Required approvals" for releases

### ❌ Don't

- Commit keystores or passwords to Git
- Share signing keys via email or chat
- Use the same keystore for multiple apps
- Disable security scanning in workflows
- Use weak keystore passwords

---

## Workflow Maintenance

### Updating Action Versions

Periodically update GitHub Actions to latest versions:

```bash
# Check for outdated actions
gh api repos/:owner/:repo/actions/workflows \
  --jq '.workflows[].path' | xargs -I {} \
  gh workflow view {} --json path,state
```

Update versions in both workflow files:
- `actions/checkout@v4` → latest
- `actions/setup-java@v4` → latest
- `gradle/actions/setup-gradle@v4` → latest
- etc.

### Testing Workflow Changes

Before merging workflow changes:

1. Create a feature branch
2. Update workflow file
3. Push to trigger the workflow
4. Verify it works as expected
5. Merge to main

---

## Monitoring & Alerts

### Build Success Rate

Track build health in GitHub:
- **Actions** tab → **Filter by workflow** → View success rate

### APK Size Monitoring

The workflows automatically report APK sizes:
- Check PR comments for size trends
- Set up alerts if size increases significantly

### Example: APK Size Alert

Add to your workflow:

```yaml
- name: Check APK size threshold
  run: |
    MAX_SIZE_MB=50
    ACTUAL_SIZE_MB=${{ steps.apk_info.outputs.apk_size_mb }}
    if (( $(echo "$ACTUAL_SIZE_MB > $MAX_SIZE_MB" | bc -l) )); then
      echo "::error::APK size ($ACTUAL_SIZE_MB MB) exceeds threshold ($MAX_SIZE_MB MB)"
      exit 1
    fi
```

---

## CI/CD Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Developer Workflow                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Git Push/PR     │
                    └──────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
    ┌─────────────────────┐    ┌─────────────────────┐
    │  android-kmp-build  │    │ android-kmp-release │
    │    (CI Workflow)    │    │  (Release Workflow) │
    └─────────────────────┘    └─────────────────────┘
                │                           │
                ├─ Setup JDK 17            ├─ Setup JDK 17
                ├─ Setup Android SDK       ├─ Decode Keystore
                ├─ Cache Gradle            ├─ Configure Signing
                ├─ Build Debug APK         ├─ Build Release APK
                ├─ Run Tests               ├─ Verify APK
                ├─ Analyze APK             ├─ Create Release
                └─ Upload Artifacts        └─ Upload to GitHub
                              │
                              ▼
                ┌─────────────────────────┐
                │   GitHub Artifacts      │
                │   + GitHub Releases     │
                └─────────────────────────┘
```

---

## Additional Resources

- [Kotlin Multiplatform Docs](https://kotlinlang.org/docs/multiplatform.html)
- [Android Gradle Plugin Docs](https://developer.android.com/build)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Gradle Build Scans](https://scans.gradle.com/)

---

## Support & Contact

For issues with the workflows:
1. Check the **Troubleshooting** section above
2. Review workflow run logs in GitHub Actions
3. Open an issue in the repository

---

**Last Updated:** 2025-11-14
**Workflows Version:** 1.0.0
**Maintained by:** DevOps Team
