package br.edu.ifrn.ifscreen

import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Formatação comum (pt-BR). */
object Ui {
    val PT: Locale = Locale("pt", "BR")

    /** Tempo truncado ao minuto, como o Bem-estar Digital exibe: "3 h 42 min". */
    fun dur(ms: Long?): String {
        if (ms == null) return "—"
        val m = ms / 60_000L
        if (m <= 0L) return if (ms > 0) "< 1 min" else "0 min"
        val h = m / 60L
        val r = m % 60L
        return if (h > 0) "$h h ${r.toString().padStart(2, '0')} min" else "$r min"
    }

    fun ago(ts: Long): String {
        if (ts <= 0) return "nunca"
        val s = (System.currentTimeMillis() - ts) / 1000
        return when {
            s < 60 -> "agora"
            s < 3600 -> "há ${s / 60} min"
            s < 86400 -> "há ${s / 3600} h"
            else -> "há ${s / 86400} d"
        }
    }

    fun dayLabel(d: LocalDate): String {
        val s = d.format(DateTimeFormatter.ofPattern("EEE, dd/MM", PT))
        return s.replaceFirstChar { it.titlecase(PT) }
    }

    fun longDay(d: LocalDate): String {
        val s = d.format(DateTimeFormatter.ofPattern("EEEE, d 'de' MMMM", PT))
        return s.replaceFirstChar { it.titlecase(PT) }
    }
}
