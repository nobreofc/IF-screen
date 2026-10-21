package br.edu.ifrn.ifscreen

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Algoritmo "ifs-unlock-1" — idêntico a tools/algorithm/screentime.js (testado no simulador).
 *
 * REGRA: conta tempo de tela somente com o aparelho DESBLOQUEADO e a tela LIGADA.
 * Começa no desbloqueio (KEYGUARD_HIDDEN, ou tela ligada se o aparelho não usa bloqueio)
 * e termina no primeiro de: tela apagada, bloqueio exibido, desligamento.
 * Descarta: notificação que acende a tela sem desbloqueio, tela de bloqueio/AOD,
 * digitação de PIN/biometria, áudio/vídeo/ligação com tela apagada, aparelho desligado.
 */
object Ev {
    const val ACTIVITY_RESUMED = 1
    const val ACTIVITY_PAUSED = 2
    const val SCREEN_INTERACTIVE = 15
    const val SCREEN_NON_INTERACTIVE = 16
    const val KEYGUARD_SHOWN = 17
    const val KEYGUARD_HIDDEN = 18
    const val ACTIVITY_STOPPED = 23
    const val DEVICE_SHUTDOWN = 26
    const val DEVICE_STARTUP = 27

    val RELEVANT = setOf(
        ACTIVITY_RESUMED, ACTIVITY_PAUSED, SCREEN_INTERACTIVE, SCREEN_NON_INTERACTIVE,
        KEYGUARD_SHOWN, KEYGUARD_HIDDEN, ACTIVITY_STOPPED, DEVICE_SHUTDOWN, DEVICE_STARTUP
    )
}

data class RawEvent(val t: Long, val type: Int, val pkg: String?)

class Intervals(
    val sessions: List<LongArray>,
    val launcher: List<LongArray>,
    val own: List<LongArray>,
    val offs: List<LongArray>
)

data class DayResult(
    val date: String,
    val screenMs: Long,
    val launcherMs: Long,
    val ownAppMs: Long,
    val deviceOffMs: Long,
    val sessions: List<LongArray>,
    val longSessions: Int,
    val complete: Boolean,
    val partialCoverage: Boolean,
    val ownLogMs: Long?,
    val source: String,
    val tz: String,
    val computedAt: Long
) {
    fun toJson(): JSONObject {
        val arr = JSONArray()
        for (s in sessions) arr.put(JSONArray().put(s[0]).put(s[1]))
        val o = JSONObject()
        o.put("date", date)
        o.put("screenMs", screenMs)
        o.put("launcherMs", launcherMs)
        o.put("ownAppMs", ownAppMs)
        o.put("deviceOffMs", deviceOffMs)
        o.put("sessions", arr)
        o.put("longSessions", longSessions)
        o.put("complete", complete)
        o.put("partialCoverage", partialCoverage)
        if (ownLogMs != null) o.put("ownLogMs", ownLogMs)
        o.put("source", source)
        o.put("algo", ALGO)
        o.put("tz", tz)
        o.put("computedAt", computedAt)
        return o
    }

    companion object {
        const val ALGO = "ifs-unlock-1"

        fun fromJson(o: JSONObject): DayResult {
            val arr = o.optJSONArray("sessions") ?: JSONArray()
            val list = ArrayList<LongArray>(arr.length())
            for (i in 0 until arr.length()) {
                val p = arr.getJSONArray(i)
                list.add(longArrayOf(p.getLong(0), p.getLong(1)))
            }
            return DayResult(
                date = o.getString("date"),
                screenMs = o.optLong("screenMs"),
                launcherMs = o.optLong("launcherMs"),
                ownAppMs = o.optLong("ownAppMs"),
                deviceOffMs = o.optLong("deviceOffMs"),
                sessions = list,
                longSessions = o.optInt("longSessions"),
                complete = o.optBoolean("complete"),
                partialCoverage = o.optBoolean("partialCoverage"),
                ownLogMs = if (o.has("ownLogMs")) o.optLong("ownLogMs") else null,
                source = o.optString("source", "usagestats"),
                tz = o.optString("tz", ""),
                computedAt = o.optLong("computedAt")
            )
        }
    }
}

object ScreenTimeEngine {
    private const val LONG_SESSION_MS = 4L * 3600_000L

    /** Lê o registro de eventos do sistema (UsageStatsManager). Retorna eventos e o timestamp mais antigo disponível. */
    fun readSystemEvents(ctx: Context, from: Long, to: Long): Pair<List<RawEvent>, Long> {
        val usm = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val ue = usm.queryEvents(from, to)
        val out = ArrayList<RawEvent>(8192)
        val e = UsageEvents.Event()
        var first = Long.MAX_VALUE
        while (ue.hasNextEvent()) {
            ue.getNextEvent(e)
            val ts = e.timeStamp
            if (ts < first) first = ts
            val type = e.eventType
            if (type in Ev.RELEVANT) {
                val pkg = if (type == Ev.ACTIVITY_RESUMED || type == Ev.ACTIVITY_PAUSED || type == Ev.ACTIVITY_STOPPED) e.packageName else null
                out.add(RawEvent(ts, type, pkg))
            }
        }
        out.sortBy { it.t }
        return Pair(out, if (first == Long.MAX_VALUE) to else first)
    }

