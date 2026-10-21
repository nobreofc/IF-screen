package br.edu.ifrn.ifscreen

import android.content.Context
import java.io.File

/**
 * Registro próprio em tempo real (independente do registro do sistema):
 * o serviço grava tela ligada, desligada e desbloqueio (USER_PRESENT) com horário.
 * Usado como conferência cruzada e como reserva se o acesso aos dados de uso for retirado.
 */
object OwnLog {
    const val ON = "ON"
    const val OFF = "OFF"
    const val PRESENT = "PRESENT"
    const val BOOT = "BOOT"
    const val SVC = "SVC"
    private val LOCK = Any()

    private fun file(ctx: Context) = File(ctx.filesDir, "ownlog.txt")

    fun append(ctx: Context, type: String, t: Long = System.currentTimeMillis()) {
        synchronized(LOCK) {
            try { file(ctx).appendText("$t,$type\n") } catch (_: Exception) { }
        }
    }

    fun read(ctx: Context, from: Long): List<Pair<Long, String>> {
        synchronized(LOCK) {
            val f = file(ctx)
            if (!f.exists()) return emptyList()
            val out = ArrayList<Pair<Long, String>>()
            f.forEachLine { line ->
                val i = line.indexOf(',')
                if (i > 0) {
                    val t = line.substring(0, i).toLongOrNull()
                    if (t != null && t >= from) out.add(Pair(t, line.substring(i + 1)))
                }
            }
            return out
        }
    }

    /** Sessões pelo registro próprio: do desbloqueio (USER_PRESENT) até a tela apagar. */
    fun sessions(ctx: Context, from: Long, nowMs: Long): List<LongArray> {
        val out = ArrayList<LongArray>()
        var start = -1L
        for ((t, type) in read(ctx, from)) {
            when (type) {
                PRESENT -> { if (start < 0) start = t }
                OFF, BOOT -> { if (start >= 0 && t > start) out.add(longArrayOf(start, t)); start = -1 }
            }
        }
        if (start >= 0 && nowMs > start) out.add(longArrayOf(start, nowMs))
        return out
    }

    /** Remove linhas com mais de 45 dias. */
    fun prune(ctx: Context) {
        synchronized(LOCK) {
            val f = file(ctx)
            if (!f.exists() || f.length() < 512 * 1024) return
            val limit = System.currentTimeMillis() - 45L * 86_400_000L
            val keep = f.readLines().filter { (it.substringBefore(',').toLongOrNull() ?: 0L) >= limit }
            f.writeText(keep.joinToString("\n", postfix = "\n"))
        }
    }
}
