import br.edu.ifrn.ifscreen.*
import java.io.File

fun main() {
    val now = 1792519200000L // 20/10/2026 15:00 (UTC-3)
    val dir = File("/tmp/claude-0/parity")
    val events = HashMap<Int, List<RawEvent>>()
    var checked = 0; var exact = 0; var maxDiff = 0L; var nMismatch = 0
    for (line in File(dir, "expected.csv").readLines()) {
        val p = line.split(",")
        val dev = p[0].toInt(); val date = p[1]; val ds = p[2].toLong(); val truth = p[3].toLong(); val n = p[4].toInt()
        val evs = events.getOrPut(dev) {
            File(dir, "dev$dev.csv").readLines().map { val q = it.split(","); RawEvent(q[0].toLong(), q[1].toInt(), q.getOrNull(2)?.ifEmpty { null }) }
        }
        val uses = ScreenTimeEngine.deriveUsesKeyguard(evs, true)
        val iv = ScreenTimeEngine.extract(evs, now, uses, setOf("com.android.launcher3"), "br.edu.ifrn.ifscreen")
        val r = ScreenTimeEngine.summarize(iv, date, ds, ds + 86_400_000L, now, ds - 86_400_000L, null, "usagestats", "America/Fortaleza")
        checked++
        val d = Math.abs(r.screenMs - truth)
        if (d == 0L) exact++
        if (d > maxDiff) maxDiff = d
        if (r.sessions.size != n) nMismatch++
    }
    println("Kotlin (app): $checked aparelho-dias, idênticos=$exact, maior diferença=${maxDiff} ms, sessões divergentes=$nMismatch")
    if (exact != checked || nMismatch != 0) System.exit(1)
}
