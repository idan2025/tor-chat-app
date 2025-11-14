plugins {
    kotlin("multiplatform")
    kotlin("plugin.serialization")
    id("com.android.library")
}

kotlin {
    androidTarget {
        compilations.all {
            kotlinOptions {
                jvmTarget = "17"
            }
        }
    }

    sourceSets {
        val commonMain by getting {
            dependencies {
                // Coroutines
                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.9.0")

                // Serialization
                implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

                // DateTime
                implementation("org.jetbrains.kotlinx:kotlinx-datetime:0.6.1")

                // Ktor Client for HTTP
                implementation("io.ktor:ktor-client-core:3.0.2")
                implementation("io.ktor:ktor-client-content-negotiation:3.0.2")
                implementation("io.ktor:ktor-serialization-kotlinx-json:3.0.2")
            }
        }

        val androidMain by getting {
            dependencies {
                // Android Ktor Engine
                implementation("io.ktor:ktor-client-okhttp:3.0.2")

                // TOR Integration - Guardian Project
                // Latest stable version with TOR binaries (0.4.8.19)
                implementation("info.guardianproject:tor-android:0.4.8.18")
                implementation("info.guardianproject:jtorctl:0.4.5.7")

                // Crypto (libsodium)
                implementation("com.goterl:lazysodium-android:5.1.0@aar")
                implementation("net.java.dev.jna:jna:5.14.0@aar")

                // AndroidX
                implementation("androidx.core:core-ktx:1.15.0")

                // DataStore for preferences
                implementation("androidx.datastore:datastore-preferences:1.1.1")

                // Socket.IO client
                implementation("io.socket:socket.io-client:2.1.1") {
                    exclude(group = "org.json", module = "json")
                }
            }
        }
    }
}

android {
    namespace = "com.torchat.shared"
    compileSdk = 35

    defaultConfig {
        minSdk = 24
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
