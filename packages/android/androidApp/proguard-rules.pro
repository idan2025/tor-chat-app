# TOR Chat ProGuard Rules

# Keep TOR libraries
-keep class org.torproject.** { *; }
-keep class net.freehaven.** { *; }
-keep class info.guardianproject.** { *; }

# Keep libsodium
-keep class com.goterl.** { *; }
-keep class com.sun.jna.** { *; }
-keep class net.java.dev.jna.** { *; }

# Kotlinx Serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}

-keep,includedescriptorclasses class com.torchat.shared.models.**$$serializer { *; }
-keepclassmembers class com.torchat.shared.models.** {
    *** Companion;
}
-keepclasseswithmembers class com.torchat.shared.models.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Ktor
-keep class io.ktor.** { *; }
-keepclassmembers class io.ktor.** { volatile <fields>; }

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# Compose
-dontwarn androidx.compose.**
-keep class androidx.compose.** { *; }

# General Android
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
