# ProGuard rules for release builds (R8 minify + resource shrinking on).
#
# This app is a thin Kotlin wrapper around a WebView that loads everything
# from app/src/main/assets/. Almost nothing in the Kotlin layer is reachable
# from JavaScript so default R8 stripping is safe. Specific keeps:

# Keep MainActivity (entry point referenced by AndroidManifest.xml).
-keep class com.livesolar.solarsystem.MainActivity { *; }

# Keep classes used by androidx.webkit.WebViewAssetLoader (loaded reflectively).
-keep class androidx.webkit.** { *; }

# Suppress R8 warnings for optional Kotlin metadata.
-dontwarn kotlin.**
-dontwarn org.jetbrains.annotations.**
