package br.edu.ifrn.ifscreen

import android.app.AppOpsManager
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Process
import org.json.JSONObject
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

data class Questionnaire(
    val refDate: String,
    val tv: Boolean,
    val tvMin: Int,
    val pc: Boolean,
    val pcMin: Int,
    val answeredAt: Long
) {
    fun toJson(): JSONObject = JSONObject()
        .put("refDate", refDate).put("tv", tv).put("tvMin", tvMin)
        .put("pc", pc).put("pcMin", pcMin).put("answeredAt", answeredAt)

    companion object {
        fun fromJson(o: JSONObject) = Questionnaire(
            o.getString("refDate"), o.optBoolean("tv"), o.optInt("tvMin"),
            o.optBoolean("pc"), o.optInt("pcMin"), o.optLong("answeredAt")
        )
    }
}

/** Armazena localmente os dias calculados e as respostas (nada se perde sem internet). */
object DayStore {
    private val LOCK = Any()

    private fun daysDir(ctx: Context) = File(ctx.filesDir, "days").apply { mkdirs() }
    private fun qDir(ctx: Context) = File(ctx.filesDir, "q").apply { mkdirs() }

    fun zone(): ZoneId = ZoneId.systemDefault()
    fun today(): LocalDate = LocalDate.now(zone())
    fun startOf(d: LocalDate): Long = d.atStartOfDay(zone()).toInstant().toEpochMilli()
    fun dateOf(t: Long): LocalDate = Instant.ofEpochMilli(t).atZone(zone()).toLocalDate()

    fun hasUsageAccess(ctx: Context): Boolean {
        val ops = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        @Suppress("DEPRECATION")
        val mode = ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
        return mode == AppOpsManager.MODE_ALLOWED
    }

    fun launcherPackages(ctx: Context): Set<String> {
        val i = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        @Suppress("DEPRECATION")
        val list = ctx.packageManager.queryIntentActivities(i, PackageManager.MATCH_ALL)
        return list.mapNotNull { it.activityInfo?.packageName }.toSet()
    }

    fun loadDay(ctx: Context, date: String): DayResult? = synchronized(LOCK) {
        val f = File(daysDir(ctx), "$date.json")
        if (!f.exists()) null else try { DayResult.fromJson(JSONObject(f.readText())) } catch (e: Exception) { null }
    }

    fun saveDay(ctx: Context, d: DayResult) = synchronized(LOCK) {
        val f = File(daysDir(ctx), "${d.date}.json")
        val tmp = File(daysDir(ctx), "${d.date}.tmp")
        tmp.writeText(d.toJson().toString())
        tmp.renameTo(f)
    }

    fun allDays(ctx: Context): List<DayResult> = synchronized(LOCK) {
        (daysDir(ctx).listFiles() ?: emptyArray())
            .filter { it.name.endsWith(".json") }
            .mapNotNull { try { DayResult.fromJson(JSONObject(it.readText())) } catch (e: Exception) { null } }
            .sortedBy { it.date }
    }

    fun loadQ(ctx: Context, refDate: String): Questionnaire? = synchronized(LOCK) {
        val f = File(qDir(ctx), "$refDate.json")
        if (!f.exists()) null else try { Questionnaire.fromJson(JSONObject(f.readText())) } catch (e: Exception) { null }
    }

    fun saveQ(ctx: Context, q: Questionnaire) = synchronized(LOCK) {
        File(qDir(ctx), "${q.refDate}.json").writeText(q.toJson().toString())
    }

    fun allQ(ctx: Context): List<Questionnaire> = synchronized(LOCK) {
        (qDir(ctx).listFiles() ?: emptyArray())
            .mapNotNull { try { Questionnaire.fromJson(JSONObject(it.readText())) } catch (e: Exception) { null } }
            .sortedBy { it.refDate }
    }

    /**
     * Recalcula os dias ainda não fechados, do dia da instalação até hoje.
     * Fonte principal: registro de eventos do sistema (sobrevive ao app ser encerrado).
     * Reserva: registro próprio, se o acesso aos dados de uso não estiver concedido.
     */
    fun recompute(ctx: Context): Int {
        val prefs = Prefs(ctx)
        val now = System.currentTimeMillis()
        val tz = zone().id
        val first = dateOf(prefs.installAt)
        val today = today()
        var d = first
        var earliestOpen: LocalDate? = null
        while (!d.isAfter(today)) {
            val stored = loadDay(ctx, d.toString())
            if (stored == null || !stored.complete) { earliestOpen = d; break }
            d = d.plusDays(1)
        }
        if (earliestOpen == null) return 0
        val from = startOf(earliestOpen) - 24L * 3600_000L
        val usage = hasUsageAccess(ctx)
        val iv: Intervals
        val coverageFrom: Long
        val source: String
        if (usage) {
            val (events, firstTs) = ScreenTimeEngine.readSystemEvents(ctx, from, now)
            val km = ctx.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            val hint = prefs.usesKeyguardHint || km.isDeviceSecure
            val uses = ScreenTimeEngine.deriveUsesKeyguard(events, hint)
            prefs.usesKeyguardHint = uses
            iv = ScreenTimeEngine.extract(events, now, uses, launcherPackages(ctx), ctx.packageName)
            coverageFrom = firstTs
            source = "usagestats"
        } else {
            val ss = OwnLog.sessions(ctx, from, now)
            iv = Intervals(ss, emptyList(), emptyList(), emptyList())
            coverageFrom = OwnLog.read(ctx, from).firstOrNull()?.first ?: now
            source = "ownlog"
        }
        val own = OwnLog.sessions(ctx, from, now)
        val ownCovered = OwnLog.read(ctx, from).firstOrNull()?.first ?: Long.MAX_VALUE
        var changed = 0
        d = earliestOpen
        while (!d.isAfter(today)) {
            val ds = startOf(d)
            val de = startOf(d.plusDays(1))
            val stored = loadDay(ctx, d.toString())
            if (stored != null && stored.complete) { d = d.plusDays(1); continue }
            val ownMs = if (ownCovered <= ds) ScreenTimeEngine.sum(ScreenTimeEngine.clip(own, ds, minOf(de, now))) else null
            val r = ScreenTimeEngine.summarize(iv, d.toString(), ds, de, now, coverageFrom, ownMs, source, tz)
            val same = stored != null && stored.screenMs == r.screenMs && stored.complete == r.complete &&
                stored.sessions.size == r.sessions.size && stored.ownLogMs == r.ownLogMs && stored.source == r.source
            if (!same) { saveDay(ctx, r); changed++ }
            d = d.plusDays(1)
        }
        return changed
    }
}
