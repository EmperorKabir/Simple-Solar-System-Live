plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// SLSS_DIAG_TEMPORARY — read short git SHA at configuration time so diagnostic
// logs can be tied to the exact commit that produced the build. Falls back to
// "unknown" if git is unavailable. Remove with the rest of the diagnostic
// logging system once the investigation concludes.
val gitCommitSha: String = try {
    val proc = ProcessBuilder("git", "rev-parse", "--short", "HEAD")
        .directory(rootDir)
        .redirectErrorStream(true)
        .start()
    proc.inputStream.bufferedReader().readText().trim().ifEmpty { "unknown" }
} catch (_: Exception) {
    "unknown"
}

android {
    namespace = "com.livesolar.solarsystem"
    compileSdk = 35

    buildFeatures {
        buildConfig = true
    }

    defaultConfig {
        applicationId = "com.livesolar.solarsystem"
        minSdk = 31
        targetSdk = 35
        versionCode = 6
        versionName = "1.0.5"

        // SLSS_DIAG_TEMPORARY — build commit for diagnostic log envelope.
        buildConfigField("String", "BUILD_COMMIT", "\"$gitCommitSha\"")

        // SLSS_DIAG_TEMPORARY — explicit master switch for the diagnostic
        // logging system. Default OFF here so release inherits false; the
        // debug + diagnostic build types flip it true below. Self-controlled
        // so gating does NOT depend on AGP's ambiguous BuildConfig.DEBUG
        // (true-for-debug-type vs true-for-debuggable) semantics.
        buildConfigField("boolean", "SLSS_DIAG_ENABLED", "false")
    }

    testOptions {
        unitTests.all {
            it.useJUnitPlatform()
        }
    }

    // Release-signing config reads keystore details from the user's
    // ~/.gradle/gradle.properties (NEVER committed). The signing config is
    // wired up whenever the referenced keystore file actually exists on disk
    // — more robust than checking the gradle property alone, which can be
    // missed on a stale daemon or cached configuration phase.
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
        // SLSS_DIAG_TEMPORARY — enable diagnostic logging in debug builds.
        getByName("debug") {
            buildConfigField("boolean", "SLSS_DIAG_ENABLED", "true")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (releaseKeystoreExists) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
        create("diagnostic") {
            initWith(getByName("debug"))
            applicationIdSuffix = ".diag"
            versionNameSuffix = "-diag"
            isDebuggable = true
            isMinifyEnabled = false
            isShrinkResources = false
            // SLSS_DIAG_TEMPORARY — set explicitly (not just via initWith) so
            // the flag is guaranteed true regardless of initWith field-copy order.
            buildConfigField("boolean", "SLSS_DIAG_ENABLED", "true")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.core:core-ktx:1.15.0")  // WindowCompat / ViewCompat / WindowInsetsCompat

    // WebViewAssetLoader for secure local asset serving (enables ES modules in WebView)
    implementation("androidx.webkit:webkit:1.12.1")

    // WorkManager — periodic widget refresh
    implementation("androidx.work:work-runtime-ktx:2.9.1")
    // Required transitively by ListenableWorker.startWork
    implementation("androidx.concurrent:concurrent-futures:1.2.0")

    // JUnit 5 — algorithmic-only unit tests for the JS engine's math (re-implemented in Kotlin)
    testImplementation("org.junit.jupiter:junit-jupiter-api:5.10.2")
    testImplementation("org.junit.jupiter:junit-jupiter-params:5.10.2")
    testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine:5.10.2")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher:1.10.2")
}
