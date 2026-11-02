package br.edu.ifrn.ifscreen

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject
import java.security.SecureRandom
import java.util.UUID

/** Preferências e identidade do aparelho. */
class Prefs(ctx: Context) {
    private val sp: SharedPreferences = ctx.applicationContext.getSharedPreferences("ifscreen", Context.MODE_PRIVATE)

    /** Cria identidade (id, código único e token) na primeira execução. */
    fun ensureIdentity() {
        synchronized(LOCK) {
            if (sp.getString("deviceId", null) != null) return
            val rnd = SecureRandom()
            val alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ" // Crockford: sem I, L, O, U
            val sb = StringBuilder()
            repeat(8) { sb.append(alphabet[rnd.nextInt(alphabet.length)]) }
            val code = "IFS-" + sb.substring(0, 4) + "-" + sb.substring(4, 8)
            val tok = ByteArray(32)
            rnd.nextBytes(tok)
            sp.edit()
                .putString("deviceId", UUID.randomUUID().toString())
                .putString("code", code)
                .putString("token", tok.joinToString("") { "%02x".format(it) })
                .putLong("installAt", System.currentTimeMillis())
                .apply()
        }
    }

    val deviceId: String get() = sp.getString("deviceId", "") ?: ""
    val code: String get() = sp.getString("code", "") ?: ""
    val token: String get() = sp.getString("token", "") ?: ""
    val installAt: Long get() = sp.getLong("installAt", System.currentTimeMillis())

    var localUrl: String
        get() = sp.getString("localUrl", "") ?: ""
        set(v) = sp.edit().putString("localUrl", v.trim().trimEnd('/')).apply()

    var relayUrl: String
        get() = sp.getString("relayUrl", BuildConfig.DEFAULT_RELAY_URL) ?: ""
        set(v) = sp.edit().putString("relayUrl", v.trim().trimEnd('/')).apply()

    var linked: Boolean
        get() = sp.getBoolean("linked", false)
        set(v) = sp.edit().putBoolean("linked", v).apply()

    var participant: String
        get() = sp.getString("participant", "") ?: ""
        set(v) = sp.edit().putString("participant", v).apply()

    var centralName: String
        get() = sp.getString("centralName", "Central IF Screen") ?: "Central IF Screen"
        set(v) = sp.edit().putString("centralName", v).apply()

    var questionHour: Int
        get() = sp.getInt("questionHour", 9)
        set(v) = sp.edit().putInt("questionHour", v).apply()

    var reminderHour: Int
        get() = sp.getInt("reminderHour", 20)
        set(v) = sp.edit().putInt("reminderHour", v).apply()

    /** Modo teste: mostrar ao participante o tempo medido. */
    var showScreenTime: Boolean
        get() = sp.getBoolean("showScreenTime", true)
        set(v) = sp.edit().putBoolean("showScreenTime", v).apply()

    var lastSyncAt: Long
        get() = sp.getLong("lastSyncAt", 0)
        set(v) = sp.edit().putLong("lastSyncAt", v).apply()

    var lastSyncChannel: String
        get() = sp.getString("lastSyncChannel", "") ?: ""
        set(v) = sp.edit().putString("lastSyncChannel", v).apply()

    var lastSyncError: String
        get() = sp.getString("lastSyncError", "") ?: ""
        set(v) = sp.edit().putString("lastSyncError", v).apply()

    var lastNotifiedDate: String
        get() = sp.getString("lastNotifiedDate", "") ?: ""
        set(v) = sp.edit().putString("lastNotifiedDate", v).apply()

    var lastReminderDate: String
        get() = sp.getString("lastReminderDate", "") ?: ""
        set(v) = sp.edit().putString("lastReminderDate", v).apply()

    var usesKeyguardHint: Boolean
        get() = sp.getBoolean("usesKeyguardHint", true)
        set(v) = sp.edit().putBoolean("usesKeyguardHint", v).apply()

    /** A Central excluiu os dados deste aparelho a pedido do participante (LGPD) e recusa novos envios. */
    var removedFromStudy: Boolean
        get() = sp.getBoolean("removedFromStudy", false)
        set(v) = sp.edit().putBoolean("removedFromStudy", v).apply()

    // confirmações da Central (versão confirmada por dia / questionário)
    fun acks(kind: String): JSONObject = try { JSONObject(sp.getString("acks_$kind", "{}") ?: "{}") } catch (e: Exception) { JSONObject() }
    fun saveAcks(kind: String, o: JSONObject) = sp.edit().putString("acks_$kind", o.toString()).apply()

    // cache de envio por canal: evita reenviar a mesma versão antes de 6 h
    fun sent(): JSONObject = try { JSONObject(sp.getString("sent", "{}") ?: "{}") } catch (e: Exception) { JSONObject() }
    fun saveSent(o: JSONObject) = sp.edit().putString("sent", o.toString()).apply()

    fun isRegistered(key: String): Boolean = sp.getBoolean("reg_$key", false)
    fun setRegistered(key: String, v: Boolean) = sp.edit().putBoolean("reg_$key", v).apply()

    companion object {
        private val LOCK = Any()
    }
}
