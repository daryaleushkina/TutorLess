// Дизайн-система на Compose: токены стиля B берутся из design/tokens/generated/android как есть (без копии —
// правится только источник design/tokens/src), поверх — тема, вшитые шрифты и общие элементы.
plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kover)
}

android {
    namespace = "dev.greprepapp.design"
    compileSdk {
        version = release(37)
    }
    defaultConfig {
        minSdk = 26
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    sourceSets {
        named("main") {
            kotlin.directories += "../../../../design/tokens/generated/android"
            // Цвета ресурсами — для фона окна и заставки, которые рисуются до Compose.
            res.directories += "../../../../design/tokens/generated/android/res"
        }
    }
    lint {
        warningsAsErrors = true
        abortOnError = true
        checkDependencies = false
    }
    testOptions {
        unitTests.isIncludeAndroidResources = true
        unitTests.all {
            // Как в app: Robolectric API 37 обращается к разделяемой памяти JDK.
            it.jvmArgs("--add-opens=java.base/jdk.internal.access=ALL-UNNAMED")
        }
    }
}

kotlin {
    compilerOptions {
        allWarningsAsErrors.set(true)
    }
}

dependencies {
    api(platform(libs.compose.bom))
    api(libs.compose.ui)
    api(libs.compose.foundation)
    api(libs.compose.material3)
    api(libs.compose.ui.tooling.preview)
    debugImplementation(libs.compose.ui.tooling)
    testImplementation(libs.junit)
    testImplementation(libs.robolectric)
    lintChecks(libs.compose.lint.checks)
}
