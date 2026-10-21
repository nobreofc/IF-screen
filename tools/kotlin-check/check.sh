#!/usr/bin/env bash
# Verificação do código Kotlin do app sem o SDK Android:
#  1) compila todos os .kt contra stubs das APIs Android usadas (pega erros de sintaxe/tipo);
#  2) roda o motor de cálculo (ScreenTimeEngine) com eventos do simulador e compara com a verdade.
# Requer: JDK 17+, Gradle instalado (usa o compilador Kotlin embutido nele), Node.js.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../.."
L="${GRADLE_LIB:-/opt/gradle/lib}"; W="$(mktemp -d)"
CP="$L/kotlin-compiler-embeddable-2.0.21.jar:$L/kotlin-stdlib-2.0.21.jar:$(ls $L/trove4j-*.jar|head -1):$L/kotlin-reflect-2.0.21.jar:$L/kotlin-script-runtime-2.0.21.jar:$L/kotlin-daemon-embeddable-2.0.21.jar:$(ls $L/kotlinx-coroutines-core-jvm*.jar|head -1):$(ls $L/annotations-*.jar|head -1)"
javac -nowarn -d "$W/stubs" $(find "$HERE/stubs" -name '*.java')
java -cp "$CP" org.jetbrains.kotlin.cli.jvm.K2JVMCompiler -no-stdlib -no-reflect -jvm-target 17 \
  -classpath "$W/stubs:$L/kotlin-stdlib-2.0.21.jar" -d "$W/app" $(find "$ROOT/android/app/src/main/java" -name '*.kt')
echo "compilação Kotlin: OK"
mkdir -p /tmp/claude-0/parity
(cd "$ROOT/tools/simulator" && node "$HERE/export-events.js")
java -cp "$CP" org.jetbrains.kotlin.cli.jvm.K2JVMCompiler -no-stdlib -no-reflect -jvm-target 17 \
  -classpath "$W/app:$W/stubs:$L/kotlin-stdlib-2.0.21.jar" -d "$W/test" "$HERE/ParityTest.kt"
java -cp "$W/test:$W/app:$W/stubs:$L/kotlin-stdlib-2.0.21.jar" ParityTestKt
