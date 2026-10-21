// Repositórios: além do Google e do Maven Central, usamos o espelho oficial do
// Maven Central no Google Cloud. Se o Maven Central falhar ou bloquear o servidor
// de build, o Gradle busca a mesma biblioteca no espelho.
pluginManagement {
    repositories {
        google()
        maven("https://maven-central.storage-download.googleapis.com/maven2/")
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        maven("https://maven-central.storage-download.googleapis.com/maven2/")
        mavenCentral()
    }
}
rootProject.name = "IFScreen"
include(":app")
