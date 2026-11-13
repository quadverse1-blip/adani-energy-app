# Add project specific ProGuard rules here.

# react-native core
-keep class com.facebook.react.** { *; }
-keep interface com.facebook.react.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Expo modules
-keep class expo.modules.** { *; }
-keep interface expo.modules.** { *; }

# Mappls SDK & Native Plugins
-keep class com.mappls.sdk.** { *; }
-keep interface com.mappls.sdk.** { *; }
-dontwarn com.mappls.sdk.**
-keep class com.mappls.sdk.maps.rctmgl.** { *; }
-keep class org.maplibre.** { *; }
-dontwarn org.maplibre.**

# react-native-screens & safe-area & AndroidX
-keep class com.swmansion.** { *; }
-keep interface com.swmansion.** { *; }
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }
-keep class androidx.fragment.app.** { *; }
-keep class androidx.appcompat.** { *; }

# react-native-webview
-keep class com.reactnativecommunity.webview.** { *; }

# Networking
-dontwarn okhttp3.**
-dontwarn okio.**
