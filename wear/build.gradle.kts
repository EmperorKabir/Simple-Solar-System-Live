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
        // WFF v3 (isAutoSize / font scaling) needs the Wear OS 5.1 runtime = API 35.
        // The format.version property in the manifest is 3; minSdk must match the v3
        // floor so Play only targets devices whose WFF runtime can render it.
        minSdk = 35
        targetSdk = 35
        // OWN versionCode band, globally unique vs the phone (phone = 8). Bumped
        // 7 -> 9 after the code-7 bundle was rejected at Play validation.
        versionCode = 9
        versionName = "1.0.6"
    }

    // A WFF watch face AAB must contain ZERO compiled code — Google Play rejects it
    // ("Watch face cannot have any dex files"). Disable every code/BuildConfig
    // generator so no classes.dex is produced (the dex is stripped post-bundle below
    // as a belt-and-braces guarantee).
    buildFeatures {
        buildConfig = false
        resValues = false
        aidl = false
        renderScript = false
        shaders = false
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

// Belt-and-braces: AGP still emits a stub base/dex/classes.dex even with every
// code feature disabled above. Google Play HARD-REJECTS a watch face that
// contains any dex ("Watch face cannot have any dex files"). Strip it from the
// bundle immediately after it is built so the artifact is Play-uploadable.
tasks.matching { it.name == "bundleRelease" || it.name == "bundleDebug" }.configureEach {
    doLast {
        val variant = if (name.contains("Release")) "release" else "debug"
        val aab = layout.buildDirectory.file("outputs/bundle/$variant/wear-$variant.aab").get().asFile
        if (aab.exists()) {
            exec {
                commandLine("python", "${rootProject.projectDir}/wear/tools/strip_dex.py", aab.absolutePath)
            }
        }
    }
}
