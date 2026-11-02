package br.edu.ifrn.ifscreen

import android.app.KeyguardManager
import android.app.NotificationManager
import android.content.Context
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import org.json.JSONArray
import org.json.JSONObject

/**
 * Sincronização com a Central — mesma lógica de tools/simulator/appClient.js (testado com 100 aparelhos).
 * Ordem de preferência: Central na rede local (in loco) → servidor-ponte na nuvem (Railway).
 * Um dado só é considerado entregue quando a CENTRAL confirma (ack); até lá fica no celular e é reenviado.
 */
object SyncManager {
    private const val RESEND_AFTER_MS = 6L * 3600_000L
    private val LOCK = Any()

    class Channel(val name: String, val base: String)

    data class Result(val ok: Boolean, val channel: String?, val message: String)

    fun syncNow(ctx: Context, reason: String): Result = synchronized(LOCK) {
        val app = ctx.applicationContext
        val prefs = Prefs(app)
        prefs.ensureIdentity()
        try { DayStore.recompute(app) } catch (e: Exception) { /* sem permissão ou erro de leitura: segue com o que há */ }

        if (prefs.removedFromStudy) {
            return Result(false, null, "Este aparelho foi retirado do estudo e não envia mais dados. Você pode desinstalar o IF Screen.")
        }

        val channels = ArrayList<Channel>()
        localChannel(app, prefs)?.let { channels.add(it) }
        if (prefs.relayUrl.isNotBlank()) channels.add(Channel("relay", prefs.relayUrl))
        if (channels.isEmpty()) {
            prefs.lastSyncError = "Nenhuma Central encontrada"
            return Result(false, null, "Nenhuma Central encontrada (rede local ou nuvem)")
        }

        val ok = ArrayList<Channel>()
        var lastErr = ""
        for (ch in channels) {
            try {
                if (!ensureRegistered(prefs, ch, false)) { lastErr = "cadastro recusado (${ch.name})"; continue }
                var st = Http.call(ch.base, "GET", "/api/v1/device/status", null, headers(prefs))
                if (st.status == 401) { // servidor perdeu o cadastro (ex.: reinício da ponte): recadastra
                    if (!ensureRegistered(prefs, ch, true)) continue
                    st = Http.call(ch.base, "GET", "/api/v1/device/status", null, headers(prefs))
                }
                if (st.status != 200) { lastErr = "HTTP ${st.status} (${ch.name})"; continue }
                mergeStatus(prefs, st.body, ch.name)
                ok.add(ch)
            } catch (e: Exception) {
                lastErr = "${ch.name}: ${e.javaClass.simpleName}"
                if (ch.name == "local") prefs.localUrl = "" // será redescoberta na próxima vez
            }
        }

        val now = System.currentTimeMillis()
        for (ch in ok) {
            try {
                val sent = prefs.sent()
                val days = JSONArray()
                val qs = JSONArray()
                val acksDay = prefs.acks("day")
                val acksQ = prefs.acks("q")
                val sentDays = ArrayList<DayResult>()
                val sentQs = ArrayList<Questionnaire>()
                for (d in DayStore.allDays(app)) {
                    if (d.computedAt <= acksDay.optLong(d.date, 0)) continue
                    if (recentlySent(sent, ch.name, "day", d.date, d.computedAt, now)) continue
                    days.put(d.toJson()); sentDays.add(d)
                }
                for (q in DayStore.allQ(app)) {
                    if (q.answeredAt <= acksQ.optLong(q.refDate, 0)) continue
                    if (recentlySent(sent, ch.name, "q", q.refDate, q.answeredAt, now)) continue
                    qs.put(q.toJson()); sentQs.add(q)
                }
                val body = JSONObject().put("days", days).put("questionnaires", qs).put("heartbeat", heartbeat(app, prefs, ch.name))
                val r = Http.call(ch.base, "POST", "/api/v1/device/ingest", body, headers(prefs), 20_000)
                if (r.status != 200) { lastErr = "envio HTTP ${r.status} (${ch.name})"; continue }
                for (d in sentDays) sent.put("${ch.name}|day|${d.date}", JSONObject().put("v", d.computedAt).put("at", now))
                for (q in sentQs) sent.put("${ch.name}|q|${q.refDate}", JSONObject().put("v", q.answeredAt).put("at", now))
                prefs.saveSent(sent)
                if (ch.name == "local") { // a Central local confirma na hora
                    val st = Http.call(ch.base, "GET", "/api/v1/device/status", null, headers(prefs))
                    if (st.status == 200) mergeStatus(prefs, st.body, ch.name)
                }
                prefs.lastSyncAt = now
                prefs.lastSyncChannel = ch.name
                prefs.lastSyncError = ""
                return Result(true, ch.name, if (ch.name == "local") "Enviado pela rede local" else "Enviado pela nuvem")
            } catch (e: Exception) {
                lastErr = "${ch.name}: ${e.javaClass.simpleName}"
            }
        }
        prefs.lastSyncError = lastErr.ifBlank { "sem conexão" }
        return Result(false, null, "Sem conexão com a Central — os dados ficam guardados no celular")
    }

