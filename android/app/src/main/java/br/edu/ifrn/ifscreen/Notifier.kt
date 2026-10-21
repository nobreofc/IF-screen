package br.edu.ifrn.ifscreen

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Notificação diária do questionário (TV e computador do dia anterior). */
object Notifier {
    const val CH_MONITOR = "monitor"
    const val CH_QUEST = "questionario"
    private const val Q_NOTIF_ID = 2001
    const val ACTION_ALARM = "br.edu.ifrn.ifscreen.ALARM"
    private val PT = Locale("pt", "BR")

    fun createChannels(ctx: Context) {
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val mon = NotificationChannel(CH_MONITOR, "Monitoramento ativo", NotificationManager.IMPORTANCE_MIN)
        mon.description = "Aviso fixo de que o IF Screen está medindo o tempo de tela"
        mon.setShowBadge(false)
        val q = NotificationChannel(CH_QUEST, "Questionário diário", NotificationManager.IMPORTANCE_HIGH)
        q.description = "Lembrete diário para responder ao questionário"
        nm.createNotificationChannel(mon)
        nm.createNotificationChannel(q)
    }

    /** Mostra a notificação se a resposta de ontem estiver pendente e já passou do horário configurado. */
    fun checkQuestionnaire(ctx: Context) {
        val prefs = Prefs(ctx)
        val now = LocalDateTime.now(DayStore.zone())
        val today = now.toLocalDate()
        val ref = today.minusDays(1)
        if (ref.isBefore(DayStore.dateOf(prefs.installAt))) return // dia anterior à instalação
        if (DayStore.loadQ(ctx, ref.toString()) != null) { cancel(ctx); return }
        val hour = now.hour
        val todayS = today.toString()
        if (hour >= prefs.reminderHour && prefs.lastReminderDate != todayS && prefs.lastNotifiedDate == todayS) {
            post(ctx, ref.toString(), true)
            prefs.lastReminderDate = todayS
        } else if (hour >= prefs.questionHour && prefs.lastNotifiedDate != todayS) {
            post(ctx, ref.toString(), false)
            prefs.lastNotifiedDate = todayS
        }
        scheduleAlarms(ctx)
    }

    private fun post(ctx: Context, refDate: String, reminder: Boolean) {
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val ref = java.time.LocalDate.parse(refDate)
        val label = ref.format(DateTimeFormatter.ofPattern("EEEE, d 'de' MMMM", PT))
        val i = Intent(ctx, QuestionnaireActivity::class.java).putExtra("refDate", refDate)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pi = PendingIntent.getActivity(ctx, 1, i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val n = Notification.Builder(ctx, CH_QUEST)
            .setSmallIcon(R.drawable.ic_stat_ifscreen)
            .setContentTitle(if (reminder) "Lembrete: questionário de ontem" else "Questionário diário — IF Screen")
            .setContentText("Ontem ($label) você usou TV ou computador? Leva 20 segundos.")
            .setStyle(Notification.BigTextStyle().bigText("Ontem ($label) você usou TV ou computador? Por quanto tempo? Toque para responder — leva 20 segundos."))
            .setContentIntent(pi)
            .setAutoCancel(true)
            .setColor(0xFF2F9E41.toInt())
            .build()
        try { nm.notify(Q_NOTIF_ID, n) } catch (_: SecurityException) { }
    }

    fun cancel(ctx: Context) {
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(Q_NOTIF_ID)
    }

    /** Alarmes inexatos (não exigem permissão especial) no horário do questionário e do lembrete. */
    fun scheduleAlarms(ctx: Context) {
        val prefs = Prefs(ctx)
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val now = LocalDateTime.now(DayStore.zone())
        for ((idx, h) in listOf(prefs.questionHour, prefs.reminderHour).withIndex()) {
            var at = now.toLocalDate().atTime(h, 1)
            if (!at.isAfter(now)) at = at.plusDays(1)
            val ms = at.atZone(DayStore.zone()).toInstant().toEpochMilli()
            val i = Intent(ctx, BootReceiver::class.java).setAction(ACTION_ALARM)
            val pi = PendingIntent.getBroadcast(ctx, 10 + idx, i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            try { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, ms, pi) } catch (_: Exception) { }
        }
    }
}
