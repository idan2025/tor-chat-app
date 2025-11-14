# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# Keep native methods
-keepclassmembers class * {
    native <methods>;
}

# Hermes
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# Socket.IO
-keep class io.socket.** { *; }
-keep class com.github.nkzawa.** { *; }

# TOR / IPtProxy
-keep class info.guardianproject.** { *; }
-dontwarn info.guardianproject.**

# Libsodium / Crypto
-keep class com.goterl.lazysodium.** { *; }
-keep class com.sun.jna.** { *; }
-dontwarn com.sun.jna.**

# React Native Sodium
-keep class org.libsodium.** { *; }
-dontwarn org.libsodium.**

# AsyncStorage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# Image Picker
-keep class com.imagepicker.** { *; }
-keep class com.reactnative.** { *; }

# Document Picker
-keep class com.reactnativedocumentpicker.** { *; }

# Push Notifications
-keep class com.dieam.reactnativepushnotification.** { *; }

# Vector Icons
-keep class com.oblador.vectoricons.** { *; }

# Fast Image
-keep class com.dylanvann.fastimage.** { *; }

# Video Player
-keep class com.brentvatne.react.** { *; }

# Glide
-keep public class * implements com.bumptech.glide.module.GlideModule
-keep class * extends com.bumptech.glide.module.AppGlideModule {
 <init>(...);
}
-keep public enum com.bumptech.glide.load.ImageHeaderParser$** {
  **[] $VALUES;
  public *;
}
-keep class com.bumptech.glide.load.data.ParcelFileDescriptorRewinder$InternalRewinder {
  *** rewind();
}

# Warnings to suppress
-dontwarn java.nio.file.*
-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement
-dontwarn javax.annotation.**
-dontwarn com.facebook.infer.**