    private fun localChannel(ctx: Context, prefs: Prefs): Channel? {
        if (!Discovery.onLocalNetwork(ctx)) return null
        val saved = prefs.localUrl
        if (saved.isNotBlank()) {
            try {
                val h = Http.call(saved, "GET", "/health", null, emptyMap(), 3_000)
                if (h.status == 200 && h.body.optString("service") == "ifscreen-central") return Channel("local", saved)
            } catch (_: Exception) { }
        }
        val found = Discovery.discover(ctx) ?: return null
        prefs.localUrl = found
        return Channel("local", found)
    }

    private fun headers(p: Prefs) = mapOf(
        "x-device-id" to p.deviceId, "x-device-token" to p.token, "x-app-key" to BuildConfig.APP_KEY
    )

    private fun ensureRegistered(prefs: Prefs, ch: Channel, force: Boolean): Boolean {
        val key = ch.name + "|" + ch.base
        if (!force && prefs.isRegistered(key)) return true
        val info = JSONObject()
            .put("manufacturer", Build.MANUFACTURER).put("model", Build.MODEL)
            .put("androidVersion", Build.VERSION.RELEASE).put("sdk", Build.VERSION.SDK_INT)
            .put("appVersion", BuildConfig.VERSION_NAME)
        val body = JSONObject().put("deviceId", prefs.deviceId).put("code", prefs.code).put("token", prefs.token).put("info", info)
        val r = Http.call(ch.base, "POST", "/api/v1/device/register", body, headers(prefs))
        if (r.status == 410) prefs.removedFromStudy = true // dados excluídos a pedido do participante
        val ok = r.status == 200
        prefs.setRegistered(key, ok)
        return ok
    }

    private fun mergeStatus(prefs: Prefs, st: JSONObject, channel: String) {
        for (kind in listOf("day", "q")) {
            val cur = prefs.acks(kind)
            val inc = st.optJSONObject("acks")?.optJSONObject(kind) ?: JSONObject()
            val it = inc.keys()
            while (it.hasNext()) {
                val k = it.next()
                val v = inc.optLong(k, 0)
                if (v > cur.optLong(k, 0)) cur.put(k, v)
            }
            prefs.saveAcks(kind, cur)
        }
        if (st.optBoolean("linked", false)) {
            prefs.linked = true
            prefs.participant = st.optString("participant", "")
        } else if (channel == "local") {
            prefs.linked = false // a Central local é a fonte da verdade sobre o vínculo
        }
        val cfg = st.optJSONObject("config")
        if (cfg != null) {
            prefs.questionHour = cfg.optInt("questionHour", prefs.questionHour)
            prefs.reminderHour = cfg.optInt("reminderHour", prefs.reminderHour)
            prefs.showScreenTime = cfg.optBoolean("showScreenTime", prefs.showScreenTime)
            val name = cfg.optString("centralName", "")
            if (name.isNotBlank()) prefs.centralName = name
            val relay = cfg.optString("relayUrl", "")
            if (channel == "local" && relay.startsWith("http")) prefs.relayUrl = relay // aprende o endereço da nuvem in loco
        }
    }

    private fun recentlySent(sent: JSONObject, ch: String, kind: String, key: String, v: Long, now: Long): Boolean {
        val s = sent.optJSONObject("$ch|$kind|$key") ?: return false
        return s.optLong("v") == v && now - s.optLong("at") < RESEND_AFTER_MS
    }

    fun heartbeat(ctx: Context, prefs: Prefs, channel: String): JSONObject {
        val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val bm = ctx.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        val km = ctx.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        val autoTime = try { Settings.Global.getInt(ctx.contentResolver, Settings.Global.AUTO_TIME) == 1 } catch (e: Exception) { true }
        return JSONObject()
            .put("appVersion", BuildConfig.VERSION_NAME)
            .put("androidVersion", Build.VERSION.RELEASE)
            .put("sdk", Build.VERSION.SDK_INT)
            .put("manufacturer", Build.MANUFACTURER)
            .put("model", Build.MODEL)
            .put("usageAccess", DayStore.hasUsageAccess(ctx))
            .put("notifPerm", nm.areNotificationsEnabled())
            .put("batteryOptIgnored", pm.isIgnoringBatteryOptimizations(ctx.packageName))
            .put("autoTime", autoTime)
            .put("usesKeyguard", prefs.usesKeyguardHint || km.isDeviceSecure)
            .put("serviceRunning", MonitorService.running)
            .put("battery", bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY))
            .put("tz", DayStore.zone().id)
            .put("channel", channel)
            .put("ts", System.currentTimeMillis())
    }
}
