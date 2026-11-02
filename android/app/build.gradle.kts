plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val relayUrl: String = (project.findProperty("IFSCREEN_RELAY_URL") as String?)?.trim().orEmpty()
val appKey: String = (project.findProperty("IFSCREEN_APP_KEY") as String?)?.trim()?.ifEmpty { null } ?: "ifscreen-app-key"

android {
    namespace = "br.edu.ifrn.ifscreen"
    compileSdk = 35

    defaultConfig {
        applicationId = "br.edu.ifrn.ifscreen"
        minSdk = 28
        targetSdk = 35
        versionCode = 2
        versionName = "1.1.0"
        buildConfigField("String", "DEFAULT_RELAY_URL", "\"$relayUrl\"")
        buildConfigField("String", "APP_KEY", "\"$appKey\"")
    }

    // Assinatura fixa do projeto: permite atualizar o app sem desinstalar (e sem perder dados).
    // Para produção, gere a sua própria chave e informe as senhas por -P ou variáveis do CI.
    signingConfigs {
        create("ifscreen") {
            storeFile = file("ifscreen-release.jks")
            storePassword = (project.findProperty("IFSCREEN_STORE_PASSWORD") as String?) ?: "ifscreen2026"
            keyAlias = "ifscreen"
            keyPassword = (project.findProperty("IFSCREEN_KEY_PASSWORD") as String?) ?: "ifscreen2026"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("ifscreen")
        }
        debug {
            signingConfig = signingConfigs.getByName("ifscreen")
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}

dependencies {
    implementation("androidx.work:work-runtime:2.9.1")
}