    /** O aparelho usa tela de bloqueio? Se há eventos de bloqueio no histórico, sim; se há telas ligadas mas nenhum bloqueio, não. */
    fun deriveUsesKeyguard(events: List<RawEvent>, hint: Boolean): Boolean {
        var screen = false
        for (ev in events) {
            if (ev.type == Ev.KEYGUARD_SHOWN || ev.type == Ev.KEYGUARD_HIDDEN) return true
            if (ev.type == Ev.SCREEN_INTERACTIVE) screen = true
        }
        return if (screen) false else hint
    }

    fun extract(events: List<RawEvent>, nowMs: Long, usesKeyguardInit: Boolean, launchers: Set<String>, ownPkg: String): Intervals {
        var screenOn = false
        var usesKeyguard = usesKeyguardInit
        var locked = usesKeyguardInit
        var start = -1L
        var fgPkg: String? = null
        var fgStart = -1L
        var offStart = -1L
        val sessions = ArrayList<LongArray>()
        val fg = ArrayList<Pair<LongArray, String>>()
        val offs = ArrayList<LongArray>()

        fun open(t: Long) { if (start < 0 && screenOn && !locked) start = t }
        fun close(t: Long) { if (start >= 0) { if (t > start) sessions.add(longArrayOf(start, t)); start = -1 } }
        fun fgClose(t: Long) {
            val p = fgPkg
            if (p != null) { if (t > fgStart) fg.add(Pair(longArrayOf(fgStart, t), p)); fgPkg = null; fgStart = -1 }
        }

        for (e in events) {
            when (e.type) {
                Ev.SCREEN_INTERACTIVE -> { screenOn = true; open(e.t) }
                Ev.SCREEN_NON_INTERACTIVE -> { close(e.t); screenOn = false }
                Ev.KEYGUARD_SHOWN -> { usesKeyguard = true; close(e.t); locked = true }
                Ev.KEYGUARD_HIDDEN -> { locked = false; open(e.t) }
                Ev.DEVICE_SHUTDOWN -> {
                    close(e.t); fgClose(e.t); screenOn = false; locked = usesKeyguard
                    if (offStart < 0) offStart = e.t
                }
                Ev.DEVICE_STARTUP -> {
                    close(e.t); fgClose(e.t); screenOn = false; locked = usesKeyguard
                    if (offStart >= 0 && e.t > offStart) offs.add(longArrayOf(offStart, e.t))
                    offStart = -1
                }
                Ev.ACTIVITY_RESUMED -> {
                    val p = e.pkg ?: ""
                    if (fgPkg != p) { fgClose(e.t); fgPkg = p; fgStart = e.t }
                }
                Ev.ACTIVITY_PAUSED, Ev.ACTIVITY_STOPPED -> {
                    if (fgPkg != null && fgPkg == e.pkg) fgClose(e.t)
                }
            }
        }
        close(nowMs)
        fgClose(nowMs)
        val launcher = intersect(fg.filter { launchers.contains(it.second) }.map { it.first }, sessions)
        val own = intersect(fg.filter { it.second == ownPkg }.map { it.first }, sessions)
        return Intervals(sessions, launcher, own, offs)
    }

    fun merge(list: List<LongArray>): List<LongArray> {
        val s = list.sortedBy { it[0] }
        val out = ArrayList<LongArray>()
        for (it in s) {
            if (out.isNotEmpty() && it[0] <= out[out.size - 1][1]) {
                val last = out[out.size - 1]
                last[1] = maxOf(last[1], it[1])
            } else out.add(longArrayOf(it[0], it[1]))
        }
        return out
    }

    /** Interseção de a com b (b ordenada e sem sobreposição). */
    fun intersect(aIn: List<LongArray>, b: List<LongArray>): List<LongArray> {
        val a = merge(aIn)
        val out = ArrayList<LongArray>()
        var i = 0
        var j = 0
        while (i < a.size && j < b.size) {
            val s = maxOf(a[i][0], b[j][0])
            val e = minOf(a[i][1], b[j][1])
            if (e > s) out.add(longArrayOf(s, e))
            if (a[i][1] < b[j][1]) i++ else j++
        }
        return out
    }

    fun clip(list: List<LongArray>, a: Long, b: Long): List<LongArray> {
        val out = ArrayList<LongArray>()
        for (it in list) {
            val x = maxOf(it[0], a)
            val y = minOf(it[1], b)
            if (y > x) out.add(longArrayOf(x, y))
        }
        return out
    }

    fun sum(list: List<LongArray>): Long {
        var t = 0L
        for (it in list) t += it[1] - it[0]
        return t
    }

    fun summarize(
        iv: Intervals, date: String, dayStart: Long, dayEnd: Long, nowMs: Long, coverageFrom: Long,
        ownLogMs: Long?, source: String, tz: String
    ): DayResult {
        val end = minOf(dayEnd, nowMs)
        val sessions = clip(iv.sessions, dayStart, end)
        return DayResult(
            date = date,
            screenMs = sum(sessions),
            launcherMs = sum(clip(iv.launcher, dayStart, end)),
            ownAppMs = sum(clip(iv.own, dayStart, end)),
            deviceOffMs = sum(clip(iv.offs, dayStart, end)),
            sessions = sessions,
            longSessions = sessions.count { it[1] - it[0] >= LONG_SESSION_MS },
            complete = nowMs >= dayEnd && coverageFrom <= dayStart,
            partialCoverage = coverageFrom > dayStart,
            ownLogMs = ownLogMs,
            source = source,
            tz = tz,
            computedAt = nowMs
        )
    }
}
