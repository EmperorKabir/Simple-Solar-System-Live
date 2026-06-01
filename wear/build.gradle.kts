plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.livesolar.solarsystem.wear"
    compileSdk = 35

    defaultConfig {
        // SAME applicationId as the phone app so the watch build ships under the
        // same Play listing (Multi-APK delivery -> auto-install on the watch).
        applicationId = "com.livesolar.solarsystem"
        minSdk = 30          // Wear OS 3+
        targetSdk = 35
        // OWN versionCode band, globally unique vs the phone (phone = 6). Watch
        // codes must never collide with phone codes across the listing.
        versionCode = 7
        versionName = "1.0.5"
    }

    // Reuse the phone app's release keystore (same signing key is REQUIRED for the
    // watch build under the same listing). Read the same gradle.properties keys.
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
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (releaseKeystoreExists) signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }
}

java {
    toolchain { languageVersion.set(JavaLanguageVersion.of(21)) }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    // Modern Wear OS watch-face runtime (CanvasRenderer, UserStyle, WatchFaceService).
    implementation("androidx.wear.watchface:watchface:1.2.1")
    // Editor (the customise-screen settings UI) — wired in a later step.
    implementation("androidx.wear.watchface:watchface-editor:1.2.1")
}
