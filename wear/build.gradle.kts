// Watch Face Format (WFF) module: RESOURCE-ONLY (no Kotlin/Java).
// The watch face is declared entirely in res/raw/watchface.xml and rendered by
// the on-device WFF runtime (com.google.wear.watchface.runtime). No code, no
// androidx.wear.watchface dependency — those AndroidX/Canvas faces cannot be
// activated on Wear OS 5/6. WFF is the
// supported + Play-required format.
plugins {
    id("com.android.application")
}

android {
    namespace = "com.livesolar.solarsystem.wear"
    compileSdk = 35

    defaultConfig {
        // SAME applicationId as the phone app -> same Play listing -> auto-install
        // on the paired watch (multi-APK delivery).
        applicationId = "com.livesolar.solarsystem"
        // WFF requires Wear OS 4+ (API 33). Below this the runtime is absent.
        minSdk = 33
        targetSdk = 35
        // OWN versionCode band, globally unique vs the phone (phone = 6).
        versionCode = 7
        versionName = "1.0.5"
    }

    // Reuse the phone app's release keystore (same signing key REQUIRED under the
    // same listing).
    val releaseKeystorePath = (project.findProperty("RELEASE_STORE_FILE") as String?) ?: ""
    val releaseKeystoreExists = releaseKeystorePath.isNotEmpty() && file(releaseKeystorePath).exists()
    signingConfigs {
        create("release") {
            if (releaseKeystoreExists) {
                storeFile = file(releaseKeystorePath)
                storePassword = project.findProperty("RELEASE_STORE_PASSWORD") as String?
                keyAlias = project.findProperty("RELEASE_KEY_ALIAS") as String?
                keyPassword = project.findProperty("RELEASE_KEY_PASSWORD") as String?
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (releaseKeystoreExists) signingConfig = signingConfigs.getByName("release")
        }
    }
}
